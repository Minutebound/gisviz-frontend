'use client'
/**
 * PosterEditor — the poster a post's visual sits on (post form, upload + edit).
 *
 *   Poster / No poster
 *   background colour (swatches or any colour) · texture · title font, size and alignment · map base
 *   the live poster below it: drag any block (title, chart / map, legend, filter, sources, logo) to move it;
 *   click a block and use the arrow keys (Shift = bigger steps) to nudge it.
 *
 * Until the publisher changes something the value stays "auto": the server picks colour, texture and font from the
 * topic on publish (the preview shows that pick). Any change makes it the publisher's own design.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Loader2, Move, RotateCcw, Sparkles, AlignLeft, AlignCenter } from 'lucide-react'
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

const label = 'block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider'
const ALL_FONTS = Object.keys(FONTS) as FontCode[]

export default function PosterEditor({ value, onChange, inputs, spec, sources }: {
  value: PosterChoice                  // "auto" | "none" | the publisher's design
  onChange: (v: PosterChoice) => void
  inputs: PosterInputs                 // the form's details: title, categories, ... (the poster shows them, "auto" reads them)
  spec?: VisualSpec | null             // the visual being built: in the middle of the poster
  sources?: PosterSource[]
}) {
  const regions = useRegions()
  const categories = useCategories()
  const accent = inputs.theme_color || '#06ba24'
  useTitleFonts(ALL_FONTS)

  /* "auto": ask the server what it would pick for this topic (debounced while the publisher types) */
  const [auto, setAuto] = useState<PosterDesign | null>(null)
  const [loading, setLoading] = useState(false)
  const topicKey = JSON.stringify([inputs.title, inputs.description, inputs.category_ids, inputs.keywords])
  useEffect(() => {
    if (value !== 'auto' || !inputs.title.trim()) return
    const t = setTimeout(() => {
      setLoading(true)
      gisvizApi.previewBackdrop({ ...inputs, backdrop: 'auto' })
        .then(d => setAuto(toDesign(d)))
        .catch(() => setAuto(null))
        .finally(() => setLoading(false))
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

  const chip = (on: boolean) => `rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
    on ? 'border-gisviz-accent text-gisviz-accent bg-gisviz-accent/5' : 'border-gisviz-border text-gisviz-ink hover:border-gisviz-accent/60'}`
  const isMap = spec?.kind === 'map'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className={`${label} mb-0`}>Poster</label>
        <div className="flex flex-wrap items-center gap-2">
          {value === 'auto' && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-gisviz-ink-soft">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Picked from the topic, change anything to make it yours
            </span>
          )}
          {value !== 'auto' && value !== 'none' && (
            <button type="button" onClick={() => onChange('auto')} className={chip(false)}>
              <Sparkles size={12} className="mr-1 inline" /> Back to topic pick
            </button>
          )}
          <div className="inline-flex rounded-md border border-gisviz-border p-0.5">
            <button type="button" onClick={() => value === 'none' && onChange('auto')}
                    className={`rounded px-3 py-1 text-[12.5px] font-semibold ${value !== 'none' ? 'bg-gisviz-accent text-white' : 'text-gisviz-ink-soft'}`}>Poster</button>
            <button type="button" onClick={() => onChange('none')}
                    className={`rounded px-3 py-1 text-[12.5px] font-semibold ${value === 'none' ? 'bg-gisviz-accent text-white' : 'text-gisviz-ink-soft'}`}>No poster</button>
          </div>
        </div>
      </div>

      {design && (
        <div className="grid grid-cols-1 gap-5 rounded-lg border border-gisviz-border bg-gisviz-canvas p-4 lg:grid-cols-2">
          {/* background colour */}
          <div>
            <span className={label}>Background colour</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {SWATCHES.map(c => (
                <button key={c} type="button" title={c} aria-label={`Background ${c}`} onClick={() => set({ bg: c })}
                        className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${design.bg.toLowerCase() === c ? 'ring-2 ring-gisviz-accent ring-offset-2 ring-offset-gisviz-canvas' : 'border-gisviz-border'}`}
                        style={{ background: c }} />
              ))}
              <label className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-gisviz-border px-2 py-1 text-[12px] text-gisviz-ink-soft">
                <input type="color" value={isHex(design.bg) ? design.bg : '#f4f2ec'} onChange={e => set({ bg: e.target.value })}
                       className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" aria-label="Any background colour" />
                <span className="font-mono">{design.bg}</span>
              </label>
            </div>
          </div>

          {/* texture */}
          <div>
            <span className={label}>Texture</span>
            <div className="grid grid-cols-5 gap-1.5">
              {TEXTURES.map(t => (
                <button key={t.code} type="button" onClick={() => set({ texture: t.code })} title={t.label}
                        className={`overflow-hidden rounded-md border text-left ${design.texture === t.code ? 'border-gisviz-accent ring-1 ring-gisviz-accent' : 'border-gisviz-border'}`}>
                  <span className="block h-9" style={{ backgroundColor: design.bg, ...textureStyle(t.code, design.bg) }} />
                  <span className="block truncate px-1.5 py-0.5 text-[10.5px] text-gisviz-ink-soft">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* title font */}
          <div>
            <span className={label}>Title font</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {ALL_FONTS.map(f => {
                const F = FONTS[f]
                return (
                  <button key={f} type="button" onClick={() => set({ font: f })} title={F.label}
                          className={`rounded-md border px-2 py-1.5 text-left ${design.font === f ? 'border-gisviz-accent ring-1 ring-gisviz-accent' : 'border-gisviz-border hover:border-gisviz-accent/60'}`}>
                    <span className="block truncate text-[19px] leading-tight text-gisviz-ink"
                          style={{ fontFamily: F.family, fontWeight: F.weight, textTransform: F.upper ? 'uppercase' : undefined }}>
                      {(inputs.title || 'Headline').split(/\s+/).slice(0, 2).join(' ')}
                    </span>
                    <span className="block truncate text-[10.5px] text-gisviz-ink-soft">{F.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* title size + alignment, map base */}
          <div className="space-y-4">
            <div>
              <span className={label}>Title size · alignment</span>
              <div className="flex items-center gap-3">
                <input type="range" min={0.7} max={1.6} step={0.05} value={design.title_size ?? 1}
                       onChange={e => set({ title_size: Number(e.target.value) })} className="flex-1 accent-gisviz-accent" aria-label="Title size" />
                <span className="w-10 font-mono text-[12px] text-gisviz-ink-soft">{Math.round((design.title_size ?? 1) * 100)}%</span>
                <button type="button" onClick={() => set({ title_align: 'left' })} className={chip(design.title_align !== 'center')} aria-label="Title on the left"><AlignLeft size={14} /></button>
                <button type="button" onClick={() => set({ title_align: 'center' })} className={chip(design.title_align === 'center')} aria-label="Title centred"><AlignCenter size={14} /></button>
              </div>
            </div>
            {isMap && (
              <div>
                <span className={label}>Map base</span>
                <div className="flex flex-wrap gap-1.5">
                  {([['auto', 'Auto'], ['streets', 'Street map'], ['none', 'None (shapes on the poster)']] as [MapBase, string][]).map(([c, l]) => (
                    <button key={c} type="button" onClick={() => set({ map_base: c })} className={chip((design.map_base ?? 'auto') === c)}>{l}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* layout */}
          <div className="lg:col-span-2 flex flex-wrap items-center gap-2 border-t border-gisviz-border pt-3 text-[12.5px] text-gisviz-ink-soft">
            <Move size={14} className="text-gisviz-accent" />
            <span>Drag any block on the poster to move it. Click one and use the arrow keys to nudge (Shift = bigger steps).</span>
            {selected && <span className="font-semibold text-gisviz-ink">Selected: {BLOCK_NAMES[selected]}</span>}
            {selected && design.layout?.[selected] && (
              <button type="button" onClick={() => resetBlock(selected)} className={chip(false)}>
                <RotateCcw size={12} className="mr-1 inline" />Reset {BLOCK_NAMES[selected].toLowerCase()}
              </button>
            )}
            {moved.length > 0 && (
              <button type="button" onClick={() => set({ layout: {} })} className={`${chip(false)} ml-auto`}>
                <RotateCcw size={12} className="mr-1 inline" />Reset all positions
              </button>
            )}
          </div>
        </div>
      )}

      {/* the live poster: what readers will see, editable */}
      {design && (
        <VisualBackdrop regionCode={inputs.region} regions={regions} design={design} accent={accent} edit={edit}
                        eyebrow={categories.find(c => inputs.category_ids.includes(c.category_id))?.label}
                        title={(spec as any)?.title || inputs.title || 'Your title'} subtitle={(spec as any)?.subtitle}
                        sources={sources} note={inputs.note}
                        renderVisual={spec ? (w => <InteractiveVisual spec={spec} height={Math.min(620, visualHeightFor(spec, w))} />) : undefined}>
          <div className="grid h-[260px] place-items-center rounded-lg border border-dashed border-current/25 text-[13px] opacity-70">
            Pick a dataset and a visual: it appears here
          </div>
        </VisualBackdrop>
      )}
    </div>
  )
}