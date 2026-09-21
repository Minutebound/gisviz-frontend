'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { FileSignature, PersonStanding, Sparkles, TrendingUp } from 'lucide-react'
import { Publisher } from '../../../types/gisviz'

interface FeedRailProps {
  category?: string
}

const RECOMMENDED_CREATORS: Publisher[] = [
  { id: 'rec-1', name: 'Sarah Chen', handle: 'sarah_gis', followers_count: 4820 },
  { id: 'rec-2', name: 'Atlas Spatial', handle: 'atlas_spatial', followers_count: 12450 },
  { id: 'rec-3', name: 'Urban Transit Lab', handle: 'transitlab', followers_count: 3190 },
  { id: 'rec-4', name: 'Diego Morales', handle: 'dmorales_geo', followers_count: 1840 },
]

const POPULAR_TAGS = [
  '#ElevationModel', '#PopulationDensity', '#Hydrology', 
  '#SatelliteImagery', '#UrbanCanopy', '#OpenStreetMap'
]

// ── 1. Desktop Right Rail (Vertical) ──
export default function FeedRail({ category }: FeedRailProps) {
  const [following, setFollowing] = useState<Record<string, boolean>>({})
  const toggleFollow = (handle: string) => setFollowing(p => ({ ...p, [handle]: !p[handle] }))

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Publishers Card */}
      <div className="rounded-2xl border border-gisviz-border bg-gisviz-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileSignature size={16} className="text-gisviz-accent" />
          <h2 className="font-display text-[15px] font-bold text-gisviz-ink">Featured Publishers</h2>
        </div>
        <div className="flex flex-col gap-4">
          {RECOMMENDED_CREATORS.map(pub => {
            const handle = pub.handle || 'user'
            const initials = (handle || '?').slice(0, 2).toUpperCase()
            const isFollowing = !!following[handle]
            return (
              <div key={handle} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 shrink-0 rounded-[10px] bg-gisviz-paper border border-gisviz-border grid place-items-center text-[12px] font-semibold text-gisviz-ink-soft">
                    {initials}
                  </span>
                  <Link href={`/profile/${handle}`} className="flex flex-col min-w-0 hover:opacity-80 transition-opacity">
                    <span className="truncate text-[13.5px] font-semibold text-gisviz-ink leading-tight">{pub.name || handle}</span>
                    <span className="text-[12px] text-gisviz-ink-soft">{(pub.followers_count ?? 0).toLocaleString()} followers</span>
                  </Link>
                </div>
                <button onClick={() => toggleFollow(handle)} className={`shrink-0 inline-flex items-center justify-center gap-1 h-8 px-3 rounded-[8px] text-[12px] font-semibold transition-all ${isFollowing ? 'bg-gisviz-paper border border-gisviz-border text-gisviz-ink' : 'bg-gisviz-ink text-gisviz-card hover:bg-gisviz-ink-soft shadow-sm'}`}>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tags Card */}
      <div className="rounded-2xl border border-gisviz-border bg-gisviz-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-gisviz-accent" />
          <h2 className="font-display text-[15px] font-bold text-gisviz-ink">{category ? `${category.replace(/-/g, ' ')} Tags` : 'Trending Tags'}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {POPULAR_TAGS.map(tag => (
            <Link key={tag} href={`/?q=${encodeURIComponent(tag.replace('#', ''))}`} className="inline-block px-2.5 py-1 rounded-[6px] bg-gisviz-canvas hover:bg-gisviz-paper border border-gisviz-border text-[12.5px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
              {tag}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 2. Mobile Interleaved Publisher Block (Horizontal Scroll) ──
export function MobileFeaturedPublishers() {
  const [following, setFollowing] = useState<Record<string, boolean>>({})
  const toggleFollow = (handle: string) => setFollowing(p => ({ ...p, [handle]: !p[handle] }))

  return (
    <div className="lg:hidden w-full rounded-2xl border border-gisviz-border bg-gisviz-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-gisviz-accent" />
        <h2 className="font-display text-[15px] font-bold text-gisviz-ink">Featured Publishers</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style dangerouslySetInnerHTML={{ __html: `div::-webkit-scrollbar { display: none; }`}} />
        {RECOMMENDED_CREATORS.map(pub => {
          const handle = pub.handle || 'user'
          const initials = (handle || '?').slice(0, 2).toUpperCase()
          const isFollowing = !!following[handle]
          return (
            <div key={handle} className="w-[240px] shrink-0 p-3 rounded-[12px] border border-gisviz-border bg-gisviz-canvas flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 shrink-0 rounded-lg bg-gisviz-paper border border-gisviz-border grid place-items-center text-[12px] font-semibold text-gisviz-ink-soft">
                  {initials}
                </span>
                <Link href={`/profile/${handle}`} className="flex flex-col min-w-0 hover:opacity-80 transition-opacity">
                  <span className="truncate text-[13px] font-semibold text-gisviz-ink leading-tight">{pub.name || handle}</span>
                  <span className="text-[11.5px] text-gisviz-ink-soft">{(pub.followers_count ?? 0).toLocaleString()} followers</span>
                </Link>
              </div>
              <button onClick={() => toggleFollow(handle)} className={`shrink-0 inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-[6px] text-[11.5px] font-semibold transition-all ${isFollowing ? 'bg-gisviz-paper border border-gisviz-border text-gisviz-ink' : 'bg-gisviz-ink text-gisviz-card hover:bg-gisviz-ink-soft shadow-sm'}`}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 3. Mobile Interleaved Trending Tags Block ──
export function MobileTrendingTags({ category }: { category?: string }) {
  return (
    <div className="lg:hidden w-full rounded-2xl border border-gisviz-border bg-gisviz-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-gisviz-accent" />
        <h2 className="font-display text-[15px] font-bold text-gisviz-ink">{category ? `${category.replace(/-/g, ' ')} Tags` : 'Trending Tags'}</h2>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {POPULAR_TAGS.map(tag => (
          <Link key={tag} href={`/?q=${encodeURIComponent(tag.replace('#', ''))}`} className="inline-block px-2.5 py-1 rounded-[6px] bg-gisviz-canvas hover:bg-gisviz-paper border border-gisviz-border text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            {tag}
          </Link>
        ))}
      </div>
    </div>
  )
}