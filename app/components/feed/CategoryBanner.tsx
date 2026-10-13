'use client'
/**
 * CategoryBanner — top of the feed on tablets and desktops (phones show only the category bar).
 *   left    the category's animated infographic: the scene the server picked from the category's words
 *           (categories.banner, the same topic engine that styles posters on upload), in the category's colour
 *   centre  the category (or "For You"): name and description
 *   right   the editor's pick, in its own container: the category's most-viewed post, its image and title
 *           (desktop; on tablets a one-line pick under the description)
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

  return (
    <section className="relative hidden w-full shrink-0 overflow-hidden rounded-[20px] border border-gisviz-border bg-gisviz-card shadow-sm sm:block"
             aria-label={`${category.label}${category.banner?.label ? `: ${category.banner.label}` : ''}`}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(100deg, ${color}1c, transparent 55%)` }} />
      <div className="relative grid min-h-[232px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_330px]">
        {/* left: the topic's animated infographic */}
        <div className="relative flex items-center px-3 py-4 lg:pl-5">
          <div className="aspect-[10/3] w-full">
            {mounted && <BannerScenes key={`${category.slug}:${scene}`} scene={scene} seed={category.slug || 'for-you'} color={color} layout="panel" />}
          </div>
        </div>

        {/* centre: the category */}
        <div className="flex flex-col items-center justify-center px-6 py-7 text-center">
          <span className="mb-2 block font-mono text-[11.5px] font-bold uppercase tracking-[0.16em]" style={{ color }}>
            {isCategory ? 'Category' : 'Global feed'}
          </span>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.03em] text-gisviz-ink lg:text-[38px]">{category.label}</h1>
          {category.description && (
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-gisviz-ink-soft line-clamp-3 lg:text-[14.5px]">{category.description}</p>
          )}
          {featured && (
            <Link href={`/post/${featured.post_id}`}
                  className="group mt-3 inline-flex max-w-full items-center gap-2 rounded-full border bg-gisviz-card py-1 pl-1 pr-3 text-[12px] shadow-sm lg:hidden"
                  style={{ borderColor: `${pickColor}55` }}>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white" style={{ background: pickColor }}>
                <Award size={10} /> Pick
              </span>
              <span className="truncate font-semibold text-gisviz-ink group-hover:text-gisviz-accent">{featured.title}</span>
              <ArrowRight size={12} className="shrink-0 text-gisviz-ink-soft" />
            </Link>
          )}
        </div>

        {/* right: the editor's pick */}
        <div className="hidden items-center py-4 pr-4 lg:flex">
          {featured ? (
            <Link href={`/post/${featured.post_id}`}
                  className="group flex w-full items-stretch gap-3 overflow-hidden rounded-[14px] border border-gisviz-border bg-gisviz-card p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderColor: `${pickColor}40` }}>
              <span className="relative block aspect-square w-[118px] shrink-0 overflow-hidden rounded-[10px] bg-gisviz-paper">
                {img
                  ? <img src={img} alt="" onError={() => setBroken(true)} className="h-full w-full scale-[1.1] object-cover transition-transform duration-500 group-hover:scale-[1.2]" />
                  : <span className="block h-full w-full" style={{ background: `linear-gradient(135deg, ${pickColor}40, ${pickColor}12)` }} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
                <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: pickColor }}>
                  <Award size={10} /> Editor&apos;s pick
                </span>
                <span className="font-display text-[15px] font-bold leading-snug text-gisviz-ink line-clamp-3 group-hover:text-gisviz-accent">{featured.title}</span>
                <span className="flex items-center gap-2 text-[11.5px] text-gisviz-ink-soft">
                  <span className="inline-flex items-center gap-1"><Eye size={11} /> {featured.views_count.toLocaleString()}</span>
                  {featured.publisher_handle && <span className="truncate">@{featured.publisher_handle}</span>}
                </span>
              </span>
            </Link>
          ) : (
            <div className="grid h-full w-full place-items-center rounded-[14px] border border-dashed border-gisviz-border px-4 text-center text-[12.5px] text-gisviz-ink-soft">
              The most-viewed post of this category shows here.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}