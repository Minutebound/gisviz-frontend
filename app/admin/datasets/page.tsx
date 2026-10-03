'use client'

/**
 * app/admin/datasets/page.tsx — Datasets (admin)
 *
 * 1. New dataset   -> a code is generated (ds_00001, ds_00002, ...); the dataset starts INACTIVE.
 * 2. Drop the Parquet file on its card -> stored in the gisviz data folder as <code>.duckdb,
 *    columns profiled for the chart suggester, and the dataset becomes ACTIVE.
 * 3. Activate / deactivate at any time (inactive = hidden from /datasets and the post picker;
 *    posts already built on it keep working). Edit details, replace the file, or delete.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight, Database, FileUp, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../connector/api'
import AccessRestricted from '../../components/AccessRestricted'
import type { ManagedDataset } from '../../../types/visuals'

const EMPTY = { title: '', description: '', category: '', source_name: '', source_url: '', license: '', publisher: '' }
type Form = typeof EMPTY
type Note = { kind: 'ok' | 'err'; text: string }

const ACCEPT = '.parquet,.csv,.tsv,.geojson,.json'
const inputCls = 'w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-[13px] focus:ring-2 focus:ring-gisviz-accent outline-none'
const labelCls = 'block text-[11px] font-mono text-gisviz-ink-soft mb-1.5 uppercase tracking-wider'

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
const fmtBytes = (n: number) => (n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`)

function MetaFields({ form, set }: { form: Form; set: (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className={labelCls}>Title <span className="text-gisviz-alert">*</span></label>
        <input value={form.title} onChange={set('title')} placeholder="e.g. India district rainfall 2024" className={inputCls} />
      </div>
      <div className="md:col-span-2">
        <label className={labelCls}>Description</label>
        <textarea value={form.description} onChange={set('description')} rows={3} className={`${inputCls} resize-y`} />
      </div>
      <div><label className={labelCls}>Category</label><input value={form.category} onChange={set('category')} placeholder="climate" className={inputCls} /></div>
      <div><label className={labelCls}>Licence</label><input value={form.license} onChange={set('license')} placeholder="CC-BY-4.0" className={inputCls} /></div>
      <div><label className={labelCls}>Source name</label><input value={form.source_name} onChange={set('source_name')} placeholder="IMD / Our World in Data" className={inputCls} /></div>
      <div><label className={labelCls}>Source link</label><input value={form.source_url} onChange={set('source_url')} placeholder="https://…" className={inputCls} /></div>
      <div><label className={labelCls}>Publisher</label><input value={form.publisher} onChange={set('publisher')} className={inputCls} /></div>
    </div>
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

function DatasetCard({ d, onChanged, onDeleted }: { d: ManagedDataset; onChanged: (n?: Note) => void; onDeleted: (n: Note) => void }) {
  const [drag, setDrag] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const active = d.status === 'active'

  const upload = async (file?: File | null) => {
    if (!file) return
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ACCEPT.split(',').includes(ext)) { setNote({ kind: 'err', text: `${file.name}: please drop a .parquet file.` }); return }
    setNote(null); setProgress(0)
    try {
      const r = await gisvizApi.uploadDatasetData(d.dataset_id, file, setProgress)
      setNote({ kind: 'ok', text: `${file.name} (${fmtBytes(file.size)}): ${r.rows.toLocaleString()} rows, ${r.columns} columns${r.geometry_type ? `, ${r.geometry_type}` : ''}. Dataset is active.` })
      onChanged()
    } catch (e) {
      setNote({ kind: 'err', text: `${file.name}: ${errText(e, 'Upload failed.')}` })
    } finally { setProgress(null) }
  }

  const toggle = async (on: boolean) => {
    setBusy(true)
    try { await gisvizApi.setDatasetActive(d.dataset_id, on); onChanged() }
    catch (e) { setNote({ kind: 'err', text: errText(e, 'Could not change the status.') }) }
    finally { setBusy(false) }
  }

  const startEdit = () => {
    setForm({ title: d.title || '', description: d.description || '', category: d.category || '', source_name: d.source_name || '',
              source_url: d.source_url || '', license: d.license || '', publisher: d.publisher || '' })
    setEditing(true)
  }
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setNote({ kind: 'err', text: 'A title is required.' }); return }
    setBusy(true)
    try { await gisvizApi.saveDatasetMeta(d.dataset_id, form); setEditing(false); setNote({ kind: 'ok', text: 'Details saved.' }); onChanged() }
    catch (err) { setNote({ kind: 'err', text: errText(err, 'Could not save.') }) }
    finally { setBusy(false) }
  }

  const remove = async () => {
    setBusy(true)
    try { await gisvizApi.deleteDataset(d.dataset_id); onDeleted({ kind: 'ok', text: `Deleted ${d.dataset_id} (${d.title}).` }) }
    catch (e) { setNote({ kind: 'err', text: errText(e, 'Could not delete.') }); setConfirmDelete(false) }
    finally { setBusy(false) }
  }

  return (
    <article className="w-full bg-gisviz-card border border-gisviz-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-[12px] font-semibold px-2 py-0.5 rounded-md bg-gisviz-canvas border border-gisviz-border text-gisviz-ink">{d.dataset_id}</span>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${active
              ? 'bg-gisviz-safe/10 text-gisviz-safe border-gisviz-safe/30' : 'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border'}`}>
              {active ? 'active' : 'inactive'}
            </span>
            {d.category && <span className="text-[12px] text-gisviz-ink-soft capitalize">· {d.category}</span>}
          </div>
          <h3 className="font-display text-[16.5px] font-bold text-gisviz-ink leading-snug">{d.title}</h3>
          <p className="text-[12.5px] text-gisviz-ink-soft mt-1">
            {d.has_data
              ? <>{Number(d.row_count).toLocaleString()} rows · {d.column_count} columns · {d.geometry_type || 'table'} · uploaded {fmtDate(d.data_uploaded_at)}</>
              : 'No file uploaded yet'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-2 text-[12.5px] text-gisviz-ink-soft mr-2">
            <Toggle on={active} disabled={busy || !d.has_data} onChange={toggle}
                    title={d.has_data ? (active ? 'Deactivate' : 'Activate') : 'Upload the file first'} />
            {active ? 'Active' : 'Inactive'}
          </label>
          <button onClick={startEdit} title="Edit details"
                  className="p-2 rounded-md border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-accent hover:border-gisviz-accent"><Pencil size={15} /></button>
          <button onClick={() => setConfirmDelete(true)} title="Delete"
                  className="p-2 rounded-md border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-alert hover:border-gisviz-alert"><Trash2 size={15} /></button>
        </div>
      </div>

      {confirmDelete && (
        <div className="mx-5 mb-4 p-3 rounded-md border border-gisviz-alert/40 bg-gisviz-alert/10 text-[13px] text-gisviz-alert flex flex-wrap items-center justify-between gap-3">
          <span>Delete <b>{d.dataset_id}</b> and its data file? This cannot be undone. Datasets used by posts can only be deactivated.</span>
          <span className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-md border border-gisviz-border text-gisviz-ink text-[12.5px] bg-gisviz-card">Cancel</button>
            <button onClick={remove} disabled={busy} className="px-3 py-1.5 rounded-md bg-gisviz-alert text-white text-[12.5px] font-semibold disabled:opacity-60">Delete</button>
          </span>
        </div>
      )}

      {editing && (
        <form onSubmit={saveEdit} className="mx-5 mb-5 p-5 rounded-lg border border-gisviz-border bg-gisviz-paper/40">
          <MetaFields form={form} set={set} />
          <div className="flex justify-end gap-3 mt-5">
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-md text-[13px] border border-gisviz-border text-gisviz-ink-soft hover:bg-gisviz-rail">Cancel</button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded-md text-[13px] font-semibold bg-gisviz-accent text-[color:var(--accent-on)] disabled:opacity-60">Save details</button>
          </div>
        </form>
      )}

      {/* drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]) }}
        onClick={() => progress === null && fileRef.current?.click()}
        className={`mx-5 mb-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors flex items-center justify-center gap-3 text-center ${
          d.has_data ? 'py-3' : 'py-7'} ${drag ? 'border-gisviz-accent bg-gisviz-accent/5' : 'border-gisviz-border hover:border-gisviz-accent'}`}
      >
        {progress !== null ? (
          <div className="w-full max-w-sm px-4">
            <div className="flex justify-between text-[12px] text-gisviz-ink-soft mb-1.5">
              <span>{progress < 100 ? 'Uploading…' : 'Writing to DuckDB and profiling…'}</span><span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gisviz-canvas overflow-hidden">
              <div className="h-full bg-gisviz-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <FileUp size={d.has_data ? 16 : 22} className="text-gisviz-accent" />
            <span className="text-[13px] text-gisviz-ink">
              {d.has_data ? 'Drop a new Parquet file to replace the data' : <>Drop the <b>Parquet</b> file here, or click to browse</>}
            </span>
          </>
        )}
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
               onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; upload(f) }} />
      </div>

      {note && (
        <div className={`mx-5 mb-5 -mt-2 flex items-start gap-2 text-[12.5px] ${note.kind === 'ok' ? 'text-gisviz-safe' : 'text-gisviz-alert'}`}>
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

  const [rows, setRows] = useState<ManagedDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const [msg, setMsg] = useState<Note | null>(null)

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth?redirect=/admin/datasets')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await gisvizApi.listManagedDatasets(q.trim(), status)) }
    catch (e) { setMsg({ kind: 'err', text: errText(e, 'Could not load datasets.') }) }
    finally { setLoading(false) }
  }, [q, status])

  useEffect(() => {
    if (!user || user.role_name !== 'admin') return
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [user, load])

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setMsg({ kind: 'err', text: 'A title is required.' }); return }
    setSaving(true)
    try {
      const r = await gisvizApi.createDataset(form)
      setMsg({ kind: 'ok', text: `Created ${r.dataset_id}. Drop its Parquet file on the card below to make it active.` })
      setForm(EMPTY); setCreating(false); setQ(''); setStatus(''); load()
    } catch (err) { setMsg({ kind: 'err', text: errText(err, 'Could not create the dataset.') }) }
    finally { setSaving(false) }
  }

  if (authLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )
  if (!user || user.role_name !== 'admin')
    return <AccessRestricted requiredRoles={['admin']} currentRole={user?.role_name} backHref="/" backLabel="Return to Feed" />

  const nActive = rows.filter(r => r.status === 'active').length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8 pb-20">

      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-display font-bold text-gisviz-ink tracking-tight flex items-center gap-3">
            <Database className="text-gisviz-accent" size={28} /> Datasets
          </h1>
          <p className="text-[14.5px] text-gisviz-ink-soft mt-1.5 leading-relaxed">
            Create a dataset, drop its Parquet file, and it goes live in the post picker · {rows.length} total · {nActive} active
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin"
            className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
            <ArrowUpRight size={14} /> Admin Home
          </Link>
          <button onClick={() => load()} title="Refresh"
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

      {/* create */}
      {creating ? (
        <form onSubmit={create} className="bg-gisviz-card border border-gisviz-border rounded-xl p-6 sm:p-8 shadow-sm mb-6">
          <h2 className="font-display text-[17px] font-bold text-gisviz-ink mb-1 flex items-center gap-2">
            <Plus size={17} className="text-gisviz-accent" /> New dataset
          </h2>
          <p className="text-[13px] text-gisviz-ink-soft mb-5">A code (ds_00001, ds_00002, …) is assigned automatically. It stays inactive until its file is uploaded.</p>
          <MetaFields form={form} set={set} />
          <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gisviz-border">
            <button type="button" onClick={() => { setCreating(false); setForm(EMPTY) }}
                    className="px-5 py-2 rounded-md text-[13px] border border-gisviz-border text-gisviz-ink-soft hover:bg-gisviz-rail">Cancel</button>
            <button type="submit" disabled={saving}
                    className="inline-flex items-center gap-2 bg-gisviz-accent text-[color:var(--accent-on)] px-6 py-2 rounded-md text-[13px] font-semibold shadow-sm hover:brightness-110 disabled:opacity-60">
              {saving && <Loader2 size={15} className="animate-spin" />} Create dataset
            </button>
          </div>
        </form>
      ) : null}

      {/* toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
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
        {!creating && (
          <button onClick={() => setCreating(true)}
                  className="inline-flex items-center justify-center gap-2 bg-gisviz-accent text-[color:var(--accent-on)] px-4 py-2 rounded-md text-[13px] font-semibold shadow-sm hover:brightness-110">
            <Plus size={15} /> New dataset
          </button>
        )}
      </div>

      {/* list */}
      <div className="flex flex-col gap-4">
        {loading && rows.length === 0 && <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-gisviz-accent" /></div>}
        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-gisviz-border bg-gisviz-card py-12 px-6 text-center text-[14px] text-gisviz-ink-soft">
            No datasets yet. Click <b>New dataset</b>, then drop its Parquet file.
          </div>
        )}
        {rows.map(d => (
          <DatasetCard key={d.dataset_id} d={d}
                       onChanged={() => load()}
                       onDeleted={n => { setMsg(n); load() }} />
        ))}
      </div>
    </div>
  )
}