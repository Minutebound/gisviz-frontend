'use client'

/**
 * DatasetVisualPicker
 * -------------------
 * 1. Search the DuckDB dataset catalog by name or id.
 * 2. The backend recommends the best visual type (shown as "Suggested").
 * 3. The publisher can switch type / columns from dropdowns.
 * 4. A live <InteractiveVisual> preview shows exactly what the post will render.
 *
 * Emits a VisualChoice (dataset_id + viz + x/y/z/size/label) that the upload and edit pages
 * send to POST/PUT /posts. The server re-validates it and renders the PNG for the feed.
 *
 * Pass `value` with a dataset_id to open on an existing choice (edit page): the picker loads that
 * dataset's column profile and keeps the choice instead of resetting it to the suggestion.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Database, Loader2, Search, Sparkles, X } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'
import { resolveSpec } from '../../../lib/visualSpec'
import InteractiveVisual, { type VisualSpec } from '../InteractiveVisual'
import { CATEGORIES } from '../../../types/gisviz'
import { VIZ_NEEDS, isMapViz } from '../../../types/visuals'
import type {
  DatasetCard, SuggestResponse, VisualChoice, VizOption, VizType,
} from '../../../types/visuals'

interface Props {
  value: VisualChoice | null
  onChange: (choice: VisualChoice | null, dataset?: DatasetCard) => void
  /** Post theme colour (#rrggbb) and its setter. */
  accent?: string
  onAccentChange?: (hex: string) => void
  /** Open on this dataset with the suggested visual (e.g. /post/upload?dataset=<id>). */
  initialDatasetId?: string
}

/** Preset theme colours: one per category, plus the site green. */
export const THEME_PRESETS: { label: string; color: string }[] = CATEGORIES.map(c => ({
  label: c.slug ? c.label : 'Default', color: c.theme_color,
}))

const selectCls =
  'w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-[12px] font-mono focus:ring-2 focus:ring-gisviz-accent outline-none'
const labelCls = 'block text-[11px] font-mono text-gisviz-ink-soft mb-1.5 uppercase tracking-wider'

export default function DatasetVisualPicker({ value, onChange, accent, onAccentChange, initialDatasetId }: Props) {
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

  // ── load a dataset's column profile + ranked visual options ──
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

  const clear = () => { setInfo(null); setSpec(null); setSpecError(''); onChange(null) }

  // ── build the preview spec whenever the choice changes ──
  const key = value ? `${value.dataset_id}|${value.viz}|${value.x ?? ''}|${value.y ?? ''}|${value.z ?? ''}|${value.size ?? ''}|${value.label_field ?? ''}` : ''
  useEffect(() => {
    if (!value) return
    let cancelled = false
    setLoadingSpec(true)
    setSpecError('')
    gisvizApi
      .buildVisualSpec(value.dataset_id, { viz: value.viz, x: value.x, y: value.y, z: value.z, size: value.size, label_field: value.label_field })
      .then(s => { if (!cancelled) setSpec(resolveSpec(s as VisualSpec)) })
      .catch((e: any) => {
        if (!cancelled) { setSpec(null); setSpecError(e?.response?.data?.detail || 'Could not build this visual.') }
      })
      .finally(() => { if (!cancelled) setLoadingSpec(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // The preview reflects the chosen theme colour without refetching anything.
  const shownSpec = useMemo<VisualSpec | null>(
    () => (spec ? ({ ...spec, accent: accent || undefined } as VisualSpec) : null), [spec, accent])

  const option: VizOption | undefined = useMemo(
    () => info?.options.find(o => o.viz === value?.viz), [info, value?.viz])

  const cols = info?.columns ?? []
  const needs = value ? VIZ_NEEDS[value.viz] : []
  const isMap = value ? isMapViz(value.viz) : false
  const numericCols = cols.filter(c => c.dtype === 'numeric')
  const numericX = value?.viz === 'scatter' || value?.viz === 'bubble'
  const xCols = cols.filter(c => (numericX ? c.dtype === 'numeric' : c.dtype === 'categorical' || c.dtype === 'temporal' || c.dtype === 'text'))
  const zCols = cols.filter(c => c.dtype !== 'numeric' && c.dtype !== 'id' && c.column_name !== value?.x)
  const sizeCols = numericCols.filter(c => c.column_name !== value?.x && c.column_name !== value?.y)
  const labelCols = cols.filter(c => c.dtype === 'categorical' || c.dtype === 'text')
  const allowCount = !isMap && value?.viz !== 'scatter' && value?.viz !== 'bubble' && value?.viz !== 'histogram'

  const changeViz = (viz: VizType) => {
    const opt = info?.options.find(o => o.viz === viz)
    if (opt && value) onChange({ dataset_id: value.dataset_id, viz, ...opt.params, label_field: opt.params.label_field ?? value.label_field })
  }
  const patch = (p: Partial<VisualChoice>) => value && onChange({ ...value, ...p })

  return (
    <div className="space-y-5">
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
                    {r.dataset_id} · {r.row_count.toLocaleString()} rows
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

      {/* ── selected dataset + choices ── */}
      {info && value && (
        <>
          <div className="flex items-start justify-between gap-3 rounded-md border border-gisviz-border bg-gisviz-paper/50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-gisviz-ink">{info.dataset.title}</p>
              <p className="font-mono text-[11px] text-gisviz-ink-soft">
                {info.dataset.dataset_id} · {info.dataset.row_count.toLocaleString()} rows
                {info.dataset.license ? ` · ${info.dataset.license}` : ''}
              </p>
            </div>
            <button type="button" onClick={clear} className="shrink-0 text-gisviz-ink-soft hover:text-gisviz-alert" aria-label="Choose a different dataset">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className={labelCls}>Visual type</label>
            <select value={value.viz} onChange={e => changeViz(e.target.value as VizType)} className={selectCls}>
              <optgroup label="Charts (D3)">
                {info.options.filter(o => !isMapViz(o.viz)).map(o => (
                  <option key={o.viz} value={o.viz}>{o.label}{o.viz === info.recommended ? '  (Suggested)' : ''}</option>
                ))}
              </optgroup>
              {info.options.some(o => isMapViz(o.viz)) && (
                <optgroup label="Maps (MapLibre)">
                  {info.options.filter(o => isMapViz(o.viz)).map(o => (
                    <option key={o.viz} value={o.viz}>{o.label}{o.viz === info.recommended ? '  (Suggested)' : ''}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {option && (
              <p className="mt-2 flex items-start gap-1.5 text-[12px] text-gisviz-ink-soft">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-gisviz-accent" />
                <span>
                  {value.viz === info.recommended ? 'Suggested because ' : 'Option: '}
                  {option.reason.charAt(0).toLowerCase() + option.reason.slice(1)}
                </span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {needs.includes('x') && (
              <div>
                <label className={labelCls}>{numericX ? 'X axis (number)' : 'X axis / categories'}</label>
                <select value={value.x ?? ''} onChange={e => patch({ x: e.target.value })} className={selectCls}>
                  {xCols.map(c => <option key={c.column_name} value={c.column_name}>{c.column_name}</option>)}
                </select>
              </div>
            )}
            {needs.includes('y') && (
              <div>
                <label className={labelCls}>{isMap ? 'Colour by' : value.viz === 'histogram' ? 'Column' : 'Y axis / value'}</label>
                <select value={value.y ?? ''} onChange={e => patch({ y: e.target.value })} className={selectCls}>
                  {numericCols.map(c => <option key={c.column_name} value={c.column_name}>{c.column_name}</option>)}
                  {allowCount && <option value="count">count (rows)</option>}
                </select>
              </div>
            )}
            {needs.includes('z') && (
              <div>
                <label className={labelCls}>{value.viz === 'stacked' ? 'Stack by' : 'Rows (second category)'}</label>
                <select value={value.z ?? ''} onChange={e => patch({ z: e.target.value })} className={selectCls}>
                  {zCols.map(c => <option key={c.column_name} value={c.column_name}>{c.column_name}</option>)}
                </select>
              </div>
            )}
            {needs.includes('size') && (
              <div>
                <label className={labelCls}>Bubble size</label>
                <select value={value.size ?? ''} onChange={e => patch({ size: e.target.value })} className={selectCls}>
                  {sizeCols.map(c => <option key={c.column_name} value={c.column_name}>{c.column_name}</option>)}
                </select>
              </div>
            )}
            {isMap && labelCols.length > 0 && (
              <div>
                <label className={labelCls}>Popup title</label>
                <select value={value.label_field ?? ''} onChange={e => patch({ label_field: e.target.value })} className={selectCls}>
                  {labelCols.map(c => <option key={c.column_name} value={c.column_name}>{c.column_name}</option>)}
                </select>
              </div>
            )}
          </div>

          {onAccentChange && (
            <div>
              <label className={labelCls}>Theme colour</label>
              <div className="flex flex-wrap items-center gap-2">
                {THEME_PRESETS.map(p => (
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
                  <input type="color" value={accent || '#06ba24'} onChange={e => onAccentChange(e.target.value)}
                         className="h-7 w-9 cursor-pointer rounded border border-gisviz-border bg-transparent p-0" aria-label="Custom theme colour" />
                  Custom
                </label>
              </div>
            </div>
          )}

          {/* ── live preview ── */}
          <div>
            <label className={labelCls}>Preview (interactive, as readers will see it)</label>
            {specError && <p className="mb-2 text-[12px] font-mono text-gisviz-alert">{specError}</p>}
            {loadingSpec && !shownSpec && (
              <div className="flex h-[300px] items-center justify-center rounded-[16px] border border-gisviz-border bg-gisviz-canvas">
                <Loader2 className="animate-spin text-gisviz-accent" size={26} />
              </div>
            )}
            {shownSpec && <InteractiveVisual key={key} spec={shownSpec} height={380} />}
          </div>
        </>
      )}

      {!info && !loadingInfo && specError && <p className="text-[12px] font-mono text-gisviz-alert">{specError}</p>}
    </div>
  )
}