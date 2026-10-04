'use client'
/**
 * lib/referenceData.ts — lists that live in the database, loaded once per page visit and shared by
 * every component (nothing here is hard-coded; the seed data is in the backend's GET /seed).
 *
 *   useCategories()     post/dataset categories  (posts DB: slug, label, description, theme_color)
 *   useRegions()        regions                  (misc DB)
 *   useVisualCatalog()  chart & map types         (misc DB)
 *
 * Call refreshCategories() after an admin edits categories so open components pick up the change.
 */
import { useEffect, useState } from 'react'
import { gisvizApi } from '../connector/api'
import type { Category } from '../types/gisviz'
import type { Region, VisualCatalog } from '../types/visuals'

/** The site accent: used when a post has no category colour (design token, not data). */
export const DEFAULT_ACCENT = '#06ba24'

/** The feed's "all categories" entry (a UI choice, not a category). */
export const FOR_YOU: Category = {
  slug: '', label: 'For You', theme_color: DEFAULT_ACCENT,
  description: 'Discover trending interactive visualizations, open datasets, and spatial analysis from the global cartography community.',
}

type Store<T> = { value: T; promise: Promise<T> | null; listeners: Set<(v: T) => void> }
function store<T>(initial: T): Store<T> { return { value: initial, promise: null, listeners: new Set() } }

function load<T>(s: Store<T>, fetcher: () => Promise<T>, force = false): Promise<T> {
  if (s.promise && !force) return s.promise
  s.promise = fetcher()
    .then(v => { s.value = v; s.listeners.forEach(l => l(v)); return v })
    .catch(() => { s.promise = null; return s.value })      // retry on the next use
  return s.promise
}

function useStore<T>(s: Store<T>, fetcher: () => Promise<T>): T {
  const [v, setV] = useState<T>(s.value)
  useEffect(() => {
    s.listeners.add(setV)
    load(s, fetcher).then(setV)
    return () => { s.listeners.delete(setV) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return v
}

const categories = store<Category[]>([])
const regions = store<Region[]>([])
const catalog = store<VisualCatalog>({ categories: [], types: [] })

const fetchCategories = async (): Promise<Category[]> =>
  ((await gisvizApi.listCategories()) as any[]).map(c => ({
    category_id: c.category_id, slug: c.slug, label: c.label, description: c.description || '',
    theme_color: c.theme_color || DEFAULT_ACCENT, sort_order: c.sort_order ?? 0,
  }))
const fetchRegions = () => gisvizApi.listRegionCatalog()
const fetchCatalog = () => gisvizApi.getVisualCatalog()

export const useCategories = () => useStore(categories, fetchCategories)
export const useRegions = () => useStore(regions, fetchRegions)
export const useVisualCatalog = () => useStore(catalog, fetchCatalog)

export const refreshCategories = () => load(categories, fetchCategories, true)

/** Category colour by slug or label (case-insensitive), or undefined. */
export function categoryColor(list: Category[], key?: string | null): string | undefined {
  if (!key) return undefined
  const k = key.toLowerCase()
  return list.find(c => c.slug === k || c.label.toLowerCase() === k)?.theme_color
}