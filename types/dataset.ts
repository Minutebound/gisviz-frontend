// types/dataset.ts

export type FileFormat = 
  | 'geojson' 
  | 'csv' 
  | 'gpkg' 
  | 'shapefile' 
  | 'kml'

export type ExternalConnectorType = 
  | 'postgres' 
  | 'snowflake' 
  | 'bigquery' 
  | 'wms' 
  | 's3'

export type DatasetSourceCategory = 'file' | 'external'

export interface DatasetSchemaField {
  name: string
  type: string
  description?: string
}

export interface Dataset {
  id: string
  title: string
  description: string
  category: string
  source_category: DatasetSourceCategory
  format: FileFormat | ExternalConnectorType
  file_size_bytes?: number
  feature_count?: number
  geometry_type?: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon' | 'Mixed'
  crs: string 
  resource_url?: string // Updated to act as a universal redirect link
  external_status?: 'available' | 'coming_soon'
  updated_at: string
  publisher: {
    name: string
    handle: string
    avatar_url?: string
  }
  schema?: DatasetSchemaField[]
  bbox?: [number, number, number, number] 
  license?: string
  update_frequency?: string
}