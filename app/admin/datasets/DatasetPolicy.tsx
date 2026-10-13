'use client'
/** /admin/datasets: licence, copyright, access, pipeline and GDPR fields of a dataset; the stream ingest key. */
import React, { useEffect, useState } from 'react'
import { Copy, KeyRound, Loader2, Lock, Radio, Scale, ShieldAlert } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'
import type { Licence } from '../../../types/access'

export const POLICY_EMPTY = {
  visibility: 'private', owner_handle: '', pipeline: 'batch', refresh_seconds: '60', retention_rows: '',
  license_code: '', copyright_holder: '', attribution: '', contains_personal_data: '',
}
export type PolicyForm = typeof POLICY_EMPTY

export function policyFrom(d: any): PolicyForm {
  return {
    visibility: d?.visibility || 'public', owner_handle: d?.owner_handle ? `@${d.owner_handle}` : '',
    pipeline: d?.pipeline || 'batch', refresh_seconds: String(d?.refresh_seconds ?? 60),
    retention_rows: d?.retention_rows ? String(d.retention_rows) : '', license_code: d?.license_code || '',
    copyright_holder: d?.copyright_holder || '', attribution: d?.attribution || '',
    contains_personal_data: d?.contains_personal_data ? '1' : '',
  }
}

/** The API body: numbers and booleans in their real types. */
export function policyPayload(f: PolicyForm) {
  return {
    visibility: f.visibility, owner_handle: f.owner_handle.trim(), pipeline: f.pipeline,
    refresh_seconds: Math.max(5, Number(f.refresh_seconds) || 60),
    retention_rows: f.retention_rows.trim() ? Number(f.retention_rows) : 0,
    license_code: f.license_code, copyright_holder: f.copyright_holder, attribution: f.attribution,
    contains_personal_data: f.contains_personal_data === '1',
  }
}

const inputCls = 'w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-2.5 py-1.5 text-gisviz-ink text-[13px] focus:ring-2 focus:ring-gisviz-accent outline-none'
const labelCls = 'block text-[10.5px] font-mono font-semibold text-gisviz-ink-soft mb-1 uppercase tracking-wider'
const req = <span className="text-gisviz-alert">*</span>

/** Cells of the dataset editor's grid (4 columns on wide screens): licence and the copyright holder (one field,
 *  required: the attribution shown with every visual is "© holder"), then who sees it and how it is fed. */
export function DatasetPolicyFields({ form, set }: { form: PolicyForm; set: (k: keyof PolicyForm, v: string) => void }) {
  const [licences, setLicences] = useState<Licence[]>([])
  useEffect(() => { gisvizApi.listLicences().then(setLicences).catch(() => setLicences([])) }, [])
  const lic = licences.find(l => l.code === form.license_code)
  return (
    <>
      <div>
        <label className={labelCls}><Scale size={10} className="inline" /> Licence</label>
        <select value={form.license_code} onChange={e => set('license_code', e.target.value)} className={inputCls}
                title={lic ? `${lic.attribution ? 'Attribution required. ' : ''}${lic.rows_public ? 'Rows may be shown. ' : 'Visual only. '}${lic.commercial ? '' : 'Non-commercial. '}${lic.public_ok ? '' : 'Private only.'}` : ''}>
          <option value="">— Choose (needed to make it public) —</option>
          {(['open', 'restricted', 'closed'] as const).map(g => (
            <optgroup key={g} label={g === 'open' ? 'Open' : g === 'restricted' ? 'Restricted' : 'Closed'}>
              {licences.filter(l => l.group === g).map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Copyright holder {req}</label>
        <input value={form.copyright_holder} onChange={e => set('copyright_holder', e.target.value)} placeholder="e.g. OpenStreetMap contributors" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}><Lock size={10} className="inline" /> Visibility</label>
        <select value={form.visibility} onChange={e => set('visibility', e.target.value)} className={inputCls}>
          <option value="public">Public: anyone can build posts</option>
          <option value="private">Private: owner + shared</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Owner</label>
        <input value={form.owner_handle} onChange={e => set('owner_handle', e.target.value)} placeholder="@acme (empty: admins)" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}><Radio size={10} className="inline" /> Pipeline</label>
        <select value={form.pipeline} onChange={e => set('pipeline', e.target.value)} className={inputCls}>
          <option value="batch">Batch (file uploads)</option>
          <option value="stream">Stream (rows pushed, live)</option>
        </select>
      </div>
      {form.pipeline === 'stream' ? (
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Refresh (s)</label>
            <input type="number" min={5} max={86400} value={form.refresh_seconds} onChange={e => set('refresh_seconds', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Keep rows</label>
            <input type="number" min={100} value={form.retention_rows} onChange={e => set('retention_rows', e.target.value)} placeholder="all" className={inputCls} /></div>
        </div>
      ) : <div className="hidden lg:block" />}
      <label className="flex items-start gap-2 self-end pb-1.5 text-[12px] text-gisviz-ink sm:col-span-2">
        <input type="checkbox" checked={form.contains_personal_data === '1'} onChange={e => set('contains_personal_data', e.target.checked ? '1' : '')} className="mt-0.5" />
        <span><ShieldAlert size={12} className="inline text-amber-600" /> Contains personal data (GDPR): readers see only the visual, never the rows.</span>
      </label>
    </>
  )
}

export function IngestKeyPanel({ datasetId, hasKey }: { datasetId: string; hasKey?: boolean }) {
  const [key, setKey] = useState<{ ingest_key: string; endpoint: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [exists, setExists] = useState(!!hasKey)
  const origin = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin).replace(/\/api\/v0\/?$/, '') : ''
  const rotate = async () => {
    if (exists && !confirm('Create a new key? The current key stops working at once.')) return
    setBusy(true); setErr('')
    try { const k = await gisvizApi.rotateIngestKey(datasetId); setKey(k); setExists(true) }
    catch (e: any) { setErr(e?.response?.data?.detail || 'Could not create a key (save the dataset as stream first).') }
    finally { setBusy(false) }
  }
  const revoke = async () => {
    setBusy(true)
    try { await gisvizApi.revokeIngestKey(datasetId); setKey(null); setExists(false) } finally { setBusy(false) }
  }
  const curl = key ? `curl -X POST ${origin}${key.endpoint} \\\n  -H "X-Ingest-Key: ${key.ingest_key}" -H "Content-Type: application/json" \\\n  -d '{"rows": [{"column": "value"}]}'` : ''
  return (
    <div className="rounded-lg border border-gisviz-border p-3">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-gisviz-ink"><KeyRound size={14} className="text-gisviz-accent" /> Stream ingest key</p>
      <p className="mb-3 text-[12px] text-gisviz-ink-soft">Machines push rows to this dataset with the key (up to 5,000 rows per request). Upload a first file to define the columns. The key is shown once.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={rotate} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border border-gisviz-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-gisviz-accent disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} {exists ? 'New key' : 'Create key'}
        </button>
        {exists && <button type="button" onClick={revoke} disabled={busy} className="rounded-md border border-gisviz-border px-3 py-1.5 text-[12.5px] text-gisviz-alert hover:border-gisviz-alert">Revoke key</button>}
      </div>
      {err && <p className="mt-2 text-[12px] text-gisviz-alert">{err}</p>}
      {key && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-gisviz-canvas px-3 py-2 font-mono text-[12px] text-gisviz-ink">
            <span className="truncate">{key.ingest_key}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(key.ingest_key)} className="ml-auto text-gisviz-ink-soft hover:text-gisviz-accent" title="Copy"><Copy size={13} /></button>
          </div>
          <pre className="overflow-x-auto rounded-md bg-gisviz-ink/90 p-3 text-[11px] leading-relaxed text-gisviz-card">{curl}</pre>
        </div>
      )}
    </div>
  )
}