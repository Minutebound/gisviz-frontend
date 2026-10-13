'use client'
/**
 * AccessPanel — who can see a post or a dataset (backend endpoints/access.py).
 *   Public / Private switch · share with a person or an organisation by @handle · people with access (revoke)
 *   · the full history (who shared with whom, when, who revoked it).
 * Shown to the post's publisher (admins / editors too) and to a dataset's owner (admins).
 */
import React, { useEffect, useState } from 'react'
import { Building2, Globe2, History, Loader2, Lock, Trash2, UserPlus, X } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'
import type { AccessDetails, ShareRow, Visibility } from '../../../types/access'

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''
}

function Who({ row }: { row: ShareRow }) {
  const org = row.grantee_type === 'org'
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${org ? 'bg-gisviz-accent/10 text-gisviz-accent' : 'bg-gisviz-paper text-gisviz-ink-soft'}`}>
        {org ? <Building2 size={14} /> : <span className="text-[11px] font-bold uppercase">{(row.grantee.handle || '?').slice(0, 2)}</span>}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-gisviz-ink">
          {org ? row.grantee.label : row.grantee.handle ? `@${row.grantee.handle}` : row.grantee.label}
        </span>
        <span className="block truncate text-[11.5px] text-gisviz-ink-soft">
          {org ? `everyone @${row.grantee.domain ?? ''}` : 'can view'}
          {row.granted_by && ` · shared by ${row.granted_by.handle ? '@' + row.granted_by.handle : row.granted_by.label}`}
        </span>
      </span>
    </span>
  )
}

export default function AccessPanel({ kind, id, onVisibility, compact = false }: {
  kind: 'post' | 'dataset'
  id: string
  onVisibility?: (v: Visibility) => void
  compact?: boolean
}) {
  const [data, setData] = useState<AccessDetails | null>(null)
  const [error, setError] = useState('')
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const load = () => gisvizApi.fetchAccess(kind, id).then(d => { setData(d); setError('') })
    .catch(e => setError(e?.response?.data?.detail || 'Could not load who has access.'))
  useEffect(() => { load() }, [kind, id])   // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<any>) => {
    setBusy(true); setError('')
    try { await fn(); await load() }
    catch (e: any) { setError(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'That did not work.') }
    finally { setBusy(false) }
  }

  // no <form> here: the panel also sits inside the dataset editor's form
  const share = () => { const h = handle.trim(); if (h && !busy) act(async () => { await gisvizApi.shareWith(kind, id, h); setHandle('') }) }

  if (!data) return (
    <div className="flex items-center gap-2 p-4 text-[13px] text-gisviz-ink-soft">
      {error ? <span className="text-gisviz-alert">{error}</span> : <><Loader2 size={14} className="animate-spin" /> Loading access…</>}
    </div>
  )

  const pub = data.visibility === 'public'
  const lockedPrivate = kind === 'post' && data.can_be_public === false
  const seg = (on: boolean) => `flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-[7px] text-[13px] font-semibold transition-colors ${
    on ? 'bg-gisviz-card text-gisviz-ink shadow-sm' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* visibility */}
      <div>
        <div className="flex rounded-[9px] border border-gisviz-border bg-gisviz-paper p-0.5">
          <button type="button" disabled={busy || lockedPrivate} className={`${seg(pub)} disabled:opacity-50`}
                  onClick={() => act(async () => { await gisvizApi.setVisibility(kind, id, 'public'); onVisibility?.('public') })}>
            <Globe2 size={14} /> Public
          </button>
          <button type="button" disabled={busy} className={seg(!pub)}
                  onClick={() => act(async () => { await gisvizApi.setVisibility(kind, id, 'private'); onVisibility?.('private') })}>
            <Lock size={14} /> Private
          </button>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-gisviz-ink-soft">
          {pub
            ? kind === 'post' ? 'Everyone can see it in the feed, search and your profile.' : 'Listed in the catalog; anyone can build posts on it.'
            : kind === 'post' ? 'Only you, the people and organisations below, and moderators can open it.'
              : 'Only its owner, admins and the people and organisations below can see and use it.'}
          {lockedPrivate && ' It must stay private: its dataset is private and was only shared with you.'}
          {kind === 'post' && data.dataset_visibility === 'private' && pub && ' Its dataset is private: readers see the visual, never the rows.'}
        </p>
      </div>

      {/* share */}
      <div className="flex gap-2">
        <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@person or @organisation"
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); share() } }}
               className="min-w-0 flex-1 h-9 rounded-[8px] border border-gisviz-border bg-gisviz-canvas px-3 text-[13px] text-gisviz-ink outline-none focus:ring-2 focus:ring-gisviz-accent" />
        <button type="button" onClick={share} disabled={busy || !handle.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-gisviz-accent px-3 text-[13px] font-semibold text-[color:var(--accent-on)] disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Share
        </button>
      </div>
      {error && <p className="flex items-center justify-between rounded-md bg-gisviz-alert/10 px-3 py-2 text-[12.5px] text-gisviz-alert">
        {error}<button type="button" onClick={() => setError('')}><X size={13} /></button></p>}

      {/* who has access */}
      <div>
        <p className="mb-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-gisviz-ink-soft">
          Shared with {data.grants.length ? `(${data.grants.length})` : ''}
        </p>
        {data.grants.length === 0 ? (
          <p className="text-[12.5px] text-gisviz-ink-soft">Nobody yet{pub ? ' (everyone can see it anyway while it is public)' : ''}.</p>
        ) : (
          <ul className="divide-y divide-gisviz-border/60 rounded-[10px] border border-gisviz-border">
            {data.grants.map(g => (
              <li key={g.share_id} className="flex items-center justify-between gap-2 px-3 py-2">
                <Who row={g} />
                <button type="button" disabled={busy} onClick={() => act(() => gisvizApi.revokeShare(kind, id, g.share_id))}
                        className="shrink-0 rounded-md p-1.5 text-gisviz-ink-soft hover:bg-gisviz-alert/10 hover:text-gisviz-alert" title="Remove access">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* history */}
      {data.history.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowHistory(v => !v)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gisviz-ink-soft hover:text-gisviz-ink">
            <History size={13} /> {showHistory ? 'Hide' : 'Show'} access history ({data.history.length})
          </button>
          {showHistory && (
            <ol className="mt-2 space-y-1.5 text-[12px] text-gisviz-ink-soft">
              {data.history.map(h => (
                <li key={h.share_id} className="rounded-md bg-gisviz-paper/60 px-2.5 py-1.5">
                  <span className="font-semibold text-gisviz-ink">{h.grantee_type === 'org' ? h.grantee.label : h.grantee.handle ? `@${h.grantee.handle}` : h.grantee.label}</span>
                  {' '}shared by {h.granted_by?.handle ? `@${h.granted_by.handle}` : h.granted_by?.label ?? '—'} · {when(h.granted_at)}
                  {h.revoked_at && <> · <span className="text-gisviz-alert">revoked</span> by {h.revoked_by?.handle ? `@${h.revoked_by.handle}` : h.revoked_by?.label ?? '—'} · {when(h.revoked_at)}</>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}