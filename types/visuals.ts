// types/visuals.ts
// Shapes returned by /api/v0/datasets/* (catalog + admin) and /api/v0/visuals/* (suggest, spec, data).

export type VizType =
  | 'map' | 'map_heat'
  | 'line' | 'area' | 'bar' | 'hbar' | 'donut' | 'treemap'
  | 'stacked' | 'heatmap' | 'scatter' | 'bubble' | 'histogram'

export type VizParam = 'x' | 'y' | 'z' | 'size'

/** Columns each visual needs (mirrors VIZ_REGISTRY in the backend). */
export const VIZ_NEEDS: Record<VizType, VizParam[]> = {
  map: ['y'], map_heat: ['y'],
  line: ['x', 'y'], area: ['x', 'y'], bar: ['x', 'y'], hbar: ['x', 'y'], donut: ['x', 'y'], treemap: ['x', 'y'],
  stacked: ['x', 'y', 'z'], heatmap: ['x', 'y', 'z'],
  scatter: ['x', 'y'], bubble: ['x', 'y', 'size'], histogram: ['y'],
}
export const isMapViz = (v: VizType) => v === 'map' || v === 'map_heat'

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
}

export interface VizOption {
  viz: VizType
  label: string
  score: number
  reason: string
  params: VizParams
}

export interface SuggestResponse {
  dataset: DatasetCard
  columns: DatasetColumn[]
  options: VizOption[]
  recommended: VizType
}

/** What the upload page keeps in state and sends to POST /posts. */
export interface VisualChoice extends VizParams {
  dataset_id: string
  viz: VizType
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
  column_count: number
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