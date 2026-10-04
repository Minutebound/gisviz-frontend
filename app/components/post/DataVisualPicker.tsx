'use client'

/**
 * DatasetVisualPicker — everything a post's visual needs, chosen before publishing (the post page
 * shows exactly this visual; readers cannot switch chart types there).
 *
 *   1. Dataset    search the catalog (datasets DB)
 *   2. Visual     the recommended chart or map is pre-selected; other types the data supports are
 *                 offered, named from the visual catalog (misc DB)
 *   3. Data       which columns go on the axes / colour / size / popup
 *   4. Story      title, subtitle, measure name
 *   5. Legend     colour bars by a category column, one colour per group (bar charts)
 *   6. Reference  average / median / fixed value line or ranking divider (bar charts)
 *   7. Filter     the labels readers can filter, and which are shown first
 *   + theme colour and a live preview with the whole dataset in its Data tab.
 *
 * Data choices (type, columns, colour column, map type) rebuild the spec on the server; presentation
 * choices apply to the preview instantly and are validated by the server on publish.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Database, Loader2, Plus, Search, Sparkles, Trash2, X } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'
import { resolveSpec } from '../../../lib/visualSpec'
import InteractiveVisual, { type VisualSpec } from '../InteractiveVisual'
import { PALETTE } from '../visuals/D3Chart'
import { DEFAULT_ACCENT, useCategories, useVisualCatalog } from '../../../lib/referenceData'
import { VIZ_NEEDS, hasLabelToggle, isMapViz, type VizParam } from '../../../types/visuals'
import type {
  DatasetCard, ReferenceLineChoice, SuggestResponse, VisualChoice, VizOption, VizType,
} from '../../../types/visuals'

interface Props {
  value: VisualChoice | null
  onChange: (choice: VisualChoice | null, dataset?: DatasetCard) => void
  /** Post theme colour (#rrggbb) and its setter. */
  accent?: string
  onAccentChange?: (hex: string) => void
  /** Open on this dataset with the suggested visual (e.g. /post/upload?dataset=<id>). */
  initialDatasetId?: string
  /** the spec as readers will see it (story choices applied): the poster preview puts it in the middle */
  onSpec?: (spec: VisualSpec | null) => void
}

const selectCls =
  'w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-[12.5px] focus:ring-2 focus:ring-gisviz-accent outline-none'
const inputCls = selectCls
const labelCls = 'block text-[11px] font-mono text-gisviz-ink-soft mb-1.5 uppercase tracking-wider'
const COLORABLE: VizType[] = ['bar', 'hbar', 'lollipop']      // colour groups + reference lines (story steps 4–5)

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gisviz-border bg-gisviz-card/60 p-4">
      <h3 className="mb-3 flex items-baseline gap-2 text-[13px] font-semibold text-gisviz-ink">
        <span className="font-mono text-[11px] text-gisviz-accent">{n}</span> {title}
        {hint && <span className="text-[11.5px] font-normal text-gisviz-ink-soft">{hint}</span>}
      </h3>
      {children}
    </section>
  )
}

export default function DatasetVisualPicker({ value, onChange, accent, onAccentChange, initialDatasetId, onSpec }: Props) {
  // preset theme colours: the site accent plus one per category colour in the DB (duplicates dropped)
  const categories = useCategories()
  const catalog = useVisualCatalog()
  const themePresets = useMemo(() => {
    const seen = new Set<string>()
    return [{ label: 'Default', color: DEFAULT_ACCENT }, ...categories.map(c => ({ label: c.label, color: c.theme_color }))]
      .filter(p => { const k = p.color.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
  }, [categories])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DatasetCard[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [info, setInfo] = useState<SuggestResponse | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  const [spec, setSpec] = useState<VisualSpec | null>(null)
  const [specError, setSpecError] = useState('')
  const [loadingSpec, setLoadingSpec] = useState(false)
  const [payload, setPayload] = useState<any>(null)        // the preview's data (for legend groups and labels)

  const boxRef = useRef<HTMLDivElement>(null)

  // ── search (debounced) ──
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const rows = await gisvizApi.searchDatasets(query.trim(), 12)
        if (!cancelled) { setResults(rows); setSearchError('') }
      } catch (e: any) {
        if (!cancelled) setSearchError(e?.response?.data?.detail || 'Could not reach the dataset catalog.')
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, open])

  // close the result list on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── load a dataset's column profile + ranked visual options; the recommended one is pre-selected ──
  const loadInfo = async (datasetId: string, keepChoice: boolean) => {
    setLoadingInfo(true)
    setSpec(null)
    setSpecError('')
    try {
      const sres: SuggestResponse = await gisvizApi.suggestVisual(datasetId)
      setInfo(sres)
      if (!keepChoice) {
        const best = sres.options.find(o => o.viz === sres.recommended) ?? sres.options[0]
        onChange({ dataset_id: datasetId, viz: best.viz, ...best.params }, sres.dataset)
      }
    } catch (e: any) {
      setInfo(null)
      if (!keepChoice) onChange(null)
      setSpecError(e?.response?.data?.detail || 'Could not analyse this dataset.')
    } finally {
      setLoadingInfo(false)
    }
  }

  const pickDataset = (card: DatasetCard) => {
    setOpen(false)
    setQuery('')
    loadInfo(card.dataset_id, false)
  }

  // Opened with an existing choice (edit page): load its dataset without overriding the choice.
  useEffect(() => {
    if (value?.dataset_id && info?.dataset.dataset_id !== value.dataset_id && !loadingInfo) {
      loadInfo(value.dataset_id, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.dataset_id])

  useEffect(() => {
    if (initialDatasetId && !value) loadInfo(initialDatasetId, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDatasetId])

  const clear = () => { setInfo(null); setSpec(null); setSpecError(''); setPayload(null); onChange(null) }

  // ── data choices rebuild the spec on the server ──
  const key = value ? [value.dataset_id, value.viz, value.x, value.y, value.z, value.size, value.label_field, value.color, value.visual_type]
    .map(v => v ?? '').join('|') : ''
  useEffect(() => {
    if (!value) return
    let cancelled = false
    setLoadingSpec(true)
    setSpecError('')
    gisvizApi.buildVisualSpecFull(value.dataset_id, {
      viz: value.viz, x: value.x, y: value.y, z: value.z, size: value.size, label_field: value.label_field,
      color: value.color || null, story: value.visual_type ? { visual_type: value.visual_type } : {},
    })
      .then(s => { if (!cancelled) setSpec(resolveSpec(s as VisualSpec)) })
      .catch((e: any) => {
        if (!cancelled) { setSpec(null); setSpecError(e?.response?.data?.detail || 'Could not build this visual.') }
      })
      .finally(() => { if (!cancelled) setLoadingSpec(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // the preview's rows / features: legend groups and filterable labels come from them
  useEffect(() => {
    if (!spec || typeof spec.data !== 'string') { setPayload(null); return }
    let live = true
    fetch(spec.data).then(r => (r.ok ? r.json() : null)).then(j => { if (live) setPayload(j) }).catch(() => {})
    return () => { live = false }
  }, [spec])

  const records: Record<string, unknown>[] = useMemo(() => {
    if (!payload) return []
    if (Array.isArray(payload)) return payload
    return (payload.features ?? []).map((f: any) => f.properties ?? {})
  }, [payload])
  const distinct = (col?: string | null) => (col ? [...new Set(records.map(r => r[col]).filter(v => v != null && v !== '').map(String))] : [])
  const groups = useMemo(() => distinct(value?.color), [records, value?.color])            // eslint-disable-line react-hooks/exhaustive-deps
  const filterField = (spec as any)?.label_filter?.field as string | undefined
  const labels = useMemo(() => distinct(filterField), [records, filterField])               // eslint-disable-line react-hooks/exhaustive-deps

  // a colour for every legend group (kept when the publisher changed it)
  useEffect(() => {
    if (!value?.color || !groups.length) return
    const current = value.colors ?? {}
    if (groups.every(g => current[g])) return
    const free = [accent || DEFAULT_ACCENT, ...PALETTE]
    const next: Record<string, string> = {}
    groups.forEach((g, i) => { next[g] = current[g] ?? free[i % free.length] })
    onChange({ ...value, colors: next })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.join('|'), value?.color])

  // presentation choices apply to the preview instantly (the server validates them on publish)
  const shownSpec = useMemo<VisualSpec | null>(() => {
    if (!spec || !value) return null
    const out: any = { ...spec, accent: accent || undefined,
      title: value.title || undefined, subtitle: value.subtitle || undefined, y_label: value.y_label || undefined }
    if (value.color) out.colors = value.colors ?? undefined
    if (COLORABLE.includes(value.viz)) out.reference_lines = value.reference_lines ?? undefined
    if (out.label_filter) out.label_filter = { ...out.label_filter, default: value.filter_default ?? null }
    if (hasLabelToggle(value.viz)) out.show_labels = !!value.show_labels
    return out as VisualSpec
  }, [spec, accent, value])

  useEffect(() => { onSpec?.(shownSpec) }, [shownSpec])   // eslint-disable-line react-hooks/exhaustive-deps

  const option: VizOption | undefined = useMemo(
    () => info?.options.find(o => o.viz === value?.viz), [info, value?.viz])

  // catalog names (misc DB) for the recommender's renderer codes; map types matching the geometry
  const typeName = (viz: VizType) => {
    const t = catalog.types.find(t => t.renderer_code === viz && (viz !== 'map' || t.code === value?.visual_type))
      ?? catalog.types.find(t => t.renderer_code === viz)
    return t ? t.name.replace(/\s*\(.*\)\s*$/, '') : info?.options.find(o => o.viz === viz)?.label ?? viz
  }
  const geom = (info?.dataset.geometry_type || '').toLowerCase()
  const mapTypes = catalog.types.filter(t => t.renderer_code === 'map' && (() => {
    const g = String(t.roles?.geometry || '')
    return !geom || g.split('|').some(k => (k === 'polygon' && geom.includes('polygon')) || (k === 'point' && geom.includes('point'))
      || (k === 'line' && geom.includes('line')) || k === 'any')
  })())

  const cols = info?.columns ?? []
  // the columns this visual needs / can use, and what to call them, come from the server with each option
  const needs: VizParam[] = option?.needs ?? (value ? VIZ_NEEDS[value.viz] ?? ['x', 'y'] : [])
  const optional: VizParam[] = option?.optional ?? []
  const roleLabel = option?.labels ?? {}
  const xKind = option?.x_kind ?? (value?.viz === 'scatter' || value?.viz === 'bubble' ? 'num' : 'cat')
  const isMap = value ? isMapViz(value.viz) : false
  const numericCols = cols.filter(c => c.dtype === 'numeric')
  const numericX = xKind === 'num'
  const catCols = cols.filter(c => c.dtype === 'categorical' || c.dtype === 'temporal' || c.dtype === 'text')
  const xCols = xKind === 'num' ? numericCols : xKind === 'time' ? [...cols.filter(c => c.dtype === 'temporal'), ...catCols.filter(c => c.dtype !== 'temporal'), ...numericCols]
    : xKind === 'any' ? cols.filter(c => c.dtype !== 'id') : catCols
  const zCols = isMap && value?.viz !== 'connection_map'          // time column of a video map: dates, years, periods
    ? cols.filter(c => c.dtype === 'temporal' || (c.dtype === 'numeric' && /(year|yr|month|date|period|time)/i.test(c.column_name))
        || ((c.dtype === 'categorical' || c.dtype === 'text') && c.column_name !== value?.label_field && c.n_distinct <= 200))
    : value?.viz === 'connected_scatter'
    ? cols.filter(c => c.dtype !== 'id' && c.column_name !== value?.x && c.column_name !== value?.y)
    : cols.filter(c => c.dtype !== 'numeric' && c.dtype !== 'id' && c.column_name !== value?.x)
  const sizeCols = numericCols.filter(c => c.column_name !== value?.x && c.column_name !== value?.y)
  const labelCols = cols.filter(c => c.dtype === 'categorical' || c.dtype === 'text')
  const colorCols = cols.filter(c => (c.dtype === 'categorical' || c.dtype === 'text') && c.n_distinct <= (value?.viz === 'edge_bundling' ? 60 : 24) && c.column_name !== value?.x)
  const allowCount = option?.count ?? (!isMap && value?.viz !== 'scatter' && value?.viz !== 'bubble' && value?.viz !== 'histogram')
  const colorable = !!value && COLORABLE.includes(value.viz)
  const has = (r: VizParam) => needs.includes(r) || optional.includes(r)
  const req = (r: VizParam) => needs.includes(r)

  // visual grid: the best few first, then every other fitting visual grouped by data-to-viz family
  const famOf = (viz: VizType) => catalog.types.find(t => t.renderer_code === viz)?.category ?? (isMapViz(viz) ? 'map' : 'other')
  const famName = (code: string) => catalog.categories.find(c => c.code === code)?.name ?? code.replace(/_/g, ' ')
  const topOpts = (info?.options ?? []).slice(0, 6)
  const restOpts = (info?.options ?? []).slice(6)
  const families = [...new Set(restOpts.map(o => famOf(o.viz)))]
  const [showAll, setShowAll] = useState(false)

  const changeViz = (viz: VizType) => {
    const opt = info?.options.find(o => o.viz === viz)
    if (!opt || !value) return
    const keepStory = { title: value.title, subtitle: value.subtitle, y_label: value.y_label, show_labels: value.show_labels }
    onChange({ dataset_id: value.dataset_id, viz, ...opt.params, label_field: opt.params.label_field ?? value.label_field,
               ...keepStory, ...(COLORABLE.includes(viz) ? { color: opt.params.color ?? value.color, colors: value.colors, reference_lines: value.reference_lines } : {}) })
  }
  const patch = (p: Partial<VisualChoice>) => value && onChange({ ...value, ...p })
  const refs = value?.reference_lines ?? []
  const setRef = (i: number, p: Partial<ReferenceLineChoice>) => patch({ reference_lines: refs.map((r, k) => (k === i ? { ...r, ...p } : r)) })

  return (
    <div className="space-y-4">
      {/* ── search ── */}
      <div ref={boxRef} className="relative">
        <label className={labelCls}>Dataset <span className="text-gisviz-alert">*</span></label>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Search datasets by name or code, e.g. ds_00001"
            className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-9 pr-9 py-2.5 text-gisviz-ink text-[13px] focus:ring-2 focus:ring-gisviz-accent outline-none"
            aria-label="Search datasets"
          />
          {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gisviz-accent" />}
        </div>

        {open && (
          <div className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-md border border-gisviz-border bg-gisviz-card shadow-lg">
            {searchError && <p className="p-3 text-[12px] font-mono text-gisviz-alert">{searchError}</p>}
            {!searchError && !searching && results.length === 0 && (
              <p className="p-3 text-[12px] font-mono text-gisviz-ink-soft">No datasets match “{query}”.</p>
            )}
            {results.map(r => (
              <button
                key={r.dataset_id}
                type="button"
                onClick={() => pickDataset(r)}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gisviz-paper border-b border-gisviz-border last:border-0"
              >
                <Database size={15} className="mt-0.5 shrink-0 text-gisviz-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-gisviz-ink">{r.title}</span>
                  <span className="block truncate font-mono text-[11px] text-gisviz-ink-soft">
                    {r.dataset_id} · {r.row_count.toLocaleString()} rows · {r.column_count ?? '?'} columns
                    {r.geometry_type ? ` · ${r.geometry_type}` : ' · table'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loadingInfo && (
        <div className="flex items-center gap-2 text-[12px] font-mono text-gisviz-ink-soft">
          <Loader2 size={14} className="animate-spin" /> Analysing columns…
        </div>
      )}

      {info && value && (
        <>
          <div className="flex items-start justify-between gap-3 rounded-md border border-gisviz-border bg-gisviz-paper/50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-gisviz-ink">{info.dataset.title}</p>
              <p className="font-mono text-[11px] text-gisviz-ink-soft">
                {info.dataset.dataset_id} · {info.dataset.row_count.toLocaleString()} rows · {cols.length} columns
                {info.dataset.geometry_type ? ` · ${info.dataset.geometry_type}` : ''}
              </p>
            </div>
            <button type="button" onClick={clear} className="shrink-0 text-gisviz-ink-soft hover:text-gisviz-alert" aria-label="Choose a different dataset">
              <X size={16} />
            </button>
          </div>

          <Step n={1} title="Visual" hint="the recommended one is selected; readers see only this one">
            {(() => {
              const tile = (o: VizOption) => {
                const on = o.viz === value.viz
                return (
                  <button key={o.viz} type="button" onClick={() => changeViz(o.viz)} aria-pressed={on}
                    className={`relative rounded-md border px-3 py-2 text-left transition-colors ${on
                      ? 'border-gisviz-accent bg-gisviz-accent/10' : 'border-gisviz-border bg-gisviz-canvas hover:border-gisviz-border-strong'}`}>
                    <span className="block pr-9 text-[12.5px] font-semibold text-gisviz-ink">{typeName(o.viz)}</span>
                    <span className="block font-mono text-[10.5px] uppercase tracking-wider text-gisviz-ink-soft">{isMapViz(o.viz) ? 'Map' : 'Chart'}</span>
                    {o.viz === info.recommended && (
                      <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-gisviz-accent px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-[color:var(--accent-on)]">
                        <Sparkles size={9} /> Best
                      </span>
                    )}
                    {on && <Check size={13} className="absolute bottom-2 right-2 text-gisviz-accent" />}
                  </button>
                )
              }
              const chosenInRest = restOpts.some(o => o.viz === value.viz)
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{topOpts.map(tile)}</div>
                  {restOpts.length > 0 && (
                    <div className="mt-2.5">
                      <button type="button" onClick={() => setShowAll(v => !v)}
                              className="inline-flex items-center gap-1 text-[12px] font-semibold text-gisviz-accent hover:underline">
                        {showAll || chosenInRest ? 'Hide' : 'Show'} {restOpts.length} more visuals that fit this data
                        <ChevronDown size={13} className={`transition-transform ${showAll || chosenInRest ? 'rotate-180' : ''}`} />
                      </button>
                      {(showAll || chosenInRest) && families.map(f => (
                        <div key={f} className="mt-3">
                          <p className="mb-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-gisviz-ink-soft">{famName(f)}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{restOpts.filter(o => famOf(o.viz) === f).map(tile)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
            {option && (
              <p className="mt-2.5 flex items-start gap-1.5 text-[12px] text-gisviz-ink-soft">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-gisviz-accent" />
                <span>{value.viz === info.recommended ? 'Recommended: ' : ''}{option.reason}</span>
              </p>
            )}
            {value.viz === 'map' && mapTypes.length > 1 && (
              <div className="mt-3 max-w-xs">
                <label className={labelCls}>Map type</label>
                <select value={value.visual_type ?? ''} onChange={e => patch({ visual_type: e.target.value || null })} className={selectCls}>
                  <option value="">Automatic (from the geometry)</option>
                  {mapTypes.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </div>
            )}
          </Step>

          <Step n={2} title="Data">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {has('x') && (
                <div>
                  <label className={labelCls}>{roleLabel.x ?? (numericX ? 'X axis (number)' : xKind === 'time' ? 'Time / order' : 'Labels / categories')}{!req('x') && ' (optional)'}</label>
                  <select value={value.x ?? ''} onChange={e => patch({ x: e.target.value || null, filter_default: null })} className={selectCls}>
                    {!req('x') && <option value="">None</option>}
                    {xCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                  </select>
                </div>
              )}
              {has('z') && (
                <div>
                  <label className={labelCls}>{roleLabel.z ?? (value.viz === 'stacked' ? 'Stack by' : 'Second category')}{!req('z') && ' (optional)'}</label>
                  <select value={value.z ?? ''} onChange={e => patch({ z: e.target.value || null, filter_default: null })} className={selectCls}>
                    {!req('z') && <option value="">None</option>}
                    {zCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                  </select>
                </div>
              )}
              {has('y') && (
                <div>
                  <label className={labelCls}>{roleLabel.y ?? (isMap ? 'Value (colour / size)' : 'Value')}{!req('y') && ' (optional)'}</label>
                  <select value={value.y ?? ''} onChange={e => patch({ y: e.target.value })} className={selectCls}>
                    {numericCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                    {allowCount && <option value="count">count (rows)</option>}
                  </select>
                </div>
              )}
              {has('size') && (
                <div>
                  <label className={labelCls}>{roleLabel.size ?? 'Bubble size'}</label>
                  <select value={value.size ?? ''} onChange={e => patch({ size: e.target.value })} className={selectCls}>
                    {sizeCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                  </select>
                </div>
              )}
              {has('color') && !colorable && (
                <div>
                  <label className={labelCls}>{roleLabel.color ?? 'Colour by'} (optional)</label>
                  <select value={value.color ?? ''} onChange={e => patch({ color: e.target.value || null, colors: null })} className={selectCls}>
                    <option value="">One colour (theme)</option>
                    {colorCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name} ({c.n_distinct})</option>)}
                  </select>
                </div>
              )}
              {(isMap || has('label_field')) && value.viz !== 'connection_map' && labelCols.length > 0 && (
                <div>
                  <label className={labelCls}>{isMap ? 'Place names (popup + filter)' : 'Point labels (tooltip)'}</label>
                  <select value={value.label_field ?? ''} onChange={e => patch({ label_field: e.target.value || null, filter_default: null })} className={selectCls}>
                    {!isMap && <option value="">None</option>}
                    {labelCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                  </select>
                </div>
              )}
            </div>
            {option?.viz === 'connection_map' && (
              <p className="mt-2 text-[12px] text-gisviz-ink-soft">Lines are drawn from the origin and destination coordinate columns found in the data.</p>
            )}
          </Step>

          <Step n={3} title="Story" hint="optional">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className={labelCls}>Visual title</label>
                <input value={value.title ?? ''} maxLength={160} onChange={e => patch({ title: e.target.value })}
                       placeholder="e.g. The countries that are best at math" className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Subtitle</label>
                  <input value={value.subtitle ?? ''} maxLength={300} onChange={e => patch({ subtitle: e.target.value })}
                         placeholder="What the numbers are, and when" className={inputCls} />
                </div>
                {!isMap && (
                  <div>
                    <label className={labelCls}>Value name</label>
                    <input value={value.y_label ?? ''} maxLength={60} onChange={e => patch({ y_label: e.target.value })}
                           placeholder={value.y === 'count' ? 'Count' : (cols.find(c => c.column_name === value.y)?.label || value.y || '')} className={inputCls} />
                  </div>
                )}
              </div>
              {hasLabelToggle(value.viz) && (
                <label className="inline-flex items-center gap-2 text-[13px] text-gisviz-ink">
                  <input type="checkbox" className="accent-gisviz-accent" checked={!!value.show_labels}
                         onChange={e => patch({ show_labels: e.target.checked })} />
                  Show labels on the {isMap ? 'map' : 'points'} by default
                  <span className="text-[12px] text-gisviz-ink-soft">(readers can switch them on / off)</span>
                </label>
              )}
            </div>
          </Step>

          {colorable && (
            <Step n={4} title="Legend & colours" hint="colour the bars by a category">
              <div className="max-w-xs">
                <label className={labelCls}>Colour by</label>
                <select value={value.color ?? ''} onChange={e => patch({ color: e.target.value || null, colors: null })} className={selectCls}>
                  <option value="">One colour (theme)</option>
                  {colorCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name} ({c.n_distinct})</option>)}
                </select>
              </div>
              {value.color && groups.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {groups.map(g => (
                    <label key={g} className="inline-flex items-center gap-2 rounded-md border border-gisviz-border bg-gisviz-canvas py-1 pl-1 pr-2.5 text-[12.5px] text-gisviz-ink">
                      <input type="color" value={value.colors?.[g] ?? '#888888'} aria-label={`Colour of ${g}`}
                             onChange={e => patch({ colors: { ...(value.colors ?? {}), [g]: e.target.value } })}
                             className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
                      {g}
                    </label>
                  ))}
                </div>
              )}
            </Step>
          )}

          {colorable && (
            <Step n={5} title="Reference line" hint="e.g. an average the bars are compared with">
              <div className="space-y-2.5">
                {refs.map((r, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1.4fr_1fr_auto] gap-2 items-end">
                    <div>
                      <label className={labelCls}>Value</label>
                      <select value={r.stat ?? 'value'} className={selectCls}
                              onChange={e => setRef(i, e.target.value === 'value' ? { stat: undefined, value: r.value ?? 0 } : { stat: e.target.value as 'mean' | 'median', value: undefined })}>
                        <option value="mean">Average of the bars</option>
                        <option value="median">Median of the bars</option>
                        <option value="value">Fixed number</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Number</label>
                      <input type="number" disabled={!!r.stat} value={r.stat ? '' : (r.value ?? '')} className={`${inputCls} disabled:opacity-50`}
                             onChange={e => setRef(i, { value: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className={labelCls}>Label</label>
                      <input value={r.label} maxLength={60} placeholder="e.g. OECD average" className={inputCls}
                             onChange={e => setRef(i, { label: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Style</label>
                      <select value={r.mode ?? 'line'} onChange={e => setRef(i, { mode: e.target.value as 'line' | 'divider' })} className={selectCls}>
                        <option value="line">Dashed line</option>
                        {value.viz === 'hbar' && <option value="divider">Divider in the ranking</option>}
                      </select>
                    </div>
                    <button type="button" onClick={() => patch({ reference_lines: refs.filter((_, k) => k !== i) })}
                            className="h-[34px] w-9 grid place-items-center rounded-md border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-alert" aria-label="Remove reference line">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {refs.length < 3 && (
                  <button type="button" onClick={() => patch({ reference_lines: [...refs, { stat: 'mean', label: 'Average', mode: value.viz === 'hbar' ? 'divider' : 'line' }] })}
                          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gisviz-border px-3 py-1.5 text-[12.5px] text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent">
                    <Plus size={13} /> Add a reference line
                  </button>
                )}
              </div>
            </Step>
          )}

          {filterField && labels.length > 1 && (
            <Step n={colorable ? 6 : 4} title="Reader filter" hint={`readers pick which ${cols.find(c => c.column_name === filterField)?.label || filterField} values to show`}>
              <div className="flex flex-wrap items-center gap-2 mb-2 text-[12.5px]">
                <span className="text-gisviz-ink-soft">Show at first:</span>
                <button type="button" onClick={() => patch({ filter_default: null })}
                        className={`rounded-md border px-2.5 py-1 ${!value.filter_default ? 'border-gisviz-accent text-gisviz-accent' : 'border-gisviz-border'}`}>All {labels.length}</button>
                <button type="button" onClick={() => patch({ filter_default: labels.slice(0, 10) })}
                        className={`rounded-md border px-2.5 py-1 ${value.filter_default ? 'border-gisviz-accent text-gisviz-accent' : 'border-gisviz-border'}`}>
                  {value.filter_default ? `${value.filter_default.length} selected` : 'A selection'}
                </button>
              </div>
              {value.filter_default && (
                <div className="max-h-44 overflow-y-auto rounded-md border border-gisviz-border bg-gisviz-canvas p-2 grid grid-cols-2 sm:grid-cols-3 gap-x-3">
                  {labels.map(l => (
                    <label key={l} className="flex items-center gap-2 py-0.5 text-[12.5px] text-gisviz-ink truncate">
                      <input type="checkbox" className="accent-gisviz-accent" checked={value.filter_default!.includes(l)}
                             onChange={e => patch({ filter_default: e.target.checked ? [...value.filter_default!, l] : value.filter_default!.filter(x => x !== l) })} />
                      <span className="truncate">{l}</span>
                    </label>
                  ))}
                </div>
              )}
            </Step>
          )}

          {onAccentChange && (
            <div>
              <label className={labelCls}>Theme colour</label>
              <div className="flex flex-wrap items-center gap-2">
                {themePresets.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    title={p.label}
                    aria-label={`Theme colour ${p.label}`}
                    aria-pressed={accent?.toLowerCase() === p.color.toLowerCase()}
                    onClick={() => onAccentChange(p.color)}
                    style={{ background: p.color }}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      accent?.toLowerCase() === p.color.toLowerCase() ? 'border-gisviz-ink' : 'border-transparent'}`}
                  />
                ))}
                <label className="ml-1 inline-flex items-center gap-2 text-[12px] text-gisviz-ink-soft">
                  <input type="color" value={accent || DEFAULT_ACCENT} onChange={e => onAccentChange(e.target.value)}
                         className="h-7 w-9 cursor-pointer rounded border border-gisviz-border bg-transparent p-0" aria-label="Custom theme colour" />
                  Custom
                </label>
              </div>
            </div>
          )}

          {/* ── live preview ── */}
          <div>
            <label className={labelCls}>Preview (interactive, exactly as readers will see it)</label>
            {specError && <p className="mb-2 text-[12px] font-mono text-gisviz-alert">{specError}</p>}
            {loadingSpec && !shownSpec && (
              <div className="flex h-[300px] items-center justify-center rounded-[16px] border border-gisviz-border bg-gisviz-canvas">
                <Loader2 className="animate-spin text-gisviz-accent" size={26} />
              </div>
            )}
            {shownSpec && <InteractiveVisual key={key} spec={shownSpec} datasetId={value.dataset_id}
                                             height={value.viz === 'hbar' ? Math.min(900, Math.max(380, labels.length * 22 + 80)) : 420} />}
          </div>
        </>
      )}

      {!info && !loadingInfo && specError && <p className="text-[12px] font-mono text-gisviz-alert">{specError}</p>}
    </div>
  )
}