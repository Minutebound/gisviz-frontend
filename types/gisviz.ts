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

/** A post/dataset category. Loaded from the posts DB (GET /categories) via lib/referenceData.ts —
 *  regions, chart types and categories are never hard-coded in the frontend. */
export interface Category {
  category_id?: number
  slug: string
  label: string
  description: string
  theme_color: string // #rrggbb from the DB (site accent when unset)
  sort_order?: number
}


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