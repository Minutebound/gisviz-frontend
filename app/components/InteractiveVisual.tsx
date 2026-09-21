'use client'

/**
 * InteractiveVisual
 * -----------------
 * Renders a post's visual as a live, hoverable chart or map instead of a
 * static image. One component, two renderers:
 *
 *   kind: 'chart'  -> dependency-free SVG line / bar / scatter with tooltips
 *   kind: 'map'    -> MapLibre GL (free, no API key) with hover popups
 *
 * Both share a Chart|Map / Data toggle, a column picker, a fullscreen
 * button, and the gisviz theme tokens (light + dark).
 *
 * Maps can also carry a time dimension (`time`): geometry is stored once,
 * values come from a long-format series table, and a year slider with
 * play/pause swaps them in without rebuilding the map.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent, Popup } from 'maplibre-gl'
import {
  AlertTriangle, BarChart3, Loader2, Map as MapIcon, Maximize2, Minimize2, Pause, Play, Table2,
} from 'lucide-react'

/* ═══════════════════ Types: the post's `visual_spec` ═══════════════════ */

export type ChartType = 'line' | 'bar' | 'scatter'
export type Row = Record<string, unknown>

export interface GeoFeature {
  type: 'Feature'
  id?: string | number
  geometry: { type: string; coordinates: unknown } | null
  properties: Row | null
}
export interface GeoFeatureCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

export interface ChartSpec {
  kind: 'chart'
  chart_type: ChartType
  /** Inline rows, or a URL returning a JSON array of rows. */
  data: Row[] | string
  /** x-axis column (category/date label, or a number for scatter). */
  x: string
  /** Numeric column plotted by default. */
  y: string
  /** Numeric columns the viewer can switch between. Defaults to [y]. */
  fields?: string[]
  /** Chart types the viewer can switch between. Defaults to [chart_type]. */
  allowed_types?: ChartType[]
}

export interface MapSpec {
  kind: 'map'
  /** Inline GeoJSON FeatureCollection, or a URL returning one. */
  data: GeoFeatureCollection | string
  /** Numeric property that drives colour (and point size). */
  value_field: string
  /** Property used as the popup title, e.g. "name". */
  label_field?: string
  /** Numeric properties the viewer can switch between. Defaults to [value_field]. */
  fields?: string[]
  /** Any MapLibre style URL. Defaults to OpenFreeMap (free, keyless), themed. */
  basemap_style?: string
  /**
   * Optional time dimension. Geometry lives once in `data`; values that change
   * over time live in `series` (long format: one row per feature per period),
   * joined on `join`. Adds a slider + play button under the map.
   */
  time?: MapTimeSpec
}

export interface MapTimeSpec {
  /** Column in `series` holding the period, e.g. "year". */
  field: string
  /** Property present on both the features and the series rows, e.g. "iso3". */
  join: string
  /** Long-format rows `{ [join], [field], ...values }`, or a URL returning them. */
  series: Row[] | string
  /** Milliseconds per step while playing. Default 900. */
  interval_ms?: number
  /** Which period to open on: 'first' (default) or 'last'. */
  start?: 'first' | 'last'
}

export type VisualSpec = ChartSpec | MapSpec

/* ═══════════════════ Helpers ═══════════════════ */

const BASEMAP_LIGHT = 'https://tiles.openfreemap.org/styles/positron'
const BASEMAP_DARK = 'https://tiles.openfreemap.org/styles/dark'
const NULL_COLOR = '#9aa8a1'
const EMPTY_ROWS: Row[] = []

/** Plain background used when the basemap can't be fetched, so the data still renders. */
const fallbackStyle = (dark: boolean) => ({
  version: 8 as const,
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': dark ? '#0c1611' : '#eef2ef' } }],
})
const SRC = 'gv-src'

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

const fmt = (v: unknown): string => {
  const n = toNum(v)
  if (n === null) {
    if (v == null || v === '') return '—'
    return typeof v === 'object' ? JSON.stringify(v) : String(v)
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 })
}

const compact = (n: number) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** User data ends up in popup HTML, so always escape it. */
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1
    min -= pad
    max += pad
  }
  const raw = (max - min) / Math.max(1, count)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = start; v <= end + step / 2; v += step) out.push(Number(v.toFixed(12)))
  return out
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0')
const rgbToHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

function mixHex(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  const [r, g, bl] = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return rgbToHex(r, g, bl)
}

/**
 * MapLibre can't read CSS variables, so paint a hidden element with
 * `text-gisviz-accent`, rasterise its colour to one pixel and read it back
 * as hex. Works whatever colour format --accent is written in.
 */
function useAccentHex(probe: React.RefObject<HTMLElement | null>, fallback = '#f65821') {
  const [hex, setHex] = useState(fallback)
  useEffect(() => {
    const el = probe.current
    if (!el) return
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.fillStyle = fallback
    ctx.fillStyle = getComputedStyle(el).color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    setHex(rgbToHex(r, g, b))
  }, [probe, fallback])
  return hex
}

type Loaded<T> = { value: T | null; error: string | null; loading: boolean }

function useSpecData<T>(data: T | string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>(() =>
    typeof data === 'string'
      ? { value: null, error: null, loading: true }
      : { value: data, error: null, loading: false },
  )
  useEffect(() => {
    if (typeof data !== 'string') {
      setState({ value: data, error: null, loading: false })
      return
    }
    let cancelled = false
    setState({ value: null, error: null, loading: true })
    fetch(data)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(json => { if (!cancelled) setState({ value: json as T, error: null, loading: false }) })
      .catch((e: Error) => { if (!cancelled) setState({ value: null, error: e.message, loading: false }) })
    return () => { cancelled = true }
  }, [data])
  return state
}

function useElementSize<T extends HTMLElement>() {
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

/* ═══════════════════ Chart renderer (no dependencies) ═══════════════════ */

interface Pt { row: Row; xRaw: unknown; xNum: number | null; y: number }

function ChartView({ rows, x, field, fields, type }: {
  rows: Row[]; x: string; field: string; fields: string[]; type: ChartType
}) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const pts = useMemo(() => {
    const out: Pt[] = []
    for (const row of rows) {
      const y = toNum(row[field])
      if (y !== null) out.push({ row, xRaw: row[x], xNum: toNum(row[x]), y })
    }
    return out
  }, [rows, x, field])

  useEffect(() => setHover(null), [field, type])

  const L = useMemo(() => {
    if (!pts.length || width < 80 || height < 80) return null
    const M = { top: 18, right: 20, bottom: 42, left: 58 }
    const iw = width - M.left - M.right
    const ih = height - M.top - M.bottom

    const ys = pts.map(p => p.y)
    let yLo = Math.min(...ys)
    let yHi = Math.max(...ys)
    if (type === 'bar') { yLo = Math.min(0, yLo); yHi = Math.max(0, yHi) }
    const yTicks = niceTicks(yLo, yHi, Math.max(2, Math.floor(ih / 64)))
    const y0 = yTicks[0]
    const y1 = yTicks[yTicks.length - 1]
    const sy = (v: number) => M.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih
    const bottom = M.top + ih
    const zeroY = sy(clamp(0, y0, y1))

    const numericX = type === 'scatter' && pts.every(p => p.xNum !== null)
    const band = iw / pts.length
    let xOf: (k: number) => number
    let xLabels: { x: number; text: string }[]

    if (numericX) {
      const xs = pts.map(p => p.xNum as number)
      const xt = niceTicks(Math.min(...xs), Math.max(...xs), Math.max(2, Math.floor(iw / 90)))
      const x0 = xt[0]
      const x1 = xt[xt.length - 1]
      const sx = (v: number) => M.left + ((v - x0) / (x1 - x0 || 1)) * iw
      xOf = k => sx(pts[k].xNum as number)
      xLabels = xt.map(t => ({ x: sx(t), text: compact(t) }))
    } else {
      xOf = k => M.left + band * (k + 0.5)
      const every = Math.ceil(pts.length / Math.max(1, Math.floor(iw / 72)))
      xLabels = pts.flatMap((p, k) =>
        k % every === 0 ? [{ x: xOf(k), text: truncate(String(p.xRaw ?? ''), 10) }] : [])
    }
    return { M, iw, ih, bottom, zeroY, yTicks, sy, xOf, band, numericX, xLabels }
  }, [pts, width, height, type])

  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    if (!L) return
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const mx = e.clientX - box.left
    const my = e.clientY - box.top
    if (L.numericX) {
      let best = -1
      let bestD = Infinity
      pts.forEach((p, k) => {
        const d = Math.hypot(L.xOf(k) - mx, L.sy(p.y) - my)
        if (d < bestD) { bestD = d; best = k }
      })
      setHover(bestD < 40 ? best : null)
    } else {
      const k = Math.floor((mx - L.M.left) / L.band)
      setHover(k >= 0 && k < pts.length ? k : null)
    }
  }

  if (!pts.length) {
    return (
      <div className="h-full flex items-center justify-center text-[13.5px] text-gisviz-ink-soft">
        No numeric values in <span className="font-mono mx-1">{field}</span> to plot.
      </div>
    )
  }

  const tip = hover !== null && L ? { x: L.xOf(hover), y: L.sy(pts[hover].y), p: pts[hover] } : null
  const tipBelow = tip ? tip.y < 120 : false
  const showDots = type === 'line' && pts.length <= 80

  return (
    <div ref={ref} className="relative w-full h-full text-gisviz-accent">
      {L && (
        <svg width={width} height={height} className="block select-none touch-none" role="img"
             aria-label={`${type} chart of ${field} by ${x}`}>
          {L.yTicks.map(t => (
            <g key={t}>
              <line x1={L.M.left} x2={width - L.M.right} y1={L.sy(t)} y2={L.sy(t)}
                    className="stroke-gisviz-border" strokeWidth={1}
                    strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={L.M.left - 10} y={L.sy(t)} dy="0.32em" textAnchor="end" fontSize={11.5}
                    className="fill-gisviz-ink-soft font-mono">{compact(t)}</text>
            </g>
          ))}

          {L.xLabels.map((l, i) => (
            <text key={i} x={l.x} y={L.bottom + 22} textAnchor="middle" fontSize={11.5}
                  className="fill-gisviz-ink-soft">{l.text}</text>
          ))}

          {tip && type !== 'bar' && (
            <line x1={tip.x} x2={tip.x} y1={L.M.top} y2={L.bottom}
                  className="stroke-gisviz-ink-soft" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />
          )}

          {type === 'line' && (() => {
            const line = pts.map((p, k) => `${k ? 'L' : 'M'}${L.xOf(k)},${L.sy(p.y)}`).join('')
            const area = `${line}L${L.xOf(pts.length - 1)},${L.bottom}L${L.xOf(0)},${L.bottom}Z`
            return (
              <>
                <path d={area} fill="currentColor" opacity={0.08} />
                <path d={line} fill="none" stroke="currentColor" strokeWidth={2.25}
                      strokeLinejoin="round" strokeLinecap="round" />
                {showDots && pts.map((p, k) => (
                  <circle key={k} cx={L.xOf(k)} cy={L.sy(p.y)} r={hover === k ? 5.5 : 3}
                          fill="currentColor" className="stroke-gisviz-card" strokeWidth={hover === k ? 2 : 0} />
                ))}
                {!showDots && tip && (
                  <circle cx={tip.x} cy={tip.y} r={5.5} fill="currentColor"
                          className="stroke-gisviz-card" strokeWidth={2} />
                )}
              </>
            )
          })()}

          {type === 'bar' && pts.map((p, k) => {
            const bw = Math.max(2, Math.min(56, L.band * 0.68))
            const top = L.sy(p.y)
            return (
              <rect key={k} x={L.xOf(k) - bw / 2} y={Math.min(top, L.zeroY)}
                    width={bw} height={Math.max(1, Math.abs(L.zeroY - top))}
                    rx={Math.min(4, bw / 4)} fill="currentColor"
                    opacity={hover === null ? 0.85 : hover === k ? 1 : 0.4}
                    style={{ transition: 'opacity 120ms' }} />
            )
          })}

          {type === 'scatter' && pts.map((p, k) => (
            <circle key={k} cx={L.xOf(k)} cy={L.sy(p.y)} r={hover === k ? 7.5 : 5}
                    fill="currentColor" opacity={hover === null || hover === k ? 0.8 : 0.3}
                    className="stroke-gisviz-card" strokeWidth={hover === k ? 2 : 1} />
          ))}

          {/* One transparent hit area drives all hovering (mouse + touch). */}
          <rect x={L.M.left} y={L.M.top} width={L.iw} height={L.ih} fill="transparent"
                onPointerMove={onPointer} onPointerDown={onPointer}
                onPointerLeave={() => setHover(null)} />
        </svg>
      )}

      {tip && (
        <div
          className="pointer-events-none absolute z-10 min-w-[170px] rounded-[10px] border border-gisviz-border bg-gisviz-card px-3 py-2 text-[12.5px] shadow-lg"
          style={{
            left: clamp(tip.x, 95, Math.max(95, width - 95)),
            top: tipBelow ? tip.y + 14 : tip.y - 14,
            transform: `translate(-50%, ${tipBelow ? '0' : '-100%'})`,
          }}
        >
          <div className="mb-1 font-semibold text-gisviz-ink">
            {L?.numericX ? `${x}: ${fmt(tip.p.xRaw)}` : String(tip.p.xRaw ?? '—')}
          </div>
          {fields.map(f => (
            <div key={f} className={`flex justify-between gap-4 ${f === field ? 'font-semibold text-gisviz-accent' : 'text-gisviz-ink-soft'}`}>
              <span>{f}</span>
              <span className="font-mono">{fmt(tip.p.row[f])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════ Map renderer (MapLibre) ═══════════════════ */

type GeomKind = 'point' | 'polygon' | 'line'

/** One period of one feature's history, used for the popup sparkline. */
export interface HistoryPoint { t: unknown; row: Row }

function detectKind(fc: GeoFeatureCollection): GeomKind {
  const t = fc.features.find(f => f.geometry)?.geometry?.type ?? 'Point'
  if (t.includes('Polygon')) return 'polygon'
  if (t.includes('LineString')) return 'line'
  return 'point'
}

function bbox(fc: GeoFeatureCollection): [[number, number], [number, number]] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1])
    } else c.forEach(walk)
  }
  fc.features.forEach(f => f.geometry && walk(f.geometry.coordinates))
  return Number.isFinite(w) ? [[w, s], [e, n]] : null
}

/* MapLibre style expressions are loosely typed JSON arrays. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Expr = any

interface FieldStats { lo: number; hi: number; breaks: number[] }

/**
 * Colour stops at the 0/25/50/75/100th percentiles. Quantiles keep skewed
 * data readable (Nigeria vs Eswatini); for time series the values come from
 * every period, so the scale stays fixed and change over time is visible.
 */
function fieldStats(vals: number[]): FieldStats {
  if (!vals.length) return { lo: 0, hi: 0, breaks: [0, 0, 0, 0, 0] }
  vals.sort((a, b) => a - b)
  const lo = vals[0]
  const hi = vals[vals.length - 1]
  const breaks = [0, 0.25, 0.5, 0.75, 1].map(q => vals[Math.round(q * (vals.length - 1))])
  const eps = (hi - lo) * 1e-6 || 1e-6
  for (let i = 1; i < breaks.length; i++) if (breaks[i] <= breaks[i - 1]) breaks[i] = breaks[i - 1] + eps
  return { lo, hi, breaks }
}

function colorExpr(field: string, st: FieldStats, ramp: string[]): Expr {
  const v = ['get', field]
  const scale = st.lo === st.hi
    ? ramp[3]
    : ['interpolate', ['linear'], v, ...st.breaks.flatMap((b, i) => [b, ramp[i]])]
  return ['case', ['==', ['typeof', v], 'number'], scale, NULL_COLOR]
}

function radiusExpr(field: string, st: FieldStats): Expr {
  const v = ['get', field]
  const scale = st.lo === st.hi ? 9 : ['interpolate', ['linear'], v, st.lo, 6, st.hi, 24]
  return ['case', ['==', ['typeof', v], 'number'], scale, 4]
}

function sparkline(values: (number | null)[], at: number) {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length < 2) return ''
  const W = 176, H = 34, lo = Math.min(...nums), hi = Math.max(...nums)
  const x = (i: number) => (i / (values.length - 1)) * (W - 8) + 4
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8)
  let d = ''
  values.forEach((v, i) => {
    if (v !== null) d += `${i > 0 && values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  const cur = at >= 0 ? values[at] : null
  const dot = cur !== null && cur !== undefined
    ? `<circle cx="${x(at).toFixed(1)}" cy="${y(cur).toFixed(1)}" r="3.5" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>`
    : ''
  return `<svg class="gv-pop-spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">` +
    `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.75" stroke-linejoin="round" opacity=".85"/>${dot}</svg>`
}

interface PopupCtx {
  labelField?: string; fields: string[]; field: string
  currentT?: unknown; historyOf?: (props: Row) => HistoryPoint[]
}

function popupHtml(props: Row, c: PopupCtx) {
  const title = c.labelField && props[c.labelField] != null
    ? `<div class="gv-pop-title">${escapeHtml(String(props[c.labelField]))}</div>` : ''
  const when = c.currentT !== undefined ? `<div class="gv-pop-when">${escapeHtml(String(c.currentT))}</div>` : ''
  const rows = c.fields.map(f =>
    `<div class="gv-pop-row${f === c.field ? ' gv-pop-active' : ''}">` +
    `<span>${escapeHtml(f)}</span><span class="gv-pop-val">${escapeHtml(fmt(props[f]))}</span></div>`,
  ).join('')
  let spark = ''
  const hist = c.historyOf?.(props) ?? []
  if (hist.length > 1) {
    const at = hist.findIndex(h => String(h.t) === String(c.currentT))
    spark = sparkline(hist.map(h => toNum(h.row[c.field])), at) +
      `<div class="gv-pop-axis"><span>${escapeHtml(String(hist[0].t))}</span><span>${escapeHtml(String(hist[hist.length - 1].t))}</span></div>`
  }
  return `${title}${when}${rows}${spark}`
}

function MapView({ fc, field, fields, labelField, basemap, accent, dark, domainRows, historyOf, currentT }: {
  fc: GeoFeatureCollection; field: string; fields: string[]
  labelField?: string; basemap: string; accent: string; dark: boolean
  /** Every period's rows (time series), so the colour scale doesn't shift as time moves. */
  domainRows?: Row[]
  historyOf?: (props: Row) => HistoryPoint[]
  currentT?: unknown
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const hoverIdRef = useRef<number | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const kind = useMemo(() => detectKind(fc), [fc])

  const ramp = useMemo(
    () => [
      mixHex(accent, '#ffffff', 0.85), mixHex(accent, '#ffffff', 0.6), mixHex(accent, '#ffffff', 0.3),
      accent, mixHex(accent, '#000000', 0.42),
    ],
    [accent],
  )

  const stats = useMemo(() => {
    const source: Row[] = domainRows ?? fc.features.map(f => f.properties ?? {})
    const r: Record<string, FieldStats> = {}
    for (const f of fields) {
      const vals: number[] = []
      for (const row of source) { const n = toNum(row[f]); if (n !== null) vals.push(n) }
      r[f] = fieldStats(vals)
    }
    return r
  }, [domainRows, fc, fields])

  // Map handlers are registered once, so they read live values through a ref.
  const ctx: PopupCtx = { labelField, fields, field, currentT, historyOf }
  const live = useRef({ ctx, stats, ramp, field, fc })
  live.current = { ctx, stats, ramp, field, fc }

  useEffect(() => {
    let disposed = false
    let map: MLMap | null = null
    let ro: ResizeObserver | null = null

    ;(async () => {
      // Client-only import: maplibre touches `window` at load time.
      const mod = await import('maplibre-gl')
      const ml = (mod as unknown as { default?: typeof mod }).default ?? mod
      const el = containerRef.current
      if (disposed || !el) return

      const bb = bbox(live.current.fc)
      map = new ml.Map({
        container: el,
        style: basemap,
        ...(bb
          ? { bounds: bb, fitBoundsOptions: { padding: 40, maxZoom: 11 } }
          : { center: [0, 20] as [number, number], zoom: 1.5 }),
        cooperativeGestures: true, // don't hijack page scroll; ctrl/⌘ + scroll to zoom
        attributionControl: { compact: true },
      })
      mapRef.current = map

      // Basemap unreachable (tile server down, blocked network): MapLibre would
      // never fire 'load' and the data would never appear. Swap to a plain
      // background once so the post's data still renders.
      let fellBack = false
      map.on('error', () => {
        if (!map || fellBack || map.isStyleLoaded()) return
        fellBack = true
        map.setStyle(fallbackStyle(dark))
      })

      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')

      ro = new ResizeObserver(() => map?.resize())
      ro.observe(el)

      const popup = new ml.Popup({
        closeButton: false, closeOnClick: false, offset: 12, maxWidth: '300px', className: 'gv-popup',
      })
      popupRef.current = popup

      map.on('load', () => {
        if (!map || disposed) return
        const { field: f, stats: st, ramp: rp } = live.current
        const color = colorExpr(f, st[f], rp)
        const hovered: Expr = ['boolean', ['feature-state', 'hover'], false]

        // generateId gives each feature its array index as id; setData keeps
        // the same order each period, so hover state survives time changes.
        map.addSource(SRC, { type: 'geojson', data: live.current.fc as Expr, generateId: true })

        let hit: string
        if (kind === 'point') {
          map.addLayer({
            id: 'gv-point', type: 'circle', source: SRC,
            paint: {
              'circle-color': color,
              'circle-radius': radiusExpr(f, st[f]),
              'circle-opacity': 0.88,
              'circle-stroke-width': ['case', hovered, 2.5, 1],
              'circle-stroke-color': ['case', hovered, '#14201b', '#ffffff'],
            },
          })
          hit = 'gv-point'
        } else if (kind === 'polygon') {
          map.addLayer({
            id: 'gv-fill', type: 'fill', source: SRC,
            paint: { 'fill-color': color, 'fill-opacity': ['case', hovered, 0.95, 0.8] },
          })
          map.addLayer({
            id: 'gv-outline', type: 'line', source: SRC,
            paint: {
              'line-color': ['case', hovered, '#14201b', '#ffffff'],
              'line-width': ['case', hovered, 2, 0.6],
            },
          })
          hit = 'gv-fill'
        } else {
          map.addLayer({
            id: 'gv-line', type: 'line', source: SRC,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': color, 'line-width': ['case', hovered, 6, 3.5] },
          })
          hit = 'gv-line'
        }

        const show = (e: MapLayerMouseEvent) => {
          const ft = e.features?.[0]
          if (!ft || !map) return
          map.getCanvas().style.cursor = 'pointer'
          const prev = hoverIdRef.current
          if (prev !== undefined) map.setFeatureState({ source: SRC, id: prev }, { hover: false })
          const id = typeof ft.id === 'number' ? ft.id : undefined
          hoverIdRef.current = id
          if (id !== undefined) map.setFeatureState({ source: SRC, id }, { hover: true })
          const at = kind === 'point' && ft.geometry.type === 'Point'
            ? (ft.geometry.coordinates as [number, number])
            : e.lngLat
          popup.setLngLat(at).setHTML(popupHtml(ft.properties as Row, live.current.ctx)).addTo(map)
        }
        const clear = () => {
          if (!map) return
          map.getCanvas().style.cursor = ''
          const prev = hoverIdRef.current
          if (prev !== undefined) map.setFeatureState({ source: SRC, id: prev }, { hover: false })
          hoverIdRef.current = undefined
          popup.remove()
        }

        map.on('mousemove', hit, show)
        map.on('click', hit, show) // touch: tap to inspect
        map.on('mouseleave', hit, clear)
        setReady(true)
      })
    })()

    return () => {
      disposed = true
      ro?.disconnect()
      map?.remove()
      mapRef.current = null
      popupRef.current = null
      hoverIdRef.current = undefined
      setReady(false)
    }
    // Geometry type and basemap rebuild the map; data changes go through setData below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, basemap, labelField])

  // New period (or new data): swap the source data in place, no map rebuild.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource(SRC) as GeoJSONSource | undefined)?.setData(fc as Expr)
    // Keep an open popup in sync while the timeline plays underneath it.
    const id = hoverIdRef.current
    const props = id !== undefined ? fc.features[id]?.properties : null
    if (popupRef.current?.isOpen() && props) popupRef.current.setHTML(popupHtml(props, live.current.ctx))
  }, [fc, ready])

  // Column picker: restyle on the GPU, no data reload.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const color = colorExpr(field, stats[field], ramp)
    if (kind === 'point') {
      map.setPaintProperty('gv-point', 'circle-color', color)
      map.setPaintProperty('gv-point', 'circle-radius', radiusExpr(field, stats[field]))
    } else if (kind === 'polygon') {
      map.setPaintProperty('gv-fill', 'fill-color', color)
    } else {
      map.setPaintProperty('gv-line', 'line-color', color)
    }
    const id = hoverIdRef.current
    const props = id !== undefined ? live.current.fc.features[id]?.properties : null
    if (popupRef.current?.isOpen() && props) popupRef.current.setHTML(popupHtml(props, live.current.ctx))
  }, [field, stats, ramp, ready, kind])

  const st = stats[field] ?? { lo: 0, hi: 0, breaks: [0, 0, 0, 0, 0] }

  return (
    <div className="relative w-full h-full">
      {/* Popup themed with gisviz tokens so it follows light/dark mode. */}
      <style>{`
        .gv-popup .maplibregl-popup-content{background:var(--card);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:8px 12px;box-shadow:0 8px 24px rgba(0,0,0,.18);font:12.5px/1.55 var(--font-sans);min-width:190px}
        .gv-popup .maplibregl-popup-tip{display:none}
        .gv-pop-title{font-weight:600}
        .gv-pop-when{font-family:var(--font-mono);font-size:11px;color:var(--ink-soft);margin-bottom:4px}
        .gv-pop-row{display:flex;justify-content:space-between;gap:16px;color:var(--ink-soft)}
        .gv-pop-active{color:var(--accent);font-weight:600}
        .gv-pop-val{font-family:var(--font-mono)}
        .gv-pop-spark{display:block;margin-top:6px}
        .gv-pop-axis{display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);margin-top:-2px}
      `}</style>
      {/* h-full, not absolute inset-0: maplibre CSS forces position:relative on this node */}
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute left-3 bottom-3 z-10 w-[200px] rounded-[10px] border border-gisviz-border bg-gisviz-card/95 px-3 py-2 shadow-sm backdrop-blur-sm">
        <div className="mb-1.5 truncate font-mono text-[11px] font-semibold text-gisviz-ink">{field}</div>
        <div className="h-2 rounded-full" style={{ background: `linear-gradient(to right, ${ramp.join(',')})` }} />
        <div className="mt-1 flex justify-between font-mono text-[10.5px] text-gisviz-ink-soft">
          <span>{compact(st.breaks[0])}</span><span>{compact(st.breaks[2])}</span><span>{compact(st.breaks[4])}</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════ Data table ═══════════════════ */

const TABLE_LIMIT = 500

function DataTable({ rows }: { rows: Row[] }) {
  const shown = rows.slice(0, TABLE_LIMIT)
  const cols = useMemo(() => {
    const set = new Set<string>()
    rows.slice(0, 50).forEach(r => Object.keys(r).forEach(k => set.add(k)))
    return [...set]
  }, [rows])
  const numeric = useMemo(() => {
    const out: Record<string, boolean> = {}
    for (const c of cols) {
      const vals = shown.map(r => r[c]).filter(v => v != null && v !== '')
      out[c] = vals.length > 0 && vals.every(v => toNum(v) !== null)
    }
    return out
  }, [cols, shown])

  return (
    <div className="h-full overflow-auto" style={{ scrollbarWidth: 'thin' }}>
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-gisviz-paper">
          <tr>
            {cols.map(c => (
              <th key={c} className={`whitespace-nowrap border-b border-gisviz-border px-3 py-2 font-mono text-[11.5px] font-semibold uppercase tracking-wide text-gisviz-ink-soft ${numeric[c] ? 'text-right' : 'text-left'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i} className="border-b border-gisviz-border/50 hover:bg-gisviz-paper/60">
              {cols.map(c => (
                <td key={c} className={`whitespace-nowrap px-3 py-1.5 text-gisviz-ink ${numeric[c] ? 'text-right font-mono text-[12.5px]' : ''}`}>
                  {truncate(fmt(r[c]), 60)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > TABLE_LIMIT && (
        <p className="px-3 py-2.5 text-[12px] text-gisviz-ink-soft">
          Showing first {TABLE_LIMIT.toLocaleString()} of {rows.length.toLocaleString()} rows.
        </p>
      )}
    </div>
  )
}

/* ═══════════════════ Main component ═══════════════════ */

const TYPE_LABEL: Record<ChartType, string> = { line: 'Line', bar: 'Bar', scatter: 'Scatter' }

/** CSVs often give numbers as strings; coerce the colour fields so MapLibre sees real numbers. */
function normalizeFc(fc: GeoFeatureCollection, fields: string[]): GeoFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features
      .filter(f => f.geometry)
      .map(f => {
        const p: Row = { ...(f.properties ?? {}) }
        for (const k of fields) {
          const n = toNum(p[k])
          if (n !== null) p[k] = n
        }
        return { ...f, properties: p }
      }),
  }
}

export default function InteractiveVisual({ spec, height = 520, className = '' }: {
  spec: VisualSpec
  height?: number
  className?: string
}) {
  const probeRef = useRef<HTMLSpanElement>(null)
  const accent = useAccentHex(probeRef)
  const { resolvedTheme } = useTheme()
  const main = useSpecData<Row[] | GeoFeatureCollection>(spec.data)
  const time = spec.kind === 'map' ? spec.time : undefined
  const seriesState = useSpecData<Row[]>(time ? time.series : EMPTY_ROWS)

  const defaultField = spec.kind === 'chart' ? spec.y : spec.value_field
  const fields = useMemo(() => {
    const f = spec.fields?.length ? spec.fields : [defaultField]
    return f.includes(defaultField) ? f : [defaultField, ...f]
  }, [spec.fields, defaultField])
  const allowedTypes: ChartType[] = spec.kind === 'chart'
    ? (spec.allowed_types?.length ? spec.allowed_types : [spec.chart_type])
    : []

  const [view, setView] = useState<'visual' | 'table'>('visual')
  const [field, setField] = useState(defaultField)
  const [chartType, setChartType] = useState<ChartType>(spec.kind === 'chart' ? spec.chart_type : 'line')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setField(defaultField)
    if (spec.kind === 'chart') setChartType(spec.chart_type)
  }, [spec, defaultField])

  // Fullscreen: Esc closes, page scroll locked.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [expanded])

  /* ── geometry ── */
  const fc = useMemo(() => {
    const value = main.value
    if (spec.kind !== 'map' || !value || Array.isArray(value)) return null
    return value.type === 'FeatureCollection' && Array.isArray(value.features) ? normalizeFc(value, fields) : null
  }, [spec.kind, main.value, fields])

  /* ── time series: long-format rows joined onto the geometry ── */
  const series = useMemo<Row[] | null>(() => {
    if (!time || !Array.isArray(seriesState.value)) return null
    return seriesState.value.map(r => {
      const out: Row = { ...r }
      for (const k of fields) { const n = toNum(out[k]); if (n !== null) out[k] = n }
      return out
    })
  }, [time, seriesState.value, fields])

  const times = useMemo<unknown[]>(() => {
    if (!time || !series) return []
    const seen = new Map<string, unknown>()
    for (const r of series) { const t = r[time.field]; if (t != null && t !== '') seen.set(String(t), t) }
    const uniq = [...seen.values()]
    return uniq.every(t => toNum(t) !== null)
      ? uniq.sort((a, b) => (toNum(a) as number) - (toNum(b) as number))
      : uniq.sort((a, b) => String(a).localeCompare(String(b)))
  }, [time, series])

  const lookup = useMemo(() => {
    const m = new Map<string, Map<string, Row>>()
    if (!time || !series) return m
    for (const r of series) {
      const k = String(r[time.join])
      if (!m.has(k)) m.set(k, new Map())
      m.get(k)!.set(String(r[time.field]), r)
    }
    return m
  }, [time, series])

  const [tIdx, setTIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const lastIdx = Math.max(0, times.length - 1)

  useEffect(() => {
    setPlaying(false)
    setTIdx(time?.start === 'last' ? Math.max(0, times.length - 1) : 0)
  }, [times.length, time?.start])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setTIdx(i => Math.min(i + 1, lastIdx)), time?.interval_ms ?? 900)
    return () => window.clearInterval(id)
  }, [playing, lastIdx, time?.interval_ms])

  useEffect(() => { if (playing && tIdx >= lastIdx) setPlaying(false) }, [playing, tIdx, lastIdx])

  const togglePlay = () => {
    if (!playing && tIdx >= lastIdx) setTIdx(0)
    setPlaying(p => !p)
  }

  const currentT = times.length ? times[Math.min(tIdx, lastIdx)] : undefined

  const viewFc = useMemo(() => {
    if (!fc || !time || currentT === undefined) return fc
    const tKey = String(currentT)
    return {
      type: 'FeatureCollection' as const,
      features: fc.features.map(f => {
        const row = lookup.get(String(f.properties?.[time.join]))?.get(tKey)
        return { ...f, properties: { ...(f.properties ?? {}), [time.field]: currentT, ...(row ?? {}) } }
      }),
    }
  }, [fc, time, currentT, lookup])

  const historyOf = useCallback((props: Row): HistoryPoint[] => {
    if (!time) return []
    const byT = lookup.get(String(props[time.join]))
    return times.map(t => ({ t, row: byT?.get(String(t)) ?? {} }))
  }, [time, times, lookup])

  /* ── rows for the Data tab ── */
  const rows = useMemo<Row[] | null>(() => {
    if (spec.kind === 'chart') return Array.isArray(main.value) ? (main.value as Row[]) : null
    if (!fc) return null
    if (time && series) {
      const label = spec.label_field
      const names = new Map(fc.features.map(f => [String(f.properties?.[time.join]), f.properties?.[label ?? '']]))
      return label ? series.map(r => ({ [label]: names.get(String(r[time.join])), ...r })) : series
    }
    return fc.features.map(f => f.properties ?? {})
  }, [spec, main.value, fc, time, series])

  const basemap = spec.kind === 'map'
    ? spec.basemap_style ?? (resolvedTheme === 'dark' ? BASEMAP_DARK : BASEMAP_LIGHT)
    : BASEMAP_LIGHT

  const loading = main.loading || seriesState.loading
  const error = main.error || seriesState.error
  const badData = !loading && !error && (!rows || (time && !times.length))
  const showTimeBar = spec.kind === 'map' && !!time && times.length > 1 && !!rows && !badData

  const segBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] text-[12.5px] font-semibold transition-colors ${
      active ? 'bg-gisviz-card text-gisviz-ink shadow-sm' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`

  return (
    <div
      className={expanded
        ? 'fixed inset-0 z-[100] flex flex-col bg-gisviz-card'
        : `rounded-[16px] border border-gisviz-border bg-gisviz-card shadow-sm overflow-hidden ${className}`}
    >
      <span ref={probeRef} aria-hidden className="hidden text-gisviz-accent" />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gisviz-border bg-gisviz-paper/40 px-3 py-2.5 sm:px-4">
        <div className="inline-flex rounded-[8px] border border-gisviz-border bg-gisviz-paper p-0.5">
          <button type="button" onClick={() => setView('visual')} className={segBtn(view === 'visual')}>
            {spec.kind === 'map' ? <MapIcon size={14} /> : <BarChart3 size={14} />}
            {spec.kind === 'map' ? 'Map' : 'Chart'}
          </button>
          <button type="button" onClick={() => setView('table')} className={segBtn(view === 'table')}>
            <Table2 size={14} /> Data
          </button>
        </div>

        {view === 'visual' && allowedTypes.length > 1 && (
          <div className="inline-flex gap-1">
            {allowedTypes.map(t => (
              <button key={t} type="button" onClick={() => setChartType(t)}
                className={`h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
                  chartType === t
                    ? 'border-gisviz-accent/40 bg-gisviz-accent/10 text-gisviz-accent'
                    : 'border-gisviz-border bg-gisviz-card text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        )}

        {view === 'visual' && fields.length > 1 && (
          <label className="inline-flex items-center gap-2 text-[12.5px] text-gisviz-ink-soft">
            <span className="hidden sm:inline">Column</span>
            <select value={field} onChange={e => setField(e.target.value)}
              className="h-8 rounded-[8px] border border-gisviz-border bg-gisviz-card px-2 font-mono text-[12.5px] text-gisviz-ink focus:outline-none focus:ring-1 focus:ring-gisviz-accent">
              {fields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
        )}

        <div className="ml-auto flex items-center gap-3">
          {rows && (
            <span className="hidden font-mono text-[11.5px] text-gisviz-ink-soft sm:inline">
              {rows.length.toLocaleString()} rows
            </span>
          )}
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gisviz-border bg-gisviz-card text-gisviz-ink transition-colors hover:bg-gisviz-paper"
            title={expanded ? 'Exit fullscreen (Esc)' : 'Fullscreen'} aria-label={expanded ? 'Exit fullscreen' : 'Fullscreen'}>
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={expanded ? 'relative min-h-0 flex-1' : 'relative'} style={expanded ? undefined : { height }}>
        {loading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin text-gisviz-accent" size={28} />
          </div>
        )}
        {(error || badData) && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertTriangle size={22} className="text-gisviz-ink-soft" />
            <p className="text-[13.5px] font-medium text-gisviz-ink">This visual&apos;s data couldn&apos;t be loaded.</p>
            {error && <p className="font-mono text-[12px] text-gisviz-ink-soft">{error}</p>}
          </div>
        )}
        {rows && !badData && view === 'table' && <DataTable rows={rows} />}
        {rows && !badData && view === 'visual' && spec.kind === 'chart' && (
          <div className="h-full px-2 pt-3 pb-1 sm:px-4">
            <ChartView rows={rows} x={spec.x} field={field} fields={fields} type={chartType} />
          </div>
        )}
        {viewFc && !badData && view === 'visual' && spec.kind === 'map' && (
          <MapView fc={viewFc} field={field} fields={fields} labelField={spec.label_field}
                   basemap={basemap} accent={accent} dark={resolvedTheme === 'dark'}
                   domainRows={series ?? undefined}
                   historyOf={time ? historyOf : undefined}
                   currentT={currentT} />
        )}
      </div>

      {/* Time bar */}
      {showTimeBar && view === 'visual' && (
        <div className="flex items-center gap-3 border-t border-gisviz-border bg-gisviz-paper/40 px-3 py-2.5 sm:gap-4 sm:px-4">
          <button type="button" onClick={togglePlay}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gisviz-accent text-white shadow-sm transition-[filter] hover:brightness-110"
            aria-label={playing ? 'Pause' : 'Play through time'} title={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>
          <div className="min-w-[58px] font-display text-[22px] font-bold tabular-nums leading-none text-gisviz-ink">
            {String(currentT)}
          </div>
          <div className="min-w-0 flex-1">
            <input type="range" min={0} max={lastIdx} step={1} value={Math.min(tIdx, lastIdx)}
              onChange={e => { setPlaying(false); setTIdx(Number(e.target.value)) }}
              className="block w-full cursor-pointer accent-gisviz-accent"
              aria-label={`${time?.field ?? 'Time'}: ${String(currentT)}`} />
            <div className="mt-0.5 flex justify-between font-mono text-[10.5px] text-gisviz-ink-soft">
              <span>{String(times[0])}</span>
              <span>{String(times[lastIdx])}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}