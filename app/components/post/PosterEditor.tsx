'use client'
/**
 * PosterEditor — the one preview of the post editor: the poster exactly as readers will see it, with the live
 * visual on it. Above it, two slim rows:
 *   1. poster style   Poster / Plain · background · texture · title (font, size, alignment) · map base · resets
 *   2. the visual's own controls (Chart | Data, labels, filter, fullscreen), portalled by InteractiveVisual
 * Any block on the poster (title, visual, legend, filter, sources, logo) can be dragged, or clicked and nudged
 * with the arrow keys (Shift = bigger steps).
 *
 * Until the publisher changes something the value stays "auto": the server picks colour, texture and font from
 * the topic on publish (the preview shows that pick). Any change makes it the publisher's own design.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlignCenter, AlignLeft, ChevronDown, Loader2, Move, RotateCcw, Sparkles, Type } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'
import { visualHeightFor } from '../../../lib/visualSpec'
import VisualBackdrop, { type PosterSource } from '../visuals/VisualBackdrop'
import InteractiveVisual, { type VisualSpec } from '../InteractiveVisual'
import { useCategories, useRegions } from '../../../lib/referenceData'
import {
  BLOCK_NAMES, DEFAULT_DESIGN, FONTS, SWATCHES, TEXTURES, isHex, textureStyle, toDesign, useTitleFonts,
  type BlockId, type FontCode, type MapBase, type PosterChoice, type PosterDesign,
} from '../../../lib/poster'

export interface PosterInputs {
  note?: string
  title: string
  description?: string
  category_ids: number[]
  keywords: string[]
  region?: string
  theme_color?: string | null
}

const ALL_FONTS = Object.keys(FONTS) as FontCode[]

/** A toolbar button that opens a small panel under it (closes on outside click / Esc). */
function Pop({ label, icon, children, wide = false }: { label: string; icon?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12.5px] font-medium transition-colors ${
                open ? 'border-gisviz-accent text-gisviz-accent' : 'border-gisviz-border bg-gisviz-card text-gisviz-ink hover:border-gisviz-border-strong'}`}>
        {icon}{label}<ChevronDown size={12} className="opacity-60" />
      </button>
      {open && (
        <div className={`absolute left-0 top-[calc(100%+6px)] z-50 rounded-[10px] border border-gisviz-border bg-gisviz-card p-3 shadow-xl ${wide ? 'w-[340px]' : 'w-[260px]'}`}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function PosterEditor({ value, onChange, inputs, spec, sources, datasetId, loading: specLoading }: {
  value: PosterChoice                  // "auto" | "none" | the publisher's design
  onChange: (v: PosterChoice) => void
  inputs: PosterInputs                 // the form's details: title, categories, ... (the poster shows them, "auto" reads them)
  spec?: VisualSpec | null             // the visual being built: in the middle of the poster
  sources?: PosterSource[]
  datasetId?: string | null            // the Data tab shows the whole dataset
  loading?: boolean                    // the visual is being (re)built
}) {
  const regions = useRegions()
  const categories = useCategories()
  const accent = inputs.theme_color || '#06ba24'
  useTitleFonts(ALL_FONTS)

  /* "auto": ask the server what it would pick for this topic (debounced while the publisher types) */
  const [auto, setAuto] = useState<PosterDesign | null>(null)
  const [picking, setPicking] = useState(false)
  const topicKey = JSON.stringify([inputs.title, inputs.description, inputs.category_ids, inputs.keywords])
  useEffect(() => {
    if (value !== 'auto' || !inputs.title.trim()) return
    const t = setTimeout(() => {
      setPicking(true)
      gisvizApi.previewBackdrop({ ...inputs, backdrop: 'auto' })
        .then(d => setAuto(toDesign(d)))
        .catch(() => setAuto(null))
        .finally(() => setPicking(false))
    }, 600)
    return () => clearTimeout(t)
  }, [value, topicKey])   // eslint-disable-line react-hooks/exhaustive-deps

  const design: PosterDesign | null = value === 'none' ? null
    : value === 'auto' ? (auto ?? DEFAULT_DESIGN) : value
  const set = (p: Partial<PosterDesign>) => design && onChange({ ...design, ...p, mode: 'custom' })

  /* layout editing */
  const [selected, setSelected] = useState<BlockId | null>(null)
  const edit = useMemo(() => design ? {
    selected,
    onSelect: setSelected,
    onMove: (b: BlockId, pos: { x: number; y: number }) => set({ layout: { ...(design.layout ?? {}), [b]: pos } }),
  } : undefined, [design, selected])   // eslint-disable-line react-hooks/exhaustive-deps
  const moved = Object.keys(design?.layout ?? {}) as BlockId[]
  const resetBlock = (b: BlockId) => { const l = { ...(design?.layout ?? {}) }; delete l[b]; set({ layout: l }) }

  const isMap = spec?.kind === 'map'
  const tile = (on: boolean) => `rounded-md border text-left ${on ? 'border-gisviz-accent ring-1 ring-gisviz-accent' : 'border-gisviz-border hover:border-gisviz-accent/60'}`
  const seg = (on: boolean) => `h-7 rounded-[6px] px-2.5 text-[12px] font-semibold ${on ? 'bg-gisviz-card text-gisviz-ink shadow-sm' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`
  const smallBtn = 'inline-flex h-8 items-center gap-1 rounded-[8px] border border-gisviz-border bg-gisviz-card px-2.5 text-[12px] text-gisviz-ink-soft hover:text-gisviz-ink'

  const placeholder = (
    <div className="grid h-[300px] place-items-center rounded-lg border border-dashed border-current/25 px-6 text-center text-[13px] opacity-70">
      {specLoading ? <Loader2 className="animate-spin" size={22} /> : 'Pick a dataset: its visual appears here'}
    </div>
  )

  return (
    <div className="space-y-2">
      {/* row 1: poster style */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex rounded-[8px] border border-gisviz-border bg-gisviz-paper p-0.5">
          <button type="button" className={seg(value !== 'none')} onClick={() => value === 'none' && onChange('auto')}>Poster</button>
          <button type="button" className={seg(value === 'none')} onClick={() => onChange('none')}>Plain</button>
        </div>
        {design && (
          <>
            <Pop label="Background" icon={<span className="h-3.5 w-3.5 rounded-full border border-gisviz-border" style={{ background: design.bg }} />}>
              <div className="flex flex-wrap gap-1.5">
                {SWATCHES.map(c => (
                  <button key={c} type="button" title={c} aria-label={`Background ${c}`} onClick={() => set({ bg: c })}
                          className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${design.bg.toLowerCase() === c ? 'ring-2 ring-gisviz-accent ring-offset-2 ring-offset-gisviz-card' : 'border-gisviz-border'}`}
                          style={{ background: c }} />
                ))}
              </div>
              <label className="mt-2.5 flex items-center gap-2 text-[12px] text-gisviz-ink-soft">
                <input type="color" value={isHex(design.bg) ? design.bg : '#f4f2ec'} onChange={e => set({ bg: e.target.value })}
                       className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" aria-label="Any background colour" />
                Any colour <span className="font-mono">{design.bg}</span>
              </label>
            </Pop>
            <Pop label="Texture" wide>
              <div className="grid grid-cols-5 gap-1.5">
                {TEXTURES.map(t => (
                  <button key={t.code} type="button" onClick={() => set({ texture: t.code })} title={t.label} className={`overflow-hidden ${tile(design.texture === t.code)}`}>
                    <span className="block h-8" style={{ backgroundColor: design.bg, ...textureStyle(t.code, design.bg) }} />
                    <span className="block truncate px-1 py-0.5 text-[10px] text-gisviz-ink-soft">{t.label}</span>
                  </button>
                ))}
              </div>
            </Pop>
            <Pop label="Title" icon={<Type size={13} />} wide>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_FONTS.map(f => {
                  const F = FONTS[f]
                  return (
                    <button key={f} type="button" onClick={() => set({ font: f })} title={F.label} className={`px-2 py-1 ${tile(design.font === f)}`}>
                      <span className="block truncate text-[17px] leading-tight text-gisviz-ink"
                            style={{ fontFamily: F.family, fontWeight: F.weight, textTransform: F.upper ? 'uppercase' : undefined }}>
                        {(inputs.title || 'Headline').split(/\s+/).slice(0, 2).join(' ')}
                      </span>
                      <span className="block truncate text-[10px] text-gisviz-ink-soft">{F.label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input type="range" min={0.7} max={1.6} step={0.05} value={design.title_size ?? 1}
                       onChange={e => set({ title_size: Number(e.target.value) })} className="flex-1 accent-gisviz-accent" aria-label="Title size" />
                <span className="w-9 font-mono text-[11px] text-gisviz-ink-soft">{Math.round((design.title_size ?? 1) * 100)}%</span>
                <button type="button" onClick={() => set({ title_align: 'left' })} className={`grid h-7 w-7 place-items-center ${tile(design.title_align !== 'center')}`} aria-label="Title on the left"><AlignLeft size={13} /></button>
                <button type="button" onClick={() => set({ title_align: 'center' })} className={`grid h-7 w-7 place-items-center ${tile(design.title_align === 'center')}`} aria-label="Title centred"><AlignCenter size={13} /></button>
              </div>
            </Pop>
            {isMap && (
              <Pop label="Map base">
                <div className="flex flex-col gap-1">
                  {([['auto', 'Auto'], ['streets', 'Street map'], ['none', 'None (shapes on the poster)']] as [MapBase, string][]).map(([c, l]) => (
                    <button key={c} type="button" onClick={() => set({ map_base: c })} className={`px-2.5 py-1.5 text-[12.5px] ${tile((design.map_base ?? 'auto') === c)}`}>{l}</button>
                  ))}
                </div>
              </Pop>
            )}
            {value === 'auto' ? (
              <span className="inline-flex items-center gap-1 px-1 text-[11.5px] text-gisviz-ink-soft" title="Colour, texture and font picked from the topic: change anything to make it yours">
                {picking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Topic pick
              </span>
            ) : (
              <button type="button" onClick={() => onChange('auto')} className={smallBtn} title="Let the topic pick the style again"><Sparkles size={12} /> Topic pick</button>
            )}
            {selected && design.layout?.[selected] && (
              <button type="button" onClick={() => resetBlock(selected)} className={smallBtn}><RotateCcw size={12} /> {BLOCK_NAMES[selected]}</button>
            )}
            {moved.length > 0 && (
              <button type="button" onClick={() => set({ layout: {} })} className={smallBtn}><RotateCcw size={12} /> All positions</button>
            )}
            <span className="ml-auto hidden items-center gap-1 text-[11.5px] text-gisviz-ink-soft xl:inline-flex">
              <Move size={12} className="text-gisviz-accent" /> Drag any block to move it
            </span>
          </>
        )}
      </div>

      {/* the poster with the live visual (its controls appear right above it) */}
      {design ? (
        <VisualBackdrop regionCode={inputs.region} regions={regions} design={design} accent={accent} edit={edit} toolsAt="top"
                        eyebrow={categories.find(c => inputs.category_ids.includes(c.category_id))?.label}
                        title={inputs.title || (spec as any)?.title || 'Your title'} subtitle={(spec as any)?.subtitle}
                        sources={sources} note={inputs.note}
                        renderVisual={spec ? (w => <InteractiveVisual spec={spec} datasetId={datasetId}
                                                                     height={Math.min(620, visualHeightFor(spec, w))} />) : undefined}>
          {placeholder}
        </VisualBackdrop>
      ) : spec ? (
        <InteractiveVisual spec={{ ...spec, title: inputs.title || spec.title }} datasetId={datasetId} height={460} />
      ) : (
        <div className="rounded-[16px] border border-gisviz-border bg-gisviz-card p-4 text-gisviz-ink-soft">{placeholder}</div>
      )}
    </div>
  )
}