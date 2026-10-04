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
import { useEffect, useMemo, useState } from 'react'
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

/** The regions offered in the feed and datasets filters: Global + the continents (kind global | continent),
 *  in the seed's order. Countries are sub-regions: picking a continent also matches content tagged with
 *  any of its countries (the server expands it), so they are never listed in the filters. */
export function topRegions(list: Region[]): Region[] {
  return list.filter(r => r.kind === 'global' || r.kind === 'continent')
             .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
}

/** Countries grouped under their continent, for pickers where a post or dataset is tagged. */
export function regionGroups(list: Region[]): { parent: Region; children: Region[] }[] {
  return topRegions(list).map(parent => ({
    parent,
    children: list.filter(r => r.parent_code === parent.code && r.kind !== 'continent').sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

/**
 * Country flags for labels (Visual Capitalist style chips): a label that is a country name or an ISO code
 * ("Japan", "JPN", "jp") maps to its flag image and its 3-letter code, from the regions table (misc DB).
 * Flags come from flagcdn.com (free, no key); anything that is not a country gets null.
 */
export function useFlags() {
  const regions = useRegions()
  const [bad, setBad] = useState<Set<string>>(() => new Set())     // flag images that failed (offline, blocked): not drawn
  const index = useMemo(() => {
    const m = new Map<string, { a2: string; a3: string }>()
    for (const r of regions) {
      if (r.kind !== 'country' || !r.iso_a2) continue
      const v = { a2: r.iso_a2.toLowerCase(), a3: (r.iso_a3 || r.iso_a2).toUpperCase() }
      for (const k of [r.name, r.iso_a2, r.iso_a3, r.code]) if (k) m.set(k.trim().toLowerCase(), v)
    }
    for (const [alias, name] of COUNTRY_ALIASES) { const v = m.get(name); if (v && !m.has(alias)) m.set(alias, v) }
    return m
  }, [regions])
  return useMemo(() => {
    const find = (label: unknown) => (label == null ? undefined : index.get(String(label).replace(/\*+$/, '').trim().toLowerCase()))
    return {
      /** flag image URL (40 px wide), or null */
      flag: (label: unknown) => { const v = find(label); const u = v ? `https://flagcdn.com/w40/${v.a2}.png` : null; return u && !bad.has(u) ? u : null },
      /** onError of a flag <image>: stop drawing that flag */
      failed: (url: string) => setBad(b => (b.has(url) ? b : new Set(b).add(url))),
      /** ISO 3166 alpha-3 code ("JPN"), or null */
      code: (label: unknown) => find(label)?.a3 ?? null,
      any: index.size > 0,
    }
  }, [index, bad])
}

/** Everyday names that differ from the ISO short names in the regions table. */
const COUNTRY_ALIASES: [string, string][] = [
  ['usa', 'united states'], ['us', 'united states'], ['united states of america', 'united states'], ['u.s.', 'united states'],
  ['uk', 'united kingdom'], ['britain', 'united kingdom'], ['great britain', 'united kingdom'],
  ['korea', 'south korea'], ['republic of korea', 'south korea'], ['korea, republic of', 'south korea'],
  ['russian federation', 'russia'], ['viet nam', 'vietnam'], ['turkey', 'türkiye'], ['czech republic', 'czechia'],
  ['hong kong sar', 'hong kong'], ['macau', 'macao'], ['ivory coast', "côte d'ivoire"], ['cote d\'ivoire', "côte d'ivoire"],
  ['democratic republic of the congo', 'dr congo'], ['uae', 'united arab emirates'], ['holland', 'netherlands'],
]