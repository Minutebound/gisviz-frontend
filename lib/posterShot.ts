/**
 * The post's image (feed cards, thumbnails, share previews): a picture of the poster exactly as the publisher
 * sees it in the editor, taken in their browser when they press Publish / Save, and sent to the API
 * (PUT /posts/<id>/image), which frames it into a 1080 x 1080 PNG.
 *
 * The poster is the element with data-gv-poster (VisualBackdrop, PosterEditor); data-gv-bg is its colour.
 * Editing handles (data-gv-noshot) and map controls are left out. The map keeps its drawing for this
 * (InteractiveVisual: preserveDrawingBuffer).
 * Any failure returns null: the post is still saved and keeps the image the server drew.
 */
declare module 'html-to-image' {
  export function toBlob(
    node: HTMLElement | null,
    options?: {
      pixelRatio?: number
      cacheBust?: boolean
      filter?: (node: HTMLElement | Element | Node) => boolean
      imagePlaceholder?: string
    },
  ): Promise<Blob | null>
}

import { toBlob } from 'html-to-image'

const TARGET_WIDTH = 1728          // px of the poster in the picture: 2x its 864 px in the 1080 image

export type PosterShot = { blob: Blob; bg: string }

function keep(node: HTMLElement): boolean {
  if (!(node instanceof Element)) return true
  if (node.hasAttribute?.('data-gv-noshot')) return false
  const c = node.classList
  return !(c?.contains('maplibregl-control-container') || c?.contains('maplibregl-cooperative-gesture-screen'))
}

export async function snapshotPoster(root: ParentNode = document): Promise<PosterShot | null> {
  const el = root.querySelector<HTMLElement>('[data-gv-poster]')
  if (!el || el.offsetWidth < 100) return null
  try {
    const ratio = Math.min(4, Math.max(1.5, TARGET_WIDTH / el.offsetWidth))
    const blob = await toBlob(el, {
      pixelRatio: ratio,
      cacheBust: false,
      filter: keep,
      // a font or image the browser may not read (another site without CORS) is skipped, not fatal
      imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    })
    if (!blob) return null
    return { blob, bg: el.getAttribute('data-gv-bg') || '#f4f2ec' }
  } catch (e) {
    console.warn('[posterShot] the poster picture could not be taken; the drawn image stays', e)
    return null
  }
}