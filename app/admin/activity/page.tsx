'use client'

/**
 * app/admin/activity/page.tsx — Admin Activity (audit trail)
 *
 * Reads admin_db via /admin/audit/actions. This data is LIVE (written
 * synchronously when an admin performs a mutation) and PERMANENT (survives
 * deletion of the source rows). It's the only record of who deleted what.
 *
 * Requires:
 *   • Backend: admin_audit.py router registered (see companion file)
 *   • Frontend: adminFetchAuditActions in services/api.ts (see companion)
 *   • admin_db audit logging wired into your mutation endpoints
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity, Loader2, RefreshCw, ArrowUpRight, Filter,
  Trash2, ShieldCheck, UserX, Flag, Tag, MessageSquare, BarChart2,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'
import AccessRestricted from '../../components/AccessRestricted'

type Action = {
  action_id: string
  admin_handle: string | null
  action_type: string
  target_type: string | null
  target_id: string | null
  payload: Record<string, any>
  occurred: string
}

const META: Record<string, { Icon: any; color: string }> = {
  'post.delete':                 { Icon: Trash2,        color: 'text-gisviz-alert' },
  'comment.delete':              { Icon: MessageSquare, color: 'text-gisviz-alert' },
  'user.delete':                 { Icon: UserX,         color: 'text-gisviz-alert' },
  'user.bulk_delete_unverified': { Icon: UserX,         color: 'text-gisviz-alert' },
  'user.verify':                 { Icon: ShieldCheck,   color: 'text-green-600' },
  'user.status_change':          { Icon: ShieldCheck,   color: 'text-gisviz-accent' },
  'user.role_change':            { Icon: ShieldCheck,   color: 'text-gisviz-accent' },
  'role.create':                 { Icon: Tag,           color: 'text-gisviz-accent' },
  'role.update':                 { Icon: Tag,           color: 'text-gisviz-ink-soft' },
  'role.delete':                 { Icon: Tag,           color: 'text-gisviz-alert' },
  'report.resolve':              { Icon: Flag,          color: 'text-gisviz-accent' },
  'report.dismiss':              { Icon: Flag,          color: 'text-gisviz-ink-soft' },
}

const FILTERS = [
  { label: 'All',           value: '' },
  { label: 'Deletions',     value: 'post.delete' },
  { label: 'User deletes',  value: 'user.delete' },
  { label: 'Verifications', value: 'user.verify' },
  { label: 'Role changes',  value: 'role.update' },
  { label: 'Reports',       value: 'report.resolve' },
]

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s <    60) return `${s}s ago`
  if (s <  3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function AdminActivityPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()

  const [actions, setActions] = useState<Action[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('')
  const [skip, setSkip]       = useState(0)
  const LIMIT = 50

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async (s = skip, f = filter) => {
    setLoading(true)
    try {
      const res = await gisvizApi.adminFetchAuditActions({ skip: s, limit: LIMIT, action_type: f || undefined })
      setActions(res.actions); setTotal(res.total)
    } catch { /* swallow */ }
    finally { setLoading(false) }
  }, [skip, filter])

  useEffect(() => { if (!authLoading && isAuthenticated) load() }, [authLoading, isAuthenticated, load])

  if (authLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )
  if (!user || user.role_name !== 'admin')
    return <AccessRestricted requiredRoles={['admin']} currentRole={user?.role_name} backHref="/" backLabel="Return to Feed" />

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 pb-20">

      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
            <Activity className="text-gisviz-accent" size={28} /> Admin Activity
          </h1>
          <p className="text-gisviz-ink-soft font-mono text-[12px] mt-1">
            Permanent audit trail · live · written at action time
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin"
            className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
            <ArrowUpRight size={14} /> Admin Home
          </Link>
          <Link href="/admin/control"
            className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
            <ArrowUpRight size={14} /> Control Panel
          </Link>
          <Link href="/admin/analytics"
            className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
            <BarChart2 size={14} /> Analytics
          </Link>
          <button onClick={() => load()}
            className="p-2 bg-gisviz-canvas border border-gisviz-border rounded-md text-gisviz-ink-soft hover:text-gisviz-ink transition-colors"
            title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <Filter size={13} className="text-gisviz-ink-soft" />
        {FILTERS.map(f => (
          <button key={f.value}
            onClick={() => { setFilter(f.value); setSkip(0); load(0, f.value) }}
            className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
              filter === f.value
                ? 'bg-gisviz-accent/10 text-gisviz-accent font-bold'
                : 'text-gisviz-ink-soft hover:text-gisviz-ink border border-gisviz-border'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* table */}
      <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gisviz-accent" />
          </div>
        ) : actions.length === 0 ? (
          <div className="py-16 text-center text-[12px] font-mono text-gisviz-ink-soft">
            <p>No admin actions recorded yet.</p>
            <p className="text-[11px] mt-1 opacity-70">Actions appear here once admins perform mutations in the control panel.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gisviz-border">
            {actions.map(a => {
              const { Icon, color } = META[a.action_type] ?? { Icon: Activity, color: 'text-gisviz-ink-soft' }
              return (
                <li key={a.action_id} className="flex items-start gap-3 px-5 py-3 hover:bg-gisviz-canvas/40 transition-colors">
                  <Icon size={15} className={`mt-0.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-gisviz-ink leading-snug">
                      <span className="font-bold">{a.admin_handle ?? 'admin'}</span>{' '}
                      <span className="font-mono text-[11px] text-gisviz-ink-soft bg-gisviz-canvas px-1 rounded">{a.action_type}</span>
                      {a.target_id && (
                        <span className="text-gisviz-ink-soft text-[11px] font-mono ml-1">
                          · {a.target_type} <code>{a.target_id.slice(0, 8)}</code>
                        </span>
                      )}
                    </p>
                    {a.payload && Object.keys(a.payload).length > 0 && (
                      <p className="text-[11px] font-mono text-gisviz-ink-soft mt-0.5 truncate">
                        {Object.entries(a.payload).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 50)}`).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-gisviz-ink-soft shrink-0 whitespace-nowrap">{timeAgo(a.occurred)}</span>
                </li>
              )
            })}
          </ul>
        )}

        {/* pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gisviz-border bg-gisviz-canvas/30">
          <span className="text-[11px] font-mono text-gisviz-ink-soft">{total} total action{total !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => { const n = Math.max(0, skip - LIMIT); setSkip(n); load(n) }}
              disabled={skip === 0}
              className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">← Prev</button>
            <button onClick={() => { const n = skip + LIMIT; setSkip(n); load(n) }}
              disabled={actions.length < LIMIT}
              className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}