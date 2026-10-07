'use client'

// app/components/feed/FeedCard.tsx
//
// The feed card: the same design for every post in the stream.
// Updated to handle both V0 flat data shapes and V2 nested (post.publisher.*) shapes safely.

import React from 'react'
import Link from 'next/link'
import {
  Heart, MessageSquare, Bookmark, Database, BadgeCheck, Radio,
} from 'lucide-react'
import { Post } from '../../../types/gisviz'
import PostMenu from '../post/PostMenu'
// Note: ensure layerColor is properly defined in your lib/designTokens or replace with a fallback
import { layerColor } from '../../../lib/designTokens' 

const RAW = process.env.NEXT_PUBLIC_API_URL || ''
const API_HOST = RAW.replace('/api/v0', '').replace(/\/$/, '')

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return `${API_HOST}${path.startsWith('/') ? '' : '/'}${path}`
}

export function timeAgo(ts?: string): string {
  if (!ts) return ''
  try {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    if (m < 1) return 'Just now'
    if (m < 60) return `${m}m ago`
    if (h < 24) return `${h}h ago`
    if (d < 30) return `${d}d ago`
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function readTime(post: Post): string {
  // @ts-ignore - gracefully handle legacy 'note' field if present
  const words = ((post.description ?? '') + (post.note ?? '')).split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.round(words / 200))} min read`
}

function compact(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return '0'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

// ── drawn placeholder, used until a thumbnail exists ────────────────────────

function VizFallback({ post, className = '' }: { post: Post; className?: string }) {
  const seed = post.post_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const cells = Array.from({ length: 24 }, (_, i) => {
    const v = ((seed * (i + 7)) % 97) / 97
    // Fallback if layerColor is missing
    const c = typeof layerColor === 'function' ? layerColor(Math.floor(v * 3)) : '#e3dfd6'
    return { v, c }
  })
  return (
    <div
      className={`grid grid-cols-6 gap-px bg-gisviz-border overflow-hidden ${className}`}
      role="img"
      aria-label="Map preview not yet rendered"
    >
      {cells.map((c, i) => (
        <span key={i} style={{ background: c.c, opacity: 0.18 + c.v * 0.7 }} />
      ))}
    </div>
  )
}

function Thumb({ post, className }: { post: Post; className: string }) {
  // Support both new `thumbnail_url` and legacy nested paths
  const legacyMapThumb = (post as any).map_preview?.thumbnail_path
  const legacyVisualThumb = (post as any).visual_image_path
  
  const src = post.thumbnail_url 
    ? mediaUrl(post.thumbnail_url) 
    : mediaUrl(legacyMapThumb) ?? mediaUrl(legacyVisualThumb)

  // a missing image file (404) shows the drawn fallback instead of a broken picture
  const [broken, setBroken] = React.useState(false)
  React.useEffect(() => setBroken(false), [src])
  if (!src || broken) return <VizFallback post={post} className={className} />
  // the poster image has a margin around the poster: zoomed in 10% by default, 10% more on hover
  return (
    <div className={`overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden onError={() => setBroken(true)}
           className="h-full w-full scale-[1.1] object-cover transition-transform duration-500 group-hover:scale-[1.2]" loading="lazy" />
    </div>
  )
}

// ── shared pieces ───────────────────────────────────────────────────────────

function PublisherRow({ post, size = 34 }: { post: Post; size?: number }) {
  // Support V2 nested publisher object OR V0 flat properties
  const handle = post.publisher?.handle || (post as any).publisher_handle || 'user'
  const avatarPath = post.publisher?.avatar_url || (post as any).publisher_avatar_path
  const timestamp = post.created_at || (post as any).created_timestamp
  
  const avatar = mediaUrl(avatarPath)
  
  return (
    <div className="flex items-center gap-2.5">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar} alt=""
          style={{ width: size, height: size }}
          className="shrink-0 rounded-[9px] object-cover"
        />
      ) : (
        <span
          style={{ width: size, height: size }}
          className="shrink-0 rounded-[9px] bg-gisviz-accent-soft text-gisviz-accent-text
                     grid place-items-center text-[13px] font-semibold"
        >
          {handle.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex flex-col gap-px">
        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-gisviz-ink">
          @{handle}
          <BadgeCheck size={14} className="text-gisviz-accent-text" aria-label="Verified publisher" />
        </span>
        <span className="text-[12.5px] text-gisviz-ink-soft">
          {timeAgo(timestamp)} · {readTime(post)}
        </span>
      </div>
    </div>
  )
}

interface FooterProps {
  post: Post
  onLike?: (post: Post) => void
  onBookmark?: (post: Post) => void
  onShare?: (post: Post) => void
  busy?: boolean
}

function CardFooter({ post, onLike, onBookmark, onShare, busy }: FooterProps) {
  // Support V2 string category OR V0 category array
  const rawCat = post.category || (post as any).categories?.[0]?.label
  const categoryLabel = rawCat ? rawCat.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : null

  const stop = (fn?: (p: Post) => void) => (e: React.MouseEvent) => {
    if (!fn) return
    e.preventDefault(); e.stopPropagation(); fn(post)
  }
  
  return (
    <div className="flex items-center gap-3.5">
      {categoryLabel && (
        <span className="inline-flex items-center h-[26px] px-2.5 rounded-full
                         bg-gisviz-accent-soft text-gisviz-accent-text
                         text-[12px] font-medium whitespace-nowrap">
          {categoryLabel}
        </span>
      )}
      <span className="w-px h-4 bg-gisviz-border" aria-hidden />

      <button
        type="button" onClick={stop(onLike)} disabled={busy}
        aria-pressed={!!post.is_liked}
        aria-label={post.is_liked ? 'Unlike' : 'Like'}
        className={`inline-flex items-center gap-1.5 text-[13px] transition-colors
                    disabled:opacity-50 ${
          post.is_liked ? 'text-gisviz-accent-text' : 'text-gisviz-ink-soft hover:text-gisviz-ink'
        }`}
      >
        <Heart size={15} fill={post.is_liked ? 'currentColor' : 'none'} />
        {compact(post.total_likes_count)}
      </button>

      <span className="inline-flex items-center gap-1.5 text-[13px] text-gisviz-ink-soft">
        <MessageSquare size={15} />
        {compact((post as any).total_comments_count ?? 0)}
      </span>

      {(post as any).post_type === 'map' && (post as any).map_preview?.layer_count && (
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] text-gisviz-ink-soft">
          <Database size={15} />
          {(post as any).map_preview.layer_count} layers
        </span>
      )}

      <div className="flex-1" />

      <button
        type="button" onClick={stop(onBookmark)} disabled={busy}
        aria-pressed={!!post.is_bookmarked}
        aria-label={post.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}
        className={`w-8 h-8 grid place-items-center transition-colors disabled:opacity-50 ${
          post.is_bookmarked ? 'text-gisviz-accent-text' : 'text-gisviz-ink-soft hover:text-gisviz-ink'
        }`}
      >
        <Bookmark size={17} fill={post.is_bookmarked ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

// ── the feed card (one design for every post) ───────────────────────────────
// The post's poster image (title, chart / map, legend, sources — drawn by the server at publish) on top, then
// the title, the description and the actions.

export default function FeedCard(props: FooterProps) {
  const { post } = props
  return (
    <article className="w-full overflow-hidden rounded-2xl border border-gisviz-border bg-gisviz-card
                        flex flex-col transition-colors hover:border-gisviz-accent/40">
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
        <PublisherRow post={post} />
        <PostMenu postId={post.post_id} onShare={() => props.onShare?.(post)} className="-mr-2" />
      </div>

      <Link href={`/post/${post.post_id}`} className="group block">
        <Thumb post={post} className="block aspect-square w-full bg-gisviz-paper" />
        <div className="flex flex-col gap-2 px-5 pt-4">
          {(post as any).post_type === 'live' && (
            <span className="inline-flex w-fit items-center gap-1 rounded-md bg-gisviz-alert/10 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-gisviz-alert">
              <Radio size={11} /> Live data
            </span>
          )}
          <h3 className="font-display text-[20px] sm:text-[22px] font-bold leading-[1.2]
                         tracking-[-0.02em] text-gisviz-ink group-hover:text-gisviz-accent-text transition-colors">
            {post.title}
          </h3>
          {post.description && (
            <p className="text-[14.5px] leading-[1.55] text-gisviz-ink-soft line-clamp-2">{post.description}</p>
          )}
        </div>
      </Link>

      <div className="px-5 pt-3 pb-4">
        <div className="mb-3 h-px bg-gisviz-border" />
        <CardFooter {...props} />
      </div>
    </article>
  )
}

/** @deprecated the stream uses FeedCard for every post; kept so older imports still compile. */
export const HeroCard = FeedCard

export function FeedCardSkeleton() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gisviz-border bg-gisviz-card flex flex-col animate-pulse" aria-hidden>
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <span className="w-[34px] h-[34px] rounded-[9px] bg-gisviz-rail-soft/60" />
        <span className="flex flex-col gap-1.5">
          <span className="block w-32 h-3 rounded bg-gisviz-rail-soft/60" />
          <span className="block w-20 h-2.5 rounded bg-gisviz-rail-soft/40" />
        </span>
      </div>
      <span className="block aspect-square w-full bg-gisviz-rail-soft/50" />
      <div className="flex flex-col gap-2.5 px-5 py-4">
        <span className="block w-4/5 h-5 rounded bg-gisviz-rail-soft/60" />
        <span className="block w-full h-3 rounded bg-gisviz-rail-soft/40" />
      </div>
    </div>
  )
}