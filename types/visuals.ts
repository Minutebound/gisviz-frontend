// types/visuals.ts
// Shapes returned by /api/v0/visuals/* (the DuckDB-backed dataset catalog).

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
  category?: string | null
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