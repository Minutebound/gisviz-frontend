'use client'
/**
 * Growth over time, from the analytics DB (daily_platform_stats, filled hourly by the backend
 * snapshot job). One metric at a time, one line, hover for the day's value. Shows when the last
 * snapshot ran and lets an admin capture now.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, TrendingUp, XCircle } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'

type Point = {
  date: string; users: number; posts: number; likes: number; bookmarks: number; comments: number
  follows: number; open_reports: number; new_users: number; new_posts: number; views: number; viewers: number
}
type Run = { run_id: string; trigger: string; status: string; rows_written: number; error_message: string | null
  started: string; duration_seconds: number | null }

const METRICS: { key: keyof Point; label: string; kind: 'total' | 'daily' }[] = [
  { key: 'views', label: 'Views / day', kind: 'daily' },
  { key: 'viewers', label: 'Viewers / day', kind: 'daily' },
  { key: 'users', label: 'Users', kind: 'total' },
  { key: 'posts', label: 'Posts', kind: 'total' },
  { key: 'new_users', label: 'Sign-ups / day', kind: 'daily' },
  { key: 'new_posts', label: 'New posts / day', kind: 'daily' },
  { key: 'likes', label: 'Likes', kind: 'total' },
  { key: 'comments', label: 'Comments', kind: 'total' },
]
const RANGES = [30, 90, 365]

const W = 760, H = 220, PAD = { l: 44, r: 12, t: 12, b: 26 }
const nice = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)
const day = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

function LineChart({ points, metric, label }: { points: Point[]; metric: keyof Point; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const vals = points.map(p => Number(p[metric]) || 0)
  const max = Math.max(1, ...vals)
  const top = (() => { const m = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / m) * m })()
  const x = (i: number) => PAD.l + (points.length < 2 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (points.length - 1))
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top)
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ticks = [0, top / 2, top]
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  const onMove = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1))
    setHover(Math.min(points.length - 1, Math.max(0, i)))
  }

  return (
    <div className="relative">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-none" role="img"
           aria-label={`${label} per day`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-gisviz-border" strokeWidth={1} strokeDasharray={t ? '2 4' : undefined} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="fill-gisviz-ink-soft font-mono text-[11px]">{nice(t)}</text>
          </g>
        ))}
        {points.map((p, i) => i % labelEvery === 0 || i === points.length - 1 ? (
          <text key={p.date} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                className="fill-gisviz-ink-soft font-mono text-[11px]">{day(p.date)}</text>
        ) : null)}
        <path d={path} fill="none" className="stroke-gisviz-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.length === 1 && <circle cx={x(0)} cy={y(vals[0])} r={4} className="fill-gisviz-accent" />}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="stroke-gisviz-ink-soft" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(vals[hover])} r={4.5} className="fill-gisviz-accent stroke-gisviz-card" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 rounded-md border border-gisviz-border bg-gisviz-card px-2.5 py-1.5 shadow-sm"
             style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) > W * 0.7 ? '-105%' : '8px'})` }}>
          <p className="font-mono text-[11px] text-gisviz-ink-soft">{day(points[hover].date)}</p>
          <p className="text-[13px] font-semibold text-gisviz-ink">{vals[hover].toLocaleString()} <span className="font-normal text-gisviz-ink-soft">{label.toLowerCase()}</span></p>
        </div>
      )}
    </div>
  )
}

export default function GrowthPanel({ trigger }: { trigger: number }) {
  const [range, setRange] = useState(90)
  const [metric, setMetric] = useState<keyof Point>('views')
  const [data, setData] = useState<{ points: Point[]; last_snapshot: string | null; stale_warning: string | null } | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [d, r] = await Promise.all([gisvizApi.adminFetchTrendsDaily(range), gisvizApi.adminFetchSnapshotRuns(5)])
      setData(d); setRuns(r)
    } catch { setError('Could not load the daily history.') }
  }, [range])
  useEffect(() => { if (trigger > 0) load() }, [trigger, load])

  const capture = async () => {
    setBusy(true)
    try { await gisvizApi.adminRunSnapshot(); await load() } catch { setError('The snapshot did not run.') } finally { setBusy(false) }
  }

  const m = METRICS.find(x => x.key === metric)!
  const points = data?.points ?? []
  const summary = useMemo(() => {
    if (!points.length) return null
    const vals = points.map(p => Number(p[metric]) || 0)
    return m.kind === 'total'
      ? { main: vals[vals.length - 1], sub: `${vals[vals.length - 1] - vals[0] >= 0 ? '+' : ''}${(vals[vals.length - 1] - vals[0]).toLocaleString()} in ${points.length} days` }
      : { main: vals.reduce((a, b) => a + b, 0), sub: `in ${points.length} days · best day ${Math.max(...vals).toLocaleString()}` }
  }, [points, metric, m.kind])

  return (
    <section className="mb-8 overflow-hidden rounded-sm border border-gisviz-border bg-gisviz-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gisviz-border bg-gisviz-canvas/50 px-5 py-3">
        <h2 className="flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-widest text-gisviz-ink">
          <TrendingUp size={13} className="text-gisviz-accent" /> Growth
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select value={metric} onChange={e => setMetric(e.target.value as keyof Point)}
                  className="h-7 rounded border border-gisviz-border bg-gisviz-card px-2 font-mono text-[12px] text-gisviz-ink">
            {METRICS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button key={r} onClick={() => setRange(r)}
                      className={`rounded px-2 py-0.5 font-mono text-[12px] ${range === r ? 'bg-gisviz-accent text-white' : 'border border-gisviz-border bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink'}`}>{r}d</button>
            ))}
          </div>
          <button onClick={capture} disabled={busy} title="Capture today's numbers now (also runs every hour)"
                  className="inline-flex h-7 items-center gap-1.5 rounded border border-gisviz-border bg-gisviz-card px-2 font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent disabled:opacity-50">
            <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Capture now
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {error && <p className="mb-3 text-[12.5px] text-gisviz-alert">{error}</p>}
        {!data ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-gisviz-accent" /></div>
        ) : points.length === 0 ? (
          <p className="py-10 text-center font-mono text-[12px] text-gisviz-ink-soft">{data.stale_warning ?? 'No days captured yet.'}</p>
        ) : (
          <>
            {summary && (
              <p className="mb-2 flex items-baseline gap-2">
                <span className="font-display text-[24px] font-bold text-gisviz-ink">{summary.main.toLocaleString()}</span>
                <span className="font-mono text-[12px] text-gisviz-ink-soft">{m.label.replace(' / day', '').toLowerCase()}{m.kind === 'daily' ? ' ' : ' · '}{summary.sub}</span>
              </p>
            )}
            <LineChart points={points} metric={metric} label={m.label.replace(' / day', '')} />
          </>
        )}
        {data && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gisviz-border/60 pt-3 font-mono text-[11.5px] text-gisviz-ink-soft">
            {data.stale_warning
              ? <span className="inline-flex items-center gap-1 text-gisviz-alert"><AlertTriangle size={12} /> {data.stale_warning}</span>
              : <span>Last snapshot {data.last_snapshot ? new Date(data.last_snapshot).toLocaleString() : '—'} · runs every hour</span>}
            {runs.slice(0, 5).map(r => (
              <span key={r.run_id} className="inline-flex items-center gap-1" title={r.error_message ?? `${r.rows_written} rows`}>
                {r.status === 'success' ? <CheckCircle2 size={12} className="text-gisviz-safe" /> : r.status === 'failed' ? <XCircle size={12} className="text-gisviz-alert" /> : <Loader2 size={12} className="animate-spin" />}
                {new Date(r.started).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} {r.trigger}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}