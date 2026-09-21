// types/gisviz.ts

export type SortOption = 'trending' | 'recent' | 'popular'

export interface Publisher {
  id?: string
  name: string
  handle: string
  avatar_url?: string
  followers_count?: number
}

export interface Post {
  post_id: string
  title: string
  description?: string
  category: string
  chart_type?: string
  region?: string
  tags?: string[]
  thumbnail_url?: string
  map_url?: string
  total_likes_count: number
  total_bookmarks_count?: number
  views_count?: number
  is_liked?: boolean
  is_bookmarked?: boolean
  created_at: string
  publisher: Publisher
}

export const REGIONS = [
  { value: 'global', label: 'Global' },
  { value: 'north-america', label: 'North America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia-pacific', label: 'Asia-Pacific' },
  { value: 'latin-america', label: 'Latin America' },
  { value: 'middle-east-africa', label: 'Middle East & Africa' },
] as const

export const CHART_TYPES = [
  { value: '', label: 'All Charts' },
  { value: 'choropleth', label: 'Choropleth' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'hexbin', label: 'Hexbin / Grid' },
  { value: 'point-cluster', label: 'Point & Cluster' },
  { value: 'bubble', label: 'Proportional Symbol' },
  { value: 'flow', label: 'Flow & Network' },
  { value: '3d-elevation', label: '3D & Extrusion' },
  { value: 'bivariate', label: 'Bivariate' },
] as const

export interface Category {
  slug: string
  label: string
  description: string
  theme_color: string // Database-driven Hex Code
}

export const CATEGORIES: Category[] = [
  { slug: '', label: 'For You', description: 'Discover trending interactive visualizations, open datasets, and spatial analysis from the global cartography community.', theme_color: '#06ba24' }, // default accent
  { slug: 'climate', label: 'Climate', description: 'Explore global temperature anomalies, carbon emissions, sea-level rise forecasts, and climate impact models.', theme_color: '#f97316' }, // orange
  { slug: 'infrastructure', label: 'Infrastructure', description: 'Map critical networks spanning energy grids, transport hubs, telecommunications, and civic facilities.', theme_color: '#3b82f6' }, // blue
  { slug: 'demographics', label: 'Demographics', description: 'Visualize population distributions, census metrics, socioeconomic trends, and human geography.', theme_color: '#a855f7' }, // purple
  { slug: 'transport', label: 'Transport', description: 'Track mobility patterns, logistics flows, transit networks, and global supply chain telemetry.', theme_color: '#10b981' }, // emerald
  { slug: 'environment', label: 'Environment', description: 'Monitor ecosystems, land use changes, hydrological basins, and conservation efforts.', theme_color: '#22c55e' }, // green
  { slug: 'economy', label: 'Economy', description: 'Analyze global trade routes, real estate markets, financial zones, and macroeconomic indicators.', theme_color: '#6366f1' }, // indigo
  { slug: 'urban-planning', label: 'Urban Planning', description: 'Inspect zoning boundaries, smart city metrics, urban expansion, and parcel-level civic data.', theme_color: '#f43f5e' }, // rose
]

export interface FeedFilters {
  search?: string
  category?: string
  publisher?: string
  sort: SortOption
  region?: string
  chart_type?: string
}

export const DEFAULT_FILTERS: FeedFilters = {
  search: '',
  category: '',
  sort: 'trending',
  region: '',
  chart_type: '',
}

export function filtersToParams(filters: FeedFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.search) params.search = filters.search
  if (filters.category) params.category = filters.category
  if (filters.publisher) params.publisher = filters.publisher
  if (filters.sort && filters.sort !== 'trending') params.sort = filters.sort
  if (filters.region) params.region = filters.region
  if (filters.chart_type) params.chart_type = filters.chart_type
  return params
}

export function filtersFromParams(searchParams: URLSearchParams): FeedFilters {
  return {
    search: searchParams.get('search') ?? '',
    category: searchParams.get('category') ?? '',
    sort: (searchParams.get('sort') as SortOption) || 'trending',
    region: searchParams.get('region') ?? '',
    chart_type: searchParams.get('chart_type') ?? '',
  }
}