// types/visuals.ts
// Shapes returned by /api/v0/datasets/* (catalog + admin) and /api/v0/visuals/* (suggest, spec, data).

/** Renderer codes (backend viz_recommender.VIZ_REGISTRY): the whole data-to-viz chart index. */
export const MAP_VIZ = ['map', 'map_heat', 'bubble_map', 'hexbin_map', 'cartogram', 'connection_map'] as const
export const CHART_VIZ = [
  'line', 'area', 'stacked_area', 'streamgraph',
  'ranked_columns', 'bar', 'hbar', 'lollipop', 'circular_bar', 'radar', 'word_cloud', 'parallel_coordinates',
  'donut', 'pie', 'treemap', 'stacked', 'sunburst', 'circle_packing', 'dendrogram',
  'scatter', 'bubble', 'heatmap', 'correlogram', 'connected_scatter', 'density_2d',
  'histogram', 'density', 'boxplot', 'violin', 'ridgeline',
  'sankey', 'chord', 'network', 'arc_diagram', 'edge_bundling',
] as const
export type VizType = (typeof MAP_VIZ)[number] | (typeof CHART_VIZ)[number]

export type VizParam = 'x' | 'y' | 'z' | 'size' | 'color' | 'label_field'

/** Fallback when an option arrives without its column roles (older API): the classic charts' needs. */
export const VIZ_NEEDS: Partial<Record<VizType, VizParam[]>> = {
  map: ['y'], map_heat: ['y'],
  line: ['x', 'y'], area: ['x', 'y'], bar: ['x', 'y'], hbar: ['x', 'y'], donut: ['x', 'y'], treemap: ['x', 'y'],
  stacked: ['x', 'y', 'z'], heatmap: ['x', 'y', 'z'],
  scatter: ['x', 'y'], bubble: ['x', 'y', 'size'], histogram: ['y'],
}
export const isMapViz = (v: VizType) => (MAP_VIZ as readonly string[]).includes(v)
/** Visuals with an on/off "Labels" switch (names + values drawn on the map / points instead of on hover only). */
export const LABEL_TOGGLE_VIZ: VizType[] = ['map', 'map_heat', 'bubble_map', 'hexbin_map', 'scatter', 'bubble']
export const hasLabelToggle = (v?: string | null) => !!v && (LABEL_TOGGLE_VIZ as string[]).includes(v)

export interface DatasetCard {
  dataset_id: string
  title: string
  description?: string | null
  category?: string | null      // categories.slug (posts DB)
  region?: string | null        // regions.code (misc DB)
  format?: string | null
  source_name?: string | null
  source_url?: string | null
  license?: string | null
  publisher?: string | null
  crs?: string | null
  bbox?: number[] | null
  data_version?: string | null
  geometry_type?: string | null
  row_count: number
  file_size_bytes?: number | null   // size of the uploaded data file
  column_count?: number
  show_data?: boolean               // rows may be shown publicly on post pages
  updated_at?: string | null
}

export interface DatasetColumn {
  column_name: string
  label: string
  dtype: 'numeric' | 'temporal' | 'categorical' | 'text' | 'id'
  sql_type?: string
  n_distinct: number
  ordinal: number
}

export interface VizParams {
  x?: string | null
  y?: string | null
  z?: string | null
  size?: string | null
  label_field?: string | null
  color?: string | null
}

export interface VizOption {
  viz: VizType
  label: string
  score: number
  reason: string
  params: VizParams
  kind?: 'chart' | 'map'
  /** Columns this visual needs / can use, and what the form calls each one (from the server). */
  needs?: VizParam[]
  optional?: VizParam[]
  /** What the x column must be: cat(egory), num(ber), time (ordered), any. */
  x_kind?: 'cat' | 'num' | 'time' | 'any'
  /** y may be "count" (rows per group). */
  count?: boolean
  labels?: Partial<Record<VizParam, string>>
}

export interface SuggestResponse {
  dataset: DatasetCard
  columns: DatasetColumn[]
  options: VizOption[]
  recommended: VizType
}

/** What the upload page keeps in state and sends to POST /posts. */
export interface ReferenceLineChoice {
  value?: number
  stat?: 'mean' | 'median'
  label: string
  mode?: 'line' | 'divider'
}

/** Everything the publisher chooses for a post's visual (sent as `visual_params`, re-validated on the server). */
export interface VisualChoice extends VizParams {
  dataset_id: string
  viz: VizType
  /** Catalog code (misc DB visual_types), e.g. "choropleth"; the server derives it when empty. */
  visual_type?: string | null
  /** Category column that colours the bars (legend), e.g. "continent". */
  color?: string | null
  title?: string | null
  subtitle?: string | null
  /** Friendly name of the measure. */
  y_label?: string | null
  /** Colour per legend group. */
  colors?: Record<string, string> | null
  reference_lines?: ReferenceLineChoice[] | null
  /** Labels shown first in the reader's filter (null = all). */
  filter_default?: string[] | null
  /** Draw labels (name + value) on the map / points from the start; readers can switch them off and on. */
  show_labels?: boolean | null
}

/** The `visual_params` of POST/PUT /posts for a choice. */
export function toVisualParams(c: VisualChoice) {
  const { dataset_id: _ignored, ...rest } = c
  return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === '' || v === undefined ? null : v]))
}

/** Rebuild a choice from a saved post's visual_spec (edit page). */
export function choiceFromSpec(datasetId: string, spec: any): VisualChoice | null {
  if (!spec || !spec.data) return null
  const qs = new URLSearchParams(String(spec.data).split('?')[1] || '')
  const get = (k: string) => qs.get(k) || null
  return {
    dataset_id: datasetId, viz: (get('viz') || spec.chart_type || 'map') as VizType,
    x: get('x'), y: get('y'), z: get('z'), size: get('size'), label_field: get('label_field'), color: get('color'),
    visual_type: spec.visual_type ?? null, title: spec.title ?? null, subtitle: spec.subtitle ?? null,
    y_label: spec.y_label ?? null, colors: spec.colors ?? null, reference_lines: spec.reference_lines ?? null,
    filter_default: spec.label_filter?.default ?? null, show_labels: spec.show_labels ?? null,
  }
}

/** Public /datasets listing. */
export interface CatalogPage {
  total: number
  items: DatasetCard[]
  categories: { category: string; count: number }[]
}

export interface CatalogDetail {
  dataset: DatasetCard
  columns: DatasetColumn[]
  post_count: number
}

/** Row on /admin/datasets: active and inactive datasets with their upload state. */
export type DatasetStatus = 'active' | 'inactive'
export interface ManagedDataset extends DatasetCard {
  status: DatasetStatus
  has_data: boolean
  created_at?: string | null
  data_uploaded_at?: string | null
}


/** Regions (misc DB) — GET /regions */
export interface Region {
  code: string
  name: string
  kind: 'global' | 'continent' | 'subregion' | 'country' | 'custom'
  parent_code?: string | null
  iso_a2?: string | null
  iso_a3?: string | null
  m49?: string | null
  bbox?: number[] | null
  sort_order: number
  is_active: boolean
}

/** GET/POST /datasets/manage/sync — datasets DB vs gisviz.duckdb */
export interface DuckdbStoreStats {
  file: string
  size_bytes: number
  wal_bytes: number
  tables: number
  rows: number
  last_loaded_at?: string | null
  duckdb_version?: string
}
export interface DatasetSyncReport {
  state: 'in_sync' | 'out_of_sync' | 'unreachable'
  in_sync: boolean
  checked_at: string
  service: string
  error?: string
  records: number
  tables: number | null
  missing_table: string[]
  version_mismatch: string[]
  orphan_tables: { code: string; rows?: number | null; source_file?: string | null }[]
  store: DuckdbStoreStats | null
  fixed_missing?: string[]
  dropped_orphans?: string[]
}

/** GET /datasets/manage/{id}/metadata (admin; loaded on click) */
export interface ManagedDatasetMetadata extends ManagedDataset {
  columns: DatasetColumn[]
  post_count: number
  store: { code: string; rows?: number | null; data_version?: string | null; source_file?: string | null;
           format?: string | null; loaded_at?: string | null } | null
  store_error: string | null
}

/** GET /datasets/{id}/rows (public, only when show_data is on) */
export interface PublicDatasetRows {
  dataset_id: string
  total_rows: number
  columns: string[]
  rows: Record<string, any>[]
}

/** GET /visuals/catalog — seeded by GET /seed (backend app/main.py), stored in the misc DB */
export interface VisualCategoryDef {
  code: string            // distribution | correlation | ranking | part_of_whole | evolution | map | flow
  name: string
  color?: string | null
  question?: string | null
  guide_goals?: string[] | null
}
export interface VisualTypeDef {
  code: string
  name: string
  category: string
  kind: 'chart' | 'map'
  roles: Record<string, string>
  best_when?: string | null
  avoid_when?: string | null
  status: 'live' | 'next' | 'later'
  interactions?: string[] | null
  renderer_code: string   // the chart_type / viz code the renderer uses
  enabled: boolean
}
export interface VisualCatalog {
  categories: VisualCategoryDef[]
  types: VisualTypeDef[]
}

/** posts.backdrop: the poster design (colour, texture, title font, block layout) — see lib/poster.ts. */
export type { PosterDesign as PostBackdrop } from '../lib/poster'