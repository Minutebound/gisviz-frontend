// lib/visualSpec.ts
// The backend returns data URLs like "/api/v0/visuals/datasets/<id>/data?...".
// <InteractiveVisual> fetches strings as-is, so point them at the API origin.

import { API_ORIGIN } from '../connector/api'
import type { VisualSpec } from '../app/components/InteractiveVisual'

export function resolveSpec<T extends VisualSpec | null | undefined>(spec: T): T {
  if (!spec) return spec
  const abs = (u: unknown) => (typeof u === 'string' && u.startsWith('/api/') ? `${API_ORIGIN}${u}` : u)
  const out: any = { ...spec, data: abs(spec.data) }
  if (spec.kind === 'map' && spec.time) out.time = { ...spec.time, series: abs(spec.time.series) }   // video map values
  return out as T
}

/**
 * Height of the visual's body for a given width, by chart type, so the visual keeps a fitting aspect ratio
 * on every screen and the poster around it stays visible: tall for rankings (one row per item, like the
 * connected ranking columns), square for round charts, landscape for maps and axis charts.
 */
export function visualHeightFor(spec: VisualSpec | null | undefined, width: number): number {
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, v)))
  if (!spec || width <= 0) return 520
  if (spec.kind === 'map') return clamp(width * 0.66, 340, 720)
  const t = spec.chart_type as string
  if (t === 'ranked_columns') return clamp(width * 1.35, 560, 1300)
  if (['hbar', 'lollipop', 'ridgeline', 'dendrogram', 'parallel_coordinates'].includes(t)) return clamp(width * 0.95, 460, 960)
  if (['donut', 'pie', 'sunburst', 'chord', 'circle_packing', 'radar', 'circular_bar', 'edge_bundling', 'correlogram',
       'word_cloud', 'network'].includes(t)) return clamp(width * 0.78, 360, 760)
  return clamp(width * 0.58, 320, 620)
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://').replace('/api/v0', '').replace(/\/$/, '')
/** An /uploads/... path from the API as a full URL. */
export const assetUrl = (p?: string | null) => (!p ? '' : p.startsWith('http') ? p : `${API_BASE}${p}`)