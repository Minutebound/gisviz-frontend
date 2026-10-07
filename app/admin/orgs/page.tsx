'use client'
/**
 * app/admin/orgs/page.tsx — verify organisation accounts.
 * An organisation account is created from Settings by someone on the organisation's own email domain;
 * it stays "pending" until an admin verifies it here. Once verified, every confirmed account on that
 * domain becomes a member and sees what is shared with the organisation in its Shared tab.
 * Backend: GET /orgs?status=, PUT /orgs/{id}/status (endpoints/orgs.py), audited in admin activity.
 */
import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Check, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../connector/api'
import AccessRestricted from '../../components/AccessRestricted'
import type { OrgCard } from '../../../types/access'

const TABS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: '' },
] as const

const BADGE: Record<string, string> = {
  pending: 'bg-gisviz-accent/10 text-gisviz-accent',
  verified: 'bg-gisviz-safe/10 text-gisviz-safe',
  rejected: 'bg-gisviz-alert/10 text-gisviz-alert',
}

export default function AdminOrgsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()
  const [status, setStatus] = useState<string>('pending')
  const [orgs, setOrgs] = useState<OrgCard[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { if (!authLoading && !isAuthenticated) router.push('/auth') }, [authLoading, isAuthenticated, router])

  const load = useCallback(() => {
    setOrgs(null); setError('')
    gisvizApi.adminListOrgs(status || undefined).then(setOrgs)
      .catch(e => { setOrgs([]); setError(e?.response?.data?.detail || 'Could not load organisations.') })
  }, [status])
  useEffect(() => { if (user?.role_name === 'admin') load() }, [load, user])

  const review = async (org: OrgCard, next: 'verified' | 'rejected' | 'pending') => {
    setBusy(org.org_id); setError('')
    try { await gisvizApi.adminReviewOrg(org.org_id, next); load() }
    catch (e: any) { setError(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'That did not work.') }
    finally { setBusy(null) }
  }

  if (authLoading) return <div className="grid h-[calc(100vh-4rem)] place-items-center"><Loader2 size={30} className="animate-spin text-gisviz-accent" /></div>
  if (!user || user.role_name !== 'admin')
    return <AccessRestricted requiredRoles={['admin']} currentRole={user?.role_name} backHref="/" backLabel="Return to Feed" />

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-20 pt-8 sm:px-6">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-gisviz-ink-soft hover:text-gisviz-ink"><ArrowLeft size={14} /> Admin</Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-[26px] font-bold tracking-tight text-gisviz-ink">
            <Building2 className="text-gisviz-accent" size={26} /> Organisations
          </h1>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-gisviz-ink-soft">
            Verify an organisation only after checking that the domain really belongs to it. Verifying makes every
            confirmed account on that email domain a member: they see everything shared with the organisation.
          </p>
        </div>
        <button onClick={load} className="rounded-md border border-gisviz-border p-2 text-gisviz-ink-soft hover:text-gisviz-ink" title="Refresh"><RefreshCw size={15} /></button>
      </div>

      <div className="mb-4 flex gap-1 rounded-[9px] border border-gisviz-border bg-gisviz-paper p-0.5">
        {TABS.map(t => (
          <button key={t.value} onClick={() => setStatus(t.value)}
                  className={`flex-1 h-8 rounded-[7px] text-[13px] font-semibold ${status === t.value ? 'bg-gisviz-card text-gisviz-ink shadow-sm' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 rounded-md bg-gisviz-alert/10 px-3 py-2 text-[13px] text-gisviz-alert">{error}</p>}

      {orgs === null ? (
        <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-gisviz-accent" /></div>
      ) : orgs.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-gisviz-border py-12 text-center text-[13.5px] text-gisviz-ink-soft">No organisations here.</p>
      ) : (
        <ul className="divide-y divide-gisviz-border/70 overflow-hidden rounded-[12px] border border-gisviz-border bg-gisviz-card">
          {orgs.map(o => (
            <li key={o.org_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gisviz-ink">{o.name}</span>
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider ${BADGE[o.status] ?? ''}`}>{o.status}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-gisviz-ink-soft">
                  @{o.email_domain}{o.handle && <> · account <Link href={`/profile/${o.handle}`} className="hover:text-gisviz-accent">@{o.handle}</Link></>}
                  {o.account_email && <> · {o.account_email}</>} · {o.member_count} member{o.member_count === 1 ? '' : 's'}
                  {o.created_at && <> · requested {new Date(o.created_at).toLocaleDateString()}</>}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {busy === o.org_id ? <Loader2 size={16} className="animate-spin text-gisviz-accent" /> : <>
                  {o.status !== 'verified' && (
                    <button onClick={() => review(o, 'verified')} className="inline-flex h-8 items-center gap-1 rounded-md bg-gisviz-accent px-3 text-[12.5px] font-semibold text-[color:var(--accent-on)]"><Check size={14} /> Verify</button>
                  )}
                  {o.status !== 'rejected' && (
                    <button onClick={() => review(o, 'rejected')} className="inline-flex h-8 items-center gap-1 rounded-md border border-gisviz-border px-3 text-[12.5px] font-semibold text-gisviz-alert hover:bg-gisviz-alert/10"><X size={14} /> {o.status === 'verified' ? 'Revoke' : 'Reject'}</button>
                  )}
                  {o.status === 'rejected' && (
                    <button onClick={() => review(o, 'pending')} className="inline-flex h-8 items-center gap-1 rounded-md border border-gisviz-border px-3 text-[12.5px] font-semibold text-gisviz-ink-soft hover:text-gisviz-ink"><RotateCcw size={14} /> Reopen</button>
                  )}
                </>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}