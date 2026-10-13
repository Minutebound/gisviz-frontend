// lib/poster.ts
// The poster a post's visual sits on: background colour + texture pattern (no gradients, no images), the title font,
// and where each block sits (offsets the publisher dragged in the poster editor). Stored in posts.backdrop and
// validated by the backend (app/services/backdrop_service.py) — keep the codes in sync.
import { useEffect } from 'react'

export type TextureCode = 'none' | 'paper' | 'grain' | 'dots' | 'grid' | 'ruled' | 'diagonal' | 'crosshatch' | 'topo' | 'waves'
export type FontCode = 'playfair' | 'dm_serif' | 'abril' | 'bodoni' | 'fraunces' | 'oswald' | 'bebas' | 'anton'
export type BlockId = 'title' | 'visual' | 'legend' | 'chips' | 'sources' | 'logo'
export type MapBase = 'auto' | 'streets' | 'none'
export interface BlockPos { x: number; y: number }           // offset from the block's own place, in % of the poster width

export interface PosterDesign {
  mode?: 'auto' | 'custom' | 'none'
  bg: string
  texture: TextureCode
  font: FontCode
  title_size?: number           // 0.7 .. 1.6
  title_align?: 'left' | 'center'
  map_base?: MapBase
  layout?: Partial<Record<BlockId, BlockPos>>
  dark?: boolean
  topic?: string
}

/** What the post form sends as `backdrop`: a design, or "auto" (picked from the topic on publish), or "none". */
export type PosterChoice = PosterDesign | 'auto' | 'none'

export const TEXTURES: { code: TextureCode; label: string }[] = [
  { code: 'none', label: 'Plain' }, { code: 'paper', label: 'Paper' }, { code: 'grain', label: 'Grain' },
  { code: 'dots', label: 'Dots' }, { code: 'grid', label: 'Grid' }, { code: 'ruled', label: 'Ruled' },
  { code: 'diagonal', label: 'Diagonal' }, { code: 'crosshatch', label: 'Crosshatch' },
  { code: 'topo', label: 'Contours' }, { code: 'waves', label: 'Waves' },
]

export const FONTS: Record<FontCode, { label: string; family: string; google: string; weight: number; upper?: boolean; tracking?: string }> = {
  playfair: { label: 'Playfair Display', family: '"Playfair Display", Georgia, serif', google: 'Playfair+Display:wght@800;900', weight: 900 },
  dm_serif: { label: 'DM Serif Display', family: '"DM Serif Display", Georgia, serif', google: 'DM+Serif+Display', weight: 400 },
  abril:    { label: 'Abril Fatface', family: '"Abril Fatface", Georgia, serif', google: 'Abril+Fatface', weight: 400 },
  bodoni:   { label: 'Bodoni Moda', family: '"Bodoni Moda", Didot, serif', google: 'Bodoni+Moda:opsz,wght@6..96,800', weight: 800 },
  fraunces: { label: 'Fraunces', family: 'Fraunces, Georgia, serif', google: 'Fraunces:opsz,wght@9..144,800', weight: 800 },
  oswald:   { label: 'Oswald', family: 'Oswald, "Arial Narrow", sans-serif', google: 'Oswald:wght@700', weight: 700, upper: true },
  bebas:    { label: 'Bebas Neue', family: '"Bebas Neue", "Arial Narrow", sans-serif', google: 'Bebas+Neue', weight: 400, upper: true, tracking: '0.01em' },
  anton:    { label: 'Anton', family: 'Anton, Impact, sans-serif', google: 'Anton', weight: 400, upper: true },
}

/** Loads the title fonts once (a plain <link> added to <head>: never suspends rendering, unlike a React
 *  stylesheet resource, so switching fonts in the editor keeps the form state). */
export function useTitleFonts(codes: FontCode[]) {
  const href = fontsHref(codes)
  useEffect(() => {
    if (document.head.querySelector(`link[data-gv-fonts="${CSS.escape(href)}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'; link.href = href; link.dataset.gvFonts = href
    document.head.appendChild(link)
  }, [href])
}

/** One stylesheet for the given fonts (the editor loads them all, a post page only its own). */
export function fontsHref(codes: FontCode[]) {
  const fams = [...new Set(codes)].map(c => `family=${FONTS[c]?.google ?? FONTS.playfair.google}`).join('&')
  return `https://fonts.googleapis.com/css2?${fams}&display=swap`
}

export const SWATCHES = ['#f4f1ea', '#f6f3ea', '#efe9dc', '#e8f2f7', '#eef3ea', '#f5eff3', '#fbf1ea', '#ffffff',
                         '#171d26', '#22312a', '#123a63', '#2b2a24', '#3a1f14', '#0b0b0c']

export const BLOCK_NAMES: Record<BlockId, string> = {
  title: 'Title', visual: 'Chart / map', legend: 'Legend', chips: 'Filter', sources: 'Sources', logo: 'Logo',
}

export const isHex = (v?: string | null): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v)

function luma(hex: string) {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [1, 3, 5].map(i => f(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const isDarkBg = (bg: string) => luma(bg) < 0.18

/** Text colours for a background: near-black on light, near-white on dark (the magazine look). */
export function posterInk(bg: string) {
  const dark = isDarkBg(bg)
  return dark
    ? { dark, ink: '#f4f2ee', soft: 'rgba(244,242,238,0.68)', line: 'rgba(244,242,238,0.16)' }
    : { dark, ink: '#141414', soft: 'rgba(20,20,20,0.62)', line: 'rgba(20,20,20,0.13)' }
}

export const DEFAULT_DESIGN: PosterDesign = { mode: 'custom', bg: '#f4f2ec', texture: 'paper', font: 'playfair',
  title_size: 1, title_align: 'left', map_base: 'auto', layout: {} }

/** A stored posts.backdrop (also older ones: {motif, bg, image, ...}) as a design; null = no poster. */
export function toDesign(b: any): PosterDesign | null {
  if (!b || b.mode === 'none' || b.motif === 'none') return null
  return {
    ...DEFAULT_DESIGN, ...(b.mode ? b : {}),
    bg: isHex(b.bg) ? b.bg : DEFAULT_DESIGN.bg,
    texture: TEXTURES.some(t => t.code === b.texture) ? b.texture : 'paper',
    font: b.font in FONTS ? b.font : 'playfair',
    layout: b.layout && typeof b.layout === 'object' ? b.layout : {},
  }
}

/* ── textures: small SVG tiles repeated over the background, drawn in the text colour at low opacity ── */

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

export function textureStyle(texture: TextureCode, bg: string): { backgroundImage?: string; backgroundSize?: string } {
  const { dark } = posterInk(bg)
  const c = dark ? '#ffffff' : '#000000'
  const a = (n: number) => (dark ? n * 1.25 : n)            // a touch stronger on dark grounds
  const tile = (w: number, h: number, body: string) =>
    ({ backgroundImage: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`),
       backgroundSize: `${w}px ${h}px` })
  const noise = (freq: number, op: number) => tile(220, 220,
    `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" stitchTiles="stitch"/>` +
    `<feColorMatrix values="0 0 0 0 ${dark ? 1 : 0}  0 0 0 0 ${dark ? 1 : 0}  0 0 0 0 ${dark ? 1 : 0}  0 0 0 ${op} 0"/></filter>` +
    `<rect width="220" height="220" filter="url(#n)"/>`)
  switch (texture) {
    case 'paper': return noise(0.9, a(0.09))
    case 'grain': return noise(0.65, a(0.2))
    case 'dots': return tile(18, 18, `<circle cx="9" cy="9" r="1.3" fill="${c}" fill-opacity="${a(0.16)}"/>`)
    case 'grid': return tile(28, 28, `<path d="M28 0H0V28" fill="none" stroke="${c}" stroke-opacity="${a(0.08)}" stroke-width="1"/>`)
    case 'ruled': return tile(40, 30, `<path d="M0 29.5H40" stroke="${c}" stroke-opacity="${a(0.1)}" stroke-width="1"/>`)
    case 'diagonal': return tile(14, 14, `<path d="M-2 16L16 -2M-2 2L2 -2M12 16L16 12" stroke="${c}" stroke-opacity="${a(0.08)}" stroke-width="1.2"/>`)
    case 'crosshatch': return tile(16, 16, `<path d="M0 16L16 0M0 0L16 16" stroke="${c}" stroke-opacity="${a(0.07)}" stroke-width="1"/>`)
    case 'topo': return tile(260, 260, [
      'M30 130c0-60 50-95 105-95s100 40 95 95-45 95-100 95S30 190 30 130z',
      'M60 130c0-42 35-68 75-68s72 30 68 68-33 68-72 68-71-26-71-68z',
      'M92 130c0-24 20-40 43-40s41 17 39 40-19 39-41 39-41-15-41-39z',
      'M118 130c0-9 8-15 17-15s16 6 15 15-7 15-16 15-16-6-16-15z',
      'M-40 20c40-30 90-20 120 5M180 255c30-30 70-35 110-15M200 -10c20 25 50 35 80 30',
    ].map(d => `<path d="${d}" fill="none" stroke="${c}" stroke-opacity="${a(0.07)}" stroke-width="1.1"/>`).join(''))
    case 'waves': return tile(40, 22, `<path d="M0 11c5-6 15-6 20 0s15 6 20 0" fill="none" stroke="${c}" stroke-opacity="${a(0.1)}" stroke-width="1.2"/>`)
    default: return {}
  }
}