// lib/designTokens.ts
//
// Hex values for the places Tailwind classes cannot reach: inline SVG fills,
// MapLibre paint expressions, canvas, and chart libraries.
//
// Everywhere else, use the Tailwind tokens (bg-gisviz-card, text-gisviz-ink…)
// so a palette change is one file, not a sweep.
//
// NOTE: app/admin/architecture/page.tsx and app/admin/erd/page.tsx currently
// hardcode `const ACCENT = '#C25B3F'`. Replace those local constants with an
// import from here so the old terracotta cannot survive anywhere.

/** Read a CSS custom property at runtime — respects the active .dark class. */
export function cssVar(name: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)
  return v.trim() || fallback
}

// ── Brand ────────────────────────────────────────────────────────────────────

/** Signal orange. Fills, marks, active states, focus rings. */
export const ACCENT = '#F65821'

/**
 * The accent used as TEXT at body size.
 *
 * #F65821 on white is only 3.31:1 — it fails WCAG AA for normal text and is
 * legal only for graphics and for type at 24px+. This darker step is 4.98:1,
 * so links, small labels and inline accent copy use it instead.
 * On dark backgrounds the raw accent already passes, so ACCENT_TEXT_DARK lifts
 * rather than darkens.
 */
export const ACCENT_TEXT = '#C8410F'
export const ACCENT_TEXT_DARK = '#FF8055'

/** Text colour to place ON an accent fill. Dark, not white — see above. */
export const ACCENT_ON = '#1B1206'

// ── Data visualisation ───────────────────────────────────────────────────────

/**
 * Categorical palette for map layers and multi-series charts.
 * Index 0 is the brand orange so a single-layer map reads as GISVIZ.
 * Ordered for maximum separation at small sizes; safe to slice.
 */
export const CATEGORICAL_LIGHT = [
  '#F65821', // orange   — brand
  '#17807A', // teal
  '#3B4FA8', // indigo
  '#B07D0A', // ochre
  '#4F7A2E', // moss
  '#8E3D6B', // plum
] as const

export const CATEGORICAL_DARK = [
  '#FF7A4D',
  '#3FB5AD',
  '#7E92E8',
  '#D9A72E',
  '#85B95E',
  '#C87BA8',
] as const

/** Sequential ramp for choropleths, low → high. Six stops = six quantiles. */
export const SEQUENTIAL_LIGHT = [
  '#FFEDE4', '#FFCDB6', '#FBA983', '#F6804F', '#E85F25', '#BC4412',
] as const

export const SEQUENTIAL_DARK = [
  '#3A1E12', '#5E2E18', '#8C4420', '#BC5A26', '#E4712F', '#FF9460',
] as const

export type Scheme = 'light' | 'dark'

export function categorical(scheme: Scheme = 'light') {
  return scheme === 'dark' ? CATEGORICAL_DARK : CATEGORICAL_LIGHT
}

export function sequential(scheme: Scheme = 'light') {
  return scheme === 'dark' ? SEQUENTIAL_DARK : SEQUENTIAL_LIGHT
}

/** Pick a stable colour for a layer by index — wraps past the end of the ramp. */
export function layerColor(index: number, scheme: Scheme = 'light'): string {
  const p = categorical(scheme)
  return p[index % p.length]
}

/**
 * Build a MapLibre `step` expression for a choropleth.
 *
 *   paint: { 'fill-color': choroplethSteps('pop_density', [10, 50, 200, 800, 3000]) }
 *
 * `breaks` must be ascending and one shorter than the ramp (6 colours → 5 breaks).
 */
export function choroplethSteps(
  field: string,
  breaks: number[],
  scheme: Scheme = 'light',
): unknown[] {
  const ramp = sequential(scheme)
  const expr: unknown[] = ['step', ['get', field], ramp[0]]
  breaks.forEach((b, i) => expr.push(b, ramp[Math.min(i + 1, ramp.length - 1)]))
  return expr
}

// ── Chrome hexes, for SVG that must match the surrounding UI ────────────────
// Prefer cssVar() in client components so these follow the theme. These are the
// light-mode fallbacks for SSR and for static diagram code.

export const INK = '#14201B'
export const INK_SOFT = '#5D7268'
export const BORDER = '#C4D4CC'
export const CARD = '#FFFFFF'
export const CANVAS = '#F2EEE3'

/** Theme-aware chrome, for client components that draw SVG. */
export function chrome(): {
  ink: string; inkSoft: string; border: string; card: string
  canvas: string; accent: string; accentText: string
} {
  return {
    ink: cssVar('--ink', INK),
    inkSoft: cssVar('--ink-soft', INK_SOFT),
    border: cssVar('--border', BORDER),
    card: cssVar('--card', CARD),
    canvas: cssVar('--canvas', CANVAS),
    accent: cssVar('--accent', ACCENT),
    accentText: cssVar('--accent-text', ACCENT_TEXT),
  }
}
