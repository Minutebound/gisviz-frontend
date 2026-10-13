'use client'
/**
 * CategoryBanner — top of the feed on tablets and desktops (phones show only the category bar).
 *
 * One plate in the category's own deep colour. Its picture (a PNG drawn per category, see lib/bannerArt.ts and
 * scripts/banners/generate.py) fills the right side and bleeds off the edge; the title and description sit
 * left-aligned on the quiet side. The category's most-viewed post is a single chip under the description.
 * If the picture cannot load, the animated infographic (BannerScenes) draws in its place.
 */
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Award, Eye } from 'lucide-react'
import BannerScenes from './BannerScenes'
import { mediaUrl } from './FeedCard'
import { bannerArt } from '../../../lib/bannerArt'
import type { FeaturedPost } from '../../../connector/api'
import type { Category } from '../../../types/gisviz'

export default function CategoryBanner({ category, isCategory, featured }: {
  category: Category
  isCategory: boolean
  featured: FeaturedPost | null
}) {
  const scene = category.banner?.scene ?? 'globe'
  const art = bannerArt(category.slug || 'for-you', scene)
  const [artBroken, setArtBroken] = useState(false)
  useEffect(() => setArtBroken(false), [art.src])
  // the fallback infographic is decorative and seeded by the category: drawn in the browser only
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const imgPath = featured ? mediaUrl(featured.visual_image_path) : null
  const [thumbBroken, setThumbBroken] = useState(false)       // a missing file (404) shows a colour block
  useEffect(() => setThumbBroken(false), [imgPath])
  const thumb = thumbBroken ? null : imgPath

  return (
    <section className="relative isolate hidden w-full shrink-0 overflow-hidden rounded-[22px] sm:block"
             style={{ background: art.bg, color: art.hi }}
             aria-label={`${category.label}${isCategory ? ' category' : ''}`}>
      {/* the picture: its own box on the right, full height, fading into the plate under the text */}
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-[70%] lg:w-[64%]"
           style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 20%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 20%)' }}>
        {artBroken ? (
          mounted && (
            <div className="absolute inset-0 p-4 opacity-90">
              <BannerScenes key={`${category.slug}:${scene}`} scene={scene} seed={category.slug || 'for-you'} color={art.ac} layout="panel" />
            </div>
          )
        ) : (
          <img src={art.src} alt="" onError={() => setArtBroken(true)} draggable={false}
               className="gv-banner-art absolute inset-0 h-full w-full select-none object-cover object-right" />
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[22px] ring-1 ring-inset ring-white/10" />

      <div className="flex min-h-[236px] flex-col justify-center gap-4 px-7 py-7 sm:max-w-[58%] lg:min-h-[252px] lg:px-10 lg:max-w-[52%]">
        <div>
          <h1 className="font-display text-[34px] font-bold leading-[1.04] tracking-[-0.035em] text-white lg:text-[46px]">{category.label}</h1>
          {category.description && (
            <p className="mt-3 max-w-[34rem] text-[14px] leading-relaxed line-clamp-3 lg:text-[15px]" style={{ color: `${art.hi}d0` }}>{category.description}</p>
          )}
        </div>

        {featured ? (
          <Link href={`/post/${featured.post_id}`} title="The most-viewed post in this feed"
                className="group inline-flex w-fit max-w-full items-center gap-3 rounded-full border border-white/15 bg-white/10 py-1.5 pl-1.5 pr-4 backdrop-blur-md transition-colors hover:bg-white/[0.17] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
              {thumb
                ? <img src={thumb} alt="" onError={() => setThumbBroken(true)} className="h-full w-full scale-[1.15] object-cover" />
                : <span className="grid h-full w-full place-items-center" style={{ background: art.ac }}><Award size={16} className="text-white" /></span>}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold leading-tight text-white">{featured.title}</span>
              <span className="mt-0.5 flex items-center gap-2 text-[11.5px] leading-tight" style={{ color: `${art.hi}b0` }}>
                <span>Editor&apos;s pick</span>
                <span className="inline-flex items-center gap-1"><Eye size={11} /> {featured.views_count.toLocaleString()}</span>
              </span>
            </span>
            <ArrowUpRight size={16} className="shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        ) : (
          <p className="text-[12.5px]" style={{ color: `${art.hi}90` }}>The most-viewed post of this feed will be pinned here.</p>
        )}
      </div>
    </section>
  )
}
