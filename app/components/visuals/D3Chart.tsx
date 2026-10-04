'use client'

/**
 * app/components/visuals/D3Chart.tsx
 *
 * Every chart type of the post visual, drawn with D3 (scales, shapes, layouts) and
 * rendered by React as SVG, so it follows the page theme and the post's theme colour.
 *
 *   line · area · bar · hbar · stacked · scatter · bubble · histogram · donut · treemap · heatmap
 *   + the rest of the data-to-viz index (ExtraChart, second half of this file):
 *     distribution  density · boxplot · violin · ridgeline      raw sample { [x]: group?, [y]: number }
 *     correlation   density_2d · correlogram ({a, b, r}) · connected_scatter ({[z], [x], [y]} in order)
 *     ranking       ranked_columns · lollipop · circular_bar · word_cloud · radar · parallel_coordinates
 *     part of whole pie · sunburst · circle_packing · dendrogram · treemap with z (x > z tree)
 *     evolution     stacked_area · streamgraph                  long format { [x]: time, [z]: series, [y] }
 *     flow          sankey · chord · network · arc_diagram · edge_bundling   links { [x]: from, [z]: to, [y] }
 *     map           cartogram (Dorling circles on a projection; GeoJSON from the map endpoint)
 *
 * Row shapes (built by the backend, see visual_service.chart_rows):
 *   line / area / bar / hbar / donut / treemap   { [x]: label, [field]: number, ... }  one row per x
 *   stacked / heatmap                             { [x]: label, [z]: series, [y]: number }
 *   scatter / bubble                              raw rows with numeric x, y (and size)
 *   histogram                                     { bin, x0, x1, count }
 *
 * Story layer (hbar, bar):
 *   colorBy    a category column; each group gets its own colour (colors map, else accent + palette)
 *              and a legend that highlights a group on hover
 *   refLines   reference values, e.g. { stat: 'mean', label: 'OECD average', mode: 'divider' }.
 *              mode 'line' draws a dashed line at the value; 'divider' (sorted bar lists) draws a
 *              dashed rule between the rows above and below it, like an editorial ranking.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { createPortal } from 'react-dom'
import { useFlags } from '../../../lib/referenceData'

export type D3ChartType =
  | 'line' | 'area' | 'bar' | 'hbar' | 'stacked' | 'scatter'
  | 'bubble' | 'histogram' | 'donut' | 'treemap' | 'heatmap'
  | (typeof EXTRA_TYPES)[number]                               // the rest of the data-to-viz index: ExtraChart below

type Row = Record<string, unknown>

/** Series colours after the post accent. Keep in sync with PALETTE in visual_image.py. */
export const PALETTE = ['#3b7ea1', '#d4a017', '#5b8c5a', '#8e5ea2', '#c0504d', '#2a9d8f', '#e76f51', '#6d6875']

export const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}
export const compact = (n: number) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(n)
export const full = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 })
export const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
export const ISO_DATE = /^\d{4}-\d{2}(-\d{2})?([T ].*)?$/

export function useSize<T extends HTMLElement>() {
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
export function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

type Tip = { x: number; y: number; title: string; lines: [string, string][] } | null

export interface ReferenceLine {
  /** A fixed value, or a statistic of the plotted values. */
  value?: number
  stat?: 'mean' | 'median'
  label: string
  mode?: 'line' | 'divider'
}

/** Group -> colour: explicit map first, then accent + palette in order of first appearance. */
export function groupColors(groups: string[], accent: string, colors?: Record<string, string>) {
  const out = new Map<string, string>()
  const free = [accent, ...PALETTE].filter(c => !Object.values(colors ?? {}).includes(c))
  let i = 0
  for (const g of groups) {
    if (out.has(g)) continue
    out.set(g, colors?.[g] ?? free[i++ % free.length])
  }
  return out
}

export function refValue(r: ReferenceLine, values: number[]): number | null {
  if (typeof r.value === 'number') return r.value
  if (!values.length) return null
  if (r.stat === 'median') return d3.median(values) ?? null
  if (r.stat === 'mean') return d3.mean(values) ?? null
  return null
}

interface Props {
  rows: Row[]
  type: D3ChartType
  x: string
  /** Numeric column plotted (the viewer can switch it for grouped charts). */
  y: string
  z?: string
  size?: string
  accent: string
  colorBy?: string
  colors?: Record<string, string>
  refLines?: ReferenceLine[]
  /** Friendly name of the measure (axis title, tooltips); defaults to the column name. */
  yLabel?: string
  /** Every measure (parallel coordinates, correlogram). */
  fields?: string[]
  /** GeoJSON for the cartogram (a map drawn with D3). */
  geo?: GeoFC | null
  /** Scatter / bubble: the column that names each point, and whether names are drawn next to the points. */
  labelField?: string
  showLabels?: boolean
  /** On a poster: the colour-group legend goes there (top right of the visual, no box). */
  legendHost?: HTMLElement | null
}

export default function D3Chart({ rows, type, x, y, z, size, accent, colorBy, colors, refLines, yLabel, fields, geo, labelField, showLabels, legendHost }: Props) {
  const [wrap, { width, height }] = useSize<HTMLDivElement>()
  const [tip, setTip] = useState<Tip>(null)
  const [focus, setFocus] = useState<string | null>(null)        // legend hover: highlight one group
  const flags = useFlags()                                         // country labels get their flag (bar rankings)
  const groupColor = useMemo(() => colorBy
    ? groupColors(rows.map(r => String(r[colorBy] ?? '')).filter(Boolean), accent, colors)
    : null, [rows, colorBy, accent, colors])
  const story = { colorBy, groupColor, focus, refLines, yName: yLabel || y }

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
          {(EXTRA_TYPES as readonly string[]).includes(type) || (type === 'treemap' && z)
            ? <ExtraChart {...{ type, rows, x, y, z, fields, accent, colorBy, colors, refLines, yName: yLabel || y, width, height, show, hide, geo }} />
            : type === 'line' || type === 'area' ? <TimeSeries {...{ rows, x, y, accent, width, height, area: type === 'area', show, hide }} />
            : type === 'bar' ? <Bars {...{ rows, x, y, accent, width, height, show, hide, ...story }} />
            : type === 'hbar' ? <HBars {...{ rows, x, y, accent, width, height, show, hide, ...story, flagOf: flags.flag, flagFailed: flags.failed }} />
            : type === 'stacked' ? <Stacked {...{ rows, x, y, z: z!, accent, width, height, show, hide }} />
            : type === 'scatter' || type === 'bubble' ? <Scatter {...{ rows, x, y, size: type === 'bubble' ? size : undefined, accent, width, height, show, hide, labelField, showLabels }} />
            : type === 'histogram' ? <Histogram {...{ rows, y, accent, width, height, show, hide }} />
            : type === 'donut' ? <Donut {...{ rows, x, y, accent, width, height, show, hide }} />
            : type === 'treemap' ? <Treemap {...{ rows, x, y, accent, width, height, show, hide }} />
            : type === 'heatmap' ? <Heatmap {...{ rows, x, y, z: z!, accent, width, height, show, hide }} />
            : null}
        </svg>
      )}
      {groupColor && groupColor.size > 1 && (type === 'hbar' || type === 'bar') && (() => {
        const items = [...groupColor].map(([g, c]) => (
          <button key={g} type="button" onMouseEnter={() => setFocus(g)} onFocus={() => setFocus(g)} onBlur={() => setFocus(null)}
                  className={`flex w-full items-center gap-2 py-0.5 text-left text-[12.5px] transition-opacity ${focus && focus !== g ? 'opacity-40' : ''}`}>
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: c }} />
            <span className="text-gisviz-ink">{g}</span>
          </button>
        ))
        if (legendHost) return createPortal(<div onMouseLeave={() => setFocus(null)}>{items}</div>, legendHost)
        if (legendHost === null) return null
        return (
          <div className={`absolute z-[5] rounded-[10px] border border-gisviz-border bg-gisviz-card/90 px-3 py-2.5 shadow-sm backdrop-blur-sm ${
                 type === 'bar' ? 'top-2 right-3' : 'bottom-12 right-14'}`}
               onMouseLeave={() => setFocus(null)}>{items}</div>
        )
      })()}
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

export const Grid = ({ ticks, y, w }: { ticks: number[]; y: (v: number) => number; w: number }) => (
  <g>{ticks.map(t => <line key={t} x1={0} x2={w} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.14} />)}</g>
)

export const YAxis = ({ ticks, y, label }: { ticks: number[]; y: (v: number) => number; label?: string }) => (
  <g fontSize={11} fill="currentColor">
    {ticks.map(t => <text key={t} x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle">{compact(t)}</text>)}
    {label && <text transform="rotate(-90)" x={-8} y={-44} textAnchor="end" fontSize={11}>{trunc(label, 28)}</text>}
  </g>
)

export function labelStep(count: number, room: number, each = 56) {
  return Math.max(1, Math.ceil(count / Math.max(1, Math.floor(room / each))))
}

export function Frame({ width, height, left = 56, right = 16, top = 12, bottom = 40, children }: {
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
  const span = isTime ? (+new Date(pts[pts.length - 1].label) - +new Date(pts[0].label)) / 86400000 : 0
  const tickFmt = d3.timeFormat(Math.abs(span) > 730 ? '%Y' : Math.abs(span) > 60 || monthly ? '%b %Y' : '%d %b')

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
                {isTime ? tickFmt(t as Date) : compact(Number(t))}
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

function Bars({ rows, x, y, accent, width, height, show, hide, colorBy, groupColor, focus, refLines, yName }: Shared & {
  x: string; y: string; colorBy?: string; groupColor?: Map<string, string> | null; focus?: string | null
  refLines?: ReferenceLine[]; yName?: string
}) {
  const data = useMemo(() => rows.map(r => ({ label: String(r[x] ?? ''), v: toNum(r[y]), g: colorBy ? String(r[colorBy] ?? '') : '' }))
    .filter(d => d.v !== null) as { label: string; v: number; g: string }[], [rows, x, y, colorBy])
  const [hot, setHot] = useState<number | null>(null)
  const long = Math.max(0, ...data.map(d => d.label.length)) > 6 && data.length > 6
  const name = yName || y
  const refs = (refLines ?? []).map(r => ({ ...r, v: refValue(r, data.map(d => d.v)) })).filter(r => r.v !== null) as (ReferenceLine & { v: number })[]
  return (
    <Frame width={width} height={height} bottom={long ? 74 : 40} top={refs.length ? 20 : 12}>
      {(w, h) => {
        const xs = d3.scaleBand<string>().domain(data.map(d => d.label)).range([0, w]).padding(0.22)
        const lo = Math.min(0, d3.min(data, d => d.v) ?? 0), hi = Math.max(0, d3.max(data, d => d.v) ?? 1)
        const ys = d3.scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).nice().range([h, 0])
        const ticks = ys.ticks(5)
        const step = labelStep(data.length, w, long ? 22 : 56)
        const fill = (d: { g: string }) => (groupColor && d.g ? groupColor.get(d.g) ?? accent : accent)
        return (
          <>
            <Grid ticks={ticks} y={ys} w={w} />
            <YAxis ticks={ticks} y={ys} label={name} />
            {data.map((d, i) => {
              const lines: [string, string][] = [[name, full(d.v)]]
              if (colorBy && d.g) lines.push([colorBy, d.g])
              const dim = focus ? d.g !== focus : hot !== null && hot !== i
              return (
                <rect key={i} x={xs(d.label)} width={xs.bandwidth()} y={Math.min(ys(d.v), ys(0))} height={Math.abs(ys(0) - ys(d.v))}
                      rx={2} fill={fill(d)} fillOpacity={dim ? 0.35 : 1}
                      onMouseMove={e => { setHot(i); show(e, d.label, lines) }} onMouseLeave={() => { setHot(null); hide() }} />
              )
            })}
            {refs.map((r, k) => (
              <g key={k} pointerEvents="none">
                <line x1={0} x2={w} y1={ys(r.v)} y2={ys(r.v)} stroke="currentColor" strokeWidth={1.5} strokeDasharray="5 4" />
                <text x={w} y={ys(r.v) - 5} textAnchor="end" fontSize={11.5} fill="currentColor">
                  <tspan fontWeight={700}>{full(Math.round(r.v * 10) / 10)}</tspan> {r.label}
                </text>
              </g>
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

function HBars({ rows, x, y, accent, width, height, show, hide, colorBy, groupColor, focus, refLines, yName, flagOf, flagFailed }: Shared & {
  x: string; y: string; colorBy?: string; groupColor?: Map<string, string> | null; focus?: string | null; refLines?: ReferenceLine[]
  yName?: string; flagOf?: (label: unknown) => string | null; flagFailed?: (url: string) => void
}) {
  const data = useMemo(() => rows.map(r => ({ label: String(r[x] ?? ''), v: toNum(r[y]), g: colorBy ? String(r[colorBy] ?? '') : '' }))
    .filter(d => d.v !== null) as { label: string; v: number; g: string }[], [rows, x, y, colorBy])
  const [hot, setHot] = useState<number | null>(null)
  const flagged = !!flagOf && data.some(d => flagOf(d.label))
  const left = Math.min(180, Math.max(60, Math.max(0, ...data.map(d => d.label.length)) * 6.4 + 14)) + (flagged ? 24 : 0)
  const many = data.length > 24                      // long ranking: tighter bars, no gaps
  const refs = (refLines ?? []).map(r => ({ ...r, v: refValue(r, data.map(d => d.v)) })).filter(r => r.v !== null) as (ReferenceLine & { v: number })[]
  const dividers = refs.filter(r => r.mode === 'divider')
  const lines = refs.filter(r => r.mode !== 'divider')
  return (
    <Frame width={width} height={height} left={left} right={dividers.length ? 118 : 48} top={lines.length ? 26 : 12} bottom={34}>
      {(w, h) => {
        const ys = d3.scaleBand<string>().domain(data.map(d => d.label)).range([0, h]).padding(many ? 0.12 : 0.2)
        const hi = Math.max(1, d3.max(data, d => d.v) ?? 1)
        const xs = d3.scaleLinear().domain([Math.min(0, d3.min(data, d => d.v) ?? 0), hi]).nice().range([0, w])
        const ticks = xs.ticks(5)
        const fs = Math.max(10, Math.min(13, ys.bandwidth() * 0.62))
        const fill = (d: { g: string }) => (groupColor && d.g ? groupColor.get(d.g) ?? accent : accent)
        const dim = (i: number, d: { g: string }) => (focus ? d.g !== focus : hot !== null && hot !== i)
        return (
          <>
            <g>{ticks.map(t => <line key={t} y1={0} y2={h} x1={xs(t)} x2={xs(t)} stroke="currentColor" strokeOpacity={0.14} />)}</g>
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {ticks.map(t => <text key={t} x={xs(t)} textAnchor="middle">{compact(t)}</text>)}
              <text x={w} y={14} textAnchor="end">{trunc(yName || y, 36)}</text>
            </g>
            {data.map((d, i) => {
              const cy = (ys(d.label) ?? 0) + ys.bandwidth() / 2
              const tipLines: [string, string][] = [[yName || y, full(d.v)]]
              if (colorBy && d.g) tipLines.push([colorBy, d.g])
              return (
                <g key={i} opacity={dim(i, d) ? 0.35 : 1}
                   onMouseMove={e => { setHot(i); show(e, d.label, tipLines) }} onMouseLeave={() => { setHot(null); hide() }}>
                  {flagged && flagOf!(d.label) && <image href={flagOf!(d.label)!} onError={() => flagFailed?.(flagOf!(d.label)!)} x={-26} y={cy - fs * 0.45} width={fs * 1.35} height={fs * 0.9} preserveAspectRatio="xMidYMid slice" />}
                  <text x={flagged ? -30 : -8} y={cy} textAnchor="end" dominantBaseline="middle" fontSize={fs} fill="currentColor">{trunc(d.label, 26)}</text>
                  <rect x={Math.min(xs(0), xs(d.v))} y={ys(d.label)} height={ys.bandwidth()} width={Math.abs(xs(d.v) - xs(0))}
                        rx={2} fill={fill(d)} />
                  <text x={xs(d.v) + 6} y={cy} dominantBaseline="middle" fontSize={fs} fontWeight={600} fill="currentColor"
                        className="tabular-nums">{full(d.v)}</text>
                </g>
              )
            })}
            {lines.map((r, k) => (
              <g key={`l${k}`} pointerEvents="none">
                <line x1={xs(r.v)} x2={xs(r.v)} y1={-6} y2={h} stroke="currentColor" strokeWidth={1.5} strokeDasharray="5 4" />
                <text x={xs(r.v)} y={-12} textAnchor="middle" fontSize={11.5} fill="currentColor">
                  <tspan fontWeight={700}>{full(r.v)}</tspan> {r.label}
                </text>
              </g>
            ))}
            {dividers.map((r, k) => {
              // first row (in the given order) whose value falls below the reference
              const idx = data.findIndex(d => d.v <= r.v)          // rows equal to the reference sit below the rule
              if (idx <= 0) return null
              const yy = (ys(data[idx].label) ?? 0) - (ys.step() - ys.bandwidth()) / 2
              return (
                <g key={`d${k}`} pointerEvents="none">
                  <line x1={-left + 8} x2={w + 8} y1={yy} y2={yy} stroke="currentColor" strokeWidth={2} strokeDasharray="6 4" />
                  <text x={w + 16} y={yy - 4} fontSize={20} fontWeight={700} fill="currentColor" className="tabular-nums">{full(Math.round(r.v * 10) / 10)}</text>
                  <text x={w + 16} y={yy + 14} fontSize={12} fill="currentColor">{r.label}</text>
                </g>
              )
            })}
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

function Scatter({ rows, x, y, size, accent, width, height, show, hide, labelField, showLabels }: Shared & {
  x: string; y: string; size?: string; labelField?: string; showLabels?: boolean }) {
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
        const label = (r: Row) => labelField && r[labelField] != null ? String(r[labelField])
          : String(Object.values(r).find(v => typeof v === 'string' && v.length < 40) ?? '')
        // labels on: names beside the points, biggest bubbles first, overlapping ones skipped
        const tags: { x: number; y: number; t: string }[] = []
        if (showLabels) {
          const taken: number[][] = []
          const order = pts.map((p, i) => i).sort((a, b) => pts[b].s - pts[a].s).slice(0, 400)
          for (const i of order) {
            const p = pts[i], t = trunc(label(p.r), 24)
            if (!t) continue
            const r = size ? rs(p.s) : 4.5, tw = t.length * 6.2, th = 12
            const lx = xs(p.a) + r + 3, ly = ys(p.b) - th / 2
            if (lx + tw > w + 30 || ly < -6 || ly + th > h + 6) continue
            if (taken.some(([a, b, c, d]) => lx < c && lx + tw > a && ly < d && ly + th > b)) continue
            taken.push([lx, ly, lx + tw, ly + th])
            tags.push({ x: lx, y: ys(p.b), t })
          }
        }
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
            {tags.length > 0 && (
              <g fontSize={10.5} fontWeight={600} fill="var(--ink)" pointerEvents="none" dominantBaseline="middle"
                 style={{ paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3, strokeLinejoin: 'round' }}>
                {tags.map((g, i) => <text key={i} x={g.x} y={g.y}>{g.t}</text>)}
              </g>
            )}
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

/* ═════════════════════ the rest of the data-to-viz index (ExtraChart) ═════════════════════ */

type Show = (e: React.MouseEvent | React.PointerEvent, title: string, lines: [string, string][]) => void

export interface GeoFC { type: 'FeatureCollection'; features: { type: 'Feature'; id?: number | string; geometry: any; properties: Row | null }[] }

export interface ExtraProps {
  type: string
  rows: Row[]
  x: string
  y: string
  z?: string
  fields?: string[]
  accent: string
  colorBy?: string
  colors?: Record<string, string>
  refLines?: ReferenceLine[]
  yName: string
  width: number
  height: number
  show: Show
  hide: () => void
  geo?: GeoFC | null
}

/** Chart types drawn by ExtraChart (the classic ones are drawn by D3Chart above). */
export const EXTRA_TYPES = [
  'ranked_columns', 'density', 'boxplot', 'violin', 'ridgeline', 'density_2d', 'correlogram', 'connected_scatter', 'parallel_coordinates',
  'radar', 'word_cloud', 'lollipop', 'circular_bar', 'pie', 'sunburst', 'circle_packing', 'dendrogram',
  'stacked_area', 'streamgraph', 'sankey', 'chord', 'network', 'arc_diagram', 'edge_bundling', 'cartogram',
] as const

function ExtraChart(p: ExtraProps) {
  switch (p.type) {
    case 'ranked_columns': return <RankedColumns {...p} />
    case 'density': return <Density {...p} />
    case 'boxplot': case 'violin': return <BoxViolin {...p} />
    case 'ridgeline': return <Ridgeline {...p} />
    case 'density_2d': return <Density2D {...p} />
    case 'correlogram': return <Correlogram {...p} />
    case 'connected_scatter': return <ConnectedScatter {...p} />
    case 'parallel_coordinates': return <Parallel {...p} />
    case 'radar': return <Radar {...p} />
    case 'word_cloud': return <WordCloud {...p} />
    case 'lollipop': return <Lollipop {...p} />
    case 'circular_bar': return <CircularBar {...p} />
    case 'pie': return <Pie {...p} />
    case 'sunburst': return <Sunburst {...p} />
    case 'circle_packing': return <Packing {...p} />
    case 'dendrogram': return <Dendrogram {...p} />
    case 'treemap': return <NestedTreemap {...p} />
    case 'stacked_area': case 'streamgraph': return <StackedArea {...p} />
    case 'sankey': return <Sankey {...p} />
    case 'chord': return <Chord {...p} />
    case 'network': return <Network {...p} />
    case 'arc_diagram': return <ArcDiagram {...p} />
    case 'edge_bundling': return <EdgeBundling {...p} />
    case 'cartogram': return <Cartogram {...p} />
    default: return null
  }
}

/* ───────────────────────── helpers ───────────────────────── */

const palette = (accent: string) => [accent, ...PALETTE]
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

/** A wrapping legend row at the top; returns the SVG and its height. */
function legend(items: [string, string][], width: number, focus?: string | null, setFocus?: (g: string | null) => void) {
  let x = 0, y = 0
  const pos = items.map(([label]) => {
    const w = Math.min(160, trunc(label, 18).length * 6.6 + 26)
    if (x + w > width && x > 0) { x = 0; y += 18 }
    const at = { x, y }; x += w
    return at
  })
  const h = items.length > 1 ? y + 22 : 0
  const svg = items.length > 1 ? (
    <g fontSize={11.5} fill="currentColor">
      {items.map(([label, color], i) => (
        <g key={label} transform={`translate(${pos[i].x},${pos[i].y + 10})`} style={{ cursor: setFocus ? 'pointer' : undefined }}
           opacity={focus && focus !== label ? 0.4 : 1}
           onMouseEnter={() => setFocus?.(label)} onMouseLeave={() => setFocus?.(null)}>
          <rect width={10} height={10} y={-9} rx={2} fill={color} />
          <text x={15}>{trunc(label, 18)}</text>
        </g>
      ))}
    </g>
  ) : null
  return { svg, h }
}

/** Values per group, in first-seen order (no x: one group named after the measure). */
function groupsOf(rows: Row[], x: string | undefined, y: string) {
  const out = new Map<string, number[]>()
  for (const r of rows) {
    const v = toNum(r[y]); if (v === null) continue
    const g = x ? str(r[x]) : y
    if (!out.has(g)) out.set(g, [])
    out.get(g)!.push(v)
  }
  return out
}

/** Gaussian kernel density on a grid (Silverman bandwidth). */
function kde(values: number[], grid: number[]) {
  const n = values.length
  if (n < 2) return grid.map(() => 0)
  const s = [...values].sort((a, b) => a - b)
  const sd = d3.deviation(s) || 1
  const iqr = (d3.quantile(s, 0.75)! - d3.quantile(s, 0.25)!) || sd
  const bw = 0.9 * Math.min(sd, iqr / 1.34) * n ** -0.2 || 1
  const k = 1 / (n * bw * Math.sqrt(2 * Math.PI))
  return grid.map(g => { let t = 0; for (const v of values) { const u = (g - v) / bw; t += Math.exp(-0.5 * u * u) } return t * k })
}

function stats(vs: number[]) {
  const s = [...vs].sort((a, b) => a - b)
  const q1 = d3.quantile(s, 0.25)!, q2 = d3.quantile(s, 0.5)!, q3 = d3.quantile(s, 0.75)!
  const iqr = q3 - q1
  const lo = s.find(v => v >= q1 - 1.5 * iqr) ?? s[0]
  const hi = [...s].reverse().find(v => v <= q3 + 1.5 * iqr) ?? s[s.length - 1]
  return { s, q1, q2, q3, lo, hi, out: s.filter(v => v < lo || v > hi), n: s.length, mean: d3.mean(s)! }
}

const statLines = (st: ReturnType<typeof stats>): [string, string][] => [
  ['median', full(st.q2)], ['middle half', `${full(st.q1)} – ${full(st.q3)}`], ['range', `${full(st.s[0])} – ${full(st.s[st.s.length - 1])}`], ['values', full(st.n)],
]

/* ───────────────────────── distribution ───────────────────────── */

function Density({ rows, x, y, accent, width, height, show, hide, yName }: ExtraProps) {
  const groups = useMemo(() => groupsOf(rows, x || undefined, y), [rows, x, y])
  const [focus, setFocus] = useState<string | null>(null)
  const all = [...groups.values()].flat()
  if (!all.length) return null
  const [lo, hi] = d3.extent(all) as [number, number]
  const pad = (hi - lo) * 0.08 || 1
  const grid = d3.range(121).map(i => lo - pad + ((hi - lo + 2 * pad) * i) / 120)
  const cols = palette(accent)
  const curves = [...groups].map(([g, vs], i) => ({ g, vs, color: cols[i % cols.length], d: kde(vs, grid) }))
  const lg = legend(curves.map(c => [c.g, c.color]), width - 70, focus, setFocus)
  return (
    <g>
      <g transform="translate(56,4)">{lg.svg}</g>
      <Frame width={width} height={height} top={lg.h + 12} bottom={44}>
        {(w, h) => {
          const xs = d3.scaleLinear().domain([grid[0], grid[grid.length - 1]]).range([0, w])
          const ys = d3.scaleLinear().domain([0, d3.max(curves, c => d3.max(c.d))! || 1]).range([h, 0])
          const area = d3.area<number>().x((_, i) => xs(grid[i])).y0(h).y1(v => ys(v)).curve(d3.curveBasis)
          const xt = xs.ticks(Math.max(3, Math.floor(w / 80)))
          return (
            <>
              <line x1={0} x2={w} y1={h} y2={h} stroke="currentColor" strokeOpacity={0.3} />
              {curves.map(c => {
                const st = stats(c.vs)
                const dim = focus && focus !== c.g
                return (
                  <g key={c.g} opacity={dim ? 0.25 : 1}
                     onMouseMove={e => { setFocus(c.g); show(e, curves.length > 1 ? c.g : yName, statLines(st)) }}
                     onMouseLeave={() => { setFocus(null); hide() }}>
                    <path d={area(c.d) ?? ''} fill={c.color} fillOpacity={0.22} />
                    <path d={area.lineY1()(c.d) ?? ''} fill="none" stroke={c.color} strokeWidth={2.2} />
                    <line x1={xs(st.q2)} x2={xs(st.q2)} y1={h} y2={h - 6} stroke={c.color} strokeWidth={2} />
                  </g>
                )
              })}
              <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
                {xt.map(t => <text key={t} x={xs(t)} textAnchor="middle">{compact(t)}</text>)}
                <text x={w} y={16} textAnchor="end">{trunc(yName, 40)}</text>
              </g>
            </>
          )
        }}
      </Frame>
    </g>
  )
}

function BoxViolin({ type, rows, x, y, accent, width, height, show, hide, yName }: ExtraProps) {
  const groups = useMemo(() => [...groupsOf(rows, x, y)].map(([g, vs]) => ({ g, st: stats(vs), vs })), [rows, x, y])
  const [hot, setHot] = useState<string | null>(null)
  if (!groups.length) return null
  const long = groups.length > 6 && Math.max(...groups.map(g => g.g.length)) > 5
  const violin = type === 'violin'
  return (
    <Frame width={width} height={height} bottom={long ? 70 : 40}>
      {(w, h) => {
        const xs = d3.scaleBand<string>().domain(groups.map(g => g.g)).range([0, w]).padding(0.25)
        const all = groups.flatMap(g => g.vs)
        const ys = d3.scaleLinear().domain(d3.extent(all) as [number, number]).nice().range([h, 0])
        const ticks = ys.ticks(5)
        const grid = d3.range(80).map(i => ys.domain()[0] + ((ys.domain()[1] - ys.domain()[0]) * i) / 79)
        const dens = violin ? groups.map(g => kde(g.vs, grid)) : []
        const dmax = violin ? d3.max(dens, d => d3.max(d))! || 1 : 1
        const bw = xs.bandwidth()
        const step = labelStep(groups.length, w, long ? 20 : 50)
        return (
          <>
            <Grid ticks={ticks} y={ys} w={w} />
            <YAxis ticks={ticks} y={ys} label={yName} />
            {groups.map((g, i) => {
              const cx = (xs(g.g) ?? 0) + bw / 2
              const dim = hot !== null && hot !== g.g
              return (
                <g key={g.g} opacity={dim ? 0.35 : 1}
                   onMouseMove={e => { setHot(g.g); show(e, g.g, statLines(g.st)) }} onMouseLeave={() => { setHot(null); hide() }}>
                  <rect x={xs(g.g)} width={bw} y={0} height={h} fill="transparent" />
                  {violin ? (
                    <>
                      <path d={d3.area<number>().y((_, k) => ys(grid[k])).x0(v => cx - (v / dmax) * bw * 0.5).x1(v => cx + (v / dmax) * bw * 0.5)
                        .curve(d3.curveBasis)(dens[i]) ?? ''} fill={accent} fillOpacity={0.55} stroke={accent} strokeWidth={1.2} />
                      <line x1={cx} x2={cx} y1={ys(g.st.q1)} y2={ys(g.st.q3)} stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
                      <circle cx={cx} cy={ys(g.st.q2)} r={3.5} fill="white" stroke="currentColor" />
                    </>
                  ) : (
                    <>
                      <line x1={cx} x2={cx} y1={ys(g.st.lo)} y2={ys(g.st.hi)} stroke={accent} strokeWidth={1.5} />
                      {[g.st.lo, g.st.hi].map((v, k) => <line key={k} x1={cx - bw * 0.18} x2={cx + bw * 0.18} y1={ys(v)} y2={ys(v)} stroke={accent} strokeWidth={1.5} />)}
                      <rect x={cx - bw * 0.32} width={bw * 0.64} y={ys(g.st.q3)} height={Math.max(1, ys(g.st.q1) - ys(g.st.q3))} rx={3}
                            fill={mix(accent, '#ffffff', 0.6)} stroke={accent} strokeWidth={1.5} />
                      <line x1={cx - bw * 0.32} x2={cx + bw * 0.32} y1={ys(g.st.q2)} y2={ys(g.st.q2)} stroke="currentColor" strokeWidth={2.2} />
                      {g.st.out.slice(0, 150).map((v, k) => <circle key={k} cx={cx + ((k % 5) - 2) * 1.6} cy={ys(v)} r={2.4} fill="none" stroke={accent} strokeOpacity={0.7} />)}
                    </>
                  )}
                </g>
              )
            })}
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {groups.map((g, i) => i % step === 0 && (
                <text key={g.g} x={(xs(g.g) ?? 0) + bw / 2} textAnchor={long ? 'end' : 'middle'}
                      transform={long ? `rotate(-35 ${(xs(g.g) ?? 0) + bw / 2} 0)` : undefined}>{trunc(g.g, long ? 16 : 12)}</text>
              ))}
            </g>
          </>
        )
      }}
    </Frame>
  )
}

function Ridgeline({ rows, x, y, accent, width, height, show, hide, yName }: ExtraProps) {
  const groups = useMemo(() => [...groupsOf(rows, x, y)].map(([g, vs]) => ({ g, vs, st: stats(vs) }))
    .sort((a, b) => b.st.q2 - a.st.q2), [rows, x, y])
  const [hot, setHot] = useState<string | null>(null)
  if (!groups.length) return null
  const left = Math.min(150, Math.max(50, Math.max(...groups.map(g => g.g.length)) * 6.4 + 12))
  return (
    <Frame width={width} height={height} left={left} top={30} bottom={40}>
      {(w, h) => {
        const all = groups.flatMap(g => g.vs)
        const [lo, hi] = d3.extent(all) as [number, number]
        const xs = d3.scaleLinear().domain([lo, hi]).nice().range([0, w])
        const grid = d3.range(100).map(i => xs.domain()[0] + ((xs.domain()[1] - xs.domain()[0]) * i) / 99)
        const band = h / groups.length
        const lift = Math.min(band * 2.4, 90)
        const xt = xs.ticks(Math.max(3, Math.floor(w / 80)))
        return (
          <>
            {xt.map(t => <line key={t} x1={xs(t)} x2={xs(t)} y1={-20} y2={h} stroke="currentColor" strokeOpacity={0.1} />)}
            {groups.map((g, i) => {
              const d = kde(g.vs, grid), m = d3.max(d) || 1
              const base = (i + 1) * band
              const area = d3.area<number>().x((_, k) => xs(grid[k])).y0(base).y1(v => base - (v / m) * lift).curve(d3.curveBasis)
              const fill = mix(accent, '#ffffff', 0.15 + 0.55 * (i / Math.max(1, groups.length - 1)))
              return (
                <g key={g.g} opacity={hot && hot !== g.g ? 0.35 : 1}
                   onMouseMove={e => { setHot(g.g); show(e, g.g, statLines(g.st)) }} onMouseLeave={() => { setHot(null); hide() }}>
                  <path d={area(d) ?? ''} fill={fill} stroke="var(--color-gisviz-card, white)" strokeWidth={1.2} />
                  <text x={-8} y={base - 3} textAnchor="end" fontSize={11} fill="currentColor">{trunc(g.g, 22)}</text>
                </g>
              )
            })}
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {xt.map(t => <text key={t} x={xs(t)} textAnchor="middle">{compact(t)}</text>)}
              <text x={w} y={16} textAnchor="end">{trunc(yName, 40)}</text>
            </g>
          </>
        )
      }}
    </Frame>
  )
}

/* ───────────────────────── correlation ───────────────────────── */

function Density2D({ rows, x, y, accent, width, height, show, hide, yName }: ExtraProps) {
  const pts = useMemo(() => rows.map(r => [toNum(r[x]), toNum(r[y])] as const)
    .filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null), [rows, x, y])
  if (!pts.length) return null
  return (
    <Frame width={width} height={height} bottom={44}>
      {(w, h) => {
        const xs = d3.scaleLinear().domain(d3.extent(pts, p => p[0]) as [number, number]).nice().range([0, w])
        const ys = d3.scaleLinear().domain(d3.extent(pts, p => p[1]) as [number, number]).nice().range([h, 0])
        const contours = d3.contourDensity<readonly [number, number]>().x(p => xs(p[0])).y(p => ys(p[1]))
          .size([w, h]).bandwidth(Math.max(10, Math.min(w, h) / 28)).thresholds(14)(pts)
        const max = d3.max(contours, c => c.value) || 1
        const color = d3.scaleSequential(d3.interpolateRgb(mix(accent, '#ffffff', 0.92), mix(accent, '#000000', 0.3))).domain([0, max])
        const path = d3.geoPath()
        const yt = ys.ticks(5), xt = xs.ticks(Math.max(3, Math.floor(w / 80)))
        return (
          <>
            <Grid ticks={yt} y={ys} w={w} />
            <YAxis ticks={yt} y={ys} label={yName} />
            <g>{contours.map((c, i) => (
              <path key={i} d={path(c) ?? ''} fill={color(c.value)} stroke={accent} strokeOpacity={0.35} strokeWidth={0.6}
                    onMouseMove={e => show(e, `Density level ${i + 1} of ${contours.length}`, [['share of points', `top ${Math.round(100 - (i / contours.length) * 100)}%`]])}
                    onMouseLeave={hide} />
            ))}</g>
            {pts.length <= 1500 && <g pointerEvents="none">{pts.map((p, i) => <circle key={i} cx={xs(p[0])} cy={ys(p[1])} r={1.4} fill="currentColor" fillOpacity={0.35} />)}</g>}
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {xt.map(t => <text key={t} x={xs(t)} textAnchor="middle">{compact(t)}</text>)}
              <text x={w} y={16} textAnchor="end">{trunc(x, 40)}</text>
            </g>
          </>
        )
      }}
    </Frame>
  )
}

function Correlogram({ rows, width, height, show, hide }: ExtraProps) {
  const { names, cell } = useMemo(() => {
    const names = [...new Set(rows.map(r => str(r.a)))]
    const cell = new Map(rows.map(r => [`${r.a}\u0000${r.b}`, toNum(r.r)]))
    return { names, cell }
  }, [rows])
  const [hot, setHot] = useState<string | null>(null)
  const left = Math.min(140, Math.max(50, Math.max(0, ...names.map(n => n.length)) * 6.4 + 12))
  const color = (r: number) => d3.interpolateRdBu((r + 1) / 2)
  return (
    <Frame width={width} height={height} left={left} right={70} top={12} bottom={left * 0.75}>
      {(w, h) => {
        const size = Math.min(w, h)
        const xs = d3.scaleBand<string>().domain(names).range([0, size]).padding(0.04)
        const bw = xs.bandwidth()
        return (
          <>
            {names.map(n => <text key={`l${n}`} x={-8} y={(xs(n) ?? 0) + bw / 2} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="currentColor">{trunc(n, 20)}</text>)}
            {names.map(n => <text key={`b${n}`} x={0} y={0} fontSize={11} fill="currentColor" textAnchor="end"
                                  transform={`translate(${(xs(n) ?? 0) + bw / 2},${size + 10}) rotate(-45)`}>{trunc(n, 18)}</text>)}
            {names.flatMap(a => names.map(b => {
              const r = cell.get(`${a}\u0000${b}`) ?? null
              const id = `${a}|${b}`
              const cx = (xs(b) ?? 0) + bw / 2, cy = (xs(a) ?? 0) + bw / 2
              return (
                <g key={id} onMouseMove={e => { setHot(id); show(e, a === b ? a : `${a} × ${b}`, [['correlation (r)', r === null ? '—' : r.toFixed(2)]]) }}
                   onMouseLeave={() => { setHot(null); hide() }}>
                  <rect x={xs(b)} y={xs(a)} width={bw} height={bw} fill="currentColor" fillOpacity={hot === id ? 0.1 : 0.03} />
                  {r !== null && <circle cx={cx} cy={cy} r={Math.max(1.5, (Math.abs(r) * bw) / 2.1)} fill={color(r)} />}
                  {r !== null && bw > 38 && a !== b && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={10.5}
                    fill={Math.abs(r) > 0.6 ? '#fff' : 'currentColor'}>{r.toFixed(2)}</text>}
                </g>
              )
            }))}
            <g transform={`translate(${size + 22},0)`} fontSize={10.5} fill="currentColor">
              {d3.range(11).map(i => <rect key={i} y={(i * Math.min(160, size)) / 11} width={12} height={Math.min(160, size) / 11 + 0.5} fill={color(1 - i / 5)} />)}
              <text x={18} y={8}>+1</text><text x={18} y={Math.min(160, size) / 2 + 4}>0</text><text x={18} y={Math.min(160, size)}>−1</text>
            </g>
          </>
        )
      }}
    </Frame>
  )
}

function ConnectedScatter({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const pts = useMemo(() => rows.map(r => ({ t: str(r[z!]), a: toNum(r[x]), b: toNum(r[y]) }))
    .filter((p): p is { t: string; a: number; b: number } => p.a !== null && p.b !== null), [rows, x, y, z])
  const [hot, setHot] = useState<number | null>(null)
  if (!pts.length) return null
  return (
    <Frame width={width} height={height} bottom={44}>
      {(w, h) => {
        const xs = d3.scaleLinear().domain(d3.extent(pts, p => p.a) as [number, number]).nice().range([0, w])
        const ys = d3.scaleLinear().domain(d3.extent(pts, p => p.b) as [number, number]).nice().range([h, 0])
        const yt = ys.ticks(5), xt = xs.ticks(Math.max(3, Math.floor(w / 80)))
        const line = d3.line<typeof pts[number]>().x(p => xs(p.a)).y(p => ys(p.b)).curve(d3.curveCatmullRom.alpha(0.5))
        const every = Math.max(1, Math.ceil(pts.length / 10))
        return (
          <>
            <defs><marker id="gv-cs-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={accent} /></marker></defs>
            <Grid ticks={yt} y={ys} w={w} />
            <YAxis ticks={yt} y={ys} label={yName} />
            <path d={line(pts) ?? ''} fill="none" stroke={accent} strokeWidth={2} strokeOpacity={0.85} />
            {pts.slice(1).map((p, i) => i % every === every - 1 && (
              <line key={`a${i}`} x1={xs(pts[i].a)} y1={ys(pts[i].b)} x2={(xs(pts[i].a) + xs(p.a)) / 2} y2={(ys(pts[i].b) + ys(p.b)) / 2}
                    stroke="none" markerEnd="url(#gv-cs-arrow)" />
            ))}
            {pts.map((p, i) => (
              <g key={i} onMouseMove={e => { setHot(i); show(e, p.t, [[x, full(p.a)], [y, full(p.b)]]) }} onMouseLeave={() => { setHot(null); hide() }}>
                <circle cx={xs(p.a)} cy={ys(p.b)} r={hot === i ? 6 : 4} fill={i === 0 || i === pts.length - 1 ? accent : 'var(--color-gisviz-card, white)'} stroke={accent} strokeWidth={1.8} />
                {(i === 0 || i === pts.length - 1 || i % every === 0) && (
                  <text x={xs(p.a) + 7} y={ys(p.b) - 7} fontSize={10.5} fill="currentColor">{trunc(p.t.slice(0, 10), 12)}</text>
                )}
              </g>
            ))}
            <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
              {xt.map(t => <text key={t} x={xs(t)} textAnchor="middle">{compact(t)}</text>)}
              <text x={w} y={16} textAnchor="end">{trunc(x, 40)}</text>
            </g>
          </>
        )
      }}
    </Frame>
  )
}

/* ───────────────────────── ranking ───────────────────────── */

function Parallel({ rows, fields, y, accent, colorBy, colors, width, height, show, hide }: ExtraProps) {
  const dims = fields?.length ? fields : [y]
  const lines = useMemo(() => rows.map(r => ({ r, v: dims.map(d => toNum(r[d])), g: colorBy ? str(r[colorBy]) : '' }))
    .filter(l => l.v.every(v => v !== null)) as { r: Row; v: number[]; g: string }[], [rows, dims, colorBy])
  const gc = useMemo(() => (colorBy ? groupColors(lines.map(l => l.g), accent, colors) : null), [lines, colorBy, accent, colors])
  const [hot, setHot] = useState<number | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const lg = legend(gc ? [...gc] : [], width - 40, focus, setFocus)
  return (
    <g>
      <g transform="translate(24,4)">{lg.svg}</g>
      <Frame width={width} height={height} left={24} right={24} top={lg.h + 26} bottom={30}>
        {(w, h) => {
          const xs = d3.scalePoint<string>().domain(dims).range([0, w]).padding(0.05)
          const ys = dims.map((_, k) => d3.scaleLinear().domain(d3.extent(lines, l => l.v[k]) as [number, number]).nice().range([h, 0]))
          const path = (l: { v: number[] }) => d3.line<number>().x((_, k) => xs(dims[k])!).y((v, k) => ys[k](v))(l.v) ?? ''
          return (
            <>
              {lines.map((l, i) => {
                const c = gc && l.g ? gc.get(l.g)! : accent
                const dim = hot !== null ? hot !== i : focus ? l.g !== focus : false
                return <path key={i} d={path(l)} fill="none" stroke={c} strokeWidth={hot === i ? 2.6 : 1.1} strokeOpacity={dim ? 0.06 : hot === i ? 1 : 0.4} />
              })}
              {lines.map((l, i) => (
                <path key={`h${i}`} d={path(l)} fill="none" stroke="transparent" strokeWidth={6}
                      onMouseMove={e => { setHot(i); show(e, colorBy && l.g ? l.g : `Row ${i + 1}`, dims.map((d, k) => [d, full(l.v[k])])) }}
                      onMouseLeave={() => { setHot(null); hide() }} />
              ))}
              {dims.map((d, k) => (
                <g key={d} transform={`translate(${xs(d)},0)`} pointerEvents="none">
                  <line y1={0} y2={h} stroke="currentColor" strokeOpacity={0.5} />
                  {ys[k].ticks(4).map(t => <text key={t} x={-4} y={ys[k](t)} textAnchor="end" dominantBaseline="middle" fontSize={9.5} fill="currentColor">{compact(t)}</text>)}
                  <text y={-10} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="currentColor">{trunc(d, 16)}</text>
                </g>
              ))}
            </>
          )
        }}
      </Frame>
    </g>
  )
}

function Radar({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const { axes, series } = useMemo(() => {
    const axes = [...new Set(rows.map(r => str(r[x])))]
    const series = new Map<string, Map<string, number>>()
    for (const r of rows) {
      const s = z ? str(r[z]) : yName
      if (!series.has(s)) series.set(s, new Map())
      series.get(s)!.set(str(r[x]), toNum(r[y]) ?? 0)
    }
    return { axes, series }
  }, [rows, x, y, z, yName])
  const [focus, setFocus] = useState<string | null>(null)
  const cols = palette(accent)
  const items: [string, string][] = [...series.keys()].map((s, i) => [s, cols[i % cols.length]])
  const lg = legend(items, width - 20, focus, setFocus)
  if (axes.length < 3) return null
  const top = lg.h + 8
  const R = Math.max(40, Math.min(width / 2 - 90, (height - top) / 2 - 30))
  const cx = width / 2, cy = top + (height - top) / 2
  const max = d3.max([...series.values()].flatMap(m => [...m.values()])) || 1
  const rs = d3.scaleLinear().domain([0, max]).nice().range([0, R])
  const ang = (i: number) => (i / axes.length) * 2 * Math.PI - Math.PI / 2
  const pt = (i: number, v: number) => [cx + Math.cos(ang(i)) * rs(v), cy + Math.sin(ang(i)) * rs(v)] as const
  return (
    <g>
      <g transform="translate(10,4)">{lg.svg}</g>
      {rs.ticks(4).filter(t => t > 0).map(t => (
        <g key={t}>
          <polygon points={axes.map((_, i) => pt(i, t).join(',')).join(' ')} fill="none" stroke="currentColor" strokeOpacity={0.15} />
          <text x={cx + 3} y={cy - rs(t)} fontSize={9.5} fill="currentColor" fillOpacity={0.7}>{compact(t)}</text>
        </g>
      ))}
      {axes.map((a, i) => {
        const [ex, ey] = [cx + Math.cos(ang(i)) * R, cy + Math.sin(ang(i)) * R]
        const anchor = Math.abs(Math.cos(ang(i))) < 0.2 ? 'middle' : Math.cos(ang(i)) > 0 ? 'start' : 'end'
        return (
          <g key={a}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="currentColor" strokeOpacity={0.2} />
            <text x={cx + Math.cos(ang(i)) * (R + 10)} y={cy + Math.sin(ang(i)) * (R + 10)} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fill="currentColor">{trunc(a, 16)}</text>
          </g>
        )
      })}
      {[...series].map(([s, m], k) => {
        const c = cols[k % cols.length]
        const dim = focus && focus !== s
        const ptsS = axes.map((a, i) => pt(i, m.get(a) ?? 0))
        return (
          <g key={s} opacity={dim ? 0.2 : 1}>
            <polygon points={ptsS.map(p => p.join(',')).join(' ')} fill={c} fillOpacity={0.16} stroke={c} strokeWidth={2.2} strokeLinejoin="round" />
            {ptsS.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={4} fill={c}
                      onMouseMove={e => { setFocus(s); show(e, `${axes[i]}${series.size > 1 ? ` · ${s}` : ''}`, [[yName, full(m.get(axes[i]) ?? 0)]]) }}
                      onMouseLeave={() => { setFocus(null); hide() }} />
            ))}
          </g>
        )
      })}
    </g>
  )
}

function WordCloud({ rows, x, y, accent, width, height, show, hide, yName }: ExtraProps) {
  const placed = useMemo(() => {
    const words = rows.map(r => ({ t: str(r[x]), v: toNum(r[y]) ?? 0 })).filter(w => w.t && w.v > 0)
      .sort((a, b) => b.v - a.v).slice(0, 120)
    if (!words.length || width < 60) return []
    const fs = d3.scaleSqrt().domain([0, words[0].v]).range([11, Math.max(18, Math.min(68, width / 9))])
    const boxes: { x: number; y: number; w: number; h: number }[] = []
    const out: { t: string; v: number; x: number; y: number; size: number; i: number }[] = []
    const hit = (b: typeof boxes[number]) => boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y)
    const ratio = width / height
    words.forEach((wd, i) => {
      const size = fs(wd.v), bw = wd.t.length * size * 0.56 + 4, bh = size * 0.95
      for (let k = 0; k < 2500; k++) {
        const a = k * 0.32, r = k * 0.55
        const px = width / 2 + r * Math.cos(a) * Math.sqrt(ratio) - bw / 2, py = height / 2 + r * Math.sin(a) / Math.sqrt(ratio) - bh / 2
        if (px < 2 || py < 2 || px + bw > width - 2 || py + bh > height - 2) continue
        const b = { x: px, y: py, w: bw, h: bh }
        if (!hit(b)) { boxes.push(b); out.push({ ...wd, x: px + bw / 2, y: py + bh * 0.78, size, i }); break }
      }
    })
    return out
  }, [rows, x, y, width, height])
  const [hot, setHot] = useState<number | null>(null)
  const cols = palette(accent)
  return (
    <g>
      {placed.map(w => (
        <text key={w.t} x={w.x} y={w.y} textAnchor="middle" fontSize={w.size} fontWeight={w.i < 10 ? 700 : 600}
              fill={cols[w.i % cols.length]} fillOpacity={hot === null || hot === w.i ? 1 : 0.35} style={{ cursor: 'default' }}
              onMouseMove={e => { setHot(w.i); show(e, w.t, [[yName, full(w.v)]]) }} onMouseLeave={() => { setHot(null); hide() }}>{w.t}</text>
      ))}
    </g>
  )
}

function Lollipop({ rows, x, y, accent, colorBy, colors, refLines, width, height, show, hide, yName }: ExtraProps) {
  const flags = useFlags()
  const data = useMemo(() => rows.map(r => ({ label: str(r[x]), v: toNum(r[y]), g: colorBy ? str(r[colorBy]) : '' }))
    .filter(d => d.v !== null) as { label: string; v: number; g: string }[], [rows, x, y, colorBy])
  const gc = useMemo(() => (colorBy ? groupColors(data.map(d => d.g), accent, colors) : null), [data, colorBy, accent, colors])
  const [hot, setHot] = useState<number | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const lg = legend(gc ? [...gc] : [], width - 20, focus, setFocus)
  const left = Math.min(200, Math.max(60, Math.max(0, ...data.map(d => d.label.length)) * 6.4 + 14) + (data.some(d => flags.flag(d.label)) ? 24 : 0))
  const refs = (refLines ?? []).map(r => ({ ...r, v: refValue(r, data.map(d => d.v)) })).filter(r => r.v !== null) as (ReferenceLine & { v: number })[]
  return (
    <g>
      <g transform="translate(10,4)">{lg.svg}</g>
      <Frame width={width} height={height} left={left} right={56} top={lg.h + (refs.length ? 28 : 10)} bottom={34}>
        {(w, h) => {
          const ys = d3.scaleBand<string>().domain(data.map(d => d.label)).range([0, h]).padding(0.3)
          const xs = d3.scaleLinear().domain([Math.min(0, d3.min(data, d => d.v) ?? 0), Math.max(1, d3.max(data, d => d.v) ?? 1)]).nice().range([0, w])
          const ticks = xs.ticks(5)
          const fs = Math.max(10, Math.min(13, ys.step() * 0.62))
          const r = Math.max(3, Math.min(8, ys.step() * 0.32))
          return (
            <>
              {ticks.map(t => <line key={t} y1={0} y2={h} x1={xs(t)} x2={xs(t)} stroke="currentColor" strokeOpacity={0.12} />)}
              <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
                {ticks.map(t => <text key={t} x={xs(t)} textAnchor="middle">{compact(t)}</text>)}
                <text x={w} y={14} textAnchor="end">{trunc(yName, 36)}</text>
              </g>
              {data.map((d, i) => {
                const cy = (ys(d.label) ?? 0) + ys.bandwidth() / 2
                const c = gc && d.g ? gc.get(d.g)! : accent
                const dim = focus ? d.g !== focus : hot !== null && hot !== i
                return (
                  <g key={i} opacity={dim ? 0.3 : 1} onMouseMove={e => { setHot(i); show(e, d.label, [[yName, full(d.v)], ...(colorBy && d.g ? [[colorBy, d.g] as [string, string]] : [])]) }}
                     onMouseLeave={() => { setHot(null); hide() }}>
                    <rect x={-left} y={cy - ys.step() / 2} width={w + left} height={ys.step()} fill="transparent" />
                    {flags.flag(d.label) && <image href={flags.flag(d.label)!} onError={() => flags.failed(flags.flag(d.label)!)} x={-26} y={cy - fs * 0.45} width={fs * 1.35} height={fs * 0.9} preserveAspectRatio="xMidYMid slice" />}
                    <text x={flags.flag(d.label) ? -30 : -8} y={cy} textAnchor="end" dominantBaseline="middle" fontSize={fs} fill="currentColor">{trunc(d.label, 26)}</text>
                    <line x1={xs(0)} x2={xs(d.v)} y1={cy} y2={cy} stroke={c} strokeWidth={2} strokeOpacity={0.6} />
                    <circle cx={xs(d.v)} cy={cy} r={r} fill={c} />
                    <text x={xs(d.v) + r + 5} y={cy} dominantBaseline="middle" fontSize={fs - 1} fontWeight={600} fill="currentColor">{compact(d.v)}</text>
                  </g>
                )
              })}
              {refs.map((rf, k) => (
                <g key={k} pointerEvents="none">
                  <line x1={xs(rf.v)} x2={xs(rf.v)} y1={-8} y2={h} stroke="currentColor" strokeWidth={1.5} strokeDasharray="5 4" />
                  <text x={xs(rf.v)} y={-13} textAnchor="middle" fontSize={11.5} fill="currentColor"><tspan fontWeight={700}>{full(rf.v)}</tspan> {rf.label}</text>
                </g>
              ))}
            </>
          )
        }}
      </Frame>
    </g>
  )
}

function CircularBar({ rows, x, y, accent, width, height, show, hide, yName }: ExtraProps) {
  const data = useMemo(() => rows.map(r => ({ label: str(r[x]), v: toNum(r[y]) ?? 0 })).filter(d => d.v > 0), [rows, x, y])
  const [hot, setHot] = useState<number | null>(null)
  if (!data.length) return null
  const R = Math.max(60, Math.min(width, height) / 2 - 70)
  const inner = R * 0.32
  const xs = d3.scaleBand<string>().domain(data.map(d => d.label)).range([0, 2 * Math.PI]).padding(0.12)
  const rs = d3.scaleRadial().domain([0, d3.max(data, d => d.v)!]).range([inner, R])
  const arc = d3.arc<{ label: string; v: number }>().innerRadius(inner).outerRadius(d => rs(d.v))
    .startAngle(d => xs(d.label)!).endAngle(d => xs(d.label)! + xs.bandwidth()).padRadius(inner).cornerRadius(2)
  return (
    <g transform={`translate(${width / 2},${height / 2})`}>
      {data.map((d, i) => {
        const a = xs(d.label)! + xs.bandwidth() / 2
        const flip = a > Math.PI
        return (
          <g key={i} opacity={hot === null || hot === i ? 1 : 0.4}
             onMouseMove={e => { setHot(i); show(e, d.label, [[yName, full(d.v)]]) }} onMouseLeave={() => { setHot(null); hide() }}>
            <path d={arc(d) ?? ''} fill={mix(accent, '#ffffff', 0.45 * (1 - d.v / (d3.max(data, q => q.v) || 1)))} />
            {data.length <= 70 && (
              <text transform={`rotate(${(a * 180) / Math.PI - 90}) translate(${rs(d.v) + 5},0) ${flip ? 'rotate(180)' : ''}`}
                    textAnchor={flip ? 'end' : 'start'} dominantBaseline="middle" fontSize={10} fill="currentColor">{trunc(d.label, 16)}</text>
            )}
          </g>
        )
      })}
      <text textAnchor="middle" y={-2} fontSize={18} fontWeight={700} fill="currentColor">{compact(hot === null ? d3.sum(data, d => d.v) : data[hot].v)}</text>
      <text textAnchor="middle" y={14} fontSize={10.5} fill="currentColor">{hot === null ? trunc(yName, 18) : trunc(data[hot].label, 18)}</text>
    </g>
  )
}

function Pie({ rows, x, y, accent, width, height, show, hide, yName }: ExtraProps) {
  const data = useMemo(() => rows.map(r => ({ label: str(r[x]), v: toNum(r[y]) ?? 0 })).filter(d => d.v > 0), [rows, x, y])
  const [hot, setHot] = useState<number | null>(null)
  const cols = palette(accent)
  const total = d3.sum(data, d => d.v)
  const narrow = width < 520
  const R = Math.max(40, Math.min(narrow ? width / 2 - 10 : height / 2 - 14, (narrow ? height - 110 : height) / 2 - 10, 210))
  const cx = narrow ? width / 2 : Math.max(R + 14, width * 0.36), cy = narrow ? R + 10 : height / 2
  const arcs = d3.pie<{ label: string; v: number }>().sort(null).value(d => d.v)(data)
  const arc = d3.arc<d3.PieArcDatum<{ label: string; v: number }>>().innerRadius(0).outerRadius(R)
  const arcHot = d3.arc<d3.PieArcDatum<{ label: string; v: number }>>().innerRadius(0).outerRadius(R + 8)
  const lab = d3.arc<d3.PieArcDatum<{ label: string; v: number }>>().innerRadius(R * 0.62).outerRadius(R * 0.62)
  return (
    <g>
      <g transform={`translate(${cx},${cy})`}>
        {arcs.map((a, i) => (
          <g key={i} onMouseMove={e => { setHot(i); show(e, a.data.label, [[yName, full(a.data.v)], ['share', `${((a.data.v / total) * 100).toFixed(1)}%`]]) }}
             onMouseLeave={() => { setHot(null); hide() }}>
            <path d={(hot === i ? arcHot : arc)(a) ?? ''} fill={cols[i % cols.length]} stroke="var(--color-gisviz-card, white)" strokeWidth={2}
                  fillOpacity={hot === null || hot === i ? 1 : 0.55} />
            {a.endAngle - a.startAngle > 0.32 && (
              <text transform={`translate(${lab.centroid(a)})`} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill="#fff"
                    pointerEvents="none">{Math.round((a.data.v / total) * 100)}%</text>
            )}
          </g>
        ))}
      </g>
      <g fontSize={12} fill="currentColor" transform={narrow ? `translate(14,${cy + R + 22})` : `translate(${cx + R + 36},${Math.max(12, cy - (data.length * 22) / 2)})`}>
        {data.map((d, i) => (
          <g key={i} transform={narrow ? `translate(${(i % 2) * (width / 2 - 14)},${Math.floor(i / 2) * 20})` : `translate(0,${i * 22})`}
             onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
            <rect width={10} height={10} y={-9} rx={2} fill={cols[i % cols.length]} />
            <text x={16}>{trunc(d.label, 22)}  <tspan fillOpacity={0.7}>{full(d.v)}</tspan></text>
          </g>
        ))}
      </g>
    </g>
  )
}

/* ───────────────────────── part of a whole: hierarchies ───────────────────────── */

interface TNode { name: string; value?: number; children?: TNode[] }

/** x (parent) > z (child) > value; without z, one level. */
function tree(rows: Row[], x: string, y: string, z?: string): TNode {
  const top = new Map<string, TNode>()
  for (const r of rows) {
    const a = str(r[x]); if (!a) continue
    const v = Math.abs(toNum(r[y]) ?? 1) || 0
    if (!top.has(a)) top.set(a, z ? { name: a, children: [] } : { name: a, value: 0 })
    const n = top.get(a)!
    if (z) n.children!.push({ name: str(r[z]), value: v })
    else n.value = (n.value ?? 0) + v
  }
  return { name: 'all', children: [...top.values()] }
}

function useTree(rows: Row[], x: string, y: string, z?: string) {
  return useMemo(() => d3.hierarchy<TNode>(tree(rows, x, y, z)).sum(d => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), [rows, x, y, z])
}

const topColor = (n: d3.HierarchyNode<TNode>, order: Map<string, string>) => {
  const top = n.ancestors().find(a => a.depth === 1)
  return top ? order.get(top.data.name)! : '#999'
}

function Sunburst({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const root = useTree(rows, x, y, z)
  const [hot, setHot] = useState<d3.HierarchyRectangularNode<TNode> | null>(null)
  const R = Math.max(50, Math.min(width, height) / 2 - 12)
  const part = useMemo(() => d3.partition<TNode>().size([2 * Math.PI, R])(root.copy()), [root, R])
  const cols = palette(accent)
  const order = new Map((part.children ?? []).map((c, i) => [c.data.name, cols[i % cols.length]]))
  const ring = R / (part.height + 1)
  const arc = d3.arc<d3.HierarchyRectangularNode<TNode>>().startAngle(d => d.x0).endAngle(d => d.x1).padAngle(0.004)
    .innerRadius(d => d.depth * ring + (d.depth === 1 ? ring * 0.15 : 0)).outerRadius(d => (d.depth + 1) * ring - 1)
  const total = root.value ?? 0
  const trail = hot ? new Set(hot.ancestors()) : null
  return (
    <g transform={`translate(${width / 2},${height / 2})`}>
      {part.descendants().filter(d => d.depth > 0).map((d, i) => {
        const c = topColor(d, order)
        const a = (d.x0 + d.x1) / 2, rr = (d.depth + 0.5) * ring
        const big = (d.x1 - d.x0) * rr > 34
        return (
          <g key={i} opacity={trail && !trail.has(d) ? 0.35 : 1}
             onMouseMove={e => { setHot(d); show(e, d.ancestors().reverse().slice(1).map(n => n.data.name).join(' › '), [[yName, full(d.value ?? 0)], ['share', `${(((d.value ?? 0) / (total || 1)) * 100).toFixed(1)}%`]]) }}
             onMouseLeave={() => { setHot(null); hide() }}>
            <path d={arc(d) ?? ''} fill={d.depth === 1 ? c : mix(c, '#ffffff', 0.25 + 0.15 * (i % 3))} stroke="var(--color-gisviz-card, white)" strokeWidth={1} />
            {big && (
              <text transform={`rotate(${(a * 180) / Math.PI - 90}) translate(${rr},0) rotate(${a > Math.PI ? 180 : 0})`} textAnchor="middle" dominantBaseline="middle"
                    fontSize={10.5} fill="#fff" pointerEvents="none">{trunc(d.data.name, Math.max(4, Math.floor(ring / 7)))}</text>
            )}
          </g>
        )
      })}
      <text textAnchor="middle" y={-2} fontSize={17} fontWeight={700} fill="currentColor">{compact(hot ? hot.value ?? 0 : total)}</text>
      <text textAnchor="middle" y={14} fontSize={10.5} fill="currentColor">{trunc(hot ? hot.data.name : yName, 16)}</text>
    </g>
  )
}

function Packing({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const root = useTree(rows, x, y, z)
  const [hot, setHot] = useState<string | null>(null)
  const S = Math.max(60, Math.min(width, height) - 8)
  const packed = useMemo(() => d3.pack<TNode>().size([S, S]).padding(z ? 4 : 2)(root.copy()), [root, S, z])
  const cols = palette(accent)
  const order = new Map((packed.children ?? []).map((c, i) => [c.data.name, cols[i % cols.length]]))
  const ox = (width - S) / 2, oy = (height - S) / 2
  return (
    <g transform={`translate(${ox},${oy})`}>
      {packed.descendants().filter(d => d.depth > 0).map((d, i) => {
        const c = topColor(d, order)
        const leaf = !d.children
        const id = d.ancestors().map(a => a.data.name).join('/')
        return (
          <g key={i} onMouseMove={e => { e.stopPropagation(); setHot(id); show(e, d.ancestors().reverse().slice(1).map(n => n.data.name).join(' › '), [[yName, full(d.value ?? 0)]]) }}
             onMouseLeave={() => { setHot(null); hide() }}>
            <circle cx={d.x} cy={d.y} r={d.r} fill={leaf ? c : mix(c, '#ffffff', 0.82)} fillOpacity={leaf ? 0.85 : 1}
                    stroke={hot === id ? 'currentColor' : leaf ? 'none' : c} strokeWidth={hot === id ? 2 : 1} />
            {leaf && d.r > 16 && (
              <text x={d.x} y={d.y} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(13, d.r / 3)} fill="#fff" pointerEvents="none">
                {trunc(d.data.name, Math.max(3, Math.floor(d.r / 4)))}
              </text>
            )}
            {!leaf && d.r > 34 && (
              <text x={d.x} y={d.y - d.r + 14} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={mix(c, '#000000', 0.25)} pointerEvents="none">
                {trunc(d.data.name, Math.floor(d.r / 4))}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

function Dendrogram({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const root = useTree(rows, x, y, z)
  const leaves = root.leaves().length
  const radial = leaves > Math.max(24, height / 13)
  const cols = palette(accent)
  const order = new Map((root.children ?? []).map((c, i) => [c.data.name, cols[i % cols.length]]))
  const [hot, setHot] = useState<string | null>(null)
  if (radial) {
    const R = Math.max(60, Math.min(width, height) / 2 - 80)
    const t = d3.cluster<TNode>().size([2 * Math.PI, R])(root.copy())
    const link = d3.linkRadial<d3.HierarchyPointLink<TNode>, d3.HierarchyPointNode<TNode>>().angle(d => d.x).radius(d => d.y)
    return (
      <g transform={`translate(${width / 2},${height / 2})`}>
        {t.links().map((l, i) => <path key={i} d={link(l) ?? ''} fill="none" stroke={topColor(l.target, order)} strokeOpacity={hot && !l.target.ancestors().some(a => a.data.name === hot) ? 0.15 : 0.6} />)}
        {t.descendants().map((d, i) => {
          const a = d.x, flip = a > Math.PI
          return (
            <g key={i} transform={`rotate(${(a * 180) / Math.PI - 90}) translate(${d.y},0)`}
               onMouseMove={e => { setHot(d.data.name); show(e, d.data.name, [[yName, full(d.value ?? 0)], ...(d.children ? [['items', String(d.leaves().length)] as [string, string]] : [])]) }}
               onMouseLeave={() => { setHot(null); hide() }}>
              <circle r={d.depth === 0 ? 4 : d.children ? 3.5 : 2.5} fill={d.depth === 0 ? 'currentColor' : topColor(d, order)} />
              {!d.children && <text x={flip ? -6 : 6} transform={flip ? 'rotate(180)' : undefined} textAnchor={flip ? 'end' : 'start'} dominantBaseline="middle"
                                    fontSize={leaves > 150 ? 7.5 : 9.5} fill="currentColor">{trunc(d.data.name, 18)}</text>}
            </g>
          )
        })}
      </g>
    )
  }
  const left = 16, right = 140
  const t = d3.cluster<TNode>().size([height - 20, width - left - right])(root.copy())
  const link = d3.linkHorizontal<d3.HierarchyPointLink<TNode>, d3.HierarchyPointNode<TNode>>().x(d => d.y).y(d => d.x)
  return (
    <g transform={`translate(${left},10)`}>
      {t.links().map((l, i) => <path key={i} d={link(l) ?? ''} fill="none" stroke={topColor(l.target, order)} strokeWidth={1.4} strokeOpacity={0.6} />)}
      {t.descendants().map((d, i) => (
        <g key={i} transform={`translate(${d.y},${d.x})`}
           onMouseMove={e => { setHot(d.data.name); show(e, d.data.name, [[yName, full(d.value ?? 0)]]) }} onMouseLeave={() => { setHot(null); hide() }}>
          <circle r={d.depth === 0 ? 5 : 4} fill={d.depth === 0 ? 'currentColor' : topColor(d, order)} stroke={hot === d.data.name ? 'currentColor' : 'none'} />
          {d.depth > 0 && <text x={d.children ? -8 : 8} y={d.children ? -8 : 0} textAnchor={d.children ? 'end' : 'start'} dominantBaseline="middle"
                                fontSize={d.children ? 11.5 : 10.5} fontWeight={d.children ? 700 : 400} fill="currentColor">{trunc(d.data.name, 22)}</text>}
        </g>
      ))}
    </g>
  )
}

function NestedTreemap({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const root = useTree(rows, x, y, z)
  const [hot, setHot] = useState<string | null>(null)
  const t = useMemo(() => d3.treemap<TNode>().size([width, height - 4]).paddingOuter(3).paddingTop(19).paddingInner(2).round(true)(root.copy()), [root, width, height])
  const cols = palette(accent)
  const order = new Map((t.children ?? []).map((c, i) => [c.data.name, cols[i % cols.length]]))
  const total = root.value || 1
  return (
    <g>
      {(t.children ?? []).map((g, i) => {
        const c = order.get(g.data.name)!
        return (
          <g key={`g${i}`}>
            <rect x={g.x0} y={g.y0} width={g.x1 - g.x0} height={g.y1 - g.y0} rx={5} fill={mix(c, '#ffffff', 0.85)} />
            {g.x1 - g.x0 > 50 && <text x={g.x0 + 6} y={g.y0 + 13} fontSize={11.5} fontWeight={700} fill={mix(c, '#000000', 0.3)}>{trunc(g.data.name, Math.floor((g.x1 - g.x0) / 7))}</text>}
          </g>
        )
      })}
      {t.leaves().map((n, i) => {
        const c = topColor(n, order), w = n.x1 - n.x0, h = n.y1 - n.y0
        const id = `${n.parent?.data.name}/${n.data.name}`
        return (
          <g key={i} transform={`translate(${n.x0},${n.y0})`}
             onMouseMove={e => { setHot(id); show(e, `${n.parent?.data.name} › ${n.data.name}`, [[yName, full(n.value ?? 0)], ['share', `${(((n.value ?? 0) / total) * 100).toFixed(1)}%`]]) }}
             onMouseLeave={() => { setHot(null); hide() }}>
            <rect width={w} height={h} rx={3} fill={c} fillOpacity={hot === id ? 1 : 0.82} />
            {w > 46 && h > 22 && <text x={5} y={14} fontSize={11} fill="#fff">{trunc(n.data.name, Math.floor(w / 6.5))}</text>}
            {w > 46 && h > 38 && <text x={5} y={29} fontSize={10.5} fill="#ffffffcc">{compact(n.value ?? 0)}</text>}
          </g>
        )
      })}
    </g>
  )
}

/* ───────────────────────── evolution ───────────────────────── */

function StackedArea({ type, rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const { keys, series, objs, isTime } = useMemo(() => {
    const xs: string[] = [], seen = new Set<string>()
    const totals = new Map<string, number>()
    const table = new Map<string, Record<string, number>>()
    for (const r of rows) {
      const a = str(r[x]), b = str(r[z!]), v = toNum(r[y]) ?? 0
      if (!seen.has(a)) { seen.add(a); xs.push(a); table.set(a, {}) }
      table.get(a)![b] = v
      totals.set(b, (totals.get(b) ?? 0) + v)
    }
    const keys = [...totals.entries()].sort((p, q) => q[1] - p[1]).map(([k]) => k)
    const isTime = xs.length > 0 && xs.every(s => ISO_DATE.test(s))
    if (isTime) xs.sort()
    const objs = xs.map(a => ({ __x: a, ...table.get(a)! }) as Record<string, any>)
    const stream = type === 'streamgraph'
    const series = d3.stack<Record<string, any>>().keys(keys).value((d, k) => d[k] ?? 0)
      .offset(stream ? d3.stackOffsetWiggle : d3.stackOffsetNone).order(stream ? d3.stackOrderInsideOut : d3.stackOrderNone)(objs)
    return { keys, series, objs, isTime }
  }, [rows, x, y, z, type])
  const [focus, setFocus] = useState<string | null>(null)
  const [hoverI, setHoverI] = useState<number | null>(null)
  const cols = palette(accent)
  const color = (k: string) => cols[keys.indexOf(k) % cols.length]
  const lg = legend(keys.map(k => [k, color(k)]), width - 70, focus, setFocus)
  if (!objs.length) return null
  const stream = type === 'streamgraph'
  return (
    <g>
      <g transform="translate(56,4)">{lg.svg}</g>
      <Frame width={width} height={height} top={lg.h + 12} bottom={40} left={stream ? 16 : 56}>
        {(w, h) => {
          const xs = isTime
            ? d3.scaleTime().domain(d3.extent(objs, o => new Date(o.__x)) as [Date, Date]).range([0, w])
            : d3.scalePoint<string>().domain(objs.map(o => o.__x)).range([0, w])
          const px = (o: Record<string, any>) => (isTime ? (xs as d3.ScaleTime<number, number>)(new Date(o.__x)) : (xs as d3.ScalePoint<string>)(o.__x) ?? 0)
          const lo = d3.min(series, s => d3.min(s, d => d[0]))!, hi = d3.max(series, s => d3.max(s, d => d[1]))!
          const ys = d3.scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).nice(!stream ? 5 : undefined).range([h, 0])
          const area = d3.area<any>().x(d => px(d.data)).y0(d => ys(d[0])).y1(d => ys(d[1])).curve(stream ? d3.curveBasis : d3.curveMonotoneX)
          const ticks = ys.ticks(5)
          const step = labelStep(objs.length, w, 70)
          const fmt = d3.timeFormat('%b %Y')
          const onMove = (e: React.MouseEvent<SVGRectElement>) => {
            const mx = e.clientX - e.currentTarget.getBoundingClientRect().left
            let best = 0, bd = Infinity
            objs.forEach((o, i) => { const d = Math.abs(px(o) - mx); if (d < bd) { bd = d; best = i } })
            setHoverI(best)
            const o = objs[best]
            show(e, isTime ? fmt(new Date(o.__x)) : o.__x, [...keys.map(k => [k, full(o[k] ?? 0)] as [string, string]), ['total', full(d3.sum(keys, k => o[k] ?? 0))]])
          }
          return (
            <>
              {!stream && <Grid ticks={ticks} y={ys} w={w} />}
              {!stream && <YAxis ticks={ticks} y={ys} label={yName} />}
              {series.map(s => <path key={s.key} d={area(s) ?? ''} fill={color(s.key)} fillOpacity={focus && focus !== s.key ? 0.2 : 0.88}
                                     stroke="var(--color-gisviz-card, white)" strokeWidth={0.5} />)}
              {hoverI !== null && <line x1={px(objs[hoverI])} x2={px(objs[hoverI])} y1={0} y2={h} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="3 3" pointerEvents="none" />}
              <g fontSize={11} fill="currentColor" transform={`translate(0,${h + 16})`}>
                {isTime
                  ? (xs as d3.ScaleTime<number, number>).ticks(Math.max(2, Math.floor(w / 90))).map((t, i) => (
                      <text key={i} x={(xs as d3.ScaleTime<number, number>)(t)} textAnchor="middle">{fmt(t)}</text>))
                  : objs.map((o, i) => i % step === 0 && <text key={i} x={px(o)} textAnchor="middle">{trunc(o.__x, 12)}</text>)}
              </g>
              <rect width={w} height={h} fill="transparent" onMouseMove={onMove} onMouseLeave={() => { setHoverI(null); hide() }} />
            </>
          )
        }}
      </Frame>
    </g>
  )
}

/* ───────────────────────── flows ───────────────────────── */

interface Link { s: string; t: string; v: number; g?: string }

function useLinks(rows: Row[], x: string, z: string | undefined, y: string, colorBy?: string) {
  return useMemo(() => rows.map(r => ({ s: str(r[x]), t: str(r[z!]), v: Math.abs(toNum(r[y]) ?? 1) || 1, g: colorBy ? str(r[colorBy]) : undefined }))
    .filter(l => l.s && l.t), [rows, x, z, y, colorBy])
}

/** Label propagation: a cheap community per node, used to colour and order networks. */
function communities(nodes: string[], links: Link[]) {
  const adj = new Map(nodes.map(n => [n, [] as [string, number][]]))
  for (const l of links) { adj.get(l.s)?.push([l.t, l.v]); adj.get(l.t)?.push([l.s, l.v]) }
  const lab = new Map(nodes.map(n => [n, n]))
  for (let it = 0; it < 12; it++) {
    let changed = false
    for (const n of nodes) {
      const tally = new Map<string, number>()
      for (const [m, w] of adj.get(n)!) tally.set(lab.get(m)!, (tally.get(lab.get(m)!) ?? 0) + w)
      if (!tally.size) continue
      const best = [...tally].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]
      if (best !== lab.get(n)) { lab.set(n, best); changed = true }
    }
    if (!changed) break
  }
  return lab
}

function Sankey({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const links = useLinks(rows, x, z, y)
  const [hot, setHot] = useState<string | null>(null)
  const layout = useMemo(() => {
    if (!links.length) return null
    // a cycle (A→B and B→A) or a self-link cannot be layered: draw "from" and "to" as two columns instead
    const out = new Map<string, Link[]>()
    links.forEach(l => { if (!out.has(l.s)) out.set(l.s, []); out.get(l.s)!.push(l) })
    const state = new Map<string, number>()
    const cyclic = (n: string): boolean => {
      if (state.get(n) === 1) return true
      if (state.get(n) === 2) return false
      state.set(n, 1)
      for (const l of out.get(n) ?? []) if (cyclic(l.t)) return true
      state.set(n, 2); return false
    }
    const bip = links.some(l => l.s === l.t) || [...out.keys()].some(n => cyclic(n))
    const L = bip ? links.map(l => ({ ...l, s: `${l.s}\u0001a`, t: `${l.t}\u0001b` })) : links
    const names = [...new Set(L.flatMap(l => [l.s, l.t]))]
    const inn = new Map(names.map(n => [n, 0])), outv = new Map(names.map(n => [n, 0]))
    L.forEach(l => { outv.set(l.s, outv.get(l.s)! + l.v); inn.set(l.t, inn.get(l.t)! + l.v) })
    const depth = new Map(names.map(n => [n, 0]))
    for (let it = 0; it < names.length; it++) {        // longest path from the sources
      let moved = false
      for (const l of L) if (depth.get(l.t)! < depth.get(l.s)! + 1) { depth.set(l.t, depth.get(l.s)! + 1); moved = true }
      if (!moved) break
    }
    const maxD = Math.max(...depth.values())
    names.forEach(n => { if (!outv.get(n)) depth.set(n, maxD) })   // sinks on the right
    const nodeW = 14, padY = 8, labelRoom = 120
    const W = Math.max(60, width - labelRoom * 2), H = height - 10
    const colsN = d3.groups(names, n => depth.get(n)!).sort((a, b) => a[0] - b[0])
    const val = (n: string) => Math.max(inn.get(n)!, outv.get(n)!)
    const ky = d3.min(colsN, ([, ns]) => (H - padY * (ns.length - 1)) / (d3.sum(ns, val) || 1))!
    const node = new Map<string, { x: number; y0: number; y1: number; name: string; v: number; out: number; in: number; inV: number; outV: number }>()
    for (const [d, ns] of colsN) {
      ns.sort((a, b) => val(b) - val(a))
      const used = d3.sum(ns, val) * ky + padY * (ns.length - 1)
      let yy = (H - used) / 2
      for (const n of ns) {
        node.set(n, { x: labelRoom + (maxD ? (d / maxD) * (W - nodeW) : 0), y0: yy, y1: yy + val(n) * ky, name: n.split('\u0001')[0], v: val(n), out: 0, in: 0, inV: inn.get(n)!, outV: outv.get(n)! })
        yy += val(n) * ky + padY
      }
    }
    const paths = [...L].sort((a, b) => node.get(a.t)!.y0 - node.get(b.t)!.y0).map(l => {
      const a = node.get(l.s)!, b = node.get(l.t)!
      const wv = l.v * ky
      const sy = a.y0 + a.out + wv / 2; a.out += wv
      return { l, a, b, wv, sy, ty: 0 }
    })
    paths.sort((p, q) => p.a.y0 - q.a.y0).forEach(p => { p.ty = p.b.y0 + p.b.in + p.wv / 2; p.b.in += p.wv })
    return { node, paths, nodeW, maxD }
  }, [links, width, height])
  if (!layout) return null
  const cols = palette(accent)
  const names = [...layout.node.keys()]
  const color = (n: string) => cols[names.indexOf(n) % cols.length]
  return (
    <g transform="translate(0,5)">
      {layout.paths.map((p, i) => {
        const x0 = p.a.x + layout.nodeW, x1 = p.b.x, mx = (x0 + x1) / 2
        const on = hot === null || hot === p.l.s || hot === p.l.t
        return (
          <path key={i} d={`M${x0},${p.sy}C${mx},${p.sy} ${mx},${p.ty} ${x1},${p.ty}`} fill="none" stroke={color(p.l.s)}
                strokeWidth={Math.max(1, p.wv)} strokeOpacity={on ? 0.42 : 0.08}
                onMouseMove={e => show(e, `${p.a.name} → ${p.b.name}`, [[yName, full(p.l.v)]])} onMouseLeave={hide} />
        )
      })}
      {[...layout.node].map(([k, n]) => {
        const right = n.x > width / 2
        return (
          <g key={k} onMouseMove={e => { setHot(k); show(e, n.name, [...(n.inV ? [['in', full(n.inV)] as [string, string]] : []), ...(n.outV ? [['out', full(n.outV)] as [string, string]] : [])]) }}
             onMouseLeave={() => { setHot(null); hide() }}>
            <rect x={n.x} y={n.y0} width={layout.nodeW} height={Math.max(1, n.y1 - n.y0)} rx={2} fill={color(k)} />
            <text x={right ? n.x - 6 : n.x + layout.nodeW + 6} y={(n.y0 + n.y1) / 2} textAnchor={right ? 'end' : 'start'} dominantBaseline="middle"
                  fontSize={11} fill="currentColor">{trunc(n.name, 18)} <tspan fillOpacity={0.6}>{compact(n.v)}</tspan></text>
          </g>
        )
      })}
    </g>
  )
}

function Chord({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const links = useLinks(rows, x, z, y)
  const [hot, setHot] = useState<number | null>(null)
  const { names, chords } = useMemo(() => {
    const tot = new Map<string, number>()
    links.forEach(l => { tot.set(l.s, (tot.get(l.s) ?? 0) + l.v); tot.set(l.t, (tot.get(l.t) ?? 0) + l.v) })
    const names = [...tot].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([n]) => n)
    const idx = new Map(names.map((n, i) => [n, i]))
    const m = names.map(() => names.map(() => 0))
    // one-way data (no item is both a "from" and a "to", e.g. gender → subject): count each link both ways,
    // otherwise the "to" items would get no arc of their own
    const froms = new Set(links.map(l => l.s)), oneWay = !links.some(l => froms.has(l.t))
    links.forEach(l => {
      const a = idx.get(l.s), b = idx.get(l.t)
      if (a === undefined || b === undefined) return
      m[a][b] += l.v
      if (oneWay) m[b][a] += l.v
    })
    return { names, chords: d3.chord().padAngle(0.035).sortSubgroups(d3.descending)(m) }
  }, [links])
  const R = Math.max(50, Math.min(width, height) / 2 - 70)
  const cols = palette(accent)
  const arc = d3.arc<d3.ChordGroup>().innerRadius(R).outerRadius(R + 12)
  const ribbon = d3.ribbon<d3.Chord, d3.ChordSubgroup>().radius(R - 1)
  return (
    <g transform={`translate(${width / 2},${height / 2})`}>
      {chords.map((c, i) => {
        const on = hot === null || hot === c.source.index || hot === c.target.index
        return (
          <path key={i} d={(ribbon(c) as unknown as string) ?? ''} fill={cols[c.source.index % cols.length]} fillOpacity={on ? 0.6 : 0.06}
                stroke={cols[c.source.index % cols.length]} strokeOpacity={on ? 0.8 : 0.1}
                onMouseMove={e => show(e, `${names[c.source.index]} ↔ ${names[c.target.index]}`, [
                  [`${trunc(names[c.source.index], 12)} → ${trunc(names[c.target.index], 12)}`, full(c.source.value)],
                  [`${trunc(names[c.target.index], 12)} → ${trunc(names[c.source.index], 12)}`, full(c.target.value)]])}
                onMouseLeave={hide} />
        )
      })}
      {chords.groups.map(g => {
        const a = (g.startAngle + g.endAngle) / 2, flip = a > Math.PI
        return (
          <g key={g.index} onMouseMove={e => { setHot(g.index); show(e, names[g.index], [[`${yName} (all links)`, full(g.value)]]) }}
             onMouseLeave={() => { setHot(null); hide() }}>
            <path d={arc(g) ?? ''} fill={cols[g.index % cols.length]} />
            <text transform={`rotate(${(a * 180) / Math.PI - 90}) translate(${R + 18},0) ${flip ? 'rotate(180)' : ''}`} textAnchor={flip ? 'end' : 'start'}
                  dominantBaseline="middle" fontSize={11} fill="currentColor">{trunc(names[g.index], 16)}</text>
          </g>
        )
      })}
    </g>
  )
}

function Network({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const links = useLinks(rows, x, z, y)
  const [hot, setHot] = useState<string | null>(null)
  const g = useMemo(() => {
    const strength = new Map<string, number>()
    links.forEach(l => { strength.set(l.s, (strength.get(l.s) ?? 0) + l.v); strength.set(l.t, (strength.get(l.t) ?? 0) + l.v) })
    const keep = new Set([...strength].sort((a, b) => b[1] - a[1]).slice(0, 160).map(([n]) => n))
    const L = links.filter(l => keep.has(l.s) && keep.has(l.t))
    const comm = communities([...keep], L)
    const maxS = d3.max(strength.values()) || 1
    const nodes = [...keep].map(id => ({ id, s: strength.get(id)!, c: comm.get(id)!, r: 3 + 11 * Math.sqrt(strength.get(id)! / maxS) }) as any)
    const ls = L.map(l => ({ source: l.s, target: l.t, v: l.v })) as any[]
    const maxV = d3.max(L, l => l.v) || 1
    d3.forceSimulation(nodes)
      .force('link', d3.forceLink(ls).id((d: any) => d.id).distance(Math.max(36, Math.min(width, height) / (Math.sqrt(nodes.length) + 1.2))).strength(0.35))
      .force('charge', d3.forceManyBody().strength(-70 - 900 / Math.max(4, nodes.length)))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide((d: any) => d.r + 2))
      .force('x', d3.forceX(width / 2).strength(0.04)).force('y', d3.forceY(height / 2).strength(0.06))
      .stop().tick(320)
    for (const n of nodes) { n.x = Math.max(n.r + 4, Math.min(width - n.r - 4, n.x)); n.y = Math.max(n.r + 4, Math.min(height - n.r - 4, n.y)) }
    const comms = [...new Set(nodes.map((n: any) => n.c))]
    const top = new Set([...nodes].sort((a: any, b: any) => b.s - a.s).slice(0, 18).map((n: any) => n.id))
    return { nodes, ls, maxV, comms, top }
  }, [links, width, height])
  const cols = palette(accent)
  const near = hot ? new Set([hot, ...g.ls.filter(l => l.source.id === hot || l.target.id === hot).flatMap(l => [l.source.id, l.target.id])]) : null
  return (
    <g>
      {g.ls.map((l, i) => {
        const on = !near || (near.has(l.source.id) && near.has(l.target.id) && (l.source.id === hot || l.target.id === hot))
        return <line key={i} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} stroke="currentColor"
                     strokeOpacity={on ? 0.35 : 0.05} strokeWidth={0.6 + 3.5 * (l.v / g.maxV)} />
      })}
      {g.nodes.map((n: any) => (
        <g key={n.id} opacity={near && !near.has(n.id) ? 0.25 : 1}
           onMouseMove={e => { setHot(n.id); show(e, n.id, [[`${yName} (all links)`, full(n.s)], ['links', String(g.ls.filter(l => l.source.id === n.id || l.target.id === n.id).length)]]) }}
           onMouseLeave={() => { setHot(null); hide() }}>
          <circle cx={n.x} cy={n.y} r={n.r} fill={cols[g.comms.indexOf(n.c) % cols.length]} stroke="var(--color-gisviz-card, white)" strokeWidth={1.2} />
          {(g.top.has(n.id) || hot === n.id) && <text x={n.x} y={n.y - n.r - 4} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="currentColor">{trunc(n.id, 18)}</text>}
        </g>
      ))}
    </g>
  )
}

function ArcDiagram({ rows, x, y, z, accent, width, height, show, hide, yName }: ExtraProps) {
  const links = useLinks(rows, x, z, y)
  const [hot, setHot] = useState<string | null>(null)
  const { order, comm, maxV, strength } = useMemo(() => {
    const strength = new Map<string, number>()
    links.forEach(l => { strength.set(l.s, (strength.get(l.s) ?? 0) + l.v); strength.set(l.t, (strength.get(l.t) ?? 0) + l.v) })
    const names = [...strength.keys()].slice(0, 80)
    const comm = communities(names, links)
    const order = [...names].sort((a, b) => (comm.get(a)! < comm.get(b)! ? -1 : comm.get(a)! > comm.get(b)! ? 1 : strength.get(b)! - strength.get(a)!))
    return { order, comm, maxV: d3.max(links, l => l.v) || 1, strength }
  }, [links])
  const cols = palette(accent)
  const comms = [...new Set(order.map(n => comm.get(n)!))]
  const color = (n: string) => cols[comms.indexOf(comm.get(n)!) % cols.length]
  const base = height - 90
  const xs = d3.scalePoint<string>().domain(order).range([30, width - 30])
  return (
    <g>
      {links.filter(l => xs(l.s) !== undefined && xs(l.t) !== undefined).map((l, i) => {
        const a = xs(l.s)!, b = xs(l.t)!, r = Math.abs(b - a) / 2
        const on = !hot || hot === l.s || hot === l.t
        return <path key={i} d={`M${a},${base} A${r},${Math.min(r, base - 10)} 0 0 ${a < b ? 1 : 0} ${b},${base}`} fill="none"
                     stroke={color(l.s)} strokeOpacity={on ? 0.5 : 0.05} strokeWidth={0.8 + 4 * (l.v / maxV)}
                     onMouseMove={e => show(e, `${l.s} → ${l.t}`, [[yName, full(l.v)]])} onMouseLeave={hide} />
      })}
      {order.map(n => (
        <g key={n} transform={`translate(${xs(n)},${base})`} onMouseMove={e => { setHot(n); show(e, n, [[`${yName} (all links)`, full(strength.get(n)!)]]) }}
           onMouseLeave={() => { setHot(null); hide() }}>
          <circle r={3 + 6 * Math.sqrt(strength.get(n)! / (d3.max(strength.values()) || 1))} fill={color(n)} />
          <text transform="rotate(-55)" x={-8} textAnchor="end" dominantBaseline="middle" fontSize={order.length > 40 ? 8.5 : 10.5} fill="currentColor">{trunc(n, 16)}</text>
        </g>
      ))}
    </g>
  )
}

function EdgeBundling({ rows, x, y, z, accent, colorBy, width, height, show, hide, yName }: ExtraProps) {
  const links = useLinks(rows, x, z, y, colorBy)
  const [hot, setHot] = useState<string | null>(null)
  const R = Math.max(60, Math.min(width, height) / 2 - 90)
  const lay = useMemo(() => {
    const names = [...new Set(links.flatMap(l => [l.s, l.t]))].slice(0, 220)
    const given = new Map<string, string>()
    links.forEach(l => { if (l.g) given.set(l.s, l.g) })
    const comm = communities(names, links)
    const group = (n: string) => given.get(n) ?? `group ${comm.get(n)}`
    const groups = d3.group(names, group)
    const root = d3.hierarchy<any>({ name: '', children: [...groups].map(([g, ns]) => ({ name: g, children: ns.map(n => ({ name: n, leaf: true })) })) })
      .sort((a, b) => d3.ascending(a.data.name, b.data.name))
    const t = d3.cluster<any>().size([2 * Math.PI, R])(root)
    const leaf = new Map(t.leaves().map(l => [l.data.name as string, l]))
    const line = d3.lineRadial<d3.HierarchyPointNode<any>>().curve(d3.curveBundle.beta(0.85)).radius(d => d.y).angle(d => d.x)
    const paths = links.filter(l => leaf.has(l.s) && leaf.has(l.t) && l.s !== l.t)
      .map(l => ({ l, d: line(leaf.get(l.s)!.path(leaf.get(l.t)!)) ?? '' }))
    return { t, paths, groups: [...groups.keys()], group, maxV: d3.max(links, l => l.v) || 1 }
  }, [links, R])
  const cols = palette(accent)
  const color = (g: string) => cols[lay.groups.indexOf(g) % cols.length]
  return (
    <g transform={`translate(${width / 2},${height / 2})`}>
      {lay.paths.map((p, i) => {
        const on = !hot || hot === p.l.s || hot === p.l.t
        return <path key={i} d={p.d} fill="none" stroke={hot === p.l.t ? '#c0504d' : color(lay.group(p.l.s))} strokeOpacity={on ? (hot ? 0.9 : 0.35) : 0.04}
                     strokeWidth={0.6 + 2.2 * (p.l.v / lay.maxV)} />
      })}
      {lay.t.leaves().map(l => {
        const a = l.x, flip = a > Math.PI, n = l.data.name as string
        return (
          <g key={n} transform={`rotate(${(a * 180) / Math.PI - 90}) translate(${l.y + 4},0)`}
             onMouseMove={e => { setHot(n); show(e, n, [['group', lay.group(n)], ['links out', String(lay.paths.filter(p => p.l.s === n).length)], ['links in', String(lay.paths.filter(p => p.l.t === n).length)], [yName, full(d3.sum(lay.paths.filter(p => p.l.s === n || p.l.t === n), p => p.l.v))]]) }}
             onMouseLeave={() => { setHot(null); hide() }}>
            <circle r={2.5} fill={color(lay.group(n))} />
            <text x={flip ? -6 : 6} transform={flip ? 'rotate(180)' : undefined} textAnchor={flip ? 'end' : 'start'} dominantBaseline="middle"
                  fontSize={lay.t.leaves().length > 120 ? 8 : 10} fontWeight={hot === n ? 700 : 400} fill="currentColor">{trunc(n, 16)}</text>
          </g>
        )
      })}
    </g>
  )
}

/* ───────────────────────── map: Dorling cartogram ───────────────────────── */

function Cartogram({ geo, x, y, accent, width, height, show, hide, yName }: ExtraProps) {
  const [hot, setHot] = useState<number | null>(null)
  const lay = useMemo(() => {
    const feats = (geo?.features ?? []).filter(f => f.geometry)
    if (!feats.length || width < 60) return null
    const proj = d3.geoNaturalEarth1().fitExtent([[24, 24], [width - 24, height - 24]], { type: 'FeatureCollection', features: feats } as any)
    const path = d3.geoPath(proj)
    const vals = feats.map(f => Math.abs(toNum(f.properties?.[y]) ?? 0))
    const max = d3.max(vals) || 1
    const k = Math.sqrt((0.32 * width * height) / (Math.PI * (d3.sum(vals) / max || 1)))
    const rMax = Math.max(8, Math.min(k, Math.min(width, height) / 6))
    const nodes = feats.map((f, i) => {
      const [cx, cy] = proj(d3.geoCentroid(f as any)) ?? [width / 2, height / 2]
      return { i, f, v: vals[i], tx: cx, ty: cy, x: cx, y: cy, r: Math.max(1.5, rMax * Math.sqrt(vals[i] / max)) } as any
    })
    d3.forceSimulation(nodes).force('x', d3.forceX((d: any) => d.tx).strength(0.35)).force('y', d3.forceY((d: any) => d.ty).strength(0.35))
      .force('collide', d3.forceCollide((d: any) => d.r + 1).iterations(3)).stop().tick(220)
    const shapes = feats.some(f => String(f.geometry.type).includes('Polygon')) ? feats.map(f => path(f as any) ?? '') : []
    const color = d3.scaleSequential(d3.interpolateRgb(mix(accent, '#ffffff', 0.8), mix(accent, '#000000', 0.3))).domain([0, max])
    return { nodes, shapes, color }
  }, [geo, y, width, height, accent])
  if (!lay) return null
  return (
    <g>
      {lay.shapes.map((d, i) => <path key={i} d={d} fill="currentColor" fillOpacity={0.05} stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.5} />)}
      {[...lay.nodes].sort((a: any, b: any) => b.r - a.r).map((n: any) => {
        const name = str(n.f.properties?.[x]) || `#${n.i + 1}`
        return (
          <g key={n.i} opacity={hot === null || hot === n.i ? 1 : 0.55}
             onMouseMove={e => { setHot(n.i); show(e, name, [[yName, full(n.v)]]) }} onMouseLeave={() => { setHot(null); hide() }}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={lay.color(n.v)} stroke="var(--color-gisviz-card, white)" strokeWidth={1} />
            {n.r > 15 && <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(12, n.r / 2.6)} fontWeight={600}
                               fill={n.v / (lay.color.domain()[1] || 1) > 0.45 ? '#fff' : '#1c1c1c'} pointerEvents="none">{trunc(name, Math.floor(n.r / 3.6))}</text>}
          </g>
        )
      })}
    </g>
  )
}


/* ───────────────────────── ranking: connected ranking columns (Visual Capitalist style) ───────────────────────── */

function RankedColumns({ rows, x, y, z, fields, accent, width, height, show, hide, yName }: ExtraProps) {
  const flags = useFlags()
  const { cols, ranks } = useMemo(() => {
    const cols = z ? [...new Set(rows.map(r => str(r[z])))].slice(0, 5) : (fields?.length ? fields : [y]).slice(0, 5)
    const ranks = cols.map(c => rows
      .map(r => ({ item: str(r[x]), v: z ? (str(r[z]) === c ? toNum(r[y]) : null) : toNum(r[c]) }))
      .filter((d): d is { item: string; v: number } => !!d.item && d.v !== null)
      .sort((a, b) => b.v - a.v))
    return { cols, ranks }
  }, [rows, x, y, z, fields])
  const [hot, setHot] = useState<string | null>(null)
  if (!cols.length) return null
  const pal = palette(accent)
  const headH = 40
  const most = Math.max(...ranks.map(r => r.length), 1)
  const rowH = Math.max(24, Math.min(40, (height - headH - 6) / most))
  const n = Math.max(1, Math.floor((height - headH - 6) / rowH))
  const shown = ranks.map(r => r.slice(0, n))
  const colW = width / cols.length
  const chipW = Math.max(84, Math.min(168, colW * 0.6))
  const chipH = rowH - 5
  const cx = (i: number) => colW * i + colW / 2
  const ypos = (j: number) => headH + j * rowH
  const where = shown.map(r => new Map(r.map((d, j) => [d.item, j])))
  const fs = Math.max(10, Math.min(14, chipH * 0.42))
  const label = (item: string) => flags.code(item) ?? trunc(item, Math.floor(chipW / (fs * 0.62)) - 3)
  const colName = (c: string) => (z ? c : c.replace(/_/g, ' '))
  return (
    <g>
      {/* links: the same item in neighbouring columns, drawn as stepped lines in the left column's colour */}
      {shown.slice(0, -1).map((r, i) => r.map((d, j) => {
        const k = where[i + 1].get(d.item)
        if (k === undefined) return null
        const x0 = cx(i) + chipW / 2, x1 = cx(i + 1) - chipW / 2
        const off = (((j * 7 + k * 3) % 9) - 4) * Math.max(2, (x1 - x0) / 40)
        const mx = (x0 + x1) / 2 + off, y0 = ypos(j) + chipH / 2, y1 = ypos(k) + chipH / 2
        const on = !hot || hot === d.item
        return <path key={`${i}-${d.item}`} d={`M${x0},${y0}H${mx}V${y1}H${x1}`} fill="none" stroke={pal[i % pal.length]}
                     strokeWidth={on && hot ? 3 : 2} strokeOpacity={on ? (hot ? 0.95 : 0.5) : 0.08} strokeLinejoin="round" />
      }))}
      {cols.map((c, i) => {
        const col = pal[i % pal.length]
        return (
          <g key={c}>
            <text x={cx(i)} y={22} textAnchor="middle" fontSize={Math.min(20, colW / 7)} fontWeight={800} fill={col}
                  style={{ textTransform: 'capitalize', fontFamily: 'Oswald, "Arial Narrow", sans-serif', letterSpacing: '0.02em' }}>{trunc(colName(c), 22)}</text>
            {shown[i].map((d, j) => {
              const fill = mix(mix(col, '#000000', 0.12), '#ffffff', 0.5 * (j / Math.max(1, n - 1)))
              const url = flags.flag(d.item)
              const on = !hot || hot === d.item
              const x0 = cx(i) - chipW / 2, y0 = ypos(j)
              return (
                <g key={d.item} opacity={on ? 1 : 0.3}
                   onMouseMove={e => { setHot(d.item); show(e, d.item, cols.map((cc, k) => [colName(cc), (() => {
                     const rk = ranks[k].findIndex(q => q.item === d.item)
                     return rk < 0 ? '—' : `${full(ranks[k][rk].v)}  (#${rk + 1})`
                   })()] as [string, string])) }}
                   onMouseLeave={() => { setHot(null); hide() }}>
                  <rect x={x0 + 2} y={y0 + 2} width={chipW} height={chipH} rx={chipH * 0.28} fill="#000" fillOpacity={0.12} />
                  <rect x={x0} y={y0} width={chipW} height={chipH} rx={chipH * 0.28} fill={fill} stroke={hot === d.item ? 'currentColor' : 'none'} strokeWidth={1.5} />
                  {url && (
                    <>
                      <clipPath id={`gvf-${i}-${j}`}><rect x={x0 + 4} y={y0 + 4} width={chipH * 1.35} height={chipH - 8} rx={3} /></clipPath>
                      <rect x={x0 + 3} y={y0 + 3} width={chipH * 1.35 + 2} height={chipH - 6} rx={4} fill="#fff" />
                      <image href={url} onError={() => flags.failed(url)} x={x0 + 4} y={y0 + 4} width={chipH * 1.35} height={chipH - 8} preserveAspectRatio="xMidYMid slice" clipPath={`url(#gvf-${i}-${j})`} />
                    </>
                  )}
                  <text x={x0 + (url ? chipH * 1.35 + 10 : 9)} y={y0 + chipH / 2} dominantBaseline="middle" fontSize={fs} fontWeight={800} fill="#fff">
                    {label(d.item)}
                  </text>
                  <text x={x0 + chipW - 8} y={y0 + chipH / 2} dominantBaseline="middle" textAnchor="end" fontSize={fs * 0.92} fontWeight={600} fill="#fff" fillOpacity={0.95}>
                    {compact(d.v)}
                  </text>
                </g>
              )
            })}
            {ranks[i].length > n && <text x={cx(i)} y={ypos(n) + 12} textAnchor="middle" fontSize={10.5} fill="currentColor" fillOpacity={0.7}>+{ranks[i].length - n} more</text>}
          </g>
        )
      })}
    </g>
  )
}