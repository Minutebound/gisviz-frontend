'use client'

/**
 * app/components/visuals/D3Chart.tsx
 *
 * Every chart type of the post visual, drawn with D3 (scales, shapes, layouts) and
 * rendered by React as SVG, so it follows the page theme and the post's theme colour.
 *
 *   line · area · bar · hbar · stacked · scatter · bubble · histogram · donut · treemap · heatmap
 *
 * Row shapes (built by the backend, see visual_service.chart_rows):
 *   line / area / bar / hbar / donut / treemap   { [x]: label, [field]: number, ... }  one row per x
 *   stacked / heatmap                             { [x]: label, [z]: series, [y]: number }
 *   scatter / bubble                              raw rows with numeric x, y (and size)
 *   histogram                                     { bin, x0, x1, count }
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

export type D3ChartType =
  | 'line' | 'area' | 'bar' | 'hbar' | 'stacked' | 'scatter'
  | 'bubble' | 'histogram' | 'donut' | 'treemap' | 'heatmap'

type Row = Record<string, unknown>

/** Series colours after the post accent. Keep in sync with PALETTE in visual_image.py. */
const PALETTE = ['#3b7ea1', '#d4a017', '#5b8c5a', '#8e5ea2', '#c0504d', '#2a9d8f', '#e76f51', '#6d6875']

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}
const compact = (n: number) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(n)
const full = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 })
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const ISO_DATE = /^\d{4}-\d{2}(-\d{2})?([T ].*)?$/

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      setSize({ width: Math.round(r.width), height: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/** Blend hex colour a towards b by t (0..1). */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

type Tip = { x: number; y: number; title: string; lines: [string, string][] } | null

interface Props {
  rows: Row[]
  type: D3ChartType
  x: string
  /** Numeric column plotted (the viewer can switch it for grouped charts). */
  y: string
  z?: string
  size?: string
  accent: string
}

export default function D3Chart({ rows, type, x, y, z, size, accent }: Props) {
  const [wrap, { width, height }] = useSize<HTMLDivElement>()
  const [tip, setTip] = useState<Tip>(null)

  const show = (e: React.MouseEvent | React.PointerEvent, title: string, lines: [string, string][]) => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box) return
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title, lines })
  }
  const hide = () => setTip(null)

  return (
    <div ref={wrap} className="relative h-full w-full select-none text-gisviz-ink-soft">
      {width > 40 && height > 40 && (
        <svg width={width} height={height} role="img" aria-label={`${type} chart of ${y}`}
             className="block overflow-visible" onMouseLeave={hide}>
          {type === 'line' || type === 'area' ? <TimeSeries {...{ rows, x, y, accent, width, height, area: type === 'area', show, hide }} />
            : type === 'bar' ? <Bars {...{ rows, x, y, accent, width, height, show, hide }} />
            : type === 'hbar' ? <HBars {...{ rows, x, y, accent, width, height, show, hide }} />
            : type === 'stacked' ? <Stacked {...{ rows, x, y, z: z!, accent, width, height, show, hide }} />
            : type === 'scatter' || type === 'bubble' ? <Scatter {...{ rows, x, y, size: type === 'bubble' ? size : undefined, accent, width, height, show, hide }} />
            : type === 'histogram' ? <Histogram {...{ rows, y, accent, width, height, show, hide }} />
            : type === 'donut' ? <Donut {...{ rows, x, y, accent, width, height, show, hide }} />
            : type === 'treemap' ? <Treemap {...{ rows, x, y, accent, width, height, show, hide }} />
            : type === 'heatmap' ? <Heatmap {...{ rows, x, y, z: z!, accent, width, height, show, hide }} />
            : null}
        </svg>
      )}
      {tip && (
        <div className="pointer-events-none absolute z-10 min-w-[120px] max-w-[260px] rounded-[8px] border border-gisviz-border bg-gisviz-card px-2.5 py-2 text-[12px] text-gisviz-ink shadow-lg"
             style={{ left: Math.min(tip.x + 14, Math.max(0, width - 200)), top: Math.max(0, tip.y - 12) }}>
          <div className="mb-0.5 font-semibold">{tip.title}</div>
          {tip.lines.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 font-mono text-[11.5px] text-gisviz-ink-soft">
              <span>{k}</span><span className="text-gisviz-ink">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── shared pieces ───────────────────────── */

interface Shared {
  rows: Row[]; accent: string; width: number; height: number
  show: (e: React.MouseEvent | React.PointerEvent, title: string, lines: [string, string][]) => void
  hide: () => void
}

const Grid = ({ ticks, y, w }: { ticks: number[]; y: (v: number) => number; w: number }) => (
  <g>{ticks.map(t => <line key={t} x1={0} x2={w} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.14} />)}</g>
)

const YAxis = ({ ticks, y, label }: { ticks: number[]; y: (v: number) => number; label?: string }) => (
  <g fontSize={11} fill="currentColor">
    {ticks.map(t => <text key={t} x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle">{compact(t)}</text>)}
    {label && <text transform="rotate(-90)" x={-8} y={-44} textAnchor="end" fontSize={11}>{trunc(label, 28)}</text>}
  </g>
)

function labelStep(count: number, room: number, each = 56) {
  return Math.max(1, Math.ceil(count / Math.max(1, Math.floor(room / each))))
}

function Frame({ width, height, left = 56, right = 16, top = 12, bottom = 40, children }: {
  width: number; height: number; left?: number; right?: number; top?: number; bottom?: number
  children: (w: number, h: number) => React.ReactNode
}) {
  const w = Math.max(10, width - left - right), h = Math.max(10, height - top - bottom)
  return <g transform={`translate(${left},${top})`}>{children(w, h)}</g>
}

/* ───────────────────────── line / area ───────────────────────── */

function TimeSeries({ rows, x, y, accent, width, height, area, show, hide }: Shared & { x: string; y: string; area: boolean }) {
  const pts = useMemo(() => rows
    .map(r => ({ label: String(r[x] ?? ''), v: toNum(r[y]) }))
    .filter((p): p is { label: string; v: number } => p.v !== null), [rows, x, y])
  const [hover, setHover] = useState<{ label: string; v: number } | null>(null)
  const isTime = pts.length > 0 && pts.every(p => ISO_DATE.test(p.label))
  const isNum = !isTime && pts.length > 0 && pts.every(p => toNum(p.label) !== null)
  const L = 56, T = 12
  const w = Math.max(10, width - L - 16), h = Math.max(10, height - T - 40)
  if (!pts.length) return null

  const xs = isTime ? d3.scaleTime().domain(d3.extent(pts, p => new Date(p.label)) as [Date, Date]).range([0, w])
    : isNum ? d3.scaleLinear().domain(d3.extent(pts, p => toNum(p.label)!) as [number, number]).nice().range([0, w])
    : d3.scalePoint<string>().domain(pts.map(p => p.label)).range([0, w]).padding(0.4)
  const px = (p: { label: string }): number =>
    isTime ? (xs as d3.ScaleTime<number, number>)(new Date(p.label))
    : isNum ? (xs as d3.ScaleLinear<number, number>)(toNum(p.label)!)
    : (xs as d3.ScalePoint<string>)(p.label) ?? 0
  const lo = Math.min(0, d3.min(pts, p => p.v)!), hi = Math.max(0, d3.max(pts, p => p.v)!)
  const ys = d3.scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).nice().range([h, 0])
  const ticks = ys.ticks(5)
  const line = d3.line<typeof pts[number]>().x(px).y(p => ys(p.v)).curve(d3.curveMonotoneX)(pts) ?? ''
  const areaPath = d3.area<typeof pts[number]>().x(px).y0(ys(0)).y1(p => ys(p.v)).curve(d3.curveMonotoneX)(pts) ?? ''
  const step = labelStep(pts.length, w)
  const monthly = pts.every(p => p.label.endsWith('-01') || p.label.length <= 7)
  const fmtDate = d3.timeFormat(monthly ? '%b %Y' : '%d %b %Y')

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const mx = e.clientX - e.currentTarget.getBoundingClientRect().left
    let best = pts[0], bd = Infinity
    for (const p of pts) { const d = Math.abs(px(p) - mx); if (d < bd) { bd = d; best = p } }
    setHover(best)
    show(e, isTime ? fmtDate(new Date(best.label)) : best.label, [[y, full(best.v)]])
  }

  return (
    <g transform={`translate(${L},${T})`}>
      <Grid ticks={ticks} y={ys} w={w} />
      <YAxis ticks={ticks} y={ys} label={y} />
      {area && <path d={areaPath} fill={accent} fillOpacity={0.18} />}
      <path d={line} fill="none" stroke={accent} strokeWidth={2.4} strokeLinejoin="round" />
      {pts.length <= 60 && pts.map((p, i) => <circle key={i} cx={px(p)} cy={ys(p.v)} r={3} fill={accent} />)}
      <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 18})`}>
        {isTime || isNum
          ? (xs as d3.ScaleTime<number, number>).ticks(Math.max(2, Math.floor(w / 90))).map((t, i) => (
              <text key={i} x={(xs as d3.ScaleTime<number, number>)(t)} textAnchor="middle">
                {isTime ? d3.timeFormat(monthly ? '%b %Y' : '%d %b')(t as Date) : compact(Number(t))}
              </text>))
          : pts.map((p, i) => i % step === 0 && (
              <text key={i} x={px(p)} textAnchor="middle">{trunc(p.label, 12)}</text>))}
      </g>
      {hover && (
        <g pointerEvents="none">
          <line x1={px(hover)} x2={px(hover)} y1={0} y2={h} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
          <circle cx={px(hover)} cy={ys(hover.v)} r={5} fill={accent} stroke="white" strokeWidth={2} />
        </g>
      )}
      <rect width={w} height={h} fill="transparent" onMouseMove={onMove} onMouseLeave={() => { setHover(null); hide() }} />
    </g>
  )
}

/* ───────────────────────── bar / horizontal bar ───────────────────────── */

function Bars({ rows, x, y, accent, width, height, show, hide }: Shared & { x: string; y: string }) {
  const data = useMemo(() => rows.map(r => ({ label: String(r[x] ?? ''), v: toNum(r[y]) })).filter(d => d.v !== null) as { label: string; v: number }[], [rows, x, y])
  const [hot, setHot] = useState<number | null>(null)
  const long = Math.max(0, ...data.map(d => d.label.length)) > 6 && data.length > 6
  return (
    <Frame width={width} height={height} bottom={long ? 74 : 40}>
      {(w, h) => {
        const xs = d3.scaleBand<string>().domain(data.map(d => d.label)).range([0, w]).padding(0.22)
        const lo = Math.min(0, d3.min(data, d => d.v) ?? 0), hi = Math.max(0, d3.max(data, d => d.v) ?? 1)
        const ys = d3.scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).nice().range([h, 0])
        const ticks = ys.ticks(5)
        const step = labelStep(data.length, w, long ? 22 : 56)
        return (
          <>
            <Grid ticks={ticks} y={ys} w={w} />
            <YAxis ticks={ticks} y={ys} label={y} />
            {data.map((d, i) => (
              <rect key={i} x={xs(d.label)} width={xs.bandwidth()} y={Math.min(ys(d.v), ys(0))} height={Math.abs(ys(0) - ys(d.v))}
                    rx={2} fill={accent} fillOpacity={hot === null || hot === i ? 1 : 0.45}
                    onMouseMove={e => { setHot(i); show(e, d.label, [[y, full(d.v)]]) }} onMouseLeave={() => { setHot(null); hide() }} />
            ))}
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {data.map((d, i) => i % step === 0 && (
                <text key={i} x={(xs(d.label) ?? 0) + xs.bandwidth() / 2} textAnchor={long ? 'end' : 'middle'}
                      transform={long ? `rotate(-35 ${(xs(d.label) ?? 0) + xs.bandwidth() / 2} 0)` : undefined}>
                  {trunc(d.label, long ? 16 : 12)}
                </text>
              ))}
            </g>
          </>
        )
      }}
    </Frame>
  )
}

function HBars({ rows, x, y, accent, width, height, show, hide }: Shared & { x: string; y: string }) {
  const data = useMemo(() => rows.map(r => ({ label: String(r[x] ?? ''), v: toNum(r[y]) })).filter(d => d.v !== null) as { label: string; v: number }[], [rows, x, y])
  const [hot, setHot] = useState<number | null>(null)
  const left = Math.min(180, Math.max(60, Math.max(0, ...data.map(d => d.label.length)) * 6.4 + 14))
  return (
    <Frame width={width} height={height} left={left} right={48} bottom={34}>
      {(w, h) => {
        const ys = d3.scaleBand<string>().domain(data.map(d => d.label)).range([0, h]).padding(0.2)
        const hi = Math.max(1, d3.max(data, d => d.v) ?? 1)
        const xs = d3.scaleLinear().domain([Math.min(0, d3.min(data, d => d.v) ?? 0), hi]).nice().range([0, w])
        const ticks = xs.ticks(5)
        return (
          <>
            <g>{ticks.map(t => <line key={t} y1={0} y2={h} x1={xs(t)} x2={xs(t)} stroke="currentColor" strokeOpacity={0.14} />)}</g>
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {ticks.map(t => <text key={t} x={xs(t)} textAnchor="middle">{compact(t)}</text>)}
              <text x={w} y={14} textAnchor="end">{trunc(y, 28)}</text>
            </g>
            {data.map((d, i) => (
              <g key={i} onMouseMove={e => { setHot(i); show(e, d.label, [[y, full(d.v)]]) }} onMouseLeave={() => { setHot(null); hide() }}>
                <text x={-8} y={(ys(d.label) ?? 0) + ys.bandwidth() / 2} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="currentColor">{trunc(d.label, 26)}</text>
                <rect x={Math.min(xs(0), xs(d.v))} y={ys(d.label)} height={ys.bandwidth()} width={Math.abs(xs(d.v) - xs(0))}
                      rx={2} fill={accent} fillOpacity={hot === null || hot === i ? 1 : 0.45} />
                <text x={xs(d.v) + 6} y={(ys(d.label) ?? 0) + ys.bandwidth() / 2} dominantBaseline="middle" fontSize={10.5} fill="currentColor">{compact(d.v)}</text>
              </g>
            ))}
          </>
        )
      }}
    </Frame>
  )
}

/* ───────────────────────── stacked bar ───────────────────────── */

function Stacked({ rows, x, y, z, accent, width, height, show, hide }: Shared & { x: string; y: string; z: string }) {
  const { xsKeys, zsKeys, table } = useMemo(() => {
    const xsKeys = [...new Set(rows.map(r => String(r[x] ?? '')))]
    const totals = new Map<string, number>()
    for (const r of rows) totals.set(String(r[z]), (totals.get(String(r[z])) ?? 0) + (toNum(r[y]) ?? 0))
    const zsKeys = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    const table = new Map<string, Record<string, number>>()
    for (const k of xsKeys) table.set(k, {})
    for (const r of rows) table.get(String(r[x] ?? ''))![String(r[z])] = toNum(r[y]) ?? 0
    return { xsKeys, zsKeys, table }
  }, [rows, x, y, z])
  const colors = [accent, ...PALETTE]
  const [hot, setHot] = useState<string | null>(null)
  return (
    <Frame width={width} height={height} top={30} bottom={xsKeys.length > 8 ? 70 : 40}>
      {(w, h) => {
        const xs = d3.scaleBand<string>().domain(xsKeys).range([0, w]).padding(0.22)
        const objs = xsKeys.map(k => ({ __x: k, ...table.get(k)! }) as any)
        const series = d3.stack<any>().keys(zsKeys).value((d, k) => d[k] ?? 0)(objs)
        const hi = d3.max(series, s => d3.max(s, d => d[1])) ?? 1
        const ys = d3.scaleLinear().domain([0, hi]).nice().range([h, 0])
        const ticks = ys.ticks(5)
        const step = labelStep(xsKeys.length, w, 44)
        return (
          <>
            <g fontSize={11} fill="currentColor" transform="translate(0,-16)">
              {zsKeys.map((k, i) => (
                <g key={k} transform={`translate(${i * 110},0)`} onMouseEnter={() => setHot(k)} onMouseLeave={() => setHot(null)}>
                  <rect width={10} height={10} y={-9} rx={2} fill={colors[i % colors.length]} />
                  <text x={15}>{trunc(k, 12)}</text>
                </g>
              ))}
            </g>
            <Grid ticks={ticks} y={ys} w={w} />
            <YAxis ticks={ticks} y={ys} label={y} />
            {series.map((s, si) => (
              <g key={s.key} fill={colors[si % colors.length]} fillOpacity={hot === null || hot === s.key ? 1 : 0.35}>
                {s.map((d: any) => (
                  <rect key={d.data.__x} x={xs(d.data.__x)} width={xs.bandwidth()} y={ys(d[1])} height={Math.max(0, ys(d[0]) - ys(d[1]))}
                        onMouseMove={e => { setHot(s.key); show(e, `${d.data.__x} · ${s.key}`, [[y, full(d[1] - d[0])], ['total', full(d3.sum(zsKeys, k => d.data[k] ?? 0))]]) }}
                        onMouseLeave={() => { setHot(null); hide() }} />
                ))}
              </g>
            ))}
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {xsKeys.map((k, i) => i % step === 0 && (
                <text key={k} x={(xs(k) ?? 0) + xs.bandwidth() / 2} textAnchor={xsKeys.length > 8 ? 'end' : 'middle'}
                      transform={xsKeys.length > 8 ? `rotate(-35 ${(xs(k) ?? 0) + xs.bandwidth() / 2} 0)` : undefined}>{trunc(k, 14)}</text>
              ))}
            </g>
          </>
        )
      }}
    </Frame>
  )
}

/* ───────────────────────── scatter / bubble ───────────────────────── */

function Scatter({ rows, x, y, size, accent, width, height, show, hide }: Shared & { x: string; y: string; size?: string }) {
  const pts = useMemo(() => rows.map(r => ({ r, a: toNum(r[x]), b: toNum(r[y]), s: size ? toNum(r[size]) : 1 }))
    .filter((p): p is { r: Row; a: number; b: number; s: number } => p.a !== null && p.b !== null && p.s !== null), [rows, x, y, size])
  const [hot, setHot] = useState<number | null>(null)
  return (
    <Frame width={width} height={height} bottom={44}>
      {(w, h) => {
        if (!pts.length) return null
        const xs = d3.scaleLinear().domain(d3.extent(pts, p => p.a) as [number, number]).nice().range([0, w])
        const ys = d3.scaleLinear().domain(d3.extent(pts, p => p.b) as [number, number]).nice().range([h, 0])
        const rs = d3.scaleSqrt().domain(d3.extent(pts, p => p.s) as [number, number]).range([3, Math.min(22, Math.max(10, w / 24))])
        const yt = ys.ticks(5), xt = xs.ticks(Math.max(3, Math.floor(w / 80)))
        const label = (r: Row) => String(Object.values(r).find(v => typeof v === 'string' && v.length < 40) ?? '')
        return (
          <>
            <Grid ticks={yt} y={ys} w={w} />
            <g>{xt.map(t => <line key={t} y1={0} y2={h} x1={xs(t)} x2={xs(t)} stroke="currentColor" strokeOpacity={0.08} />)}</g>
            <YAxis ticks={yt} y={ys} label={y} />
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {xt.map(t => <text key={t} x={xs(t)} textAnchor="middle">{compact(t)}</text>)}
              <text x={w} y={16} textAnchor="end">{trunc(size ? `${x}  ·  bubble size = ${size}` : x, 48)}</text>
            </g>
            {pts.map((p, i) => (
              <circle key={i} cx={xs(p.a)} cy={ys(p.b)} r={size ? rs(p.s) : 4.5} fill={accent} fillOpacity={size ? 0.5 : 0.7}
                      stroke={accent} strokeWidth={hot === i ? 2.5 : 1}
                      onMouseMove={e => { setHot(i); show(e, label(p.r) || `${full(p.a)}, ${full(p.b)}`,
                        [[x, full(p.a)], [y, full(p.b)], ...(size ? [[size, full(p.s)] as [string, string]] : [])]) }}
                      onMouseLeave={() => { setHot(null); hide() }} />
            ))}
          </>
        )
      }}
    </Frame>
  )
}

/* ───────────────────────── histogram ───────────────────────── */

function Histogram({ rows, y, accent, width, height, show, hide }: Shared & { y: string }) {
  const bins = useMemo(() => rows.map(r => ({ a: toNum(r.x0), b: toNum(r.x1), c: toNum(r.count) ?? 0, label: String(r.bin ?? '') }))
    .filter((d): d is { a: number; b: number; c: number; label: string } => d.a !== null && d.b !== null), [rows])
  const [hot, setHot] = useState<number | null>(null)
  return (
    <Frame width={width} height={height} bottom={44}>
      {(w, h) => {
        if (!bins.length) return null
        const xs = d3.scaleLinear().domain([bins[0].a, bins[bins.length - 1].b]).range([0, w])
        const ys = d3.scaleLinear().domain([0, d3.max(bins, d => d.c) || 1]).nice().range([h, 0])
        const yt = ys.ticks(5), xt = xs.ticks(Math.max(3, Math.floor(w / 80)))
        return (
          <>
            <Grid ticks={yt} y={ys} w={w} />
            <YAxis ticks={yt} y={ys} label="count" />
            {bins.map((d, i) => (
              <rect key={i} x={xs(d.a) + 0.5} width={Math.max(1, xs(d.b) - xs(d.a) - 1)} y={ys(d.c)} height={h - ys(d.c)} rx={1.5}
                    fill={accent} fillOpacity={hot === null || hot === i ? 1 : 0.45}
                    onMouseMove={e => { setHot(i); show(e, d.label, [['count', full(d.c)]]) }} onMouseLeave={() => { setHot(null); hide() }} />
            ))}
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {xt.map(t => <text key={t} x={xs(t)} textAnchor="middle">{compact(t)}</text>)}
              <text x={w} y={16} textAnchor="end">{trunc(y, 40)}</text>
            </g>
          </>
        )
      }}
    </Frame>
  )
}

/* ───────────────────────── donut ───────────────────────── */

function Donut({ rows, x, y, accent, width, height, show, hide }: Shared & { x: string; y: string }) {
  const data = useMemo(() => rows.map(r => ({ label: String(r[x] ?? ''), v: toNum(r[y]) }))
    .filter((d): d is { label: string; v: number } => d.v !== null && d.v > 0), [rows, x, y])
  const colors = [accent, ...PALETTE]
  const [hot, setHot] = useState<number | null>(null)
  const total = d3.sum(data, d => d.v)
  const narrow = width < 520
  const R = Math.max(40, Math.min(narrow ? width / 2 - 10 : height / 2 - 14, (narrow ? height - 120 : height) / 2 - 10, 200))
  const cx = narrow ? width / 2 : Math.max(R + 14, width * 0.34)
  const cy = narrow ? R + 10 : height / 2
  const arcs = d3.pie<{ label: string; v: number }>().sort(null).value(d => d.v)(data)
  const arc = d3.arc<d3.PieArcDatum<{ label: string; v: number }>>().innerRadius(R * 0.62).outerRadius(R)
  const arcHot = d3.arc<d3.PieArcDatum<{ label: string; v: number }>>().innerRadius(R * 0.6).outerRadius(R + 7)
  return (
    <g>
      <g transform={`translate(${cx},${cy})`}>
        {arcs.map((a, i) => (
          <path key={i} d={(hot === i ? arcHot : arc)(a) ?? ''} fill={colors[i % colors.length]} stroke="var(--color-gisviz-card, white)" strokeWidth={2}
                fillOpacity={hot === null || hot === i ? 1 : 0.5}
                onMouseMove={e => { setHot(i); show(e, a.data.label, [[y, full(a.data.v)], ['share', `${((a.data.v / total) * 100).toFixed(1)}%`]]) }}
                onMouseLeave={() => { setHot(null); hide() }} />
        ))}
        <text textAnchor="middle" y={-2} fontSize={22} fontWeight={700} fill="currentColor" className="text-gisviz-ink">{compact(hot === null ? total : data[hot].v)}</text>
        <text textAnchor="middle" y={16} fontSize={11} fill="currentColor">{hot === null ? trunc(y, 22) : trunc(data[hot].label, 22)}</text>
      </g>
      <g fontSize={12} fill="currentColor" transform={narrow ? `translate(14,${cy + R + 22})` : `translate(${cx + R + 36},${Math.max(12, cy - (data.length * 22) / 2)})`}>
        {data.map((d, i) => (
          <g key={i} transform={narrow ? `translate(${(i % 2) * (width / 2 - 14)},${Math.floor(i / 2) * 20})` : `translate(0,${i * 22})`}
             onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
            <rect width={10} height={10} y={-9} rx={2} fill={colors[i % colors.length]} />
            <text x={16}>{trunc(d.label, 20)}  <tspan fillOpacity={0.7}>{((d.v / total) * 100).toFixed(0)}%</tspan></text>
          </g>
        ))}
      </g>
    </g>
  )
}

/* ───────────────────────── treemap ───────────────────────── */

function Treemap({ rows, x, y, accent, width, height, show, hide }: Shared & { x: string; y: string }) {
  const data = useMemo(() => rows.map(r => ({ label: String(r[x] ?? ''), v: toNum(r[y]) }))
    .filter((d): d is { label: string; v: number } => d.v !== null && d.v > 0), [rows, x, y])
  const [hot, setHot] = useState<number | null>(null)
  const root = useMemo(() => {
    const h = d3.hierarchy<any>({ children: data }).sum(d => d.v ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    return d3.treemap<any>().size([width, height - 6]).paddingInner(3).round(true)(h)
  }, [data, width, height])
  const max = d3.max(data, d => d.v) ?? 1
  const total = d3.sum(data, d => d.v)
  return (
    <g>
      {root.leaves().map((n, i) => {
        const w = n.x1 - n.x0, h = n.y1 - n.y0
        const t = (n.data.v as number) / max
        const fill = mix(accent, '#ffffff', 0.72 - 0.64 * t)
        const dark = t > 0.45
        return (
          <g key={i} transform={`translate(${n.x0},${n.y0})`}
             onMouseMove={e => { setHot(i); show(e, n.data.label, [[y, full(n.data.v)], ['share', `${((n.data.v / total) * 100).toFixed(1)}%`]]) }}
             onMouseLeave={() => { setHot(null); hide() }}>
            <rect width={w} height={h} rx={4} fill={fill} stroke={hot === i ? accent : 'none'} strokeWidth={2} />
            {w > 56 && h > 30 && (
              <>
                <text x={8} y={18} fontSize={12} fontWeight={600} fill={dark ? '#fff' : '#1c1c1c'}>{trunc(n.data.label, Math.floor(w / 7))}</text>
                {h > 46 && <text x={8} y={34} fontSize={11} fill={dark ? '#ffffffcc' : '#1c1c1ccc'}>{compact(n.data.v)}</text>}
              </>
            )}
          </g>
        )
      })}
    </g>
  )
}

/* ───────────────────────── heatmap ───────────────────────── */

function Heatmap({ rows, x, y, z, accent, width, height, show, hide }: Shared & { x: string; y: string; z: string }) {
  const { xk, zk, cell } = useMemo(() => {
    const xk = [...new Set(rows.map(r => String(r[x] ?? '')))]
    const zk = [...new Set(rows.map(r => String(r[z] ?? '')))]
    const cell = new Map<string, number>()
    for (const r of rows) { const v = toNum(r[y]); if (v !== null) cell.set(`${r[x]}\u0000${r[z]}`, v) }
    return { xk, zk, cell }
  }, [rows, x, y, z])
  const [hot, setHot] = useState<string | null>(null)
  const left = Math.min(150, Math.max(50, Math.max(0, ...zk.map(s => s.length)) * 6.4 + 12))
  return (
    <Frame width={width} height={height} left={left} right={90} bottom={xk.length > 8 ? 74 : 40}>
      {(w, h) => {
        const xs = d3.scaleBand<string>().domain(xk).range([0, w]).padding(0.05)
        const ys = d3.scaleBand<string>().domain(zk).range([0, h]).padding(0.05)
        const vals = [...cell.values()]
        const [lo, hi] = [d3.min(vals) ?? 0, d3.max(vals) ?? 1]
        const color = d3.scaleSequential(d3.interpolateRgb(mix(accent, '#ffffff', 0.9), mix(accent, '#000000', 0.35))).domain([lo, hi === lo ? lo + 1 : hi])
        const step = labelStep(xk.length, w, 44)
        const legendH = Math.min(120, h)
        return (
          <>
            {zk.map(k => <text key={k} x={-8} y={(ys(k) ?? 0) + ys.bandwidth() / 2} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="currentColor">{trunc(k, 22)}</text>)}
            {xk.map((k, i) => i % step === 0 && (
              <text key={k} x={(xs(k) ?? 0) + xs.bandwidth() / 2} y={h + 16} fontSize={11} fill="currentColor"
                    textAnchor={xk.length > 8 ? 'end' : 'middle'} transform={xk.length > 8 ? `rotate(-35 ${(xs(k) ?? 0) + xs.bandwidth() / 2} ${h + 16})` : undefined}>{trunc(k, 14)}</text>
            ))}
            {xk.flatMap(a => zk.map(b => {
              const v = cell.get(`${a}\u0000${b}`)
              const id = `${a}|${b}`
              return (
                <rect key={id} x={xs(a)} y={ys(b)} width={xs.bandwidth()} height={ys.bandwidth()} rx={3}
                      fill={v === undefined ? 'currentColor' : color(v)} fillOpacity={v === undefined ? 0.06 : 1}
                      stroke={hot === id ? accent : 'none'} strokeWidth={2}
                      onMouseMove={e => { setHot(id); show(e, `${a} · ${b}`, [[y, v === undefined ? '—' : full(v)]]) }}
                      onMouseLeave={() => { setHot(null); hide() }} />
              )
            }))}
            <g transform={`translate(${w + 18},0)`} fontSize={10.5} fill="currentColor">
              <defs>
                <linearGradient id="gv-heat-legend" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0" stopColor={color(lo)} /><stop offset="1" stopColor={color(hi === lo ? lo + 1 : hi)} />
                </linearGradient>
              </defs>
              <rect width={12} height={legendH} rx={3} fill="url(#gv-heat-legend)" />
              <text x={18} y={8}>{compact(hi)}</text>
              <text x={18} y={legendH}>{compact(lo)}</text>
            </g>
          </>
        )
      }}
    </Frame>
  )
}