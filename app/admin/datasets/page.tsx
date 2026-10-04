'use client'

/**
 * app/admin/datasets/page.tsx — Datasets (admin)
 *
 * New dataset / Edit open the same popup: details (category from the post categories, region from
 * the misc DB regions table) plus a drop zone for the data file (Parquet, CSV, Excel, GeoJSON,
 * zipped Shapefile, GeoPackage, KML, ...). The file is converted if needed and loaded as table
 * <code> (ds_00001, ...) in gisviz.duckdb by the DuckDB service; the dataset then becomes ACTIVE.
 *
 * The store panel shows whether the datasets DB and gisviz.duckdb agree (in sync / out of sync /
 * unreachable) with the store's size, tables and rows. "Sync DuckDB" re-checks and marks datasets
 * whose table is missing as inactive. Each card: file size, activate / deactivate, show data on post
 * pages yes / no, Metadata (that dataset's record, fetched only when clicked), row preview, edit, delete.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  ArrowUpRight, Database, FileUp, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X, CheckCircle2, AlertCircle,
  Table2, HardDrive, File as FileIcon, CircleSlash, Info,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi, type ColumnEdit, type ColumnKind, type StagedUpload } from '../../../connector/api'
import AccessRestricted from '../../components/AccessRestricted'
import type { DatasetSyncReport, ManagedDataset, ManagedDatasetMetadata, Region } from '../../../types/visuals'

type CategoryOpt = { category_id: number; slug: string; label: string }
type BrokenPost = { post_id: string; title: string; share_slug?: string; problem: string }
const EMPTY = { title: '', description: '', category: '', region: '', source_name: '', source_url: '', license: '', publisher: '' }
type Form = typeof EMPTY
type Note = { kind: 'ok' | 'err'; text: string }

// keep in sync with SUPPORTED in backend app/duckstore/convert.py
const ACCEPT = '.parquet,.csv,.tsv,.txt,.json,.ndjson,.jsonl,.geojson,.xlsx,.xls,.ods,.feather,.arrow,.gpkg,.kml,.kmz,.gpx,.fgb,.gml,.topojson,.dxf,.zip'
const FORMATS_HINT = 'Parquet · CSV · Excel · ODS · JSON · GeoJSON · Shapefile (.zip) · GeoPackage · KML/KMZ · GPX · FlatGeobuf · GML · TopoJSON · File Geodatabase (.zip)'
const inputCls = 'w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-[13px] focus:ring-2 focus:ring-gisviz-accent outline-none'
const labelCls = 'block text-[11px] font-mono text-gisviz-ink-soft mb-1.5 uppercase tracking-wider'
const headerBtn = 'px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5 disabled:opacity-60'

const errText = (e: any, fallback: string) => {
  const res = e?.response
  if (!res) return `${fallback} The server could not be reached.`
  const d = res.data?.detail
  if (typeof d === 'string') return d
  if (res.status === 413) return 'The file is too large for the server or proxy upload limit.'
  if (res.status === 401 || res.status === 403) return 'Only admins can manage datasets.'
  return `${fallback} (HTTP ${res.status})`
}
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString() : '—')
const fmtTime = (s?: string | null) => (s ? new Date(s).toLocaleTimeString() : '—')
const fmtBytes = (n?: number | null) => {
  if (n === null || n === undefined) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}
const fileProblem = (file: File) => {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (ext === '.shp') return `${file.name}: zip the .shp together with its .shx, .dbf and .prj files and drop the .zip.`
  if (!ACCEPT.split(',').includes(ext)) return `${file.name}: unsupported format. Supported: ${FORMATS_HINT}.`
  return null
}

// ── Region dropdown: Global, then one group per continent (sub-regions and countries indented) ──
function RegionSelect({ regions, value, onChange }: { regions: Region[]; value: string; onChange: (v: string) => void }) {
  const groups = useMemo(() => {
    const kids = new Map<string, Region[]>()
    regions.forEach(r => { if (r.parent_code) kids.set(r.parent_code, [...(kids.get(r.parent_code) || []), r]) })
    const byCode = new Map(regions.map(r => [r.code, r]))
    const walk = (r: Region, depth: number, out: { r: Region; depth: number }[]) => {
      out.push({ r, depth })
      ;(kids.get(r.code) || []).forEach(k => walk(k, depth + 1, out))
      return out
    }
    const tops = regions.filter(r => r.kind === 'global' || !r.parent_code || !byCode.has(r.parent_code))
    const globals = tops.filter(r => r.kind === 'global')
    const continents = globals.flatMap(g => kids.get(g.code) || [])
    const others = tops.filter(r => r.kind !== 'global')
    return { globals, sections: [...continents, ...others].map(c => ({ head: c, items: walk(c, 0, []) })) }
  }, [regions])
  const known = !value || regions.some(r => r.code === value)
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
      <option value="">— No region —</option>
      {!known && <option value={value}>{value} (not in regions)</option>}
      {groups.globals.map(g => <option key={g.code} value={g.code}>{g.name}</option>)}
      {groups.sections.map(s => (
        <optgroup key={s.head.code} label={s.head.name}>
          {s.items.map(({ r, depth }) => (
            <option key={r.code} value={r.code}>{'   '.repeat(depth)}{depth === 0 ? `All of ${r.name}` : r.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

// ── Upload previewer (Compass-style): one column per card, edits shown on a live sample ──
type Edit = { rename?: string; type?: ColumnKind; include?: boolean }
const KIND_LABEL: Record<ColumnKind, string> = { text: 'Text', integer: 'Integer', decimal: 'Decimal', date: 'Date', datetime: 'Date & time', boolean: 'Yes / no' }

function UploadPreviewer({ staged, view, edits, setEdit, refreshing }: {
  staged: StagedUpload; view: StagedUpload; edits: Record<string, Edit>
  setEdit: (source: string, e: Edit) => void; refreshing: boolean
}) {
  const bySource = new Map(view.columns.map(c => [c.source, c]))
  const kept = staged.columns.filter(c => edits[c.source]?.include !== false)
  const hasGeom = view.sample.some(r => r._gv_geom != null)
  return (
    <div className="rounded-lg border border-gisviz-border bg-gisviz-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gisviz-border text-[12px] text-gisviz-ink-soft">
        <span><b className="text-gisviz-ink">{staged.source_file}</b> · {Number(view.rows).toLocaleString()} rows · {kept.length} of {staged.columns.length} columns kept · {fmtBytes(staged.bytes)}{hasGeom ? ' · geometry' : ''}</span>
        <span className="flex items-center gap-1.5">{refreshing && <Loader2 size={12} className="animate-spin" />} Not live yet: review the columns, then <b className="text-gisviz-ink">Load data</b></span>
      </div>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <table className="text-left text-[12px] border-collapse">
          <thead className="sticky top-0 z-10 bg-gisviz-paper">
            <tr>
              {staged.columns.map(c => {
                const e = edits[c.source] ?? {}
                const on = e.include !== false
                const v = bySource.get(c.source)
                return (
                  <th key={c.source} className={`align-top border-b border-r border-gisviz-border px-2 py-2 min-w-[150px] font-normal ${on ? '' : 'opacity-50'}`}>
                    <label className="flex items-center gap-1.5 mb-1.5 text-[11px] text-gisviz-ink-soft">
                      <input type="checkbox" checked={on} className="accent-gisviz-accent"
                             onChange={ev => setEdit(c.source, { ...e, include: ev.target.checked })} /> keep
                    </label>
                    <input value={e.rename ?? c.name} disabled={!on} aria-label={`Name of ${c.source}`}
                           onChange={ev => setEdit(c.source, { ...e, rename: ev.target.value })}
                           className="w-full mb-1.5 rounded border border-gisviz-border bg-gisviz-card px-1.5 py-1 font-mono text-[12px] text-gisviz-ink outline-none focus:ring-1 focus:ring-gisviz-accent" />
                    <select value={e.type ?? c.kind} disabled={!on} aria-label={`Type of ${c.source}`}
                            onChange={ev => setEdit(c.source, { ...e, type: ev.target.value as ColumnKind })}
                            className="w-full rounded border border-gisviz-border bg-gisviz-card px-1 py-1 text-[12px] text-gisviz-ink">
                      {staged.types.map(t => <option key={t} value={t}>{KIND_LABEL[t]}{t === c.kind ? ' (detected)' : ''}</option>)}
                    </select>
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10.5px] font-mono">
                      {v && v.empty > 0 && <span className="rounded bg-gisviz-paper px-1 text-gisviz-ink-soft">{v.empty.toLocaleString()} empty</span>}
                      {v && v.lost > 0 && <span className="rounded bg-gisviz-alert/10 px-1 text-gisviz-alert" title="values that cannot be converted become empty">{v.lost.toLocaleString()} lost</span>}
                    </div>
                  </th>
                )
              })}
              {hasGeom && <th className="align-top border-b border-gisviz-border px-2 py-2 min-w-[140px] text-[11px] font-mono text-gisviz-ink-soft">geometry (kept)</th>}
            </tr>
          </thead>
          <tbody className={refreshing ? 'opacity-60' : ''}>
            {view.sample.map((r, i) => (
              <tr key={i} className="border-b border-gisviz-border/50">
                {staged.columns.map(c => {
                  const v = bySource.get(c.source)
                  const val = v ? r[v.name] : undefined
                  return (
                    <td key={c.source} className={`border-r border-gisviz-border/40 px-2 py-1 whitespace-nowrap max-w-[220px] truncate ${v ? 'text-gisviz-ink' : 'text-gisviz-ink-soft/50'}`}>
                      {!v ? '—' : val === null || val === undefined ? <span className="text-gisviz-ink-soft italic">empty</span> : String(val)}
                    </td>
                  )
                })}
                {hasGeom && <td className="px-2 py-1 font-mono text-[11px] text-gisviz-ink-soft whitespace-nowrap max-w-[200px] truncate">{r._gv_geom ?? ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Add / edit popup (same for both) ─────────────────────────────────
function DatasetModal({ dataset, categories, regions, onClose, onDone }: {
  dataset: ManagedDataset | null
  categories: CategoryOpt[]
  regions: Region[]
  onClose: () => void
  onDone: (n: Note) => void
}) {
  const [current, setCurrent] = useState<ManagedDataset | null>(dataset)   // becomes set after "create" succeeds
  const [form, setForm] = useState<Form>(() => dataset ? {
    title: dataset.title || '', description: dataset.description || '', category: dataset.category || '',
    region: dataset.region || '', source_name: dataset.source_name || '', source_url: dataset.source_url || '',
    license: dataset.license || '', publisher: dataset.publisher || '',
  } : EMPTY)
  const initial = useRef(form)
  const [file, setFile] = useState<File | null>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [err, setErr] = useState('')
  // a replacement that would break published posts: nothing changed yet, the admin decides
  const [conflict, setConflict] = useState<{ message: string; broken_posts: BrokenPost[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // upload previewer: the staged file (as detected), the admin's column edits, and the sample with them applied
  const [staged, setStaged] = useState<StagedUpload | null>(null)
  const [edits, setEdits] = useState<Record<string, Edit>>({})
  const [view, setView] = useState<StagedUpload | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const changes = useMemo<ColumnEdit[]>(() => Object.entries(edits).map(([column, e]) => {
    const c: ColumnEdit = { column }
    const orig = staged?.columns.find(x => x.source === column)
    if (e.include === false) c.include = false
    if (e.rename && e.rename !== orig?.name) c.rename = e.rename
    if (e.type && e.type !== orig?.kind) c.type = e.type
    return c
  }).filter(c => Object.keys(c).length > 1), [edits, staged])
  const changesKey = JSON.stringify(changes)
  useEffect(() => {
    if (!staged || !current) return
    if (!changes.length) { setView(staged); return }
    let live = true
    setRefreshing(true)
    const t = setTimeout(() => {
      gisvizApi.sampleStagedDataset(current.dataset_id, changes)
        .then(v => { if (live) { setView(v); setErr('') } })
        .catch(e => { if (live) setErr(errText(e, 'Could not apply the column changes.')) })
        .finally(() => { if (live) setRefreshing(false) })
    }, 350)
    return () => { live = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changesKey, staged])
  const close = () => {
    if (staged && current) gisvizApi.discardStagedDataset(current.dataset_id).catch(() => {})   // cancel: nothing goes live
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, staged, current])

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  const pick = (f?: File | null) => {
    if (!f) return
    const p = fileProblem(f)
    if (p) { setErr(p); return }
    setErr(''); setConflict(null); setFile(f)
  }
  const catKnown = !form.category || categories.some(c => c.slug === form.category)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial.current)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (staged && current) { await commit(current.dataset_id, false); return }      // step 3: go live
    if (!form.title.trim()) { setErr('A title is required.'); return }
    setBusy(true); setErr(''); setConflict(null)
    let code = current?.dataset_id
    let created = false
    try {
      if (!current) {
        const r = await gisvizApi.createDataset(form)
        code = r.dataset_id; created = true
        setCurrent(r); initial.current = form
      } else if (dirty) {
        await gisvizApi.saveDatasetMeta(current.dataset_id, form)
        initial.current = form
      }
    } catch (e2) {
      setErr(errText(e2, current ? 'Could not save.' : 'Could not create the dataset.')); setBusy(false); return
    }
    if (!file) {
      onDone({ kind: 'ok', text: created ? `Created ${code}. It stays inactive until its data file is uploaded (Edit → drop the file).`
                                         : `Saved ${code}.` })
      return
    }
    await stage(code!, created)                                                      // step 1: preview the file
  }

  const stage = async (code: string, created = false) => {
    if (!file) return
    setBusy(true); setErr(''); setConflict(null); setProgress(0)
    try {
      const r = await gisvizApi.stageDatasetFile(code, file, setProgress)
      setStaged(r); setView(r); setEdits({})
    } catch (e3: any) {
      setErr(`${created ? `Created ${code}, but the file could not be read. ` : ''}${file.name}: ${errText(e3, 'Upload failed.')}`)
    } finally { setProgress(null); setBusy(false) }
  }

  const commit = async (code: string, force: boolean) => {
    setBusy(true); setErr(''); setConflict(null)
    try {
      const r = await gisvizApi.commitStagedDataset(code, changes, force)
      const broken: BrokenPost[] = r.broken_posts || []
      onDone({
        kind: broken.length ? 'err' : 'ok',
        text: `${staged?.source_file ?? 'File'} (${fmtBytes(r.bytes ?? staged?.bytes)}) loaded as ${code}: ${Number(r.rows).toLocaleString()} rows, ${r.columns} columns${r.geometry_type ? `, ${r.geometry_type}` : ''}. Dataset is active.`
          + (broken.length ? ` ${broken.length === 1 ? '1 post now needs' : `${broken.length} posts now need`} a new chart: ${broken.map(b => `"${b.title}"`).join(', ')} — open each post and edit its visual.` : ''),
      })
    } catch (e3: any) {
      const d = e3?.response?.data?.detail
      if (e3?.response?.status === 409 && d && Array.isArray(d.broken_posts)) setConflict({ message: d.message, broken_posts: d.broken_posts })
      else setErr(errText(e3, 'Could not load the data.'))
      setBusy(false)
    }
  }

  const cancelStaged = async () => {
    if (current) await gisvizApi.discardStagedDataset(current.dataset_id).catch(() => {})
    setStaged(null); setView(null); setEdits({}); setFile(null); setConflict(null)
  }

  const isEdit = !!current
  const action = staged ? 'Load data' : isEdit ? (file ? 'Save & preview file' : 'Save') : (file ? 'Create & preview file' : 'Create dataset')

  // rendered into <body> so the site's top bar cannot sit above it
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gisviz-black/20 backdrop-blur-sm" onClick={() => !busy && close()} />
      <form onSubmit={submit}
            className={`relative z-10 w-full ${staged ? 'max-w-5xl' : 'max-w-2xl'} my-8 bg-gisviz-card border border-gisviz-border rounded-xl shadow-2xl transition-[max-width]`}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-gisviz-border">
          <div>
            <h2 className="font-display text-[17px] font-bold text-gisviz-ink flex items-center gap-2">
              {isEdit ? <Pencil size={16} className="text-gisviz-accent" /> : <Plus size={17} className="text-gisviz-accent" />}
              {isEdit ? <>Edit <span className="font-mono text-[14px] px-1.5 py-0.5 rounded bg-gisviz-canvas border border-gisviz-border">{current!.dataset_id}</span></> : 'New dataset'}
            </h2>
            <p className="text-[12.5px] text-gisviz-ink-soft mt-1">
              {isEdit ? 'Change the details, or drop a new file to replace the data.'
                      : 'A code (ds_00001, ds_00002, …) is assigned automatically. Inactive until its data file is loaded.'}
            </p>
          </div>
          <button type="button" onClick={close} disabled={busy} className="text-gisviz-ink-soft hover:text-gisviz-accent disabled:opacity-40"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Title <span className="text-gisviz-alert">*</span></label>
            <input value={form.title} onChange={set('title')} placeholder="e.g. India district rainfall 2024" className={inputCls} autoFocus />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3} className={`${inputCls} resize-y`} />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select value={form.category} onChange={set('category')} className={inputCls}>
              <option value="">— No category —</option>
              {!catKnown && <option value={form.category}>{form.category} (not a post category)</option>}
              {categories.map(c => <option key={c.category_id} value={c.slug}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Region</label>
            <RegionSelect regions={regions} value={form.region} onChange={v => setForm(f => ({ ...f, region: v }))} />
          </div>
          <div><label className={labelCls}>Source name</label><input value={form.source_name} onChange={set('source_name')} placeholder="IMD / Our World in Data" className={inputCls} /></div>
          <div><label className={labelCls}>Source link</label><input value={form.source_url} onChange={set('source_url')} placeholder="https://…" className={inputCls} /></div>
          <div><label className={labelCls}>Licence</label><input value={form.license} onChange={set('license')} placeholder="CC-BY-4.0" className={inputCls} /></div>
          <div><label className={labelCls}>Publisher</label><input value={form.publisher} onChange={set('publisher')} className={inputCls} /></div>

          {/* data file */}
          <div className="md:col-span-2">
            <label className={labelCls}>Data file {isEdit && current!.has_data && <span className="normal-case tracking-normal">· current: {Number(current!.row_count).toLocaleString()} rows, uploaded {fmtDate(current!.data_uploaded_at)}</span>}</label>
            {staged && view ? (
              <>
                <UploadPreviewer staged={staged} view={view} edits={edits} refreshing={refreshing}
                                 setEdit={(src, e) => setEdits(m => ({ ...m, [src]: e }))} />
                <button type="button" onClick={cancelStaged} disabled={busy}
                        className="mt-2 text-[12px] text-gisviz-ink-soft hover:text-gisviz-alert">Cancel this upload</button>
              </>
            ) : progress !== null ? (
              <div className="rounded-lg border border-gisviz-border bg-gisviz-canvas px-4 py-4">
                <div className="flex justify-between text-[12px] text-gisviz-ink-soft mb-1.5">
                  <span>{progress < 100 ? `Uploading ${file?.name}…` : `Reading ${file?.name}: detecting columns and types…`}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gisviz-card overflow-hidden">
                  <div className={`h-full bg-gisviz-accent transition-all ${progress >= 100 ? 'animate-pulse' : ''}`} style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : file ? (
              <div className="rounded-lg border border-gisviz-accent/50 bg-gisviz-accent/5 px-4 py-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px] text-gisviz-ink min-w-0">
                  <FileIcon size={16} className="text-gisviz-accent shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-gisviz-ink-soft shrink-0">{fmtBytes(file.size)}</span>
                </span>
                <button type="button" onClick={() => setFile(null)} className="text-[12px] text-gisviz-ink-soft hover:text-gisviz-alert shrink-0">Remove</button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]) }}
                onClick={() => fileRef.current?.click()}
                className={`rounded-lg border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 text-center py-6 px-4 ${
                  drag ? 'border-gisviz-accent bg-gisviz-accent/5' : 'border-gisviz-border hover:border-gisviz-accent'}`}>
                <FileUp size={20} className="text-gisviz-accent" />
                <span className="text-[13px] text-gisviz-ink">
                  {isEdit && current!.has_data ? 'Drop a new file to replace the data, or click to browse' : <>Drop the <b>data file</b> here, or click to browse</>}
                </span>
                <span className="text-[11.5px] text-gisviz-ink-soft">{FORMATS_HINT}</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                   onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; pick(f) }} />
          </div>
        </div>

        {conflict && current && (
          <div className="mx-6 mb-4 p-4 rounded-md border border-amber-500/50 bg-amber-500/10 text-[12.5px] text-gisviz-ink">
            <p className="font-semibold flex items-center gap-2 mb-1.5"><AlertCircle size={15} className="text-amber-600" /> This file would break published posts</p>
            <p className="text-gisviz-ink-soft mb-2">{conflict.message}</p>
            <ul className="space-y-1 mb-3 max-h-40 overflow-auto">
              {conflict.broken_posts.map(b => (
                <li key={b.post_id} className="flex flex-wrap gap-x-2">
                  <a href={`/post/${b.post_id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-gisviz-accent hover:underline">{b.title}</a>
                  <span className="font-mono text-[11.5px] text-gisviz-ink-soft">{b.problem}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={cancelStaged}
                      className="px-3 py-1.5 rounded-md border border-gisviz-border bg-gisviz-card text-[12.5px] font-semibold">Keep current data</button>
              <button type="button" onClick={() => commit(current.dataset_id, true)} disabled={busy}
                      className="px-3 py-1.5 rounded-md border border-amber-600/60 bg-gisviz-card text-amber-700 text-[12.5px] font-semibold disabled:opacity-60">
                Replace anyway
              </button>
            </div>
          </div>
        )}

        {err && (
          <div className="mx-6 mb-4 p-3 rounded-md border border-gisviz-alert/40 bg-gisviz-alert/10 text-[12.5px] text-gisviz-alert flex items-start gap-2">
            <AlertCircle size={15} className="mt-px shrink-0" /><span>{err}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gisviz-border">
          <button type="button" onClick={close} disabled={busy}
                  className="px-5 py-2 rounded-md text-[13px] border border-gisviz-border text-gisviz-ink-soft hover:bg-gisviz-rail disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || refreshing || (isEdit && !dirty && !file && !staged)}
                  className="inline-flex items-center gap-2 bg-gisviz-accent text-[color:var(--accent-on)] px-6 py-2 rounded-md text-[13px] font-semibold shadow-sm hover:brightness-110 disabled:opacity-60">
            {busy && <Loader2 size={15} className="animate-spin" />} {action}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function Toggle({ on, disabled, onChange, title }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} title={title}
            onClick={() => onChange(!on)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              on ? 'bg-gisviz-accent border-gisviz-accent' : 'bg-gisviz-canvas border-gisviz-border'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function ResultTable({ columns, rows }: { columns: string[]; rows: Record<string, any>[] }) {
  if (!rows.length) return <p className="text-[12.5px] text-gisviz-ink-soft px-1 py-2">No rows.</p>
  return (
    <div className="overflow-auto max-h-[360px] rounded-md border border-gisviz-border bg-gisviz-card">
      <table className="text-left text-[12px] font-mono min-w-full">
        <thead className="sticky top-0 bg-gisviz-paper text-gisviz-ink-soft">
          <tr>{columns.map(c => <th key={c} className="px-3 py-2 font-medium whitespace-nowrap border-b border-gisviz-border">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gisviz-border/40">
              {columns.map(c => <td key={c} className="px-3 py-1.5 whitespace-nowrap text-gisviz-ink max-w-[320px] truncate">{r[c] === null || r[c] === undefined ? <span className="text-gisviz-ink-soft">null</span> : String(r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── DuckDB store status ──────────────────────────────────────────────
const STATE = {
  in_sync:     { label: 'In sync',     dot: 'bg-gisviz-safe',  text: 'text-gisviz-safe',  box: 'border-gisviz-safe/30 bg-gisviz-safe/5' },
  out_of_sync: { label: 'Out of sync', dot: 'bg-amber-500',    text: 'text-amber-600',    box: 'border-amber-500/40 bg-amber-500/10' },
  unreachable: { label: 'Unreachable', dot: 'bg-gisviz-alert', text: 'text-gisviz-alert', box: 'border-gisviz-alert/40 bg-gisviz-alert/10' },
} as const

function StorePanel({ sync, checking, fixing, onFix }: {
  sync: DatasetSyncReport | null; checking: boolean; fixing: boolean; onFix: (dropOrphans: boolean) => void
}) {
  if (!sync) return (
    <div className="mb-5 p-4 rounded-xl border border-gisviz-border bg-gisviz-card text-[13px] text-gisviz-ink-soft flex items-center gap-2">
      <Loader2 size={14} className="animate-spin" /> Checking gisviz.duckdb…
    </div>
  )
  const st = STATE[sync.state] || STATE.unreachable
  const s = sync.store
  const stat = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-gisviz-ink-soft">{label}</div>
      <div className="text-[13.5px] font-semibold text-gisviz-ink truncate">{value}</div>
    </div>
  )
  return (
    <section className={`mb-5 rounded-xl border p-4 sm:p-5 ${st.box}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <HardDrive size={17} className="text-gisviz-ink-soft" />
          <span className="font-display font-bold text-[15px] text-gisviz-ink">Analytical store</span>
          <span className="font-mono text-[12px] text-gisviz-ink-soft">gisviz.duckdb</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-current/30 bg-gisviz-card text-[12px] font-semibold ${st.text}`}>
            <span className={`h-2 w-2 rounded-full ${st.dot} ${checking ? 'animate-pulse' : ''}`} /> {st.label}
          </span>
        </div>
        <span className="text-[11.5px] font-mono text-gisviz-ink-soft">checked {fmtTime(sync.checked_at)}</span>
      </div>

      {sync.state === 'unreachable' ? (
        <div className="text-[13px] text-gisviz-ink">
          <p className="flex items-start gap-2"><CircleSlash size={15} className="mt-0.5 shrink-0 text-gisviz-alert" />
            <span>The API cannot reach the DuckDB service at <span className="font-mono">{sync.service}</span>: {sync.error}</span></p>
          <p className="text-[12px] text-gisviz-ink-soft mt-2 font-mono">On the server: docker compose ps duckdb · docker compose logs --tail=50 duckdb</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stat('Tables', sync.tables ?? '—')}
          {stat('Dataset records', sync.records)}
          {stat('Rows', s ? s.rows.toLocaleString() : '—')}
          {stat('File size', s ? fmtBytes(s.size_bytes + (s.wal_bytes || 0)) : '—')}
          {stat('Last load', s?.last_loaded_at ? fmtDate(s.last_loaded_at) : '—')}
          {stat('DuckDB', s?.duckdb_version ? `v${s.duckdb_version}` : '—')}
        </div>
      )}

      {sync.state === 'out_of_sync' && (
        <div className="mt-4 pt-4 border-t border-amber-500/30 text-[13px]">
          <ul className="list-disc pl-5 space-y-1 text-gisviz-ink">
            {sync.missing_table.length > 0 && <li>Marked active but no table in gisviz.duckdb: <span className="font-mono">{sync.missing_table.join(', ')}</span> — <b>Sync DuckDB</b> marks them inactive; re-upload to restore.</li>}
            {sync.version_mismatch.length > 0 && <li>Table differs from the record: <span className="font-mono">{sync.version_mismatch.join(', ')}</span> — re-upload the file (Edit).</li>}
            {sync.orphan_tables.length > 0 && <li>Tables without a dataset record: <span className="font-mono">{sync.orphan_tables.map(o => o.code).join(', ')}</span></li>}
          </ul>
          {sync.orphan_tables.length > 0 && (
            <button onClick={() => onFix(true)} disabled={fixing}
                    className="mt-3 px-3 py-1.5 rounded-md border border-gisviz-alert/50 bg-gisviz-card text-gisviz-alert text-[12.5px] font-semibold disabled:opacity-60">
              Drop {sync.orphan_tables.length} table{sync.orphan_tables.length === 1 ? '' : 's'} without a record
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// ── one dataset ──────────────────────────────────────────────────────
function MetaGrid({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[10.5px] font-mono uppercase tracking-wider text-gisviz-ink-soft">{k}</dt>
          <dd className="text-[13px] text-gisviz-ink break-words">{v === null || v === undefined || v === '' ? <span className="text-gisviz-ink-soft">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  )
}

function MetadataPanel({ m, categoryLabel, regionLabel }: { m: ManagedDatasetMetadata; categoryLabel?: string; regionLabel?: string }) {
  const src = m.source_url ? (m.source_url.startsWith('http') ? m.source_url : `https://${m.source_url}`) : null
  return (
    <div className="mx-5 mb-5 rounded-lg border border-gisviz-border bg-gisviz-paper/40 p-4 sm:p-5">
      <p className="text-[11px] font-mono text-gisviz-ink-soft uppercase tracking-wider mb-3">Metadata · {m.dataset_id}</p>
      <MetaGrid items={[
        ['Status', m.status],
        ['Show data on posts', m.show_data ? 'Yes' : 'No'],
        ['Posts using it', m.post_count],
        ['Category', m.category ? (categoryLabel || m.category) : null],
        ['Region', m.region ? (regionLabel || m.region) : null],
        ['Licence', m.license],
        ['Publisher', m.publisher],
        ['Source', src ? <a href={src} target="_blank" rel="noopener noreferrer" className="text-gisviz-accent hover:underline">{m.source_name || src}</a> : m.source_name],
        ['File size', m.file_size_bytes != null ? fmtBytes(m.file_size_bytes) : null],
        ['Uploaded file', m.store?.source_file],
        ['Format', m.format],
        ['Rows', m.has_data ? Number(m.row_count).toLocaleString() : null],
        ['Columns', m.has_data ? m.column_count : null],
        ['Geometry', m.geometry_type],
        ['CRS', m.crs],
        ['Bounding box', m.bbox && m.bbox.length === 4 ? <span className="font-mono text-[12px]">[{m.bbox.map(v => Number(v).toFixed(3)).join(', ')}]</span> : null],
        ['Data version', m.data_version ? <span className="font-mono text-[12px]">{m.data_version}</span> : null],
        ['Uploaded', m.data_uploaded_at ? fmtDate(m.data_uploaded_at) : null],
        ['Loaded in DuckDB', m.store?.loaded_at ? fmtDate(m.store.loaded_at) : (m.store_error ? <span className="text-gisviz-alert">store unreachable</span> : (m.has_data ? <span className="text-gisviz-alert">table missing</span> : null))],
        ['Created', m.created_at ? fmtDate(m.created_at) : null],
        ['Updated', m.updated_at ? fmtDate(m.updated_at) : null],
      ]} />
      {m.description && <p className="mt-4 text-[13px] text-gisviz-ink leading-relaxed">{m.description}</p>}
      {m.columns.length > 0 && (
        <div className="mt-4 overflow-auto max-h-[320px] rounded-md border border-gisviz-border bg-gisviz-card">
          <table className="text-left text-[12px] min-w-full">
            <thead className="sticky top-0 bg-gisviz-paper text-gisviz-ink-soft">
              <tr>{['#', 'Column', 'Label', 'Kind', 'SQL type', 'Distinct'].map(h => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap border-b border-gisviz-border">{h}</th>)}</tr>
            </thead>
            <tbody>
              {m.columns.map((c, i) => (
                <tr key={c.column_name} className="border-t border-gisviz-border/40">
                  <td className="px-3 py-1.5 text-gisviz-ink-soft font-mono">{(c.ordinal ?? i) + 1}</td>
                  <td className="px-3 py-1.5 font-mono text-gisviz-ink">{c.column_name}</td>
                  <td className="px-3 py-1.5 text-gisviz-ink">{c.label !== c.column_name ? c.label : ''}</td>
                  <td className="px-3 py-1.5 text-gisviz-ink-soft">{c.dtype}</td>
                  <td className="px-3 py-1.5 font-mono text-gisviz-accent">{(c.sql_type || '').toLowerCase()}</td>
                  <td className="px-3 py-1.5 font-mono text-gisviz-ink-soft">{Number(c.n_distinct).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DatasetCard({ d, categoryLabel, regionLabel, onEdit, onChanged, onDeleted }: {
  d: ManagedDataset; categoryLabel?: string; regionLabel?: string
  onEdit: () => void; onChanged: () => void; onDeleted: (n: Note) => void
}) {
  const [note, setNote] = useState<Note | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [preview, setPreview] = useState<{ columns: string[]; rows: any[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [meta, setMeta] = useState<ManagedDatasetMetadata | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const active = d.status === 'active'
  const showData = !!d.show_data

  // metadata of THIS dataset only, fetched when the button is clicked (never on page load)
  const toggleMeta = async () => {
    if (meta) { setMeta(null); return }
    setMetaLoading(true)
    try { setMeta(await gisvizApi.datasetMetadata(d.dataset_id)) }
    catch (e) { setNote({ kind: 'err', text: errText(e, 'Could not load the metadata.') }) }
    finally { setMetaLoading(false) }
  }
  const togglePreview = async () => {
    if (preview) { setPreview(null); return }
    setPreviewing(true)
    try {
      const r = await gisvizApi.previewDataset(d.dataset_id, 20)
      setPreview({ columns: r.rows.length ? Object.keys(r.rows[0]) : [], rows: r.rows })
    } catch (e) { setNote({ kind: 'err', text: errText(e, 'Could not load the preview.') }) }
    finally { setPreviewing(false) }
  }
  const toggle = async (on: boolean) => {
    setBusy(true)
    try { await gisvizApi.setDatasetActive(d.dataset_id, on); onChanged() }
    catch (e) { setNote({ kind: 'err', text: errText(e, 'Could not change the status.') }) }
    finally { setBusy(false) }
  }
  const toggleShowData = async (on: boolean) => {
    setBusy(true)
    try {
      await gisvizApi.setDatasetShowData(d.dataset_id, on)
      setMeta(null)                                   // stale if open
      setNote({ kind: 'ok', text: on ? 'Data is now shown on the pages of posts built on this dataset.' : 'Data is hidden from post pages.' })
      onChanged()
    } catch (e) { setNote({ kind: 'err', text: errText(e, 'Could not change it.') }) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await gisvizApi.deleteDataset(d.dataset_id); onDeleted({ kind: 'ok', text: `Deleted ${d.dataset_id} (${d.title}).` }) }
    catch (e) { setNote({ kind: 'err', text: errText(e, 'Could not delete.') }); setConfirmDelete(false) }
    finally { setBusy(false) }
  }
  const iconBtn = (on: boolean) => `p-2 rounded-md border text-gisviz-ink-soft hover:text-gisviz-accent hover:border-gisviz-accent ${on ? 'border-gisviz-accent text-gisviz-accent' : 'border-gisviz-border'}`

  return (
    <article className="bg-gisviz-card border border-gisviz-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-[12px] font-semibold px-2 py-0.5 rounded-md bg-gisviz-canvas border border-gisviz-border text-gisviz-ink">{d.dataset_id}</span>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${active
              ? 'bg-gisviz-safe/10 text-gisviz-safe border-gisviz-safe/30' : 'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border'}`}>
              {active ? 'active' : 'inactive'}
            </span>
            {d.category && <span className="text-[12px] text-gisviz-ink-soft">· {categoryLabel || d.category}</span>}
            {d.region && <span className="text-[12px] text-gisviz-ink-soft">· {regionLabel || d.region}</span>}
          </div>
          <h3 className="font-display text-[16.5px] font-bold text-gisviz-ink leading-snug">{d.title}</h3>
          <p className="text-[12.5px] text-gisviz-ink-soft mt-1">
            {d.has_data
              ? <>{Number(d.row_count).toLocaleString()} rows · {d.column_count} columns · {d.geometry_type || 'table'}{d.format ? ` · ${d.format}` : ''}{d.file_size_bytes != null ? ` · ${fmtBytes(d.file_size_bytes)}` : ''} · uploaded {fmtDate(d.data_uploaded_at)}</>
              : <>No data file yet — <button onClick={onEdit} className="text-gisviz-accent hover:underline">Edit</button> to upload it</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex flex-col gap-1.5 mr-2">
            <label className="flex items-center gap-2 text-[12px] text-gisviz-ink-soft">
              <Toggle on={active} disabled={busy || !d.has_data} onChange={toggle}
                      title={d.has_data ? (active ? 'Deactivate' : 'Activate') : 'Upload the file first'} />
              {active ? 'Active' : 'Inactive'}
            </label>
            <label className="flex items-center gap-2 text-[12px] text-gisviz-ink-soft">
              <Toggle on={showData} disabled={busy} onChange={toggleShowData}
                      title={showData ? 'Rows are shown on post pages: click to hide' : 'Rows are hidden on post pages: click to show'} />
              Show data: {showData ? 'Yes' : 'No'}
            </label>
          </div>
          <button onClick={toggleMeta} title="Load this dataset's metadata"
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-[12px] font-mono ${meta ? 'border-gisviz-accent text-gisviz-accent' : 'border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-accent hover:border-gisviz-accent'}`}>
            {metaLoading ? <Loader2 size={14} className="animate-spin" /> : <Info size={14} />} Metadata
          </button>
          {d.has_data && (
            <button onClick={togglePreview} title="Preview rows in DuckDB" className={iconBtn(!!preview)}>
              {previewing ? <Loader2 size={15} className="animate-spin" /> : <Table2 size={15} />}
            </button>
          )}
          <button onClick={onEdit} title="Edit details / replace the data file" className={iconBtn(false)}><Pencil size={15} /></button>
          <button onClick={() => setConfirmDelete(true)} title="Delete"
                  className="p-2 rounded-md border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-alert hover:border-gisviz-alert"><Trash2 size={15} /></button>
        </div>
      </div>

      {confirmDelete && (
        <div className="mx-5 mb-4 p-3 rounded-md border border-gisviz-alert/40 bg-gisviz-alert/10 text-[13px] text-gisviz-alert flex flex-wrap items-center justify-between gap-3">
          <span>Delete <b>{d.dataset_id}</b> and its table in gisviz.duckdb? This cannot be undone. Datasets used by posts can only be deactivated.</span>
          <span className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-md border border-gisviz-border text-gisviz-ink text-[12.5px] bg-gisviz-card">Cancel</button>
            <button onClick={remove} disabled={busy} className="px-3 py-1.5 rounded-md bg-gisviz-alert text-white text-[12.5px] font-semibold disabled:opacity-60">Delete</button>
          </span>
        </div>
      )}

      {meta && <MetadataPanel m={meta} categoryLabel={categoryLabel} regionLabel={regionLabel} />}

      {preview && (
        <div className="mx-5 mb-5">
          <p className="text-[11px] font-mono text-gisviz-ink-soft uppercase tracking-wider mb-1.5">First {preview.rows.length} rows of {d.dataset_id} in gisviz.duckdb</p>
          <ResultTable columns={preview.columns} rows={preview.rows} />
        </div>
      )}

      {note && (
        <div className={`mx-5 mb-5 flex items-start gap-2 text-[12.5px] ${note.kind === 'ok' ? 'text-gisviz-safe' : 'text-gisviz-alert'}`}>
          {note.kind === 'ok' ? <CheckCircle2 size={15} className="mt-px shrink-0" /> : <AlertCircle size={15} className="mt-px shrink-0" />}
          <span>{note.text}</span>
        </div>
      )}
    </article>
  )
}

export default function AdminDatasetsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const isAdmin = user?.role_name === 'admin'

  const [rows, setRows] = useState<ManagedDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const [msg, setMsg] = useState<Note | null>(null)

  const [modal, setModal] = useState<{ dataset: ManagedDataset | null } | null>(null)
  const [categories, setCategories] = useState<CategoryOpt[]>([])
  const [regions, setRegions] = useState<Region[]>([])

  const [sync, setSync] = useState<DatasetSyncReport | null>(null)
  const [checking, setChecking] = useState(false)
  const [fixing, setFixing] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth?redirect=/admin/datasets')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await gisvizApi.listManagedDatasets(q.trim(), status)) }
    catch (e) { setMsg({ kind: 'err', text: errText(e, 'Could not load datasets.') }) }
    finally { setLoading(false) }
  }, [q, status])

  const checkSync = useCallback(async () => {
    setChecking(true)
    try { setSync(await gisvizApi.datasetSyncStatus()) }
    catch (e) {
      setSync({ state: 'unreachable', in_sync: false, checked_at: new Date().toISOString(), service: 'API',
                error: errText(e, 'Could not check.'), records: 0, tables: null, missing_table: [],
                version_mismatch: [], orphan_tables: [], store: null })
    } finally { setChecking(false) }
  }, [])

  // "Sync DuckDB": re-check, and mark records whose table is missing as inactive
  const runSync = async (dropOrphans = false) => {
    setFixing(true); setChecking(true)
    try {
      const r = await gisvizApi.fixDatasetSync(dropOrphans)
      setSync(r)
      const fixed = r.fixed_missing?.length || 0, dropped = r.dropped_orphans?.length || 0
      setMsg(r.state === 'unreachable'
        ? { kind: 'err', text: `DuckDB service unreachable: ${r.error}` }
        : { kind: r.in_sync ? 'ok' : 'err', text: fixed || dropped
            ? `Synced: ${fixed ? `${fixed} dataset${fixed === 1 ? '' : 's'} without a table marked inactive` : ''}${fixed && dropped ? ', ' : ''}${dropped ? `${dropped} orphan table${dropped === 1 ? '' : 's'} dropped` : ''}.`
            : r.in_sync ? 'Datasets DB and gisviz.duckdb are in sync.' : 'Re-checked: some differences need a re-upload or a decision (see the store panel).' })
      if (fixed || dropped) load()
    } catch (e) { setMsg({ kind: 'err', text: errText(e, 'Could not sync.') }) }
    finally { setFixing(false); setChecking(false) }
  }

  useEffect(() => {
    if (!isAdmin) return
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [isAdmin, load])

  useEffect(() => {
    if (!isAdmin) return
    gisvizApi.listCategories().then(setCategories).catch(() => setCategories([]))
    gisvizApi.listRegionCatalog().then(setRegions).catch(() => setRegions([]))
  }, [isAdmin])

  // re-check the DuckDB link whenever the list changes
  useEffect(() => { if (isAdmin) checkSync() }, [isAdmin, rows, checkSync])

  const catLabel = useMemo(() => new Map(categories.map(c => [c.slug, c.label])), [categories])
  const regLabel = useMemo(() => new Map(regions.map(r => [r.code, r.name])), [regions])

  if (authLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )
  if (!user || !isAdmin)
    return <AccessRestricted requiredRoles={['admin']} currentRole={user?.role_name} backHref="/" backLabel="Return to Feed" />

  const nActive = rows.filter(r => r.status === 'active').length
  const st = sync ? STATE[sync.state] : null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8 pb-20">

      {/* header: title left, actions right (same as the other admin pages) */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-display font-bold text-gisviz-ink tracking-tight flex items-center gap-3">
            <Database className="text-gisviz-accent" size={28} /> Datasets
          </h1>
          <p className="text-[14.5px] text-gisviz-ink-soft mt-1.5 leading-relaxed">
            {rows.length} total · {nActive} active · data in gisviz.duckdb
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link href="/admin" className={headerBtn}><ArrowUpRight size={14} /> Admin Home</Link>
          <button onClick={() => runSync(false)} disabled={fixing} className={headerBtn}
                  title="Re-check the datasets DB against gisviz.duckdb and mark datasets whose table is missing as inactive">
            {fixing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Sync DuckDB
            {st && <span className={`ml-1 inline-flex items-center gap-1 ${st.text}`}><span className={`h-2 w-2 rounded-full ${st.dot}`} />{st.label}</span>}
          </button>
          <button onClick={() => setModal({ dataset: null })}
                  className="inline-flex items-center gap-1.5 bg-gisviz-accent text-[color:var(--accent-on)] px-4 py-2 rounded-md font-mono text-[12px] font-semibold shadow-sm hover:brightness-110">
            <Plus size={14} /> New dataset
          </button>
          <button onClick={() => { load(); checkSync() }} title="Refresh"
                  className="p-2 bg-gisviz-canvas border border-gisviz-border rounded-md text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-4 mb-5 rounded-md text-[13px] border flex items-center justify-between gap-3 ${
          msg.kind === 'ok' ? 'bg-gisviz-safe/5 text-gisviz-safe border-gisviz-safe/30' : 'bg-gisviz-alert/10 text-gisviz-alert border-gisviz-alert/40'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)}><X size={16} /></button>
        </div>
      )}

      <StorePanel sync={sync} checking={checking} fixing={fixing} onFix={runSync} />

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code or title" className={`${inputCls} pl-8 w-56`} />
        </div>
        <div className="inline-flex p-1 rounded-md border border-gisviz-border bg-gisviz-canvas">
          {(['', 'active', 'inactive'] as const).map(s => (
            <button key={s || 'all'} onClick={() => setStatus(s)}
                    className={`px-2.5 py-1 rounded font-mono text-[12px] ${status === s ? 'bg-gisviz-card text-gisviz-ink shadow-sm' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
              {s || 'all'}
            </button>
          ))}
        </div>
      </div>

      {/* list */}
      <div className="flex flex-col gap-4">
        {loading && rows.length === 0 && <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-gisviz-accent" /></div>}
        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-gisviz-border bg-gisviz-card py-12 px-6 text-center text-[14px] text-gisviz-ink-soft">
            No datasets yet. Click <b>New dataset</b>, fill in the details and drop its data file.
          </div>
        )}
        {rows.map(d => (
          <DatasetCard key={d.dataset_id} d={d}
                       categoryLabel={d.category ? catLabel.get(d.category) : undefined}
                       regionLabel={d.region ? regLabel.get(d.region) : undefined}
                       onEdit={() => setModal({ dataset: d })}
                       onChanged={() => load()}
                       onDeleted={n => { setMsg(n); load() }} />
        ))}
      </div>

      {modal && (
        <DatasetModal dataset={modal.dataset} categories={categories} regions={regions}
                      onClose={() => { setModal(null); load() }}
                      onDone={n => { setModal(null); setMsg(n); load() }} />
      )}
    </div>
  )
}
