'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ShieldCheck, Tag, Users, FileText, Flag,
  MessageSquare, UserX, KeyRound, Plus, Trash2,
  Edit2, X, Check, Loader2, Search, ChevronDown,
  ToggleLeft, ToggleRight, ExternalLink, RefreshCw,
  AlertTriangle, ArrowUpRight, Save, Shield,
  Activity, BarChart2, LifeBuoy,
  Download,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'
import AccessRestricted from '../../components/AccessRestricted'
import AccessControlPanel from './AccessControlPanel'

// ── 1. Tab type now includes 'tickets' ───────────────────────────────────────
type Tab = 'categories' | 'users' | 'posts' | 'reports' | 'comments' | 'unverified' | 'roles' | 'tickets'

// ── 2. TABS array — tickets entry added at the end ───────────────────────────
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'categories', label: 'Categories',     icon: <Tag size={14} /> },
  { id: 'users',      label: 'Users',          icon: <Users size={14} /> },
  { id: 'posts',      label: 'Posts',          icon: <FileText size={14} /> },
  { id: 'reports',    label: 'Reports',        icon: <Flag size={14} /> },
  { id: 'comments',   label: 'Comments',       icon: <MessageSquare size={14} /> },
  { id: 'unverified', label: 'Unverified',     icon: <UserX size={14} /> },
  { id: 'roles',      label: 'Roles', icon: <KeyRound size={14} /> },
  { id: 'tickets',    label: 'Support',        icon: <LifeBuoy size={14} /> },
]

// ── 3. VALID_TABS — tickets added ────────────────────────────────────────────
const VALID_TABS: Tab[] = [
  'categories', 'users', 'posts', 'reports', 'comments', 'unverified', 'roles', 'tickets',
]

const ALL_ROLES = ['viewer', 'publisher', 'editor', 'support', 'admin']

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components — unchanged from your current file
// ─────────────────────────────────────────────────────────────────────────────

const Badge = ({ children, color = 'default' }: { children: React.ReactNode; color?: string }) => {
  const cls: Record<string, string> = {
    admin:       'bg-gisviz-alert/30 text-gisviz-alert/100 border-gisviz-alert/50',
    editor:      'bg-purple-100 text-purple-700 border-purple-200',
    publisher:   'bg-blue-100 text-blue-700 border-blue-200',
    support:     'bg-gisviz-canvas/10 text-yellow-700 border-yellow-200',
    viewer:      'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border',
    open:        'bg-gisviz-canvas/10 text-yellow-700 border-yellow-200',
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    resolved:    'bg-gisviz-safe/10 text-gisviz-safe/90 border-gisviz-safe/30',
    closed:      'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border',
    dismissed:   'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border',
    default:     'bg-gisviz-canvas text-gisviz-ink border-gisviz-border',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-mono font-bold border ${cls[color as string] || cls.default}`}>
      {children}
    </span>
  )
}

function ConfirmBtn({ onConfirm, busy }: { onConfirm: () => void; busy?: boolean }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) return (
    <button onClick={() => setConfirming(true)}
      className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-alert hover:bg-gisviz-alert/10 transition-colors" title="Delete">
      <Trash2 size={14} />
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => { onConfirm(); setConfirming(false) }} disabled={busy}
        className="p-1 rounded bg-gisviz-alert text-gisviz-white hover:bg-gisviz-alert/100 transition-colors disabled:opacity-50">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button onClick={() => setConfirming(false)}
        className="p-1 rounded bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
        <X size={12} />
      </button>
    </div>
  )
}

function Panel({ title, icon, count, actions, children }: {
  title: string; icon: React.ReactNode; count?: number | string
  actions?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/50 flex-wrap gap-3">
        <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest flex items-center gap-2">
          <span className="text-gisviz-accent">{icon}</span>
          {title}{count !== undefined ? ` (${count})` : ''}
        </h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

const EmptyState = ({ text }: { text: string }) => (
  <div className="py-12 text-center text-[12px] font-mono text-gisviz-ink-soft">{text}</div>
)
const Spinner = () => (
  <div className="flex justify-center py-12">
    <Loader2 size={24} className="animate-spin text-gisviz-accent" />
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminControlPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<Tab>('categories')
  const [ddOpen, setDdOpen]       = useState(false)
  const [globalErr, setGlobalErr] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    const t = searchParams.get('tab') as Tab | null
    if (t && VALID_TABS.includes(t)) setActiveTab(t)
  }, [searchParams])

  if (authLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )

  if (!user || user.role_name !== 'admin') {
    return <AccessRestricted requiredRoles={['admin']} currentRole={user?.role_name} backHref="/" backLabel="Return to Feed" />
  }

  const meta = TABS.find(t => t.id === activeTab)!

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 pb-20">

      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
            <ShieldCheck className="text-gisviz-accent" size={28} /> Control Panel
          </h1>
          <p className="text-gisviz-ink-soft font-mono text-[12px] mt-1">
            Platform management — <Badge color="admin">admin</Badge> only
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin"
            className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
            <ArrowUpRight size={14} /> Admin Home
          </Link>
          <Link href="/admin/analytics"
            className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
            <BarChart2 size={14} /> Analytics
          </Link>
          <Link href="/admin/activity"
            className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
            <Activity size={14} /> Activity
          </Link>

          {/* ── Tab dropdown ── */}
          <div className="relative">
            <button onClick={() => setDdOpen(p => !p)}
              className="flex items-center gap-2 bg-gisviz-card border border-gisviz-border px-4 py-2 rounded-md font-mono text-[12px] text-gisviz-ink shadow-sm hover:border-gisviz-accent transition-colors min-w-[160px] justify-between">
              <span className="flex items-center gap-2">{meta.icon} {meta.label}</span>
              <ChevronDown size={13} className={`transition-transform ${ddOpen ? 'rotate-180' : ''}`} />
            </button>
            {ddOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-gisviz-card border border-gisviz-border rounded-md shadow-lg z-30 py-1 overflow-hidden">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setDdOpen(false) }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-[12px] font-mono transition-colors ${
                      activeTab === tab.id
                        ? 'bg-gisviz-accent/10 text-gisviz-accent font-bold'
                        : 'text-gisviz-ink hover:bg-gisviz-canvas'
                    }`}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {globalErr && (
        <div className="mb-4 p-3 bg-gisviz-alert/10 border border-gisviz-alert/50 rounded-md text-[12px] font-mono text-gisviz-alert flex items-center justify-between">
          {globalErr}
          <button onClick={() => setGlobalErr('')}><X size={14} /></button>
        </div>
      )}

      {/* ── 4. Tab switch — tickets case added ── */}
      {activeTab === 'categories' && <CategoriesPanel  onError={setGlobalErr} />}
      {activeTab === 'users'      && <UsersPanel        onError={setGlobalErr} adminUser={user} />}
      {activeTab === 'posts'      && <PostsPanel        onError={setGlobalErr} />}
      {activeTab === 'reports'    && <ReportsPanel      onError={setGlobalErr} />}
      {activeTab === 'comments'   && <CommentsPanel     onError={setGlobalErr} />}
      {activeTab === 'unverified' && <UnverifiedPanel   onError={setGlobalErr} />}
      {activeTab === 'roles'      && <AccessControlPanel onError={setGlobalErr} />}
      {activeTab === 'tickets'    && <TicketsPanel      onError={setGlobalErr} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES — unchanged from your current file
// ─────────────────────────────────────────────────────────────────────────────
function CategoriesPanel({ onError }: { onError: (e: string) => void }) {
  const [cats, setCats]           = useState<any[]>([])
  const [pending, setPending]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState<string | null>(null)
  const [editId, setEditId]       = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editSlug, setEditSlug]   = useState('')
  const [newLabel, setNewLabel]   = useState('')
  const [newSlug, setNewSlug]     = useState('')
  const [showAdd, setShowAdd]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([gisvizApi.listCategories(), gisvizApi.getPendingCategories()])
      setCats(c); setPending(p)
    } catch { onError('Failed to load categories') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const act = async (key: string, fn: () => Promise<any>) => {
    setBusy(key)
    try { await fn(); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Action failed') }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-6">
      <Panel title="Active Categories" icon={<Tag size={14} />} count={cats.length}
        actions={
          <>
            <button onClick={load} title="Refresh" className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowAdd(p => !p)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gisviz-accent text-gisviz-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">
              <Plus size={13} /> Add
            </button>
          </>
        }
      >
        {showAdd && (
          <div className="px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/30 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase">Label</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Remote Sensing"
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded px-3 py-1.5 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none" />
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase">Slug</label>
              <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="remote-sensing"
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded px-3 py-1.5 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none" />
            </div>
            <button
              onClick={() => act('create', async () => { await gisvizApi.createCategory(newLabel, newSlug); setNewLabel(''); setNewSlug(''); setShowAdd(false) })}
              disabled={busy === 'create' || !newLabel || !newSlug}
              className="flex items-center gap-1 px-4 py-1.5 bg-gisviz-accent text-gisviz-white rounded text-[12px] font-mono font-bold disabled:opacity-50 hover:bg-opacity-90 transition-colors">
              {busy === 'create' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Create
            </button>
          </div>
        )}
        {loading ? <Spinner /> : (
          <table className="w-full text-[12px] font-mono">
            <thead><tr className="border-b border-gisviz-border">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Label</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Slug</th>
              <th className="text-right px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Uses</th>
              <th className="px-4 py-3 w-24"></th>
            </tr></thead>
            <tbody className="divide-y divide-gisviz-border/50">
              {cats.map(cat => (
                <tr key={cat.category_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                  <td className="px-6 py-3">
                    {editId === cat.category_id
                      ? <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="w-full bg-gisviz-canvas border border-gisviz-accent rounded px-2 py-1 text-[12px] font-mono outline-none" />
                      : <span className="font-medium text-gisviz-ink">{cat.label}</span>}
                  </td>
                  <td className="px-4 py-3 text-gisviz-ink-soft hidden sm:table-cell">
                    {editId === cat.category_id
                      ? <input value={editSlug} onChange={e => setEditSlug(e.target.value)} className="w-full bg-gisviz-canvas border border-gisviz-accent rounded px-2 py-1 text-[12px] font-mono outline-none" />
                      : cat.slug}
                  </td>
                  <td className="px-4 py-3 text-right text-gisviz-ink-soft hidden md:table-cell">{cat.usage_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editId === cat.category_id ? (
                        <>
                          <button onClick={() => act(String(cat.category_id), async () => { await gisvizApi.updateCategory(cat.category_id, editLabel, editSlug); setEditId(null) })}
                            disabled={busy === String(cat.category_id)}
                            className="p-1.5 rounded bg-gisviz-accent text-gisviz-white hover:bg-opacity-90 disabled:opacity-50 transition-colors">
                            {busy === String(cat.category_id) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => { setEditId(cat.category_id); setEditLabel(cat.label); setEditSlug(cat.slug) }}
                          className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-canvas transition-colors">
                          <Edit2 size={14} />
                        </button>
                      )}
                      <ConfirmBtn onConfirm={() => act(`del-${cat.category_id}`, () => gisvizApi.deleteCategory(cat.category_id))} busy={busy === `del-${cat.category_id}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {pending.length > 0 && (
        <Panel title="Pending Suggestions" icon={<AlertTriangle size={14} />} count={pending.length}>
          <table className="w-full text-[12px] font-mono">
            <thead><tr className="border-b border-gisviz-border">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Label</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Slug</th>
              <th className="px-4 py-3 w-40"></th>
            </tr></thead>
            <tbody className="divide-y divide-gisviz-border/50">
              {pending.map(p => (
                <tr key={p.pending_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                  <td className="px-6 py-3 font-medium text-gisviz-ink">{p.label}</td>
                  <td className="px-4 py-3 text-gisviz-ink-soft hidden sm:table-cell">{p.normalized_slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => act(p.pending_id, () => gisvizApi.approvePendingCategory(p.pending_id))} disabled={!!busy}
                        className="flex items-center gap-1 px-2 py-1 bg-gisviz-safe/10 text-gisviz-safe/90 border border-gisviz-safe/30 rounded text-[12px] font-mono hover:bg-gisviz-safe/10 transition-colors disabled:opacity-50">
                        {busy === p.pending_id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
                      </button>
                      <button onClick={() => act(`rej-${p.pending_id}`, () => gisvizApi.rejectPendingCategory(p.pending_id))} disabled={!!busy}
                        className="flex items-center gap-1 px-2 py-1 bg-gisviz-alert/10 text-gisviz-alert border border-gisviz-alert/50 rounded text-[12px] font-mono hover:bg-gisviz-alert/30 transition-colors disabled:opacity-50">
                        <X size={11} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS — unchanged from your current file
// ─────────────────────────────────────────────────────────────────────────────
function UsersPanel({ onError, adminUser }: { onError: (e: string) => void; adminUser: any }) {
  const [users, setUsers]     = useState<any[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [skip, setSkip]       = useState(0)
  const LIMIT = 20

  const load = useCallback(async (s = 0, q = '') => {
    setLoading(true)
    try {
      const res = await gisvizApi.fetchAllUsers(s, LIMIT, q || undefined)
      setUsers(res.users); setTotal(res.total)
    } catch { onError('Failed to load users') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const act = async (key: string, fn: () => Promise<any>) => {
    setBusy(key)
    try { await fn(); await load(skip, search) }
    catch (e: any) { onError(e.response?.data?.detail || 'Action failed') }
    finally { setBusy(null) }
  }

  return (
    <Panel title="Users" icon={<Users size={14} />} count={total}
      actions={
        <div className="flex gap-2 items-center">
          <button onClick={() => load(skip, search)} title="Refresh"
            className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <form onSubmit={e => { e.preventDefault(); setSkip(0); load(0, search) }} className="flex gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Handle or email…"
                className="pl-8 pr-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none w-48" />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-gisviz-accent text-gisviz-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">Go</button>
          </form>
        </div>
      }
    >
      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] font-mono min-w-[540px]">
              <thead><tr className="border-b border-gisviz-border">
                <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Handle</th>
                <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden lg:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider">Role</th>
                <th className="text-center px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider">Active</th>
                <th className="px-4 py-3 w-14"></th>
              </tr></thead>
              <tbody className="divide-y divide-gisviz-border/50">
                {users.map(u => (
                  <tr key={u.user_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                    <td className="px-6 py-3">
                      <Link href={`/profile/${u.user_handle}`} target="_blank" className="text-gisviz-accent hover:underline flex items-center gap-1">
                        @{u.user_handle} <ExternalLink size={10} />
                      </Link>
                      <div className="text-[12px] text-gisviz-ink-soft mt-0.5">{u.post_count} posts · {u.follower_count} followers</div>
                    </td>
                    <td className="px-4 py-3 text-gisviz-ink-soft hidden lg:table-cell text-[12px]">{u.email_address}</td>
                    <td className="px-4 py-3">
                      {u.user_id === adminUser?.user_id
                        ? <Badge color="admin">admin (you)</Badge>
                        : (
                          <select value={u.role_name}
                            onChange={e => act(`role-${u.user_id}`, () => gisvizApi.updateUserRole(u.user_id, e.target.value))}
                            disabled={!!busy}
                            className="bg-gisviz-canvas border border-gisviz-border rounded px-2 py-0.5 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none disabled:opacity-50">
                            {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        )
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => act(`status-${u.user_id}`, () => gisvizApi.setUserStatus(u.user_id, !u.is_active))}
                        disabled={!!busy || u.user_id === adminUser?.user_id}
                        className="disabled:opacity-40 transition-colors">
                        {busy === `status-${u.user_id}`
                          ? <Loader2 size={18} className="animate-spin text-gisviz-ink-soft" />
                          : u.is_active
                            ? <ToggleRight size={20} className="text-gisviz-safe/70" />
                            : <ToggleLeft  size={20} className="text-gisviz-ink-soft" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {u.user_id !== adminUser?.user_id && (
                        <ConfirmBtn onConfirm={() => act(`del-${u.user_id}`, () => gisvizApi.deleteUser(u.user_id))} busy={busy === `del-${u.user_id}`} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t border-gisviz-border bg-gisviz-canvas/30">
            <span className="text-[12px] font-mono text-gisviz-ink-soft">
              {skip + 1}–{Math.min(skip + LIMIT, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button onClick={() => { const s = Math.max(0, skip - LIMIT); setSkip(s); load(s, search) }} disabled={skip === 0}
                className="px-3 py-1 rounded border border-gisviz-border text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">← Prev</button>
              <button onClick={() => { const s = skip + LIMIT; setSkip(s); load(s, search) }} disabled={skip + LIMIT >= total}
                className="px-3 py-1 rounded border border-gisviz-border text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">Next →</button>
            </div>
          </div>
        </>
      )}
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────────────────────────────────────
function PostsPanel({ onError }: { onError: (e: string) => void }) {
  const [posts, setPosts]     = useState<any[]>([])
  const [total, setTotal]     = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [skip, setSkip]       = useState(0)
  const LIMIT = 20

  const load = useCallback(async (s = 0, q = '') => {
    setLoading(true)
    try {
      const res = await gisvizApi.fetchAllPosts(s, LIMIT, q || undefined)
      if (Array.isArray(res)) { setPosts(res); setTotal(res.length) }
      else { setPosts(res.posts || []); setTotal(res.total || 0) }
    } catch { onError('Failed to load posts') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const handleToggleStatus = async (postId: string, currentIsActive: number) => {
    const newStatus = currentIsActive === 1 ? false : true
    setBusy(`status-${postId}`)
    try {
      await gisvizApi.adminSetPostStatus(postId, newStatus)
      // optimistic local update — no full reload needed
      setPosts(prev => prev.map(p =>
        p.post_id === postId ? { ...p, is_active: newStatus ? 1 : 0 } : p
      ))
    } catch (e: any) {
      onError(e.response?.data?.detail || 'Status update failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel title="Posts" icon={<FileText size={14} />} count={total}
      actions={
        <div className="flex gap-2 items-center">
          <button onClick={() => load(skip, search)} title="Refresh"
            className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <form onSubmit={e => { e.preventDefault(); setSkip(0); load(0, search) }} className="flex gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title…"
                className="pl-8 pr-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none w-48" />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-gisviz-accent text-gisviz-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">Go</button>
          </form>
        </div>
      }
    >
      {loading ? <Spinner /> : (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gisviz-border bg-gisviz-canvas/30">
                <th className="px-6 py-2 text-left text-[11px] font-mono text-gisviz-ink-soft uppercase tracking-wider">Title</th>
                <th className="px-4 py-2 text-left text-[11px] font-mono text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Publisher</th>
                <th className="px-4 py-2 text-right text-[11px] font-mono text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Likes</th>
                <th className="px-4 py-2 text-center text-[11px] font-mono text-gisviz-ink-soft uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-right text-[11px] font-mono text-gisviz-ink-soft uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gisviz-border/50">
              {posts.length === 0
                ? <tr><td colSpan={5}><EmptyState text="No posts found." /></td></tr>
                : posts.map((p: any) => {
                  const isActive  = p.is_active !== 0  // treat missing field as active
                  const statusKey = `status-${p.post_id}`
                  const isBusy    = busy === statusKey || busy === p.post_id

                  return (
                    <tr key={p.post_id} className={`hover:bg-gisviz-canvas/30 transition-colors ${!isActive ? 'opacity-60' : ''}`}>

                      {/* Title */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {!isActive && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 uppercase shrink-0">
                              Inactive
                            </span>
                          )}
                          <Link href={`/post/${p.post_id}`} target="_blank"
                            className="text-gisviz-accent hover:underline flex items-center gap-1 line-clamp-1">
                            {p.title} <ExternalLink size={10} />
                          </Link>
                        </div>
                        <div className="text-[12px] text-gisviz-ink-soft mt-0.5">
                          {new Date(p.created_timestamp).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Publisher */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Link href={`/profile/${p.publisher_handle}`}
                          className="text-gisviz-ink hover:text-gisviz-accent transition-colors">
                          @{p.publisher_handle}
                        </Link>
                      </td>

                      {/* Likes */}
                      <td className="px-4 py-3 text-right text-gisviz-ink-soft hidden sm:table-cell">
                        {p.total_likes_count}
                      </td>

                      {/* Status toggle */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p.post_id, p.is_active ?? 1)}
                          disabled={isBusy}
                          title={isActive ? 'Click to deactivate' : 'Click to activate'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition-colors disabled:opacity-40 ${
                            isActive
                              ? 'bg-gisviz-safe/10 text-gisviz-safe/90 border-gisviz-safe/30 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-gisviz-safe/10 hover:text-gisviz-safe/90 hover:border-gisviz-safe/30'
                          }`}
                        >
                          {isBusy
                            ? <Loader2 size={11} className="animate-spin" />
                            : isActive
                              ? <ToggleRight size={13} />
                              : <ToggleLeft size={13} />
                          }
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/post/${p.post_id}/edit`}
                            className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-canvas transition-colors"
                            title="Edit">
                            <Edit2 size={14} />
                          </Link>
                          <ConfirmBtn
                            onConfirm={() => {
                              setBusy(p.post_id)
                              gisvizApi.adminDeletePost(p.post_id)
                                .then(() => load(skip, search))
                                .catch((e: any) => onError(e.response?.data?.detail || 'Delete failed'))
                                .finally(() => setBusy(null))
                            }}
                            busy={busy === p.post_id}
                          />
                        </div>
                      </td>

                    </tr>
                  )
                })
              }
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gisviz-border bg-gisviz-canvas/30">
            <span className="text-[12px] font-mono text-gisviz-ink-soft">
              {skip + 1}–{Math.min(skip + LIMIT, total || skip + posts.length)} of {total || '?'}
            </span>
            <div className="flex gap-2">
              <button onClick={() => { const s = Math.max(0, skip - LIMIT); setSkip(s); load(s, search) }}
                disabled={skip === 0}
                className="px-3 py-1 rounded border border-gisviz-border text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">
                ← Prev
              </button>
              <button onClick={() => { const s = skip + LIMIT; setSkip(s); load(s, search) }}
                disabled={skip + LIMIT >= total}
                className="px-3 py-1 rounded border border-gisviz-border text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS — unchanged from your current file
// ─────────────────────────────────────────────────────────────────────────────
function ReportsPanel({ onError }: { onError: (e: string) => void }) {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [filter, setFilter]   = useState<'all' | 'open' | 'resolved' | 'dismissed'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await gisvizApi.fetchReports()
      setReports(Array.isArray(res) ? res : (res?.reports || []))
    }
    catch { onError('Failed to load reports') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const act = async (key: string, fn: () => Promise<any>, reload = true) => {
    setBusy(key)
    try { await fn(); if (reload) await load() }
    catch (e: any) { onError(e?.response?.data?.detail || 'Action failed') }
    finally { setBusy(null) }
  }

  const safeReports = Array.isArray(reports) ? reports : []
  const visible = safeReports.filter(r => filter === 'all' || r.status === filter)

  return (
    <Panel title="Reports" icon={<Flag size={14} />} count={safeReports.length}
      actions={
        <div className="flex items-center gap-1 flex-wrap">
          {(['all', 'open', 'resolved', 'dismissed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-[12px] font-mono transition-colors capitalize ${
                filter === f ? 'bg-gisviz-accent text-white' : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'
              }`}>{f}</button>
          ))}
          <button onClick={load} title="Refresh"
            className="p-1.5 ml-1 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      }
    >
      {loading ? <Spinner />
        : visible.length === 0 ? <EmptyState text={filter === 'all' ? 'No reports yet.' : `No ${filter} reports.`} />
        : (
          <div className="divide-y divide-gisviz-border/50">
            {visible.map(r => (
              <ReportRow key={r.report_id} report={r} busy={busy}
                onResolve={() => act(`res-${r.report_id}`, () => gisvizApi.updateReportStatus(r.report_id, 'resolved'))}
                onDismiss={() => act(`dis-${r.report_id}`, () => gisvizApi.updateReportStatus(r.report_id, 'dismissed'))}
                onDeactivateUser={() => act(`deact-${r.reporter_user_id}`, () => gisvizApi.setUserStatus(r.reporter_user_id, false))}
                onDeletePost={() => act(`delpost-${r.post_id}`, () => gisvizApi.adminDeletePost(r.post_id))}
              />
            ))}
          </div>
        )
      }
    </Panel>
  )
}

function ReportRow({ report: r, busy, onResolve, onDismiss, onDeactivateUser, onDeletePost }: {
  report: any; busy: string | null
  onResolve: () => void; onDismiss: () => void; onDeactivateUser: () => void; onDeletePost: () => void
}) {
  const [confirmDeact, setConfirmDeact] = useState(false)
  const [confirmDel,   setConfirmDel]   = useState(false)
  const isBusy = (key: string) => busy === key

  return (
    <div className="px-5 py-4 hover:bg-gisviz-canvas/30 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <Flag size={14} className={`mt-0.5 shrink-0 ${r.status === 'open' ? 'text-yellow-500' : r.status === 'resolved' ? 'text-gisviz-safe/70' : 'text-gisviz-ink-soft'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge color={r.status}>{r.status}</Badge>
            <span className="text-[12px] font-mono text-gisviz-ink-soft">{new Date(r.created_timestamp).toLocaleDateString()}</span>
            {r.post_id && (
              <Link href={`/post/${r.post_id}`} target="_blank" className="text-[12px] font-mono text-gisviz-accent hover:underline flex items-center gap-0.5">
                View post <ExternalLink size={10} />
              </Link>
            )}
          </div>
          <p className="text-[12px] font-mono text-gisviz-ink"><span className="text-gisviz-ink-soft">Reason: </span>{r.reason}</p>
          {r.reporter_user_id && (
            <p className="text-[12px] font-mono text-gisviz-ink-soft mt-0.5">
              Reporter ID: <code className="text-gisviz-ink">{String(r.reporter_user_id).slice(0, 8)}…</code>
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap pl-[24px]">
        {r.status !== 'resolved' && (
          <button onClick={onResolve} disabled={!!busy}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-[12px] font-mono bg-gisviz-safe/10 text-gisviz-safe/90 border border-gisviz-safe/30 hover:bg-gisviz-safe/10 transition-colors disabled:opacity-40">
            {isBusy(`res-${r.report_id}`) ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Resolve
          </button>
        )}
        {r.status !== 'dismissed' && (
          <button onClick={onDismiss} disabled={!!busy}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-[12px] font-mono bg-gisviz-canvas text-gisviz-ink-soft border border-gisviz-border hover:text-gisviz-ink transition-colors disabled:opacity-40">
            {isBusy(`dis-${r.report_id}`) ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />} Dismiss
          </button>
        )}
        {r.reporter_user_id && (
          confirmDeact ? (
            <div className="flex items-center gap-1">
              <span className="text-[12px] font-mono text-gisviz-ink-soft">Deactivate reporter?</span>
              <button onClick={() => { setConfirmDeact(false); onDeactivateUser() }} disabled={!!busy}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-mono bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-gisviz-canvas/10 transition-colors disabled:opacity-40">
                {isBusy(`deact-${r.reporter_user_id}`) ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Yes
              </button>
              <button onClick={() => setConfirmDeact(false)}
                className="px-2 py-0.5 rounded text-[12px] font-mono bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDeact(true)} disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-[12px] font-mono bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-gisviz-canvas/10 transition-colors disabled:opacity-40">
              <ToggleLeft size={12} /> Deactivate User
            </button>
          )
        )}
        {r.post_id && (
          confirmDel ? (
            <div className="flex items-center gap-1">
              <span className="text-[12px] font-mono text-gisviz-ink-soft">Delete post?</span>
              <button onClick={() => { setConfirmDel(false); onDeletePost() }} disabled={!!busy}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-mono bg-gisviz-alert/50 text-gisviz-alert border border-gisviz-alert/50 hover:bg-gisviz-alert/30 transition-colors disabled:opacity-40">
                {isBusy(`delpost-${r.post_id}`) ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Yes, delete
              </button>
              <button onClick={() => setConfirmDel(false)}
                className="px-2 py-0.5 rounded text-[12px] font-mono bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-[12px] font-mono bg-gisviz-alert/10 text-gisviz-alert border border-gisviz-alert/50 hover:bg-gisviz-alert/30 transition-colors disabled:opacity-40">
              <Trash2 size={11} /> Delete Post
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS — unchanged from your current file
// ─────────────────────────────────────────────────────────────────────────────
function CommentsPanel({ onError }: { onError: (e: string) => void }) {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [skip, setSkip]       = useState(0)
  const LIMIT = 30

  const load = useCallback(async (s = 0, q = '') => {
    setLoading(true)
    try { setData(await gisvizApi.adminFetchComments(s, LIMIT, q || undefined)) }
    catch { onError('Failed to load comments') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const comments = data?.comments || []

  return (
    <Panel title="Comments" icon={<MessageSquare size={14} />} count={data?.total ?? '…'}
      actions={
        <div className="flex gap-2 items-center">
          <button onClick={() => load(skip, search)} title="Refresh"
            className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <form onSubmit={e => { e.preventDefault(); setSkip(0); load(0, search) }} className="flex gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search content…"
                className="pl-8 pr-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none w-48" />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-gisviz-accent text-gisviz-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">Go</button>
          </form>
        </div>
      }
    >
      {loading ? <Spinner /> : comments.length === 0 ? <EmptyState text="No comments found." /> : (
        <>
          <table className="w-full text-[12px] font-mono">
            <thead><tr className="border-b border-gisviz-border">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider">Content</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Post</th>
              <th className="px-4 py-3 w-14"></th>
            </tr></thead>
            <tbody className="divide-y divide-gisviz-border/50">
              {comments.map((c: any) => (
                <tr key={c.comment_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                  <td className="px-6 py-3">
                    <Link href={`/profile/${c.user_handle}`} className="text-gisviz-accent hover:underline">@{c.user_handle}</Link>
                    <div className="text-[12px] text-gisviz-ink-soft mt-0.5">{new Date(c.created_timestamp).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3 text-gisviz-ink-soft max-w-xs"><span className="line-clamp-2">{c.content}</span></td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Link href={`/post/${c.post_id}`} target="_blank" className="text-gisviz-ink-soft hover:text-gisviz-accent flex items-center gap-1">
                      Post <ExternalLink size={10} />
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ConfirmBtn
                      onConfirm={() => {
                        setBusy(c.comment_id)
                        gisvizApi.adminDeleteComment(c.comment_id)
                          .then(() => load(skip, search))
                          .catch((e: any) => onError(e.response?.data?.detail || 'Delete failed'))
                          .finally(() => setBusy(null))
                      }}
                      busy={busy === c.comment_id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-2 px-6 py-3 border-t border-gisviz-border bg-gisviz-canvas/30">
            <button onClick={() => { const s = Math.max(0, skip - LIMIT); setSkip(s); load(s, search) }} disabled={skip === 0}
              className="px-3 py-1 rounded border border-gisviz-border text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">← Prev</button>
            <button onClick={() => { const s = skip + LIMIT; setSkip(s); load(s, search) }} disabled={comments.length < LIMIT}
              className="px-3 py-1 rounded border border-gisviz-border text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">Next →</button>
          </div>
        </>
      )}
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// UNVERIFIED — unchanged from your current file
// ─────────────────────────────────────────────────────────────────────────────
function UnverifiedPanel({ onError }: { onError: (e: string) => void }) {
  const [users, setUsers]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  // null = no filter (show all), number = filter by age
  const [days, setDays]         = useState<number | null>(null)
 
  const load = useCallback(async (d: number | null = days) => {
    setLoading(true)
    try {
      // undefined → no query param → backend returns ALL unverified
      const result = await gisvizApi.adminFetchUnverified(d ?? undefined)
      setUsers(result)
    } catch {
      onError('Failed to load unverified users')
    } finally {
      setLoading(false)
    }
  }, [days, onError])
 
  useEffect(() => { load() }, [load])
 
  const handleVerify = (userId: string) => {
    setBusy(userId)
    gisvizApi.adminVerifyUser(userId)
      .then(() => load())
      .catch((e: any) => onError(e.response?.data?.detail || 'Verify failed'))
      .finally(() => setBusy(null))
  }
 
  const handleDelete = (userId: string) => {
    setBusy(userId)
    gisvizApi.deleteUser(userId)
      .then(() => load())
      .catch((e: any) => onError(e.response?.data?.detail || 'Delete failed'))
      .finally(() => setBusy(null))
  }
 
  const handleBulkDelete = async () => {
    setBulkBusy(true)
    try {
      const res = await gisvizApi.adminBulkDeleteUnverified(30)
      await load()
      // brief toast-style feedback via the error slot (reuse for success)
    } catch (e: any) {
      onError(e.response?.data?.detail || 'Bulk delete failed')
    } finally {
      setBulkBusy(false)
    }
  }
 
  const handleExport = () => {
    // triggers browser download — no UI state needed
    gisvizApi.adminExportUnverifiedCsv(days ?? undefined)
  }
 
  const DAY_OPTIONS: Array<{ label: string; value: number | null }> = [
    { label: 'All unverified',  value: null },
    { label: 'Older than 1 day',   value: 1  },
    { label: 'Older than 3 days',  value: 3  },
    { label: 'Older than 7 days',  value: 7  },
    { label: 'Older than 14 days', value: 14 },
    { label: 'Older than 30 days', value: 30 },
    { label: 'Older than 60 days', value: 60 },
  ]
 
  return (
    <Panel
      title="Unverified Users"
      icon={<UserX size={14} />}
      count={users.length}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
 
          {/* Age filter dropdown — "All unverified" is the default */}
          <select
            value={days === null ? '' : String(days)}
            onChange={e => {
              const val = e.target.value === '' ? null : Number(e.target.value)
              setDays(val)
              load(val)
            }}
            className="bg-gisviz-canvas border border-gisviz-border rounded px-2.5 py-1 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none"
          >
            {DAY_OPTIONS.map(opt => (
              <option key={String(opt.value)} value={opt.value === null ? '' : String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
 
          {/* Refresh */}
          <button
            onClick={() => load()}
            title="Refresh"
            className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
 
          {/* CSV export — always available when there's data */}
          {users.length > 0 && (
            <button
              onClick={handleExport}
              title="Download CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded text-[12px]  font-mono text-gisviz-ink hover:border-gisviz-accent transition-colors"
            >
              <Download size={13} />
              Export CSV
            </button>
          )}
 
          {/* Bulk delete — only shown when data is present */}
          {users.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gisviz-alert text-gisviz-white rounded text-[12px]  font-mono font-bold hover:bg-gisviz-alert/100 transition-colors disabled:opacity-50"
            >
              {bulkBusy
                ? <Loader2 size={12} className="animate-spin" />
                : <Trash2 size={12} />
              }
              Bulk delete (30+ days)
            </button>
          )}
        </div>
      }
    >
      {loading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState text={
          days === null
            ? 'No unverified accounts.'
            : `No unverified accounts older than ${days} day(s).`
        } />
      ) : (
        <table className="w-full text-[12px] font-mono">
          <thead>
            <tr className="border-b border-gisviz-border bg-gisviz-canvas/40">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Handle</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Email</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Role</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Registered</th>
              <th className="px-4 py-3 w-36"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gisviz-border/50">
            {users.map((u: any) => (
              <tr key={u.user_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                <td className="px-6 py-3 font-bold text-gisviz-ink">@{u.user_handle}</td>
                <td className="px-4 py-3 text-gisviz-ink-soft hidden sm:table-cell text-[12px] ">{u.email_address}</td>
                <td className="px-4 py-3 text-gisviz-ink-soft hidden md:table-cell text-[12px] ">
                  {u.role_name
                    ? <span className="px-1.5 py-0.5 bg-gisviz-canvas border border-gisviz-border rounded font-mono">{u.role_name}</span>
                    : <span className="opacity-40">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-gisviz-ink-soft hidden md:table-cell">
                  {new Date(u.created_timestamp).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => handleVerify(u.user_id)}
                      disabled={!!busy}
                      className="flex items-center gap-1 px-2 py-1 bg-gisviz-safe/10 text-gisviz-safe/90 border border-gisviz-safe/30 rounded text-[12px]  font-mono hover:bg-gisviz-safe/10 transition-colors disabled:opacity-50"
                    >
                      {busy === u.user_id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Check size={11} />
                      }
                      Verify
                    </button>
                    <ConfirmBtn
                      onConfirm={() => handleDelete(u.user_id)}
                      busy={busy === u.user_id}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
 
      {/* Footer row — record count + export reminder */}
      {!loading && users.length > 0 && (
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-gisviz-border bg-gisviz-canvas/30">
          <span className="text-[12px]  font-mono text-gisviz-ink-soft">
            {users.length} unverified account{users.length !== 1 ? 's' : ''}
            {days !== null ? ` older than ${days} day${days !== 1 ? 's' : ''}` : ' total'}
          </span>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 text-[12px]  font-mono text-gisviz-ink-soft hover:text-gisviz-accent transition-colors"
          >
            <Download size={12} /> Download CSV
          </button>
        </div>
      )}
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT TICKETS — renamed from SupportPopup, fully wired to tickets tab
// ─────────────────────────────────────────────────────────────────────────────

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

function TicketsPanel({ onError }: { onError: (e: string) => void }) {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [filter, setFilter]   = useState<'all' | TicketStatus>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await gisvizApi.adminFetchTickets()
      setTickets(Array.isArray(res) ? res : (res?.tickets || []))
    } catch { onError('Failed to load support tickets') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const act = async (key: string, fn: () => Promise<any>) => {
    setBusy(key)
    try { await fn(); await load() }
    catch (e: any) { onError(e?.response?.data?.detail || 'Action failed') }
    finally { setBusy(null) }
  }

  const safeTickets = Array.isArray(tickets) ? tickets : []
  const visible = safeTickets.filter(t => filter === 'all' || t.status === filter)

  return (
    <Panel title="Support Tickets" icon={<LifeBuoy size={14} />} count={safeTickets.length}
      actions={
        <div className="flex items-center gap-1 flex-wrap">
          {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-[12px]  font-mono transition-colors capitalize ${
                filter === f
                  ? 'bg-gisviz-accent text-white'
                  : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'
              }`}>
              {f.replace('_', ' ')}
            </button>
          ))}
          <button onClick={load} title="Refresh"
            className="p-1.5 ml-1 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      }
    >
      {loading ? <Spinner />
        : visible.length === 0
        ? <EmptyState text={`No ${filter === 'all' ? '' : filter.replace('_', ' ') + ' '}tickets.`} />
        : (
          <div className="overflow-x-auto pb-4">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gisviz-border/50 bg-gisviz-canvas/30 text-[12px]  font-mono text-gisviz-ink-soft uppercase tracking-wider">
                  <th className="p-4 font-medium w-1/3">Issue & Details</th>
                  <th className="p-4 font-medium w-1/4">Contact Info</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gisviz-border/50">
                {visible.map(t => (
                  <TicketRow key={t.ticket_id} ticket={t} busy={busy}
                    onStatusChange={(status: TicketStatus) =>
                      act(`status-${t.ticket_id}`, () =>
                        gisvizApi.adminUpdateTicketStatus(t.ticket_id, status)
                      )
                    }
                    onDelete={() =>
                      act(`del-${t.ticket_id}`, () =>
                        gisvizApi.adminDeleteTicket(t.ticket_id)
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </Panel>
  )
}

function TicketRow({ ticket: t, busy, onStatusChange, onDelete }: {
  ticket: any
  busy: string | null
  onStatusChange: (s: TicketStatus) => void
  onDelete: () => void
}) {
  const [statusOpen, setStatusOpen] = useState(false)
  const isBusy = (key: string) => busy === key

  const STATUS_OPTIONS: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed']

  return (
    <tr className="hover:bg-gisviz-canvas/40 transition-colors group">
      
      {/* Issue & Details */}
      <td className="p-4 align-top">
        <p className="text-[12px] font-bold text-gisviz-ink mb-1">{t.subject}</p>
        <p className="text-[12px] font-mono text-gisviz-ink-soft line-clamp-2 leading-relaxed" title={t.description}>
          {t.description}
        </p>
        <p className="text-[12px] font-mono text-gisviz-ink-soft mt-2">
          {new Date(t.created_timestamp).toLocaleString()}
        </p>
      </td>

      {/* Contact Info */}
      <td className="p-4 align-top">
        {t.user_handle ? (
          <Link href={`/profile/${t.user_handle}`} className="inline-flex items-center gap-1 text-[12px] font-mono font-bold text-gisviz-accent hover:underline">
            @{t.user_handle}
          </Link>
        ) : (
          <span className="text-[12px] font-mono text-gisviz-ink-soft italic">Anonymous visitor</span>
        )}
        {t.contact_email && (
          <p className="text-[12px]  font-mono text-gisviz-ink mt-1 break-all">
            {t.contact_email}
          </p>
        )}
      </td>

      {/* Category */}
      <td className="p-4 align-top">
        <span className="text-[12px]  font-mono px-2 py-1 bg-gisviz-canvas border border-gisviz-border rounded capitalize text-gisviz-ink-soft whitespace-nowrap shadow-sm">
          {t.category?.replace('_', ' ')}
        </span>
      </td>

      {/* Status Badge */}
      <td className="p-4 align-top">
        <Badge color={t.status}>{t.status.replace('_', ' ')}</Badge>
      </td>

      {/* Hover Actions */}
      <td className="p-4 align-top text-right">
        <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          
          {/* Status dropdown */}
          <div className="relative">
            <button onClick={() => setStatusOpen(o => !o)} disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px]  font-mono bg-gisviz-canvas border border-gisviz-border text-gisviz-ink hover:border-gisviz-accent transition-colors disabled:opacity-40 whitespace-nowrap">
              {isBusy(`status-${t.ticket_id}`) ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
              Status
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-gisviz-card border border-gisviz-border rounded-md shadow-lg z-20 py-1 text-left">
                {STATUS_OPTIONS.filter(s => s !== t.status).map(s => (
                  <button key={s} onClick={() => { setStatusOpen(false); onStatusChange(s) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px]  font-mono text-gisviz-ink hover:bg-gisviz-canvas capitalize transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      s === 'open'        ? 'bg-yellow-500' :
                      s === 'in_progress' ? 'bg-blue-500'   :
                      s === 'resolved'    ? 'bg-gisviz-safe/50'  : 'bg-gisviz-ink-soft'
                    }`} />
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick resolve shortcut */}
          {(t.status === 'open' || t.status === 'in_progress') && (
            <button onClick={() => onStatusChange('resolved')} disabled={!!busy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px]  font-mono bg-gisviz-safe/10 text-gisviz-safe/90 border border-gisviz-safe/30 hover:bg-gisviz-safe/10 transition-colors disabled:opacity-40">
              {isBusy(`status-${t.ticket_id}`) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Resolve
            </button>
          )}

          {/* Delete */}
          <ConfirmBtn onConfirm={onDelete} busy={isBusy(`del-${t.ticket_id}`)} />
        </div>
      </td>

    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES — kept in file (used as fallback / reference) but tab renders
// AccessControlPanel (imported) which supersedes this.
// This component is intentionally not rendered by the tab switch above.
// ─────────────────────────────────────────────────────────────────────────────
const PERM_KEYS: { key: string; label: string; desc: string }[] = [
  { key: 'admin',        label: 'Admin Panel',      desc: '/admin/* pages' },
  { key: 'publish',      label: 'Publish Posts',     desc: 'Create & edit own posts' },
  { key: 'moderate',     label: 'Moderate Content',  desc: 'Delete comments, resolve reports' },
  { key: 'manage_tags',  label: 'Manage Categories', desc: 'Approve / reject suggestions' },
  { key: 'view_reports', label: 'View Reports',      desc: 'Read access to reports tab' },
]