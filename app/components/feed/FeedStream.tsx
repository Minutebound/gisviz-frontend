'use client'

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Loader2, Inbox, Plus, ChevronDown, Globe2, BarChart2, Check, Flame, Clock, Search
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'
import {
  Post,
  FeedFilters,
  DEFAULT_FILTERS,
  filtersToParams,
  filtersFromParams,
  REGIONS,
  CHART_TYPES,
  CATEGORIES
} from '../../../types/gisviz'
import CategoryBar from './CategoryBar'
import FeedCard, { HeroCard, FeedCardSkeleton } from './FeedCard'
import FeedRail, { MobileFeaturedPublishers, MobileTrendingTags } from './FeedRail'
import ShareModal from '../SharePost'

const PAGE_SIZE = 12

export default function FeedStream() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useAuth() as any

  // ── Data & Fetch State ──
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS)
  const [localSearch, setLocalSearch] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sharing, setSharing] = useState<Post | null>(null)

  // ── UI Overlay State ──
  const [sortOpen, setSortOpen] = useState(false)
  const [regionOpen, setRegionOpen] = useState(false)
  const [chartTypeOpen, setChartTypeOpen] = useState(false)
  
  const sortRef = useRef<HTMLDivElement>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  const chartTypeRef = useRef<HTMLDivElement>(null)

  const canPublish = isAuthenticated && ['admin', 'editor', 'publisher'].includes(user?.role_name || user?.role)

  // ── Click Outside Handler for Dropdowns ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) setRegionOpen(false)
      if (chartTypeRef.current && !chartTypeRef.current.contains(e.target as Node)) setChartTypeOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Sync state from query string on initial load ──
  useEffect(() => {
    const params = filtersFromParams(new URLSearchParams(searchParams.toString()))
    setFilters(params)
    setLocalSearch(params.search ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync state back to URL parameters ──
  const applyFilters = useCallback((next: FeedFilters) => {
    setFilters(next)
    const qs = new URLSearchParams(filtersToParams(next)).toString()
    router.replace(qs ? `/?${qs}` : '/', { scroll: false })
  }, [router])

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      applyFilters({ ...filters, search: localSearch })
    }
  }

  const filterKey = useMemo(
    () => JSON.stringify(filtersToParams(filters)),
    [filters],
  )

  // ── Fetch page 0 on filter update ──
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setExhausted(false)

    gisvizApi.fetchFeed({ filters, skip: 0, limit: PAGE_SIZE })
      .then((rows: Post[]) => {
        if (!alive) return
        setPosts(rows ?? [])
        setExhausted((rows?.length ?? 0) < PAGE_SIZE)
      })
      .catch((e: any) => {
        if (!alive) return
        setPosts([])
        setError(e?.message ?? 'Could not load the feed.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => { alive = false }
  }, [filterKey])

  const loadMore = async () => {
    if (loadingMore || exhausted) return
    setLoadingMore(true)
    try {
      const rows: Post[] = await gisvizApi.fetchFeed({
        filters,
        skip: posts.length,
        limit: PAGE_SIZE,
      })
      setPosts(p => [...p, ...(rows ?? [])])
      if ((rows?.length ?? 0) < PAGE_SIZE) setExhausted(true)
    } catch {
      setExhausted(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const patch = (id: string, fn: (p: Post) => Post) =>
    setPosts(ps => ps.map(p => (p.post_id === id ? fn(p) : p)))

  const onLike = async (post: Post) => {
    if (!isAuthenticated) { router.push('/auth'); return }
    const was = !!post.is_liked
    setBusyId(post.post_id)
    patch(post.post_id, p => ({ ...p, is_liked: !was, total_likes_count: p.total_likes_count + (was ? -1 : 1) }))
    try { await gisvizApi.toggleLike(post.post_id) } 
    catch { patch(post.post_id, p => ({ ...p, is_liked: was, total_likes_count: p.total_likes_count + (was ? 1 : -1) })) } 
    finally { setBusyId(null) }
  }

  const onBookmark = async (post: Post) => {
    if (!isAuthenticated) { router.push('/auth'); return }
    const was = !!post.is_bookmarked
    setBusyId(post.post_id)
    patch(post.post_id, p => ({ ...p, is_bookmarked: !was }))
    try { await gisvizApi.toggleBookmark(post.post_id) } 
    catch { patch(post.post_id, p => ({ ...p, is_bookmarked: was })) } 
    finally { setBusyId(null) }
  }

  const [hero, ...rest] = posts
  const showHero = filters.sort === 'trending' && !!hero && !filters.chart_type && !filters.region && !filters.search

  const selectedRegion = REGIONS.find(r => r.value === (filters.region ?? '')) || REGIONS[0]
  const selectedChartType = CHART_TYPES.find(c => c.value === (filters.chart_type ?? '')) || CHART_TYPES[0]
  const activeCategory = CATEGORIES.find(c => c.slug === (filters.category ?? '')) || CATEGORIES[0]

  // Dynamic indices for interleaving mobile rails
  const displayPosts = showHero ? rest : posts
  const mobilePubIndex = displayPosts.length <= 5 ? 0 : 1
  const mobileTagIndex = displayPosts.length <= 5 ? 2 : 4

  return (
    <>
      <CategoryBar filters={filters} onChange={applyFilters} />

      {/* Main Single-Column Content Wrapper */}
      <main className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-[72px] pt-5 sm:pt-8 pb-14 w-full flex flex-col gap-6 sm:gap-8">
        
        {/* ── FULL WIDTH TOP SECTION ── */}
        
        {/* 1A. Full-Width Dynamic Category Banner (Desktop & Tablet Only) */}
        <div className="hidden sm:block w-full relative rounded-[20px] overflow-hidden border border-gisviz-border bg-gisviz-card shadow-sm shrink-0">
          <div 
            className="absolute top-0 right-0 bottom-0 w-full md:w-2/3 pointer-events-none" 
            style={{ background: `linear-gradient(to left, transparent, ${activeCategory.theme_color}26)` }}
          />
          <div className="relative p-6 md:p-8 lg:p-10">
            <span 
              className="font-mono text-[11.5px] uppercase tracking-[0.14em] font-bold mb-2.5 block"
              style={{ color: activeCategory.theme_color }}
            >
              {filters.category ? 'Category' : 'Global Feed'}
            </span>
            <h1 className="font-display text-[32px] lg:text-[42px] font-bold tracking-[-0.03em] text-gisviz-ink mb-2 leading-tight">
              {activeCategory.label}
            </h1>
            <p className="text-[15px] lg:text-[16px] text-gisviz-ink-soft max-w-2xl leading-relaxed">
              {activeCategory.description}
            </p>
          </div>
        </div>

        {/* 1B. Compact Mobile Category Header (Mobile Only) */}
        <div className="sm:hidden flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center">
            <span 
              className="inline-flex px-3 py-1.5 rounded-[8px] font-display text-[18px] font-bold text-gisviz-ink tracking-tight border shadow-sm"
              style={{ 
                background: `linear-gradient(to right, ${activeCategory.theme_color}33, ${activeCategory.theme_color}1A)`,
                borderColor: `${activeCategory.theme_color}40`
              }}
            >
              {activeCategory.label}
            </span>
          </div>
          <p className="text-[13.5px] text-gisviz-ink-soft leading-relaxed">
            {activeCategory.description}
          </p>
        </div>
        
        {/* ── Header Controls (Filters, Search & Publish) ── */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-gisviz-border/60 shrink-0">
          
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            
            <div className="hidden lg:inline-flex items-center p-0.5 rounded-[8px] border border-gisviz-border bg-gisviz-paper shrink-0 shadow-sm">
              <button
                type="button"
                onClick={() => applyFilters({ ...filters, sort: 'trending' })}
                className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-[6px] text-[12.5px] font-medium transition-colors ${
                  filters.sort === 'trending' ? 'bg-gisviz-card text-gisviz-ink shadow-sm font-semibold' : 'text-gisviz-ink-soft hover:text-gisviz-ink'
                }`}
              >
                <Flame size={14} /> <span>Trending</span>
              </button>
              <button
                type="button"
                onClick={() => applyFilters({ ...filters, sort: 'recent' })}
                className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-[6px] text-[12.5px] font-medium transition-colors ${
                  filters.sort === 'recent' ? 'bg-gisviz-card text-gisviz-ink shadow-sm font-semibold' : 'text-gisviz-ink-soft hover:text-gisviz-ink'
                }`}
              >
                <Clock size={14} /> <span>Recent</span>
              </button>
            </div>

            <div className="relative lg:hidden shrink-0" ref={sortRef}>
              <button
                type="button"
                onClick={() => { setSortOpen(!sortOpen); setRegionOpen(false); setChartTypeOpen(false); }}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] border border-gisviz-border bg-gisviz-paper text-[13px] font-medium text-gisviz-ink hover:border-gisviz-border-strong transition-all shadow-sm"
              >
                {filters.sort === 'trending' ? <Flame size={14} className="text-gisviz-ink-soft" /> : <Clock size={14} className="text-gisviz-ink-soft" />}
                <span className="capitalize">{filters.sort}</span>
                <ChevronDown size={14} className="text-gisviz-ink-soft shrink-0" />
              </button>
              {sortOpen && (
                <div className="absolute left-0 mt-2 w-40 rounded-xl border border-gisviz-border bg-gisviz-card shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button type="button" onClick={() => { applyFilters({ ...filters, sort: 'trending' }); setSortOpen(false); }} className="w-full text-left px-3 py-2 text-[13px] font-medium text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent flex items-center gap-2">
                    <Flame size={14} className="text-gisviz-ink-soft" /> Trending
                  </button>
                  <button type="button" onClick={() => { applyFilters({ ...filters, sort: 'recent' }); setSortOpen(false); }} className="w-full text-left px-3 py-2 text-[13px] font-medium text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent flex items-center gap-2">
                    <Clock size={14} className="text-gisviz-ink-soft" /> Recent
                  </button>
                </div>
              )}
            </div>

            <div className="relative shrink-0" ref={regionRef}>
              <button
                type="button"
                onClick={() => { setRegionOpen(!regionOpen); setSortOpen(false); setChartTypeOpen(false); }}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] border text-[13px] font-medium transition-all shadow-sm ${
                  filters.region ? 'border-gisviz-accent text-gisviz-accent bg-gisviz-accent/5' : 'border-gisviz-border bg-gisviz-paper text-gisviz-ink hover:border-gisviz-border-strong'
                }`}
              >
                <Globe2 size={14} className={filters.region ? 'text-gisviz-accent' : 'text-gisviz-ink-soft'} />
                <span className="max-w-[90px] sm:max-w-[140px] truncate">{selectedRegion.label}</span>
                <ChevronDown size={14} className="text-gisviz-ink-soft shrink-0" />
              </button>
              {regionOpen && (
                <div className="absolute left-0 mt-2 w-48 rounded-xl border border-gisviz-border bg-gisviz-card shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 text-[10.5px] font-mono uppercase tracking-wider text-gisviz-ink-soft border-b border-gisviz-border mb-1">Region Filter</div>
                  {REGIONS.map(reg => {
                    const active = (filters.region ?? '') === reg.value
                    return (
                      <button key={reg.value} type="button" onClick={() => { applyFilters({ ...filters, region: reg.value }); setRegionOpen(false); }} className="w-full text-left px-3 py-2 text-[13px] font-medium text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent flex items-center justify-between gap-2 transition-colors">
                        <span className={active ? 'font-semibold text-gisviz-accent' : ''}>{reg.label}</span>
                        {active && <Check size={14} className="text-gisviz-accent shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="relative shrink-0" ref={chartTypeRef}>
              <button
                type="button"
                onClick={() => { setChartTypeOpen(!chartTypeOpen); setSortOpen(false); setRegionOpen(false); }}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] border text-[13px] font-medium transition-all shadow-sm ${
                  filters.chart_type ? 'border-gisviz-accent text-gisviz-accent bg-gisviz-accent/5' : 'border-gisviz-border bg-gisviz-paper text-gisviz-ink hover:border-gisviz-border-strong'
                }`}
              >
                <BarChart2 size={14} className={filters.chart_type ? 'text-gisviz-accent' : 'text-gisviz-ink-soft'} />
                <span className="max-w-[90px] sm:max-w-[140px] truncate">{selectedChartType.label}</span>
                <ChevronDown size={14} className="text-gisviz-ink-soft shrink-0" />
              </button>
              {chartTypeOpen && (
                <div className="absolute right-0 sm:left-0 mt-2 w-52 rounded-xl border border-gisviz-border bg-gisviz-card shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 text-[10.5px] font-mono uppercase tracking-wider text-gisviz-ink-soft border-b border-gisviz-border mb-1">Visualization Type</div>
                  {CHART_TYPES.map(chart => {
                    const active = (filters.chart_type ?? '') === chart.value
                    return (
                      <button key={chart.value} type="button" onClick={() => { applyFilters({ ...filters, chart_type: chart.value }); setChartTypeOpen(false); }} className="w-full text-left px-3 py-2 text-[13px] font-medium text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent flex items-center justify-between gap-2 transition-colors">
                        <span className={active ? 'font-semibold text-gisviz-accent' : ''}>{chart.label}</span>
                        {active && <Check size={14} className="text-gisviz-accent shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 w-full xl:w-auto xl:justify-end shrink-0">
            {!loading && !error && (
              <span className="hidden sm:inline text-[13px] font-medium text-gisviz-ink-soft shrink-0">
                {posts.length}{exhausted ? '' : '+'} posts
              </span>
            )}
            
            <div className="relative w-full sm:w-auto sm:min-w-[200px] flex-1 sm:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
              <input
                type="text"
                placeholder="Search feed..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={handleSearchSubmit}
                className="w-full h-9 pl-9 pr-3 rounded-[8px] border border-gisviz-border bg-gisviz-paper text-[13px] text-gisviz-ink placeholder:text-gisviz-ink-soft focus:outline-none focus:ring-1 focus:ring-gisviz-accent transition-all shadow-sm"
              />
            </div>

            {canPublish && (
              <Link
                href="/post/upload"
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-[8px] bg-gisviz-accent text-[13.5px] font-semibold text-[color:var(--accent-on)] hover:brightness-110 transition-[filter] shadow-sm shrink-0"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Publish</span><span className="sm:hidden">Publish</span>
              </Link>
            )}
          </div>

        </header>


        {/* ── TWO COLUMN LAYOUT (Feed Content & Rail) ── */}
        <div className="flex flex-col lg:flex-row gap-8 xl:gap-14 items-start w-full">

          {/* ── LEFT COLUMN (Main Feed) ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 w-full">
            
            {loading && (
              <div className="flex flex-col gap-6">
                {Array.from({ length: 3 }).map((_, i) => <FeedCardSkeleton key={i} />)}
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl border border-gisviz-border bg-gisviz-card p-10 text-center shadow-sm">
                <p className="text-[15px] text-gisviz-ink">{error}</p>
                <button onClick={() => applyFilters({ ...filters })} className="mt-4 h-10 px-5 rounded-[10px] bg-gisviz-accent text-[14px] font-semibold text-[color:var(--accent-on)] shadow-sm hover:brightness-110 transition-[filter]">
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && posts.length === 0 && (
              <div className="rounded-2xl border border-gisviz-border bg-gisviz-card p-12 flex flex-col items-center gap-3 text-center shadow-sm">
                <Inbox size={28} className="text-gisviz-ink-soft" />
                <p className="font-display text-[18px] font-bold text-gisviz-ink">Nothing matches those filters</p>
                <p className="max-w-sm text-[14px] text-gisviz-ink-soft">Try widening the region or resetting your filters.</p>
                <button onClick={() => { setLocalSearch(''); applyFilters(DEFAULT_FILTERS); }} className="mt-2 h-10 px-5 rounded-[10px] border border-gisviz-border text-[13.5px] font-semibold text-gisviz-ink hover:border-gisviz-border-strong bg-gisviz-paper shadow-sm">
                  Reset filters
                </button>
              </div>
            )}

            {!loading && !error && posts.length > 0 && (
              <div className="grid grid-cols-1 gap-6 w-full">
                
                {/* Hero Render */}
                {showHero && (
                  <HeroCard
                    post={hero}
                    onLike={onLike}
                    onBookmark={onBookmark}
                    onShare={setSharing}
                    busy={busyId === hero.post_id}
                  />
                )}

                {/* Interleaved Mapping */}
                {displayPosts.map((p, idx) => (
                  <React.Fragment key={p.post_id}>
                    <FeedCard
                      post={p}
                      onLike={onLike}
                      onBookmark={onBookmark}
                      onShare={setSharing}
                      busy={busyId === p.post_id}
                    />
                    
                    {/* Mobile Rail Interleaving (Hidden on Desktop) */}
                    {idx === mobilePubIndex && <MobileFeaturedPublishers />}
                    {idx === mobileTagIndex && <MobileTrendingTags category={filters.category} />}
                  </React.Fragment>
                ))}

                {/* Fallback injections if post array is smaller than target index */}
                {displayPosts.length > 0 && displayPosts.length <= mobilePubIndex && <MobileFeaturedPublishers />}
                {displayPosts.length > 0 && displayPosts.length <= mobileTagIndex && <MobileTrendingTags category={filters.category} />}

                {/* Load More */}
                {!exhausted && (
                  <div className="flex items-center gap-4 mt-2 mb-4">
                    <span className="flex-1 h-px bg-gisviz-border/60" />
                    <button onClick={loadMore} disabled={loadingMore} className="shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-full border border-gisviz-border bg-gisviz-card text-[13.5px] font-semibold text-gisviz-ink hover:border-gisviz-border-strong disabled:opacity-60 transition-colors shadow-sm">
                      {loadingMore && <Loader2 size={15} className="animate-spin" />}
                      {loadingMore ? 'Loading' : 'Load more'}
                    </button>
                    <span className="flex-1 h-px bg-gisviz-border/60" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (Desktop Vertical Rail) ── */}
          <aside className="hidden lg:flex flex-col w-[300px] xl:w-[320px] shrink-0 sticky top-[96px] h-fit">
            <FeedRail category={filters.category} />
          </aside>

        </div>
      </main>

      {sharing && (
        <ShareModal
          isOpen={!!sharing}
          onClose={() => setSharing(null)}
          url={`/post/${sharing.post_id}`}
          title={sharing.title}
        />
      )}
    </>
  )
}