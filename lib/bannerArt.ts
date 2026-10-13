/**
 * Banner art for the feed's category banner: one PNG per category (public/banners/<slug>.png) and one per scene
 * (public/banners/scene-<scene>.png) for a category added later. Both are drawn by scripts/banners/generate.py,
 * which also writes bannerPalette.json: the plate colour each picture sits on.
 */
import palette from './bannerPalette.json'
import type { BannerScene } from '../types/gisviz'

type Plate = { scene: string; bg: string; bg2: string; ac: string; hi: string }
const plates = palette as Record<string, Plate>

export interface BannerArt {
  /** the picture to show (the category's own, else its scene's) */
  src: string
  /** plate colours behind and around the picture (the title sits on `bg`) */
  bg: string
  bg2: string
  /** the category colour and its pale highlight, for small accents */
  ac: string
  hi: string
}

const GLOBE = plates['scene-globe']

export function bannerArt(slug: string, scene: BannerScene): BannerArt {
  const own = plates[slug]
  const by = own ?? plates[`scene-${scene}`] ?? GLOBE
  const file = own ? slug : plates[`scene-${scene}`] ? `scene-${scene}` : 'scene-globe'
  return { src: `/banners/${file}.png`, bg: by.bg, bg2: by.bg2, ac: by.ac, hi: by.hi }
}
