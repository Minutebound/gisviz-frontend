'use client'

/**
 * DatasetVisualPicker — everything a post's visual needs, chosen before publishing (the post page
 * shows exactly this visual; readers cannot switch chart types there). Two sections, shown one at a time by the
 * post editor's tabs (both stay mounted, so the preview keeps updating):
 *
 *   data     Dataset (search the catalog) · Visual (the recommended chart or map is pre-selected; other types the
 *            data supports are offered) · Columns (axes, size, labels)
 *   design   Text (subtitle, value name, labels) · Classes & colours (a class column, one colour per class,
 *            palettes) · Axes (linear or log) · Measures (mean / median / mode / a fixed threshold, optionally
 *            shaded, plus a summary card) · the labels readers can filter
 * Compact, for the post editor's side panel; the editor shows the visual (onSpec) on the poster preview.
 * The poster's headline is the post's title.
 *
 * Data choices (type, columns, colour column, map type) rebuild the spec on the server; presentation
 * choices apply to the preview instantly and are validated by the server on publish.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Database, Loader2, Lock, Radio, Search, Sparkles, Trash2, X } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'
import { resolveSpec } from '../../../lib/visualSpec'
import type { VisualSpec } from '../InteractiveVisual'
import { PALETTE } from '../visuals/D3Chart'
import { DEFAULT_ACCENT, useVisualCatalog } from '../../../lib/referenceData'
import { REF_VIZ, VIZ_NEEDS, XY_VIZ, hasLabelToggle, isMapViz, type VizParam } from '../../../types/visuals'
import { Field, Group, Pill, Seg, Toggle, inputCls } from './UI'
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
  /** only datasets of this pipeline: batch (standard posts) | stream (live posts) */
  pipeline?: 'batch' | 'stream'
  /** the visual is being (re)built on the server */
  onLoading?: (busy: boolean) => void
  /** which part of the designer is shown: the data (dataset, visual, columns) or the design (colours, axes, measures) */
  section?: 'data' | 'design'
  /** design section with no dataset yet: take the publisher to the data section */
  onGoData?: () => void
}

const selectCls = inputCls
const COLORABLE: VizType[] = ['bar', 'hbar', 'lollipop']      // classes coloured by a category column even without a "color" role
/** Palettes the publisher can apply to the classes in one click. The first is the site default. */
const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Default', colors: PALETTE },
  { name: 'Colour-blind safe', colors: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00', '#56B4E9', '#F0E442', '#999999'] },
  { name: 'Soft', colors: ['#7aa6c2', '#e3b95f', '#8fb98e', '#b48fc4', '#d98a87', '#68bfb5', '#ee9b83', '#a5a0ae'] },
]
const STAT_NAME = { mean: 'Mean', median: 'Median', mode: 'Mode' } as const

function Step({ title, hint, children }: { n?: number; title: string; hint?: string; children: React.ReactNode }) {
  return <Group title={title} hint={hint}>{children}</Group>
}

export default function DatasetVisualPicker({ value, onChange, accent, initialDatasetId, onSpec, pipeline, onLoading, section = 'data', onGoData }: Props) {
  const catalog = useVisualCatalog()
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
        const rows = await gisvizApi.searchDatasets(query.trim(), 12, pipeline)
        if (!cancelled) { setResults(rows); setSearchError('') }
      } catch (e: any) {
        if (!cancelled) setSearchError(e?.response?.data?.detail || 'Could not reach the dataset catalog.')
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, open, pipeline])

  // close the result list on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── load a dataset's column profile + ranked visual options; the recommended one is pre-selected ──
  const picked = useRef<DatasetCard | null>(null)          // the search result (access flags) of the chosen dataset
  const loadInfo = async (datasetId: string, keepChoice: boolean) => {
    setLoadingInfo(true)
    setSpec(null)
    setSpecError('')
    try {
      const sres: SuggestResponse = await gisvizApi.suggestVisual(datasetId)
      setInfo(sres)
      if (!keepChoice) {
        const best = sres.options.find(o => o.viz === sres.recommended) ?? sres.options[0]
        const card = picked.current?.dataset_id === datasetId ? { ...sres.dataset, ...picked.current } : sres.dataset
        onChange({ dataset_id: datasetId, viz: best.viz, ...best.params }, card)
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
    picked.current = card
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
    if (REF_VIZ.includes(value.viz)) out.reference_lines = value.reference_lines ?? undefined
    if (XY_VIZ.includes(value.viz)) {
      out.x_scale = value.x_scale === 'log' ? 'log' : undefined
      out.y_scale = value.y_scale === 'log' ? 'log' : undefined
      out.show_summary = value.show_summary || undefined
    }
    if (out.label_filter) out.label_filter = { ...out.label_filter, default: value.filter_default ?? null }
    if (hasLabelToggle(value.viz)) out.show_labels = !!value.show_labels
    return out as VisualSpec
  }, [spec, accent, value])

  useEffect(() => { onSpec?.(shownSpec) }, [shownSpec])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onLoading?.(loadingSpec || loadingInfo) }, [loadingSpec, loadingInfo])   // eslint-disable-line react-hooks/exhaustive-deps

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
  const isXY = !!value && XY_VIZ.includes(value.viz)
  const canRef = !!value && REF_VIZ.includes(value.viz)
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
    const canColorNew = COLORABLE.includes(viz) || (opt.optional ?? []).includes('color') || (opt.needs ?? []).includes('color')
    onChange({
      dataset_id: value.dataset_id, viz, ...opt.params, label_field: opt.params.label_field ?? value.label_field, ...keepStory,
      ...(canColorNew ? { color: opt.params.color ?? value.color, colors: value.colors } : {}),
      ...(REF_VIZ.includes(viz) ? { reference_lines: (value.reference_lines ?? []).map(r => (XY_VIZ.includes(viz) ? r : { ...r, axis: undefined, shade: undefined })) } : {}),
      ...(XY_VIZ.includes(viz) ? { x_scale: value.x_scale, y_scale: value.y_scale, show_summary: value.show_summary } : {}),
    })
  }
  const patch = (p: Partial<VisualChoice>) => value && onChange({ ...value, ...p })
  const refs = value?.reference_lines ?? []
  const setRef = (i: number, p: Partial<ReferenceLineChoice>) => patch({ reference_lines: refs.map((r, k) => (k === i ? { ...r, ...p } : r)) })
  const addRef = (r: ReferenceLineChoice) => refs.length < 3 && patch({ reference_lines: [...refs, r] })
  const canColor = !!value && (colorable || has('color'))
  const applyPalette = (colors: string[]) => patch({ colors: Object.fromEntries(groups.map((g, i) => [g, colors[i % colors.length]])) })

  const groupCounts = useMemo(() => {
    const m = new Map<string, number>()
    if (value?.color) for (const r of records) { const g = String(r[value.color] ?? ''); if (g) m.set(g, (m.get(g) ?? 0) + 1) }
    return m
  }, [records, value?.color])
  const medianOf = (col?: string | null) => {
    const v = records.map(r => Number(r[col ?? ''])).filter(n => Number.isFinite(n)).sort((a, b) => a - b)
    return v.length ? v[Math.floor(v.length / 2)] : 0
  }
  const hasData = !!(info && value)
  const sectionCls = (s: 'data' | 'design') =>
    `divide-y divide-gisviz-border [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 ${section === s ? '' : 'hidden'}`

  return (
    <div className="space-y-5">
      {/* ── search (only until a dataset is picked; its card has a "change" button) ── */}
      <div ref={boxRef} className={`relative ${section === 'data' && !hasData ? '' : 'hidden'}`}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Search datasets by name or code, e.g. ds_00001"
            className={`${inputCls} h-10 pl-9 pr-9`}
            aria-label="Search datasets"
          />
          {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gisviz-accent" />}
        </div>

        {open && (
          // in the flow, not floating: the Data tab is short, so a floating list would be clipped by the panel
          <div role="listbox" aria-label="Matching datasets" className="mt-2 max-h-80 w-full overflow-auto rounded-lg border border-gisviz-border bg-gisviz-card">
            {searchError && <p className="p-3 text-[12px] text-gisviz-alert">{searchError}</p>}
            {!searchError && !searching && results.length === 0 && (
              <p className="p-3 text-[12px] text-gisviz-ink-soft">No datasets match “{query}”.</p>
            )}
            {results.map(r => (
              <button
                key={r.dataset_id}
                type="button"
                onClick={() => pickDataset(r)}
                className="flex w-full items-start gap-3 border-b border-gisviz-border px-3 py-2.5 text-left last:border-0 hover:bg-gisviz-paper"
              >
                <Database size={15} className="mt-0.5 shrink-0 text-gisviz-accent" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-gisviz-ink">{r.title}</span>
                    {r.visibility === 'private' && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-gisviz-paper px-1.5 py-px text-[10px] font-bold uppercase text-gisviz-ink-soft" title={r.can_publish_publicly ? 'Private dataset: posts show the visual, never the rows' : 'Shared with you: posts on it must stay private'}>
                        <Lock size={9} /> {r.can_publish_publicly ? 'Private' : 'Shared'}
                      </span>
                    )}
                    {r.pipeline === 'stream' && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-gisviz-alert/10 px-1.5 py-px text-[10px] font-bold uppercase text-gisviz-alert">
                        <Radio size={9} /> Live
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11.5px] text-gisviz-ink-soft">
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
        <div className="flex items-center gap-2 text-[12.5px] text-gisviz-ink-soft">
          <Loader2 size={14} className="animate-spin" /> Analysing columns…
        </div>
      )}

      {section === 'design' && !hasData && !loadingInfo && (
        <div className="rounded-xl border border-dashed border-gisviz-border px-4 py-8 text-center">
          <p className="text-[13px] font-semibold text-gisviz-ink">Pick a dataset first</p>
          <p className="mt-1 text-[12px] text-gisviz-ink-soft">Colours, axes and measures depend on the data you chart.</p>
          {onGoData && (
            <button type="button" onClick={onGoData} className="mt-3 inline-flex h-8 items-center rounded-lg bg-gisviz-accent px-3 text-[12.5px] font-bold text-[color:var(--accent-on)]">
              Choose a dataset
            </button>
          )}
        </div>
      )}

      {info && value && (
        <>
          {/* ════════════ DATA: dataset · visual · columns ════════════ */}
          <div className={sectionCls('data')}>
            <div className="flex items-start justify-between gap-3 rounded-xl border border-gisviz-border bg-gisviz-paper/50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-gisviz-ink">{info.dataset.title}</p>
                <p className="text-[11.5px] text-gisviz-ink-soft">
                  {info.dataset.dataset_id} · {info.dataset.row_count.toLocaleString()} rows · {cols.length} columns
                  {info.dataset.geometry_type ? ` · ${info.dataset.geometry_type}` : ''}
                </p>
              </div>
              <button type="button" onClick={clear} className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-gisviz-accent hover:bg-gisviz-accent/10" aria-label="Choose a different dataset">
                Change
              </button>
            </div>

            <Step title="Visual" hint="The best fit for your data is selected. Pick another to compare.">
              {(() => {
                const tile = (o: VizOption) => {
                  const on = o.viz === value.viz
                  return (
                    <button key={o.viz} type="button" onClick={() => changeViz(o.viz)} aria-pressed={on}
                      className={`relative rounded-lg border px-2.5 py-2 text-left transition-colors ${on
                        ? 'border-gisviz-accent bg-gisviz-accent/10' : 'border-gisviz-border bg-gisviz-canvas hover:border-gisviz-border-strong'}`}>
                      <span className="block truncate pr-9 text-[12.5px] font-semibold text-gisviz-ink" title={typeName(o.viz)}>{typeName(o.viz)}</span>
                      <span className="block text-[10.5px] font-medium uppercase tracking-wider text-gisviz-ink-soft">{isMapViz(o.viz) ? 'Map' : 'Chart'}</span>
                      {o.viz === info.recommended && (
                        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-gisviz-accent px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-[color:var(--accent-on)]">
                          <Sparkles size={9} /> Best
                        </span>
                      )}
                      {on && !(o.viz === info.recommended) && <Check size={13} className="absolute right-2 top-2 text-gisviz-accent" />}
                    </button>
                  )
                }
                const chosenInRest = restOpts.some(o => o.viz === value.viz)
                return (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">{topOpts.map(tile)}</div>
                    {restOpts.length > 0 && (
                      <div className="pt-1">
                        <button type="button" onClick={() => setShowAll(v => !v)}
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-gisviz-accent hover:underline">
                          {showAll || chosenInRest ? 'Hide' : 'Show'} {restOpts.length} more visuals that fit this data
                          <ChevronDown size={13} className={`transition-transform ${showAll || chosenInRest ? 'rotate-180' : ''}`} />
                        </button>
                        {(showAll || chosenInRest) && families.map(f => (
                          <div key={f} className="mt-3">
                            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-gisviz-ink-soft">{famName(f)}</p>
                            <div className="grid grid-cols-2 gap-1.5">{restOpts.filter(o => famOf(o.viz) === f).map(tile)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
              {option && (
                <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-gisviz-ink-soft">
                  <Sparkles size={13} className="mt-0.5 shrink-0 text-gisviz-accent" />
                  <span>{value.viz === info.recommended ? 'Recommended: ' : ''}{option.reason}</span>
                </p>
              )}
              {value.viz === 'map' && mapTypes.length > 1 && (
                <Field label="Map type" className="max-w-xs">
                  <select value={value.visual_type ?? ''} onChange={e => patch({ visual_type: e.target.value || null })} className={selectCls}>
                    <option value="">Automatic (from the geometry)</option>
                    {mapTypes.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                  </select>
                </Field>
              )}
            </Step>

            <Step title="Columns" hint="Which column goes where.">
              <div className="grid grid-cols-2 gap-2.5">
                {has('x') && (
                  <Field label={`${roleLabel.x ?? (numericX ? 'X axis (number)' : xKind === 'time' ? 'Time / order' : 'Labels / categories')}${!req('x') ? ' (optional)' : ''}`}>
                    <select value={value.x ?? ''} onChange={e => patch({ x: e.target.value || null, filter_default: null })} className={selectCls}>
                      {!req('x') && <option value="">None</option>}
                      {xCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                    </select>
                  </Field>
                )}
                {has('z') && (
                  <Field label={`${roleLabel.z ?? (value.viz === 'stacked' ? 'Stack by' : 'Second category')}${!req('z') ? ' (optional)' : ''}`}>
                    <select value={value.z ?? ''} onChange={e => patch({ z: e.target.value || null, filter_default: null })} className={selectCls}>
                      {!req('z') && <option value="">None</option>}
                      {zCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                    </select>
                  </Field>
                )}
                {has('y') && (
                  <Field label={`${roleLabel.y ?? (isMap ? 'Value (colour / size)' : 'Value')}${!req('y') ? ' (optional)' : ''}`}>
                    <select value={value.y ?? ''} onChange={e => patch({ y: e.target.value })} className={selectCls}>
                      {numericCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                      {allowCount && <option value="count">count (rows)</option>}
                    </select>
                  </Field>
                )}
                {has('size') && (
                  <Field label={roleLabel.size ?? 'Bubble size'}>
                    <select value={value.size ?? ''} onChange={e => patch({ size: e.target.value })} className={selectCls}>
                      {sizeCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                    </select>
                  </Field>
                )}
                {(isMap || has('label_field')) && value.viz !== 'connection_map' && labelCols.length > 0 && (
                  <Field label={isMap ? 'Place names (popup + filter)' : 'Point labels (tooltip)'}>
                    <select value={value.label_field ?? ''} onChange={e => patch({ label_field: e.target.value || null, filter_default: null })} className={selectCls}>
                      {!isMap && <option value="">None</option>}
                      {labelCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name}</option>)}
                    </select>
                  </Field>
                )}
              </div>
              {option?.viz === 'connection_map' && (
                <p className="text-[12px] text-gisviz-ink-soft">Lines are drawn from the origin and destination coordinate columns found in the data.</p>
              )}
            </Step>
          </div>

          {/* ════════════ DESIGN: text · classes & colours · axes · measures · reader filter ════════════ */}
          <div className={sectionCls('design')}>
            <Step title="Text" hint="Optional words on the poster.">
              <Field label="Subtitle">
                <input value={value.subtitle ?? ''} maxLength={300} onChange={e => patch({ subtitle: e.target.value })}
                       placeholder="What the numbers are, and when" className={inputCls} />
              </Field>
              {!isMap && (
                <Field label="Value name" hint="shown on the axis and in tooltips">
                  <input value={value.y_label ?? ''} maxLength={60} onChange={e => patch({ y_label: e.target.value })}
                         placeholder={value.y === 'count' ? 'Count' : (cols.find(c => c.column_name === value.y)?.label || value.y || '')} className={inputCls} />
                </Field>
              )}
              {hasLabelToggle(value.viz) && (
                <Toggle checked={!!value.show_labels} onChange={v => patch({ show_labels: v })}
                        label={`Names on the ${isMap ? 'map' : 'points'}`} hint="Readers can switch them off." />
              )}
            </Step>

            {canColor && (
              <Step title="Classes & colours" hint="Colour the marks by a category so each class stands apart.">
                <Field label="Class column">
                  <select value={value.color ?? ''} onChange={e => patch({ color: e.target.value || null, colors: null })} className={selectCls}>
                    <option value="">One colour (theme)</option>
                    {colorCols.map(c => <option key={c.column_name} value={c.column_name}>{c.label || c.column_name} ({c.n_distinct})</option>)}
                  </select>
                </Field>
                {!value.color && colorCols.length === 0 && (
                  <p className="text-[11.5px] leading-snug text-gisviz-ink-soft">This dataset has no category column with few enough values to use as classes.</p>
                )}
                {value.color && groups.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-0.5 text-[11.5px] font-semibold text-gisviz-ink-soft">Palette</span>
                      {PALETTES.map(p => (
                        <Pill key={p.name} onClick={() => applyPalette(p.colors)} title={`Apply the ${p.name} palette to the classes`}>
                          <span className="flex">{p.colors.slice(0, 4).map(c => <i key={c} className="-ml-0.5 h-2.5 w-2.5 rounded-full border border-gisviz-card first:ml-0" style={{ background: c }} />)}</span>
                          {p.name}
                        </Pill>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {groups.map(g => (
                        <label key={g} className="flex items-center gap-2 rounded-lg border border-gisviz-border bg-gisviz-canvas py-1 pl-1 pr-2 text-[12.5px] text-gisviz-ink">
                          <input type="color" value={value.colors?.[g] ?? '#888888'} aria-label={`Colour of ${g}`}
                                 onChange={e => patch({ colors: { ...(value.colors ?? {}), [g]: e.target.value } })}
                                 className="h-6 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
                          <span className="min-w-0 flex-1 truncate" title={g}>{g}</span>
                          <span className="font-mono text-[10.5px] text-gisviz-ink-soft">{(groupCounts.get(g) ?? 0).toLocaleString()}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </Step>
            )}

            {isXY && (
              <Step title="Axes" hint="Log spreads out data that spans orders of magnitude, like income or population. Values of 0 or below can't be shown on a log axis.">
                <div className="grid grid-cols-2 gap-2.5">
                  {([['X axis', 'x_scale'], ['Y axis', 'y_scale']] as const).map(([name, key]) => (
                    <Field key={key} label={name}>
                      <Seg<'linear' | 'log'> label={name} value={value[key] === 'log' ? 'log' : 'linear'}
                                             onChange={v => patch({ [key]: v === 'log' ? 'log' : null })}
                                             options={[{ value: 'linear', label: 'Linear' }, { value: 'log', label: 'Log' }]} />
                    </Field>
                  ))}
                </div>
              </Step>
            )}

            {canRef && (
              <Step title="Measures" hint={isXY ? 'Mean, median, mode or a fixed threshold, drawn over the chart. A threshold can tint one side.' : 'A line the bars are compared with: mean, median, mode or a fixed number.'}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['mean', 'median', 'mode'] as const).map(st => (
                    <Pill key={st} onClick={() => addRef({ stat: st, label: STAT_NAME[st], mode: value.viz === 'hbar' ? 'divider' : 'line', ...(isXY ? { axis: 'y' as const } : {}) })}>
                      + {STAT_NAME[st]}
                    </Pill>
                  ))}
                  <Pill onClick={() => addRef({ value: Math.round(medianOf(value.y)), label: 'Threshold', mode: 'line', ...(isXY ? { axis: 'y' as const, shade: 'below' as const } : {}) })}>
                    + Threshold
                  </Pill>
                  {refs.length >= 3 && <span className="text-[11.5px] text-gisviz-ink-soft">Up to 3 measures.</span>}
                </div>
                {refs.map((r, i) => (
                  <div key={i} className="space-y-2 rounded-xl border border-gisviz-border bg-gisviz-paper/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <select value={r.stat ?? 'value'} aria-label="What to measure" className={selectCls}
                                onChange={e => setRef(i, e.target.value === 'value' ? { stat: undefined, value: r.value ?? Math.round(medianOf(value.y)) } : { stat: e.target.value as 'mean' | 'median' | 'mode', value: undefined })}>
                          <option value="mean">Mean (average)</option>
                          <option value="median">Median (middle value)</option>
                          <option value="mode">Mode (most common)</option>
                          <option value="value">Fixed number</option>
                        </select>
                      </div>
                      {!r.stat && (
                        <div className="w-28 shrink-0">
                          <input type="number" aria-label="Number" value={r.value ?? ''} className={inputCls}
                                 onChange={e => setRef(i, { value: e.target.value === '' ? undefined : Number(e.target.value) })} />
                        </div>
                      )}
                      <button type="button" onClick={() => patch({ reference_lines: refs.filter((_, k) => k !== i) })}
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-alert" aria-label="Remove measure">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input value={r.label} maxLength={60} aria-label="Label" placeholder="Label on the chart, e.g. Median" className={inputCls}
                           onChange={e => setRef(i, { label: e.target.value })} />
                    {isXY && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Seg<'x' | 'y'> size="sm" label="Axis" value={r.axis === 'x' ? 'x' : 'y'} onChange={v => setRef(i, { axis: v })}
                                        options={[{ value: 'y', label: 'On Y axis' }, { value: 'x', label: 'On X axis' }]} />
                        <Seg<'none' | 'below' | 'above'> size="sm" label="Shading" value={r.shade ?? 'none'}
                                                         onChange={v => setRef(i, { shade: v === 'none' ? null : v })}
                                                         options={[{ value: 'none', label: 'No tint' }, { value: 'below', label: 'Tint below' }, { value: 'above', label: 'Tint above' }]} />
                      </div>
                    )}
                    {value.viz === 'hbar' && (
                      <Seg<'line' | 'divider'> size="sm" label="Style" value={r.mode ?? 'line'} onChange={v => setRef(i, { mode: v })}
                                               options={[{ value: 'line', label: 'Dashed line' }, { value: 'divider', label: 'Divider in the ranking' }]} />
                    )}
                  </div>
                ))}
                {isXY && (
                  <Toggle checked={!!value.show_summary} onChange={v => patch({ show_summary: v })}
                          label="Summary card" hint="n, mean, median and mode of both axes, in a corner of the chart." />
                )}
              </Step>
            )}

            {filterField && labels.length > 1 && (
              <Step title="Reader filter" hint={`Readers pick which ${cols.find(c => c.column_name === filterField)?.label || filterField} values to show.`}>
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="text-gisviz-ink-soft">Show at first:</span>
                  <Pill active={!value.filter_default} onClick={() => patch({ filter_default: null })}>All {labels.length}</Pill>
                  <Pill active={!!value.filter_default} onClick={() => patch({ filter_default: labels.slice(0, 10) })}>
                    {value.filter_default ? `${value.filter_default.length} selected` : 'A selection'}
                  </Pill>
                </div>
                {value.filter_default && (
                  <div className="grid max-h-44 grid-cols-2 gap-x-3 overflow-y-auto rounded-lg border border-gisviz-border bg-gisviz-canvas p-2">
                    {labels.map(l => (
                      <label key={l} className="flex items-center gap-2 truncate py-0.5 text-[12.5px] text-gisviz-ink">
                        <input type="checkbox" className="accent-gisviz-accent" checked={value.filter_default!.includes(l)}
                               onChange={e => patch({ filter_default: e.target.checked ? [...value.filter_default!, l] : value.filter_default!.filter(x => x !== l) })} />
                        <span className="truncate">{l}</span>
                      </label>
                    ))}
                  </div>
                )}
              </Step>
            )}
          </div>

          {specError && <p className="text-[12px] text-gisviz-alert">{specError}</p>}
        </>
      )}

      {!info && !loadingInfo && specError && <p className="text-[12px] text-gisviz-alert">{specError}</p>}
    </div>
  )
}