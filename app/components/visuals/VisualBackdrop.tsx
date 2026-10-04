'use client'
/**
 * VisualBackdrop — the poster a post's visual sits on (posts.backdrop, see lib/poster.ts).
 *
 *   background  one colour + a texture pattern (no gradients, no pictures)
 *   title       eyebrow (category · place), the headline in the chosen magazine font, the subtitle
 *   visual      only the chart / map, 90% of the poster width, on the poster itself (no card); its legend
 *               sits top right of it (the visual portals it here through PosterContext)
 *   footer      the GISViz mark (black or white) bottom left; filter chips and "(Source: …)" bottom right
 *   tools       the reader's controls (labels, data, fullscreen) under the poster, outside it
 *
 * Every block can be moved: `layout` keeps offsets in % of the poster width, so the arrangement scales with the
 * poster. With `edit` the blocks are draggable (and nudged with the arrow keys once clicked).
 */
import React, { createContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Region } from '../../../types/visuals'
import {
  BLOCK_NAMES, FONTS, posterInk, textureStyle, useTitleFonts,
  type BlockId, type BlockPos, type MapBase, type PosterDesign,
} from '../../../lib/poster'

/** Lets the visual inside know it is on a poster, and where to send its legend, filter chips and controls. */
export interface PosterCtx {
  inPoster: boolean
  chipHost: HTMLElement | null
  legendHost: HTMLElement | null
  toolsHost: HTMLElement | null
  dark: boolean
  mapBase: MapBase
  editing: boolean
  /** The post's one theme colour: the visual on the poster uses it too. */
  accent?: string
}
export const PosterContext = createContext<PosterCtx>({
  inPoster: false, chipHost: null, legendHost: null, toolsHost: null, dark: false, mapBase: 'auto', editing: false,
})

export interface PosterSource { label: string; url?: string | null }

/** The editor's hooks: which block is selected, and where a block was moved to. */
export interface PosterEdit {
  selected: BlockId | null
  onSelect: (b: BlockId | null) => void
  onMove: (b: BlockId, pos: BlockPos) => void
}

const round1 = (n: number) => Math.round(n * 10) / 10

function Movable({ id, pos, posterW, edit, className = '', style, children }: {
  id: BlockId; pos?: BlockPos; posterW: number; edit?: PosterEdit
  className?: string; style?: React.CSSProperties; children: React.ReactNode
}) {
  const x = pos?.x ?? 0, y = pos?.y ?? 0
  const drag = useRef<{ cx: number; cy: number; x0: number; y0: number } | null>(null)
  const selected = edit?.selected === id
  const transform = x || y ? `translate(${(x * posterW) / 100}px, ${(y * posterW) / 100}px)` : undefined

  if (!edit) return <div className={className} style={{ ...style, transform }}>{children}</div>

  const move = (dx: number, dy: number) => edit.onMove(id, { x: round1(x + dx), y: round1(y + dy) })
  return (
    <div className={/\babsolute\b/.test(className) ? className : `${className} relative`} style={{ ...style, transform, zIndex: selected ? 45 : undefined }}>
      {children}
      {/* the handle covers the block while editing: dragging moves it instead of panning the map / hovering bars */}
      <div role="button" tabIndex={0} aria-label={`Move ${BLOCK_NAMES[id]}`} aria-pressed={selected}
           className={`absolute -inset-1 z-20 cursor-move rounded-md outline-none transition-colors ${selected
             ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/5' : 'ring-1 ring-current/25 hover:ring-[var(--accent)]/70'}`}
           onPointerDown={e => {
             e.stopPropagation(); e.preventDefault()
             ;(e.currentTarget as HTMLElement).focus({ preventScroll: true })    // so the arrow keys reach it
             edit.onSelect(id)
             drag.current = { cx: e.clientX, cy: e.clientY, x0: x, y0: y }
             ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
           }}
           onPointerMove={e => {
             const d = drag.current
             if (!d || posterW <= 0) return
             edit.onMove(id, { x: round1(d.x0 + ((e.clientX - d.cx) / posterW) * 100), y: round1(d.y0 + ((e.clientY - d.cy) / posterW) * 100) })
           }}
           onPointerUp={() => { drag.current = null }}
           onKeyDown={e => {
             const step = e.shiftKey ? 5 : 0.5
             const k: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
             if (k[e.key]) { e.preventDefault(); move(...k[e.key]) }
             if (e.key === 'Escape') edit.onSelect(null)
           }}>
        <span className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider ${selected
          ? 'bg-[var(--accent)] text-white' : 'bg-black/55 text-white opacity-0 group-hover/poster:opacity-100'}`}>
          {BLOCK_NAMES[id]}
        </span>
      </div>
    </div>
  )
}

export default function VisualBackdrop({ regionCode, regions, accent, eyebrow, design, title, subtitle, sources, note,
  renderVisual, children, edit }: {
  regionCode?: string | null
  regions: Region[]
  accent: string                       // the post's theme colour: the only colour on the poster besides black / white
  eyebrow?: string | null
  design: PosterDesign
  title?: string | null
  subtitle?: string | null
  sources?: PosterSource[]
  note?: string | null
  renderVisual?: (width: number) => React.ReactNode   // the visual, sized to its width on the poster
  children?: React.ReactNode
  edit?: PosterEdit                    // poster editor: blocks are draggable
}) {
  const { ink, soft, line, dark } = posterInk(design.bg)
  const font = FONTS[design.font] ?? FONTS.playfair
  useTitleFonts([design.font])
  const layout = design.layout ?? {}
  const scale = design.title_size ?? 1
  const center = design.title_align === 'center'

  const posterRef = useRef<HTMLElement>(null)
  const visualRef = useRef<HTMLDivElement>(null)
  const [posterW, setPosterW] = useState(0)
  const [innerW, setInnerW] = useState(0)
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setPosterW(Math.round(posterRef.current?.clientWidth ?? 0))
      setInnerW(Math.round(visualRef.current?.clientWidth ?? 0))
    })
    if (posterRef.current) ro.observe(posterRef.current)
    if (visualRef.current) ro.observe(visualRef.current)
    return () => ro.disconnect()
  }, [])

  const [chipHost, setChipHost] = useState<HTMLElement | null>(null)
  const [legendHost, setLegendHost] = useState<HTMLElement | null>(null)
  const [toolsHost, setToolsHost] = useState<HTMLElement | null>(null)
  const mapBase = design.map_base ?? 'auto'
  const ctx = useMemo<PosterCtx>(() => ({ inPoster: true, chipHost, legendHost, toolsHost, dark, mapBase, editing: !!edit, accent }),
    [chipHost, legendHost, toolsHost, dark, mapBase, edit, accent])

  const region = regions.find(r => r.code === regionCode) || null
  const place = !region || region.kind === 'global' ? 'Worldwide' : region.name
  const srcs = (sources ?? []).filter(s => s.label?.trim())

  // the poster's own colours for everything inside it (charts, labels, tooltips follow these tokens)
  // (the Tailwind tokens --color-gisviz-* are resolved at :root, so they are set here too)
  const tokens: Record<string, string> = { ink, 'ink-soft': soft, card: design.bg, paper: design.bg, canvas: design.bg,
                                           border: line, grid: line, accent }
  const vars = {
    ...Object.fromEntries(Object.entries(tokens).flatMap(([k, v]) => [[`--${k}`, v], [`--color-gisviz-${k}`, v]])),
    color: ink, backgroundColor: design.bg, ...textureStyle(design.texture, design.bg),
  } as React.CSSProperties
  const mv = (id: BlockId) => ({ id, pos: layout[id], posterW, edit })

  return (
    <div className="mb-8">
      <section ref={posterRef} style={vars}
               onPointerDown={() => edit?.onSelect(null)}
               className={`group/poster relative isolate overflow-hidden rounded-[18px] border border-gisviz-border`}>

        {/* title */}
        <Movable {...mv('title')} className={`px-5 pt-6 sm:px-9 sm:pt-9 pb-3 ${center ? 'text-center' : ''}`}>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>
            {[eyebrow, place].filter(Boolean).join(' · ')}
          </p>
          <h2 className="mt-1.5 break-words leading-[0.95]"
              style={{ fontFamily: font.family, fontWeight: font.weight, textTransform: font.upper ? 'uppercase' : undefined,
                       letterSpacing: font.tracking ?? (font.upper ? '0' : '-0.015em'), color: ink,
                       fontSize: `calc(clamp(30px, 5.6vw, 66px) * ${scale})` }}>
            {title || 'Untitled'}
          </h2>
          {subtitle && (
            <p className={`mt-2.5 max-w-[62ch] text-[15px] sm:text-[17px] font-medium leading-snug ${center ? 'mx-auto' : ''}`}
               style={{ color: soft }}>{subtitle}</p>
          )}
        </Movable>

        {/* the chart / map: 90% of the poster width, straight on the poster; its legend top right */}
        <PosterContext.Provider value={ctx}>
          <div ref={visualRef} className="relative mx-auto mt-3 w-[90%]">
            <Movable {...mv('visual')}>
              {renderVisual ? (innerW > 0 ? renderVisual(innerW) : null) : children}
            </Movable>
            <Movable {...mv('legend')} className="absolute right-0 top-0 z-[40] [&:has(>.gv-host:empty)]:hidden">
              <div ref={setLegendHost} className="gv-host" />
            </Movable>
          </div>
        </PosterContext.Provider>

        {/* footer: the mark bottom left; filter chips + note + sources bottom right */}
        <footer className="relative flex flex-col-reverse gap-4 px-5 pt-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-9 sm:pb-7">
          <Movable {...mv('logo')} className="shrink-0">
            <span className="flex items-center gap-1.5" style={{ color: ink }}>
              <img src="/gisviz_logo.png" alt="" className="h-7 w-7 object-contain"
                   style={{ filter: dark ? 'brightness(0) invert(1)' : 'brightness(0)' }} />
              <span className="font-mono text-[13px] font-black uppercase tracking-[0.2em]">GISViz</span>
            </span>
          </Movable>
          <div className="flex min-w-0 flex-col items-stretch gap-2 sm:max-w-[72%] sm:items-end">
            <Movable {...mv('chips')} className="[&:has(>.gv-host:empty)]:hidden">
              <div ref={setChipHost} className="gv-host flex flex-wrap justify-start gap-1.5 sm:justify-end" />
            </Movable>
            {(note || srcs.length > 0) && (
              <Movable {...mv('sources')}>
                <p className="text-[12px] italic leading-relaxed sm:text-right" style={{ color: soft }}>
                  {note && <span>{note} </span>}
                  {srcs.length > 0 && (
                    <span>(Source{srcs.length > 1 ? 's' : ''}: {srcs.map((s, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && '; '}
                        {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">{s.label}</a> : s.label}
                      </React.Fragment>
                    ))})</span>
                  )}
                </p>
              </Movable>
            )}
          </div>
        </footer>
      </section>
      {/* the reader's controls live under the poster, so the poster shows only the visual */}
      <div ref={setToolsHost} className="mt-2 empty:hidden" />
    </div>
  )
}