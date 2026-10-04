'use client'
/**
 * Feed side rails: Featured Publishers (GET /users/popular, real follow/unfollow) and Trending Tags
 * (GET /posts/keywords/trending, per category). All data comes from the API; a card with nothing
 * to show is hidden.
 */
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileSignature, Sparkles, TrendingUp } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi, UPLOAD_BASE } from '../../../connector/api'

interface FeedRailProps {
  category?: string
}

type Pub = { user_id: string; user_handle: string; avatar_path?: string | null; title?: string | null;
             follower_count: number; is_followed?: boolean }
type Tag = { word: string; posts: number }

const PUBLISHER_LIMIT = 5
const TAG_LIMIT = 10

// one request per page for both rails (desktop + mobile), keyed by the viewer
const pubCache = new Map<string, Promise<Pub[]>>()
function loadPublishers(uid?: string): Promise<Pub[]> {
  const key = uid || 'anon'
  if (!pubCache.has(key)) {
    pubCache.set(key, gisvizApi.getPopularPublishers(PUBLISHER_LIMIT + 1, uid)
      .catch(() => { pubCache.delete(key); return [] }))
  }
  return pubCache.get(key)!
}
const tagCache = new Map<string, Promise<Tag[]>>()
function loadTags(category?: string): Promise<Tag[]> {
  const key = category || ''
  if (!tagCache.has(key)) {
    tagCache.set(key, gisvizApi.fetchTrendingKeywords(category || undefined, TAG_LIMIT)
      .catch(() => { tagCache.delete(key); return [] }))
  }
  return tagCache.get(key)!
}

function usePublishers() {
  const { user, isAuthenticated } = useAuth() as any
  const router = useRouter()
  const [pubs, setPubs] = useState<Pub[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadPublishers(user?.user_id).then(list => {
      if (live) setPubs(list.filter(p => p.user_id !== user?.user_id).slice(0, PUBLISHER_LIMIT))
    })
    return () => { live = false }
  }, [user?.user_id])

  const toggleFollow = async (p: Pub) => {
    if (!isAuthenticated) { router.push('/auth'); return }
    const was = !!p.is_followed
    setBusy(p.user_id)
    const patch = (followed: boolean, delta: number) => setPubs(list => list.map(x => x.user_id === p.user_id
      ? { ...x, is_followed: followed, follower_count: Math.max(0, x.follower_count + delta) } : x))
    patch(!was, was ? -1 : 1)
    try {
      if (was) await gisvizApi.unfollowUser(p.user_id)
      else await gisvizApi.followUser(p.user_id)
      pubCache.clear()                                    // counts changed
    } catch { patch(was, was ? 1 : -1) }
    finally { setBusy(null) }
  }
  return { pubs, busy, toggleFollow }
}

function useTags(category?: string) {
  const [tags, setTags] = useState<Tag[]>([])
  useEffect(() => {
    let live = true
    loadTags(category).then(t => { if (live) setTags(t) })
    return () => { live = false }
  }, [category])
  return tags
}

function Avatar({ p, size }: { p: Pub; size: number }) {
  const initials = (p.user_handle || '?').slice(0, 2).toUpperCase()
  return p.avatar_path
    ? <img src={`${UPLOAD_BASE}${p.avatar_path}`} alt="" width={size} height={size}
           className="shrink-0 rounded-[10px] border border-gisviz-border object-cover" style={{ width: size, height: size }} />
    : <span className="shrink-0 rounded-[10px] bg-gisviz-paper border border-gisviz-border grid place-items-center text-[12px] font-semibold text-gisviz-ink-soft"
            style={{ width: size, height: size }}>{initials}</span>
}

function FollowButton({ p, busy, onClick, small }: { p: Pub; busy: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className={`shrink-0 inline-flex items-center justify-center gap-1 ${small ? 'h-7 px-2.5 rounded-[6px] text-[11.5px]' : 'h-8 px-3 rounded-[8px] text-[12px]'} font-semibold transition-all disabled:opacity-60 ${
        p.is_followed ? 'bg-gisviz-paper border border-gisviz-border text-gisviz-ink' : 'bg-gisviz-ink text-gisviz-card hover:bg-gisviz-ink-soft shadow-sm'}`}>
      {p.is_followed ? 'Following' : 'Follow'}
    </button>
  )
}

const tagsTitle = (category?: string) => category ? `${category.replace(/-/g, ' ')} Tags` : 'Trending Tags'
const tagHref = (word: string) => `/?search=${encodeURIComponent(word)}`

// ── 1. Desktop Right Rail (Vertical) ──
export default function FeedRail({ category }: FeedRailProps) {
  const { pubs, busy, toggleFollow } = usePublishers()
  const tags = useTags(category)

  return (
    <div className="flex flex-col gap-6 w-full">
      {pubs.length > 0 && (
        <div className="rounded-2xl border border-gisviz-border bg-gisviz-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileSignature size={16} className="text-gisviz-accent" />
            <h2 className="font-display text-[15px] font-bold text-gisviz-ink">Featured Publishers</h2>
          </div>
          <div className="flex flex-col gap-4">
            {pubs.map(p => (
              <div key={p.user_id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar p={p} size={36} />
                  <Link href={`/profile/${p.user_handle}`} className="flex flex-col min-w-0 hover:opacity-80 transition-opacity">
                    <span className="truncate text-[13.5px] font-semibold text-gisviz-ink leading-tight">@{p.user_handle}</span>
                    <span className="text-[12px] text-gisviz-ink-soft">{(p.follower_count ?? 0).toLocaleString()} followers</span>
                  </Link>
                </div>
                <FollowButton p={p} busy={busy === p.user_id} onClick={() => toggleFollow(p)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="rounded-2xl border border-gisviz-border bg-gisviz-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-gisviz-accent" />
            <h2 className="font-display text-[15px] font-bold text-gisviz-ink capitalize">{tagsTitle(category)}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(t => (
              <Link key={t.word} href={tagHref(t.word)} title={`${t.posts} post${t.posts === 1 ? '' : 's'}`}
                className="inline-block px-2.5 py-1 rounded-[6px] bg-gisviz-canvas hover:bg-gisviz-paper border border-gisviz-border text-[12.5px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
                #{t.word}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 2. Mobile Interleaved Publisher Block (Horizontal Scroll) ──
export function MobileFeaturedPublishers() {
  const { pubs, busy, toggleFollow } = usePublishers()
  if (pubs.length === 0) return null
  return (
    <div className="lg:hidden w-full rounded-2xl border border-gisviz-border bg-gisviz-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-gisviz-accent" />
        <h2 className="font-display text-[15px] font-bold text-gisviz-ink">Featured Publishers</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {pubs.map(p => (
          <div key={p.user_id} className="w-[240px] shrink-0 p-3 rounded-[12px] border border-gisviz-border bg-gisviz-canvas flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar p={p} size={32} />
              <Link href={`/profile/${p.user_handle}`} className="flex flex-col min-w-0 hover:opacity-80 transition-opacity">
                <span className="truncate text-[13px] font-semibold text-gisviz-ink leading-tight">@{p.user_handle}</span>
                <span className="text-[11.5px] text-gisviz-ink-soft">{(p.follower_count ?? 0).toLocaleString()} followers</span>
              </Link>
            </div>
            <FollowButton p={p} busy={busy === p.user_id} onClick={() => toggleFollow(p)} small />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 3. Mobile Interleaved Trending Tags Block ──
export function MobileTrendingTags({ category }: { category?: string }) {
  const tags = useTags(category)
  if (tags.length === 0) return null
  return (
    <div className="lg:hidden w-full rounded-2xl border border-gisviz-border bg-gisviz-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-gisviz-accent" />
        <h2 className="font-display text-[15px] font-bold text-gisviz-ink capitalize">{tagsTitle(category)}</h2>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <Link key={t.word} href={tagHref(t.word)} title={`${t.posts} post${t.posts === 1 ? '' : 's'}`}
            className="inline-block px-2.5 py-1 rounded-[6px] bg-gisviz-canvas hover:bg-gisviz-paper border border-gisviz-border text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            #{t.word}
          </Link>
        ))}
      </div>
    </div>
  )
}
