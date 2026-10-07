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

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent, Popup } from 'maplibre-gl'
import * as d3 from 'd3'
import { createPortal } from 'react-dom'
import D3Chart, { PALETTE, type D3ChartType, type ReferenceLine } from './visuals/D3Chart'
import { PosterContext } from './visuals/VisualBackdrop'
import { gisvizApi } from '../../connector/api'
import {
  AlertTriangle, BarChart3, ChevronDown, Filter, Loader2, Map as MapIcon, Maximize2, Minimize2, Pause, Play, Table2, Tag,
} from 'lucide-react'

/* ═══════════════════ Types: the post's `visual_spec` ═══════════════════ */

export type ChartType = D3ChartType
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

/** Presentation ("story") options shared by charts and maps, set when publishing. */
export interface StoryOptions {
  /** Catalog code of the chosen visual type (misc DB visual_types), e.g. "hbar" or "choropleth". */
  visual_type?: string
  title?: string
  subtitle?: string
  /** Friendly name of the measure (axis title, tooltips). */
  y_label?: string
  /** Labels the reader can filter by (a dropdown); `default` = pre-selected labels (null = all). */
  label_filter?: { field: string; default?: string[] | null }
  /** Labels drawn on the map / points from the start (readers toggle them with the "Labels" button). */
  show_labels?: boolean
  /** Live post (stream dataset): the data is re-read every refresh_seconds. */
  live?: { refresh_seconds: number; updated_at?: string | null }
}

export interface ChartSpec extends StoryOptions {
  kind: 'chart'
  /** Post theme colour (#rrggbb). Overrides the site accent for this visual only. */
  accent?: string
  chart_type: ChartType
  /** Inline rows, or a URL returning a JSON array of rows. */
  data: Row[] | string
  /** x-axis column (category/date label, or a number for scatter). Unused by histogram. */
  x: string
  /** Series / second category column (stacked bar, heatmap). */
  z?: string
  /** Numeric column that sets bubble size. */
  size?: string
  /** Numeric column plotted by default. */
  y: string
  /** Numeric columns the viewer can switch between. Defaults to [y]. */
  fields?: string[]
  /** Chart types the viewer can switch between. Defaults to [chart_type]. */
  allowed_types?: ChartType[]
  /** Story layer: colour bars by this category column (with a legend), e.g. "continent". */
  color_by?: string
  /** Optional fixed colours per group, e.g. { "Asia": "#d62f3a" }. */
  colors?: Record<string, string>
  /** Reference lines, e.g. [{ "stat": "mean", "label": "OECD average", "mode": "divider" }]. */
  reference_lines?: ReferenceLine[]
  /** Scatter / bubble: the column naming each point (tooltip title, point labels). */
  label_field?: string
}

export interface MapSpec extends StoryOptions {
  kind: 'map'
  /** Post theme colour (#rrggbb). Overrides the site accent for this visual only. */
  accent?: string
  /** Inline GeoJSON FeatureCollection, or a URL returning one. */
  data: GeoFeatureCollection | string
  /** auto: by geometry · heat: point density · bubble: circles sized by value (polygons at their centre) ·
   *  hexbin: points summed into hexagons · cartogram: Dorling circles (D3) · connection: origin→destination lines */
  map_style?: 'auto' | 'heat' | 'bubble' | 'hexbin' | 'cartogram' | 'connection'
  /** Connection map: the destination name column (label_field is the origin). */
  target_field?: string
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
/** No basemap: the data's own shapes drawn straight on the poster (transparent canvas). */
const BARE_STYLE = { version: 8 as const, sources: {}, layers: [] as never[] }
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

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** User data ends up in popup HTML, so always escape it. */
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

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

function useSpecData<T>(data: T | string, refreshMs = 0): Loaded<T> & { fetchedAt: number | null } {
  const [state, setState] = useState<Loaded<T>>(() =>
    typeof data === 'string'
      ? { value: null, error: null, loading: true }
      : { value: data, error: null, loading: false },
  )
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  // live posts: re-read the data in the background (the chart keeps showing the last data meanwhile)
  useEffect(() => {
    if (typeof data !== 'string' || !refreshMs) return
    let alive = true
    const tick = () => {
      if (document.visibilityState === 'hidden') return          // no polling in background tabs
      const url = `${data}${data.includes('?') ? '&' : '?'}_r=${Date.now()}`
      fetch(url)
        .then(r => (r.ok ? r.json() : null))
        .then(json => { if (alive && json != null) { setState({ value: json as T, error: null, loading: false }); setFetchedAt(Date.now()) } })
        .catch(() => {})
    }
    const id = window.setInterval(tick, Math.max(5000, refreshMs))
    return () => { alive = false; window.clearInterval(id) }
  }, [data, refreshMs])
  useEffect(() => {
    if (typeof data !== 'string') {
      setState({ value: data, error: null, loading: false })
      return
    }
    let cancelled = false
    setState({ value: null, error: null, loading: true })
    fetch(data)
      .then(async r => {
        if (!r.ok) {
          // show the server's reason (e.g. "Unknown column 'x' for x" after the dataset file was replaced)
          let detail = ''
          try { const j = await r.json(); detail = typeof j?.detail === 'string' ? j.detail : '' } catch { /* not JSON */ }
          throw new Error(detail || `HTTP ${r.status}`)
        }
        return r.json()
      })
      .then(json => { if (!cancelled) { setState({ value: json as T, error: null, loading: false }); setFetchedAt(Date.now()) } })
      .catch((e: Error) => { if (!cancelled) setState({ value: null, error: e.message, loading: false }) })
    return () => { cancelled = true }
  }, [data])
  return { ...state, fetchedAt }
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

/* Charts are drawn by <D3Chart> (app/components/visuals/D3Chart.tsx); maps by MapLibre below. */

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

/** Bubble map: area ~ value (radius ~ sqrt), 5–34 px. */
function bubbleExpr(field: string, st: FieldStats): Expr {
  const v = ['get', field]
  const lo = Math.sqrt(Math.max(0, st.lo)), hi = Math.sqrt(Math.max(0, st.hi))
  const scale = hi === lo ? 14 : ['interpolate', ['linear'], ['sqrt', ['max', v, 0]], lo, 5, hi, 34]
  return ['case', ['==', ['typeof', v], 'number'], scale, 4]
}

function widthExpr(field: string, st: FieldStats): Expr {
  const v = ['get', field]
  return st.lo === st.hi ? 3 : ['interpolate', ['linear'], ['coalesce', v, st.lo], st.lo, 1.2, st.hi, 9]
}

/** Polygons / lines -> a point at their centre (bubble map), properties kept. */
function centroidFc(fc: GeoFeatureCollection): GeoFeatureCollection {
  return { ...fc, features: fc.features.map(f => (!f.geometry || f.geometry.type === 'Point' ? f
    : { ...f, geometry: { type: 'Point', coordinates: d3.geoCentroid(f as any) } })) as GeoFeature[] }
}

/** Where a feature's label goes: the point, the centre of its biggest polygon, or the middle of a line. */
function labelAnchor(f: GeoFeature): [number, number] | null {
  const g = f.geometry as { type: string; coordinates: any } | null
  if (!g) return null
  if (g.type === 'Point') return g.coordinates
  if (g.type === 'MultiPoint') return g.coordinates?.[0] ?? null
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    const polys: any[] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    let best = polys[0], bestA = -1
    for (const p of polys) {
      const a = Math.abs(d3.geoArea({ type: 'Polygon', coordinates: p } as any))
      if (a > bestA && a < 2 * Math.PI) { best = p; bestA = a }       // (a wound-the-wrong-way ring covers the globe)
    }
    const c = d3.geoCentroid({ type: 'Polygon', coordinates: best } as any)
    return Number.isFinite(c[0]) ? c : null
  }
  const line: any[] = g.type === 'LineString' ? g.coordinates : g.type === 'MultiLineString' ? g.coordinates?.[0] : []
  return line?.length ? line[Math.floor(line.length / 2)] : null
}

const LABEL_MAX = 300

/** Points -> regular hexagons (Web Mercator, so they look even), each with the sum of `field` (or a count). */
function hexbinFc(fc: GeoFeatureCollection, field: string, sumName: string): GeoFeatureCollection {
  const R = Math.PI / 180
  const toY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * R) / 2)) / R
  const toLat = (y: number) => (2 * Math.atan(Math.exp(y * R)) - Math.PI / 2) / R
  const pts: [number, number, number | null][] = []
  for (const f of fc.features) {
    const g = f.geometry as { type: string; coordinates: any } | null
    const c = g?.type === 'Point' ? g.coordinates : g?.type === 'MultiPoint' ? g.coordinates?.[0] : null
    if (c) pts.push([c[0], toY(c[1]), toNum(f.properties?.[field])])
  }
  if (!pts.length) return { type: 'FeatureCollection', features: [] }
  const [x0, x1] = d3.extent(pts, p => p[0]) as [number, number], [y0, y1] = d3.extent(pts, p => p[1]) as [number, number]
  const size = Math.max(0.01, Math.max(x1 - x0, y1 - y0) / 46)            // ~46 cells across the data
  const sum = pts.some(p => p[2] !== null)
  const cells = new Map<string, { q: number; r: number; v: number; n: number }>()
  for (const [px, py, v] of pts) {
    let q = ((Math.sqrt(3) / 3) * px - py / 3) / size, r = ((2 / 3) * py) / size
    let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r)
    const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r)
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry
    q = rx; r = rz
    const k = `${q},${r}`
    const c = cells.get(k) ?? { q, r, v: 0, n: 0 }
    c.v += v ?? 0; c.n += 1; cells.set(k, c)
  }
  const features = [...cells.values()].map((c, i) => {
    const cx = size * Math.sqrt(3) * (c.q + c.r / 2), cy = size * 1.5 * c.r
    const ring = d3.range(7).map(k => { const a = (Math.PI / 180) * (60 * k - 30); return [cx + size * Math.cos(a), toLat(cy + size * Math.sin(a))] })
    return { type: 'Feature', id: i, geometry: { type: 'Polygon', coordinates: [ring] },
             properties: { [sumName]: sum ? Math.round(c.v * 100) / 100 : c.n, points: c.n } }
  })
  return { type: 'FeatureCollection', features } as GeoFeatureCollection
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

function MapView({ fc, field, fields, labelField, basemap, accent, dark, domainRows, historyOf, currentT, heat, bubble, lineWidth, showLabels,
  baseMode = 'streets', legendHost }: {
  heat?: boolean
  /** streets = basemap tiles; none = only the data on a transparent canvas; auto = none for polygons, else streets. */
  baseMode?: 'auto' | 'streets' | 'none'
  /** On a poster: the legend goes there (top right of the visual) instead of over the map. */
  legendHost?: HTMLElement | null
  /** Draw each place's name + value on the map (overlapping labels are skipped, biggest values first). */
  showLabels?: boolean
  /** Bubble map: circle area follows the value (bigger range). */
  bubble?: boolean
  /** Connection map: line width follows the value too. */
  lineWidth?: boolean
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
  const bare = baseMode === 'none' || (baseMode === 'auto' && kind === 'polygon')

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
      // the worker is served from /public (scripts/copy-maplibre-worker.mjs): bundling hides MapLibre's own copy
      if (typeof (ml as any).setWorkerUrl === 'function') (ml as any).setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`)
      const el = containerRef.current
      if (disposed || !el) return

      const bb = bbox(live.current.fc)
      map = new ml.Map({
        container: el,
        style: bare ? BARE_STYLE : basemap,
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
        // 'load' never fires when the first style failed: add the data once the fallback style is in
        // (listen first: an inline style can finish loading inside setStyle)
        map.once('style.load', () => setTimeout(setup, 0))
        map.setStyle(legendHost !== undefined ? BARE_STYLE : fallbackStyle(dark), { diff: false })   // poster: just the data
        setTimeout(() => { if (map?.isStyleLoaded()) setup() }, 300)
      })

      map.addControl(new ml.NavigationControl({ showCompass: false }), legendHost !== undefined ? 'bottom-right' : 'top-right')

      ro = new ResizeObserver(() => map?.resize())
      ro.observe(el)

      const popup = new ml.Popup({
        closeButton: false, closeOnClick: false, offset: 12, maxWidth: '300px', className: 'gv-popup',
      })
      popupRef.current = popup

      // add the data layers once, on whichever comes first: the basemap loading, or the offline fallback style
      let added = false
      function setup() {
        if (!map || disposed || added) return
        added = true
        const { field: f, stats: st, ramp: rp } = live.current
        const color = colorExpr(f, st[f], rp)
        const hovered: Expr = ['boolean', ['feature-state', 'hover'], false]

        // generateId gives each feature its array index as id; setData keeps
        // the same order each period, so hover state survives time changes.
        map.addSource(SRC, { type: 'geojson', data: live.current.fc as Expr, generateId: true })

        let hit: string
        if (kind === 'point') {
          if (heat) {
            // Density surface when zoomed out; individual points (hoverable) fade in as you zoom.
            const { lo, hi } = st[f] ?? { lo: 0, hi: 1 }
            const rp2 = live.current.ramp
            map.addLayer({
              id: 'gv-heat', type: 'heatmap', source: SRC, maxzoom: 11,
              paint: {
                'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['to-number', ['get', f]], lo], lo, 0.15, hi === lo ? lo + 1 : hi, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 9, 30],
                'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(0,0,0,0)', 0.2, rp2[0], 0.45, rp2[2], 0.75, rp2[3], 1, rp2[4]],
                'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 11, 0],
              },
            })
          }
          map.addLayer({
            id: 'gv-point', type: 'circle', source: SRC,
            ...(heat ? { minzoom: 7 } : {}),
            paint: {
              'circle-color': color,
              'circle-radius': bubble ? bubbleExpr(f, st[f]) : radiusExpr(f, st[f]),
              'circle-opacity': heat ? ['interpolate', ['linear'], ['zoom'], 7, 0, 10, 0.88] : 0.88,
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
            paint: lineWidth
              ? { 'line-color': color, 'line-opacity': 0.75, 'line-width': ['case', hovered, ['+', widthExpr(f, st[f]), 2.5], widthExpr(f, st[f])] }
              : { 'line-color': color, 'line-width': ['case', hovered, 6, 3.5] },
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
      }
      map.on('load', setup)
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
  }, [kind, basemap, bare, labelField, heat, bubble, lineWidth])

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
      map.setPaintProperty('gv-point', 'circle-radius', bubble ? bubbleExpr(field, stats[field]) : radiusExpr(field, stats[field]))
    } else if (kind === 'polygon') {
      map.setPaintProperty('gv-fill', 'fill-color', color)
    } else {
      map.setPaintProperty('gv-line', 'line-color', color)
    }
    const id = hoverIdRef.current
    const props = id !== undefined ? live.current.fc.features[id]?.properties : null
    if (popupRef.current?.isOpen() && props) popupRef.current.setHTML(popupHtml(props, live.current.ctx))
  }, [field, stats, ramp, ready, kind])

  /* ── labels on the map: HTML tags that follow the map (no font glyphs needed, so they work on any basemap) ── */
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !showLabels) return
    // inside the canvas container: above the map, below popups and the zoom buttons
    const host = document.createElement('div')
    host.className = 'gv-lbls'
    host.setAttribute('aria-hidden', 'true')
    map.getCanvasContainer().appendChild(host)
    const centred = kind !== 'point' || !!bubble                 // on the shape / bubble; small dots: just above
    const items = fc.features.map(f => {
      const at = labelAnchor(f)
      const props = f.properties ?? {}
      const v = toNum(props[field])
      const name = labelField && props[labelField] != null && props[labelField] !== '' ? String(props[labelField]) : ''
      return at && (name || v !== null) ? { at, name, v } : null
    }).filter((x): x is { at: [number, number]; name: string; v: number | null } => !!x)
      .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity)).slice(0, LABEL_MAX)
    const els = items.map(it => {
      const el = document.createElement('div')
      el.className = 'gv-lbl'
      if (it.name) { const n = document.createElement('span'); n.textContent = truncate(it.name, 28); el.appendChild(n) }
      if (it.v !== null) { const b = document.createElement('b'); b.textContent = compact(it.v); el.appendChild(b) }
      host.appendChild(el)
      return el
    })
    const sizes = els.map(el => [el.offsetWidth, el.offsetHeight])   // measured once
    const place = () => {
      const W = host.clientWidth, H = host.clientHeight
      const taken: number[][] = []
      items.forEach((it, i) => {
        const el = els[i], [w, h] = sizes[i]
        const p = map.project(it.at)
        const x = p.x - w / 2, y = centred ? p.y - h / 2 : p.y - h - 6
        const clash = x < 0 || y < 0 || x + w > W || y + h > H
          || taken.some(([a, b, c, d]) => x < c && x + w > a && y < d && y + h > b)
        if (clash) { el.style.visibility = 'hidden'; return }
        taken.push([x - 2, y - 1, x + w + 2, y + h + 1])
        el.style.visibility = 'visible'
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
      })
    }
    place()
    map.on('move', place)
    map.on('resize', place)
    return () => { map.off('move', place); map.off('resize', place); host.remove() }
  }, [showLabels, ready, fc, field, labelField, kind, bubble])

  const st = stats[field] ?? { lo: 0, hi: 0, breaks: [0, 0, 0, 0, 0] }
  // the colour key: five steps of the post colour (on a poster it sits top right of the visual, no box)
  const legend = (
    <div className="w-[200px]">
      <div className="mb-1.5 truncate font-mono text-[11px] font-semibold text-gisviz-ink">{field}</div>
      <div className="flex h-2 overflow-hidden rounded-full">{ramp.map(c => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-gisviz-ink-soft">
        <span>{compact(st.breaks[0])}</span><span>{compact(st.breaks[2])}</span><span>{compact(st.breaks[4])}</span>
      </div>
    </div>
  )

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
        .gv-lbls{position:absolute;inset:0;pointer-events:none;overflow:hidden}
        .gv-lbl{position:absolute;left:0;top:0;visibility:hidden;display:flex;flex-direction:column;align-items:center;white-space:nowrap;line-height:1.1;font:600 11px/1.1 var(--font-sans);color:var(--ink);text-shadow:0 0 3px var(--card),0 0 3px var(--card),0 0 2px var(--card)}
        .gv-lbl b{font:700 11px/1.1 var(--font-mono);color:var(--ink)}
        .gv-pop-axis{display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);margin-top:-2px}
      `}</style>
      {/* h-full, not absolute inset-0: maplibre CSS forces position:relative on this node */}
      <div ref={containerRef} className="h-full w-full" />
      {legendHost ? createPortal(legend, legendHost) : legendHost === undefined ? (
        <div className="absolute left-3 bottom-3 z-10 w-[200px] rounded-[10px] border border-gisviz-border bg-gisviz-card/95 px-3 py-2 shadow-sm backdrop-blur-sm">
          {legend}
        </div>
      ) : null}
    </div>
  )
}

/* ═══════════════════ Data table ═══════════════════ */

const TABLE_LIMIT = 500
const DATASET_PAGE = 100

/** The whole dataset behind a visual (every column), a page at a time — GET /datasets/{id}/rows. */
export function DatasetTable({ datasetId }: { datasetId: string }) {
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<{ columns: string[]; rows: Row[]; total: number } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    setBusy(true); setError('')
    gisvizApi.fetchDatasetRows(datasetId, DATASET_PAGE, offset)
      .then(r => { if (live) setPage({ columns: r.columns, rows: r.rows, total: r.total_rows }) })
      .catch(e => { if (live) setError(e?.response?.status === 403 ? 'The data of this dataset is not published.' : 'Could not load the data.') })
      .finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [datasetId, offset])
  if (error) return <p className="px-4 py-6 text-[13px] text-gisviz-ink-soft">{error}</p>
  if (!page) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-gisviz-accent" size={24} /></div>
  const last = Math.min(offset + DATASET_PAGE, page.total)
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-gisviz-paper">
            <tr>{page.columns.map(c => (
              <th key={c} className="whitespace-nowrap border-b border-gisviz-border px-3 py-2 text-left font-mono text-[11.5px] font-semibold uppercase tracking-wide text-gisviz-ink-soft">{c}</th>
            ))}</tr>
          </thead>
          <tbody className={busy ? 'opacity-50' : ''}>
            {page.rows.map((r, i) => (
              <tr key={offset + i} className="border-b border-gisviz-border/50 hover:bg-gisviz-paper/60">
                {page.columns.map(c => (
                  <td key={c} className={`whitespace-nowrap px-3 py-1.5 text-gisviz-ink ${toNum(r[c]) !== null ? 'text-right font-mono text-[12.5px]' : ''}`}>
                    {truncate(fmt(r[c]), 60)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-gisviz-border bg-gisviz-paper/40 px-3 py-2 text-[12px] text-gisviz-ink-soft">
        <span className="font-mono">{page.total ? `${(offset + 1).toLocaleString()}–${last.toLocaleString()} of ${page.total.toLocaleString()} rows` : 'No rows'}</span>
        <span className="flex gap-1.5">
          <button type="button" disabled={offset === 0 || busy} onClick={() => setOffset(o => Math.max(0, o - DATASET_PAGE))}
            className="h-7 rounded-md border border-gisviz-border bg-gisviz-card px-2.5 disabled:opacity-40">Previous</button>
          <button type="button" disabled={last >= page.total || busy} onClick={() => setOffset(o => o + DATASET_PAGE)}
            className="h-7 rounded-md border border-gisviz-border bg-gisviz-card px-2.5 disabled:opacity-40">Next</button>
        </span>
      </div>
    </div>
  )
}

/** Dropdown of the visual's labels (e.g. countries): the reader picks which ones are shown. */
/** Poster filter: one chip per label / group (bottom right of the poster). Click = show only that; click more to add. */
function PosterChips({ labels, selected, onChange, colors, accent }: {
  labels: string[]; selected: Set<string> | null; onChange: (s: Set<string> | null) => void
  colors?: Record<string, string>; accent: string
}) {
  const pal = [accent, ...PALETTE]
  const toggle = (l: string) => {
    if (!selected) { onChange(new Set([l])); return }
    const next = new Set(selected)
    if (next.has(l)) next.delete(l); else next.add(l)
    onChange(next.size === 0 || next.size === labels.length ? null : next)
  }
  const chip = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-all'
  return (
    <>
      <button type="button" onClick={() => onChange(null)}
              className={`${chip} ${!selected ? 'border-transparent bg-gisviz-ink text-gisviz-card' : 'border-current/30 bg-gisviz-card/80 text-gisviz-ink hover:bg-gisviz-card'}`}>
        All
      </button>
      {labels.map((l, i) => {
        const on = !selected || selected.has(l)
        const c = colors ? colors[l] ?? pal[i % pal.length] : accent      // one theme colour per post; groups keep theirs
        return (
          <button key={l} type="button" onClick={() => toggle(l)} aria-pressed={!!selected && selected.has(l)}
                  className={`${chip} bg-gisviz-card/85 text-gisviz-ink ${on ? 'border-gisviz-border' : 'border-transparent opacity-45'} hover:opacity-100`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}
          </button>
        )
      })}
    </>
  )
}

function LabelFilter({ labels, selected, onChange }: {
  labels: string[]; selected: Set<string> | null; onChange: (s: Set<string> | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const count = selected ? labels.filter(l => selected.has(l)).length : labels.length
  const shown = labels.filter(l => l.toLowerCase().includes(q.trim().toLowerCase()))
  const toggle = (l: string) => {
    const next = new Set(selected ?? labels)
    if (next.has(l)) next.delete(l); else next.add(l)
    onChange(next.size === labels.length ? null : next)
  }
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12.5px] font-medium ${
          selected ? 'border-gisviz-accent/50 bg-gisviz-accent/10 text-gisviz-accent' : 'border-gisviz-border bg-gisviz-card text-gisviz-ink'}`}>
        <Filter size={13} /> {selected ? `${count} of ${labels.length}` : `All ${labels.length}`} <ChevronDown size={13} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-gisviz-border bg-gisviz-card p-2 shadow-lg">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search labels" autoFocus
            className="mb-1.5 w-full rounded-md border border-gisviz-border bg-gisviz-canvas px-2.5 py-1.5 text-[12.5px] text-gisviz-ink outline-none focus:ring-1 focus:ring-gisviz-accent" />
          <div className="mb-1.5 flex gap-1.5 text-[12px]">
            <button type="button" onClick={() => onChange(null)} className="rounded-md border border-gisviz-border px-2 py-1 hover:border-gisviz-accent">All</button>
            <button type="button" onClick={() => onChange(new Set())} className="rounded-md border border-gisviz-border px-2 py-1 hover:border-gisviz-accent">None</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {shown.map(l => (
              <label key={l} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] text-gisviz-ink hover:bg-gisviz-paper">
                <input type="checkbox" checked={!selected || selected.has(l)} onChange={() => toggle(l)} className="accent-gisviz-accent" />
                <span className="truncate">{l}</span>
              </label>
            ))}
            {!shown.length && <p className="px-1.5 py-2 text-[12px] text-gisviz-ink-soft">No match.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

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

export default function InteractiveVisual({ spec, height = 520, className = '', datasetId, showData = true, tools = 'full' }: {
  spec: VisualSpec
  height?: number
  className?: string
  /** The dataset behind the visual: the Data tab then shows the whole dataset (every column). */
  datasetId?: string | null
  /** false hides the Data tab (the dataset's "show data" switch is off). */
  showData?: boolean
  /** full: Chart | Data tabs, filter, labels, count, fullscreen (post editor).
   *  reader: only what a reader needs on the post page (filter, labels, live, fullscreen); the data has its own
   *  section at the bottom of the post page. */
  tools?: 'full' | 'reader'
}) {
  const probeRef = useRef<HTMLSpanElement>(null)
  const siteAccent = useAccentHex(probeRef)
  const poster = useContext(PosterContext)
  const hexOk = (c?: string): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c)
  // one theme colour per post: on a poster the poster's colour wins
  const accent = hexOk(poster.accent) ? poster.accent : hexOk(spec.accent) ? spec.accent : siteAccent
  const { resolvedTheme } = useTheme()
  const liveMs = spec.live?.refresh_seconds ? spec.live.refresh_seconds * 1000 : 0
  const main = useSpecData<Row[] | GeoFeatureCollection>(spec.data, liveMs)
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
  /* ── labels on / off (names + values on the map or beside the points; hover still works) ── */
  const canLabel = spec.kind === 'map' ? spec.map_style !== 'cartogram' : spec.chart_type === 'scatter' || spec.chart_type === 'bubble'
  const [labelsOn, setLabelsOn] = useState(!!spec.show_labels)
  useEffect(() => { setLabelsOn(!!spec.show_labels) }, [spec.show_labels])

  useEffect(() => {
    setField(defaultField)
    if (spec.kind === 'chart') setChartType(spec.chart_type)
  }, [spec, defaultField])

  // Fullscreen: the visual covers the whole window (top nav and footer hidden); Esc closes, page scroll locked.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.classList.add('gv-fullscreen')
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.documentElement.classList.remove('gv-fullscreen')
      window.removeEventListener('keydown', onKey)
    }
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

  /* ── label filter (dropdown): which labels (e.g. countries) are shown ── */
  const filterField = spec.label_filter?.field
  const allLabels = useMemo<string[]>(() => {
    if (!filterField) return []
    const vals = spec.kind === 'chart'
      ? (Array.isArray(main.value) ? (main.value as Row[]).map(r => r[filterField]) : [])
      : (fc?.features ?? []).map(f => f.properties?.[filterField])
    return [...new Set(vals.filter(v => v != null && v !== '').map(String))]
  }, [filterField, spec.kind, main.value, fc])
  const [picked, setPicked] = useState<Set<string> | null>(null)
  useEffect(() => {
    const d = spec.label_filter?.default
    setPicked(d && d.length ? new Set(d.map(String)) : null)
  }, [spec.label_filter?.default, filterField])
  const keep = useCallback((v: unknown) => !picked || picked.has(String(v)), [picked])

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

  /* ── on a poster: filter chips at the poster's bottom right (by colour group when there is one) ── */
  const groupField = spec.kind === 'chart' && spec.color_by && spec.color_by !== filterField ? spec.color_by : undefined
  const chipField = groupField ?? filterField
  const groupLabels = useMemo<string[]>(() => (groupField && Array.isArray(main.value)
    ? [...new Set((main.value as Row[]).map(r => r[groupField]).filter(v => v != null && v !== '').map(String))] : []), [groupField, main.value])
  const chipLabels = groupField ? groupLabels : allLabels
  const [pickedGroups, setPickedGroups] = useState<Set<string> | null>(null)
  const chipPicked = groupField ? pickedGroups : picked
  const setChipPicked = groupField ? setPickedGroups : setPicked
  const chipsOnPoster = poster.inPoster && !!poster.chipHost && !!chipField && chipLabels.length > 1 && chipLabels.length <= 16

  const chartRows = useMemo(() => {
    if (!rows || spec.kind !== 'chart') return rows
    let out = rows
    if (filterField && picked) out = out.filter(r => keep(r[filterField]))
    if (groupField && pickedGroups) out = out.filter(r => pickedGroups.has(String(r[groupField])))
    return out
  }, [rows, filterField, picked, keep, spec.kind, groupField, pickedGroups])
  const mapFc = useMemo(() => (viewFc && filterField && picked
    ? { ...viewFc, features: viewFc.features.filter(f => keep(f.properties?.[filterField])) } : viewFc),
    [viewFc, filterField, picked, keep])
  const reader = tools === 'reader'
  const hasDataTab = !reader && (!datasetId || showData)

  /* ── map styles that reshape the features before drawing ── */
  const mapStyle = spec.kind === 'map' ? spec.map_style ?? 'auto' : 'auto'
  const hexName = mapStyle === 'hexbin' ? (fields.length && field !== 'count' && (fc?.features ?? []).some(f => toNum(f.properties?.[field]) !== null) ? `${field} (total)` : 'points') : ''
  const shownFc = useMemo<GeoFeatureCollection | null>(() => {
    if (!mapFc) return null
    if (mapStyle === 'bubble') return centroidFc(mapFc)
    if (mapStyle === 'hexbin') return hexbinFc(mapFc, field, hexName)
    if (mapStyle === 'connection' && spec.kind === 'map') {
      const a = spec.label_field, b = spec.target_field
      return { ...mapFc, features: mapFc.features.map(f => ({ ...f, properties: { ...(f.properties ?? {}),
        route: [a ? f.properties?.[a] : null, b ? f.properties?.[b] : null].filter(v => v != null && v !== '').join(' → ') || 'Connection' } })) }
    }
    return mapFc
  }, [mapFc, mapStyle, field, hexName, spec])

  const basemap = spec.kind === 'map'
    ? spec.basemap_style ?? ((poster.inPoster ? poster.dark : resolvedTheme === 'dark') ? BASEMAP_DARK : BASEMAP_LIGHT)
    : BASEMAP_LIGHT

  const loading = main.loading || seriesState.loading
  const error = main.error || seriesState.error
  const badData = !loading && !error && (!rows || (time && !times.length))
  const showTimeBar = spec.kind === 'map' && !!time && times.length > 1 && !!rows && !badData

  const segBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] text-[12.5px] font-semibold transition-colors ${
      active ? 'bg-gisviz-card text-gisviz-ink shadow-sm' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`

  // on a poster only the chart / map is shown: no card, no title; the controls go under the poster
  const bareOnPoster = poster.inPoster && !expanded
  const toolsOut = bareOnPoster && !!poster.toolsHost
  const wrap = (bar: React.ReactNode) => (toolsOut ? createPortal(
    reader ? bar : <div className="rounded-[12px] border border-gisviz-border bg-gisviz-card shadow-sm">{bar}</div>, poster.toolsHost!) : bar)
  // reader controls on a poster: a slim row of small buttons, no bar around them
  const slim = reader && toolsOut

  const body = (
    <div
      className={expanded
        ? 'fixed inset-0 z-[300] flex flex-col bg-gisviz-card'      /* the whole window: above the top nav and the footer */
        : bareOnPoster ? `relative ${className}`
        : `rounded-[16px] border border-gisviz-border bg-gisviz-card shadow-sm overflow-hidden ${className}`}
    >
      {chipsOnPoster && createPortal(
        <PosterChips labels={chipLabels} selected={chipPicked} onChange={setChipPicked}
                     colors={groupField && spec.kind === 'chart' ? spec.colors : undefined} accent={accent} />, poster.chipHost!)}
      <span ref={probeRef} aria-hidden className="hidden text-gisviz-accent" />

      {(spec.title || spec.subtitle) && (!poster.inPoster || expanded) && (
        <div className="px-4 pt-4 pb-3 sm:px-5 border-b border-gisviz-border/60">
          {spec.title && <h3 className="font-display text-[19px] sm:text-[22px] font-bold leading-tight text-gisviz-ink">{spec.title}</h3>}
          {spec.subtitle && <p className="mt-1 text-[13.5px] text-gisviz-ink-soft leading-relaxed">{spec.subtitle}</p>}
        </div>
      )}

      {/* Toolbar (under the poster when on one) */}
      {wrap(<div className={`flex flex-wrap items-center gap-2 ${slim ? 'justify-end px-0 py-0' : 'px-3 py-2.5 sm:px-4'} ${toolsOut ? '' : 'border-b border-gisviz-border bg-gisviz-paper/40'}`}>
        {!reader && <div className="inline-flex rounded-[8px] border border-gisviz-border bg-gisviz-paper p-0.5">
          <button type="button" onClick={() => setView('visual')} className={segBtn(view === 'visual')}>
            {spec.kind === 'map' ? <MapIcon size={14} /> : <BarChart3 size={14} />}
            {spec.kind === 'map' ? 'Map' : 'Chart'}
          </button>
          {hasDataTab && (
            <button type="button" onClick={() => setView('table')} className={segBtn(view === 'table')}>
              <Table2 size={14} /> Data
            </button>
          )}
        </div>}

        {spec.live && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-gisviz-alert/30 bg-gisviz-alert/5 px-2.5 text-[12px] font-semibold text-gisviz-alert"
                title={`Live data: refreshed every ${spec.live.refresh_seconds} s`}>
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gisviz-alert opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-gisviz-alert" /></span>
            LIVE
            {main.fetchedAt && <span className="font-mono text-[10.5px] font-medium text-gisviz-ink-soft">{new Date(main.fetchedAt).toLocaleTimeString()}</span>}
          </span>
        )}

        {/* one visual per post: no chart-type or measure switching; readers filter the labels instead */}
        {view === 'visual' && filterField && allLabels.length > 1 && !(chipsOnPoster && !groupField) && (
          <LabelFilter labels={allLabels} selected={picked} onChange={setPicked} />
        )}

        {view === 'visual' && canLabel && (
          <button type="button" onClick={() => setLabelsOn(v => !v)} aria-pressed={labelsOn}
            title={labelsOn ? 'Hide labels' : 'Show labels'}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12.5px] font-semibold transition-colors ${
              labelsOn ? 'border-gisviz-accent bg-gisviz-accent/10 text-gisviz-accent' : 'border-gisviz-border bg-gisviz-paper text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
            <Tag size={13} /> Labels <span className="font-mono text-[10.5px] opacity-80">{labelsOn ? 'ON' : 'OFF'}</span>
          </button>
        )}

        <div className={`${slim ? '' : 'ml-auto'} flex items-center gap-3`}>
          {rows && view === 'visual' && !reader && (
            <span className="hidden font-mono text-[11.5px] text-gisviz-ink-soft sm:inline">
              {(spec.kind === 'chart' ? chartRows?.length ?? 0 : mapFc?.features.length ?? 0).toLocaleString()} shown
            </span>
          )}
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gisviz-border bg-gisviz-card text-gisviz-ink transition-colors hover:bg-gisviz-paper"
            title={expanded ? 'Exit fullscreen (Esc)' : 'Fullscreen'} aria-label={expanded ? 'Exit fullscreen' : 'Fullscreen'}>
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>)}

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
        {view === 'table' && datasetId && showData && <DatasetTable datasetId={datasetId} />}
        {rows && !badData && view === 'table' && !datasetId && <DataTable rows={rows} />}
        {rows && !badData && view === 'visual' && spec.kind === 'chart' && (
          <div className="h-full px-2 pt-3 pb-1 sm:px-4">
            <D3Chart rows={chartRows ?? []} type={chartType} x={spec.x} y={field} z={spec.z} size={spec.size} accent={accent} fields={spec.fields}
                     colorBy={spec.color_by} colors={spec.colors} refLines={spec.reference_lines} yLabel={spec.y_label}
                     labelField={spec.label_field} showLabels={canLabel && labelsOn} legendHost={bareOnPoster ? poster.legendHost : undefined} />
          </div>
        )}
        {mapFc && !badData && view === 'visual' && spec.kind === 'map' && mapStyle === 'cartogram' && (
          <div className="h-full px-2 pt-2 pb-1 sm:px-4">
            <D3Chart rows={[]} geo={mapFc} type="cartogram" x={spec.label_field ?? ''} y={field} accent={accent} yLabel={spec.y_label} />
          </div>
        )}
        {shownFc && !badData && view === 'visual' && spec.kind === 'map' && mapStyle !== 'cartogram' && (
          <MapView fc={shownFc} field={mapStyle === 'hexbin' ? hexName : field} fields={mapStyle === 'hexbin' ? [hexName] : fields}
                   labelField={mapStyle === 'hexbin' ? undefined : mapStyle === 'connection' ? 'route' : spec.label_field}
                   bubble={mapStyle === 'bubble'} lineWidth={mapStyle === 'connection'}
                   basemap={basemap} accent={accent} dark={poster.inPoster ? poster.dark : resolvedTheme === 'dark'}
                   baseMode={bareOnPoster ? poster.mapBase : 'streets'} legendHost={bareOnPoster ? poster.legendHost : undefined}
                   domainRows={series ?? undefined}
                   historyOf={time ? historyOf : undefined}
                   currentT={currentT}
                   heat={spec.map_style === 'heat'} showLabels={canLabel && labelsOn} />
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
  // fullscreen goes to <body>: a poster's transforms and stacking would otherwise keep it under the top nav
  return expanded && typeof document !== 'undefined' ? createPortal(body, document.body) : body
}