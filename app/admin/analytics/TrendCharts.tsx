'use client'

/**
 * app/admin/analytics/TrendCharts.tsx
 *
 * NO auto-fetch on mount. Data only loads when the parent page's
 * "Load Data / Refresh" button is clicked, which calls loadAll()
 * and passes the result in via the `externalTrigger` prop.
 *
 * The component accepts an optional `triggerLoad` prop (a number that
 * increments each time the parent wants a refresh). When it changes,
 * TrendCharts fetches. This way the parent controls ALL fetching —
 * the chart never fires a request on its own.
 */

import React, { useState, useEffect } from 'react'
import { TrendingUp, AlertTriangle, Loader2, Database } from 'lucide-react'
import { gisvizApi } from '../../../services/api'

type Point = {
  date: string
  total_users: number
  total_posts: number
  total_likes: number
  total_bookmarks: number
  total_comments: number
  total_follows: number
  open_reports: number
  new_users: number
  new_posts: number
}

const SERIES = [
  { key: 'total_users'    as keyof Point, label: 'Users',     color: '#2b6cb0' },
  { key: 'total_posts'    as keyof Point, label: 'Posts',     color: '#2f855a' },
  { key: 'total_comments' as keyof Point, label: 'Comments',  color: '#c05621' },
  { key: 'new_users'      as keyof Point, label: 'New users', color: '#6b46c1' },
]

const RANGES = [30, 90, 180, 365]

interface TrendChartsProps {
  /** Increments each time the parent wants charts to reload. 0 = never load. */
  triggerLoad?: number
}

export default function TrendCharts({ triggerLoad = 0 }: TrendChartsProps) {
  const [points, setPoints]   = useState<Point[]>([])
  const [loading, setLoading] = useState(false)   // false — never auto-loads
  const [days, setDays]       = useState(90)
  const [stale, setStale]     = useState<string | null>(null)
  const [active, setActive]   = useState<keyof Point>('total_users')
  const [hasLoaded, setHasLoaded] = useState(false)

  // Only fetches when triggerLoad changes AND is > 0
  // Days filter change also re-fetches, but only after the first load
  useEffect(() => {
    if (triggerLoad === 0) return   // no trigger yet — stay empty
    let alive = true
    setLoading(true)
    gisvizApi.adminFetchTrendsDaily(days)
      .then((res: any) => {
        if (!alive) return
        setPoints(res.points || [])
        setStale(res.stale_warning || null)
        setHasLoaded(true)
      })
      .catch(() => { if (alive) setPoints([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [triggerLoad, days])   // re-runs when parent triggers OR days filter changes

  const activeSeries = SERIES.find(s => s.key === active)!

  return (
    <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm mb-8">

      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/50 flex-wrap gap-3">
        <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest flex items-center gap-2">
          <span className="text-gisviz-accent"><TrendingUp size={14} /></span>
          Growth Trends
          <span className="text-gisviz-ink-soft normal-case font-normal tracking-normal ml-1">
            — snapshot history
          </span>
        </h2>
        {hasLoaded && (
          <div className="flex items-center gap-1">
            {RANGES.map(r => (
              <button key={r} onClick={() => setDays(r)}
                className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
                  days === r
                    ? 'bg-gisviz-accent/10 text-gisviz-accent font-bold'
                    : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
                {r}d
              </button>
            ))}
          </div>
        )}
      </div>

      {/* staleness warning */}
      {stale && (
        <div className="mx-6 mt-4 p-2.5 bg-yellow-50 border border-yellow-200 rounded text-[11px] font-mono text-yellow-700 flex items-center gap-2">
          <AlertTriangle size={13} /> {stale}
        </div>
      )}

      <div className="p-6">
        {/* Not yet triggered */}
        {!hasLoaded && !loading && (
          <div className="flex flex-col items-center gap-2 py-10 text-gisviz-ink-soft">
            <Database size={22} className="opacity-30" />
            <p className="font-mono text-[12px]">Trend data will appear after clicking <strong className="text-gisviz-ink">Load Data</strong>.</p>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-gisviz-accent" />
          </div>
        )}

        {hasLoaded && !loading && points.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-gisviz-ink-soft">
            <Database size={22} />
            <p className="font-mono text-[12px]">No snapshot data yet.</p>
            <p className="font-mono text-[11px]">Materialize <code className="bg-gisviz-canvas px-1 rounded">daily_snapshot</code> in Dagit first.</p>
          </div>
        )}

        {hasLoaded && !loading && points.length > 0 && (
          <>
            {/* series selector */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {SERIES.map(s => (
                <button key={String(s.key)} onClick={() => setActive(s.key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded font-mono text-[11px] transition-colors border ${
                    active === s.key
                      ? 'border-transparent font-bold bg-gisviz-canvas text-gisviz-ink'
                      : 'border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
                  <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>

            <LineChart points={points} seriesKey={active} color={activeSeries.color} />

            <p className="mt-3 text-[11px] font-mono text-gisviz-ink-soft text-right">
              {points.length} snapshot{points.length !== 1 ? 's' : ''} · {points[0]?.date} → {points[points.length - 1]?.date}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Inline SVG line chart ──────────────────────────────────────────────────────
function LineChart({
  points, seriesKey, color,
}: { points: Point[]; seriesKey: keyof Point; color: string }) {
  const W = 680, H = 220, PAD = { t: 12, r: 14, b: 26, l: 52 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b

  const vals = points.map(p => Number(p[seriesKey]) || 0)
  const max  = Math.max(...vals, 1)
  const min  = Math.min(...vals, 0)
  const span = max - min || 1
  const n    = points.length

  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => PAD.t + ih - ((v - min) / span) * ih

  const line = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${(PAD.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`

  const ticks = 5
  const fmt   = (v: number) =>
    v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M'
    : v >= 1_000   ? (v / 1_000).toFixed(1) + 'K'
    : String(Math.round(v))
  const labelEvery = Math.max(1, Math.ceil(n / 7))
  const gradId = `tg-${String(seriesKey)}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: ticks }, (_, k) => {
        const v = min + (span * k) / (ticks - 1)
        const yy = y(v)
        return (
          <g key={k}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy} stroke="#8888880f" strokeWidth="1" />
            <text x={PAD.l - 6} y={yy + 4} textAnchor="end"
                  fill="currentColor" opacity="0.45"
                  style={{ fontSize: 10, fontFamily: 'monospace' }}>
              {fmt(v)}
            </text>
          </g>
        )
      })}
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={color}>
          <title>{points[i].date}: {fmt(v)}</title>
        </circle>
      ))}
      {points.map((p, i) => i % labelEvery === 0 ? (
        <text key={i} x={x(i)} y={H - 4} textAnchor="middle"
              fill="currentColor" opacity="0.4"
              style={{ fontSize: 9, fontFamily: 'monospace' }}>
          {p.date.slice(5)}
        </text>
      ) : null)}
    </svg>
  )
}