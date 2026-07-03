'use client'

/**
 * PageLoader
 *
 * Reusable loading component with three variants:
 *
 *  spinner  — centred animated spinner (default, used in loading.tsx)
 *  skeleton — card skeleton grid matching the feed/profile layout
 *  overlay  — full-screen translucent overlay with spinner (for in-page transitions)
 *
 * Usage:
 *   <PageLoader />                        // spinner, full page height
 *   <PageLoader variant="skeleton" />     // skeleton grid
 *   <PageLoader variant="overlay" />      // overlaid on existing content
 *   <PageLoader label="Loading posts…" /> // custom label under spinner
 */

import { Loader2 } from 'lucide-react'

interface PageLoaderProps {
  variant?: 'spinner' | 'skeleton' | 'overlay'
  label?: string
  /** How many skeleton cards to render (only used in skeleton variant) */
  count?: number
}

// ─── Skeleton card ─────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-5 flex flex-col gap-3 animate-pulse min-h-[192px]">
      {/* Icon placeholder */}
      <div className="w-5 h-5 bg-gisviz-border/60 rounded-sm" />
      {/* Category pill */}
      <div className="w-20 h-4 bg-gisviz-border/40 rounded-sm" />
      {/* Title lines */}
      <div className="w-full h-4 bg-gisviz-border/60 rounded-sm" />
      <div className="w-3/4 h-4 bg-gisviz-border/40 rounded-sm" />
      {/* Description */}
      <div className="w-full h-3 bg-gisviz-border/30 rounded-sm mt-1" />
      <div className="w-5/6 h-3 bg-gisviz-border/20 rounded-sm" />
      {/* Footer */}
      <div className="mt-auto flex justify-between items-center">
        <div className="flex gap-3">
          <div className="w-8 h-3 bg-gisviz-border/30 rounded-sm" />
          <div className="w-8 h-3 bg-gisviz-border/30 rounded-sm" />
        </div>
        <div className="w-16 h-3 bg-gisviz-border/20 rounded-sm" />
      </div>
    </div>
  )
}

// ─── Feed-style skeleton (image card + side info) ──────────────────
function SkeletonFeedCard() {
  return (
    <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-4 flex flex-col gap-3 animate-pulse mb-4">
      {/* Image area */}
      <div className="w-full h-48 bg-gisviz-border/30 rounded-sm" />
      {/* Author row */}
      <div className="flex items-center gap-3 mt-2">
        <div className="w-8 h-8 rounded-full bg-gisviz-border/40" />
        <div className="flex flex-col gap-1.5">
          <div className="w-24 h-3 bg-gisviz-border/50 rounded-sm" />
          <div className="w-16 h-3 bg-gisviz-border/30 rounded-sm" />
        </div>
      </div>
      {/* Title */}
      <div className="w-full h-4 bg-gisviz-border/60 rounded-sm" />
      <div className="w-3/4 h-4 bg-gisviz-border/40 rounded-sm" />
      {/* Tags */}
      <div className="flex gap-2 mt-1">
        {[40, 56, 32].map(w => (
          <div key={w} style={{ width: w }} className="h-5 bg-gisviz-border/30 rounded-sm" />
        ))}
      </div>
      {/* Action bar */}
      <div className="flex gap-4 pt-2 border-t border-gisviz-border/40 mt-1">
        {[48, 48, 48].map((w, i) => (
          <div key={i} style={{ width: w }} className="h-6 bg-gisviz-border/25 rounded-sm" />
        ))}
      </div>
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────────
export default function PageLoader({
  variant = 'spinner',
  label,
  count = 6,
}: PageLoaderProps) {

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-gisviz-canvas/70 backdrop-blur-[2px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-gisviz-accent" size={32} />
          {label && (
            <p className="text-[12px] font-mono text-gisviz-ink-soft animate-pulse">{label}</p>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'skeleton') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  // Default: spinner
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      {/* Animated logo-ring */}
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-gisviz-border" />
        <div className="absolute inset-0 rounded-full border-2 border-t-gisviz-accent border-r-transparent border-b-transparent border-l-transparent animate-spin" />
      </div>
      {label && (
        <p className="text-[12px] font-mono text-gisviz-ink-soft">{label}</p>
      )}
    </div>
  )
}

// ─── Named exports for convenience ─────────────────────────────────
export { SkeletonCard, SkeletonFeedCard }