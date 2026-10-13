'use client'
/**
 * CategoryBanner — top of the feed on tablets and desktops (phones show only the category bar).
 * A slim, sleek strip:
 *   left    the category: a colour tick + eyebrow, name and a one-line-ish description
 *   centre  the topic's animated infographic (categories.banner scene), faded into the background
 *   right   the editor's pick: the category's most-viewed post as a compact chip (desktop; on tablets a pill)
 */
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Award, Eye } from 'lucide-react'
import BannerScenes from './BannerScenes'
import { mediaUrl } from './FeedCard'
import type { FeaturedPost } from '../../../connector/api'
import type { Category } from '../../../types/gisviz'

export default function CategoryBanner({ category, isCategory, featured }: {
  category: Category
  isCategory: boolean
  featured: FeaturedPost | null
}) {
  const color = category.banner?.color || category.theme_color
  const scene = category.banner?.scene ?? 'globe'
  // decorative and seeded by the category: drawn in the browser only (the server does not know the category yet)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const imgPath = featured ? mediaUrl(featured.visual_image_path) : null
  const [broken, setBroken] = useState(false)               // a missing file (404) shows the colour block
  useEffect(() => setBroken(false), [imgPath])
  const img = broken ? null : imgPath
  const pickColor = featured?.theme_color || color
  const fade = 'linear-gradient(90deg, transparent 0%, #000 22%, #000 78%, transparent 100%)'

  return (
    <section className="relative hidden w-full shrink-0 overflow-hidden rounded-2xl border border-gisviz-border bg-gisviz-card sm:block"
             aria-label={`${category.label}${category.banner?.label ? `: ${category.banner.label}` : ''}`}>
      {/* soft colour wash + hairline accent along the top */}
      <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(105deg, ${color}18 0%, transparent 60%)` }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}00 70%)` }} />

      <div className="relative grid min-h-[148px] grid-cols-[minmax(0,1fr)] items-center sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_280px]">
        {/* left: the category */}
        <div className="relative z-10 flex flex-col justify-center px-6 py-5 lg:px-7">
          <span className="mb-1.5 inline-flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color }}>
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />
            {isCategory ? 'Category' : 'Global feed'}
          </span>
          <h1 className="font-display text-[28px] font-bold leading-[1.08] tracking-[-0.03em] text-gisviz-ink lg:text-[34px]">{category.label}</h1>
          {category.description && (
            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-gisviz-ink-soft line-clamp-2">{category.description}</p>
          )}
          {featured && (
            <Link href={`/post/${featured.post_id}`}
                  className="group mt-3 inline-flex max-w-full items-center gap-2 self-start rounded-full border bg-gisviz-card/80 py-1 pl-1 pr-3 text-[12px] lg:hidden"
                  style={{ borderColor: `${pickColor}55` }}>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white" style={{ background: pickColor }}>
                <Award size={10} /> Pick
              </span>
              <span className="truncate font-semibold text-gisviz-ink group-hover:text-gisviz-accent">{featured.title}</span>
              <ArrowRight size={12} className="shrink-0 text-gisviz-ink-soft" />
            </Link>
          )}
        </div>

        {/* centre: the topic's animated infographic, faded at both edges */}
        <div className="pointer-events-none relative hidden h-full items-center py-3 sm:flex"
             style={{ maskImage: fade, WebkitMaskImage: fade, opacity: 0.9 }}>
          <div className="aspect-[10/3] w-full">
            {mounted && <BannerScenes key={`${category.slug}:${scene}`} scene={scene} seed={category.slug || 'for-you'} color={color} layout="panel" />}
          </div>
        </div>

        {/* right: the editor's pick */}
        <div className="relative z-10 hidden items-center py-4 pr-5 lg:flex">
          {featured ? (
            <Link href={`/post/${featured.post_id}`}
                  className="group flex w-full items-center gap-3 rounded-xl border bg-gisviz-card/90 p-2 pr-3 backdrop-blur transition-all hover:-translate-y-px hover:shadow-md"
                  style={{ borderColor: `${pickColor}45` }}>
              <span className="relative block aspect-square w-[76px] shrink-0 overflow-hidden rounded-lg bg-gisviz-paper">
                {img
                  ? <img src={img} alt="" onError={() => setBroken(true)} className="h-full w-full scale-[1.32] object-cover transition-transform duration-500 group-hover:scale-[1.42]" />
                  : <span className="block h-full w-full" style={{ background: `linear-gradient(135deg, ${pickColor}40, ${pickColor}12)` }} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: pickColor }}>
                  <Award size={10} /> Editor&apos;s pick
                </span>
                <span className="font-display text-[13.5px] font-bold leading-snug text-gisviz-ink line-clamp-2 group-hover:text-gisviz-accent">{featured.title}</span>
                <span className="flex items-center gap-2 text-[11px] text-gisviz-ink-soft">
                  <span className="inline-flex items-center gap-1"><Eye size={11} /> {featured.views_count.toLocaleString()}</span>
                  {featured.publisher_handle && <span className="truncate">@{featured.publisher_handle}</span>}
                </span>
              </span>
            </Link>
          ) : (
            <div className="grid h-[92px] w-full place-items-center rounded-xl border border-dashed border-gisviz-border px-4 text-center text-[12px] text-gisviz-ink-soft">
              The most-viewed post of this category shows here.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
