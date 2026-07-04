'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, Tag, Users, Hash, FileText, Flag,
  MessageSquare, UserX, KeyRound, Plus, Trash2,
  Edit2, X, Check, Loader2, Search, ChevronDown,
  ToggleLeft, ToggleRight, ExternalLink, RefreshCw,
  AlertTriangle, ArrowUpRight, Save, Shield,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'
import AccessRestricted from '../../components/AccessRestricted'

type Tab = 'categories' | 'users' | 'keywords' | 'posts' | 'reports' | 'comments' | 'unverified' | 'roles'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'categories', label: 'Categories', icon: <Tag size={14} /> },
  { id: 'users',      label: 'Users',      icon: <Users size={14} /> },
  { id: 'keywords',   label: 'Keywords',   icon: <Hash size={14} /> },
  { id: 'posts',      label: 'Posts',      icon: <FileText size={14} /> },
  { id: 'reports',    label: 'Reports',    icon: <Flag size={14} /> },
  { id: 'comments',   label: 'Comments',   icon: <MessageSquare size={14} /> },
  { id: 'unverified', label: 'Unverified', icon: <UserX size={14} /> },
  { id: 'roles',      label: 'Roles',      icon: <KeyRound size={14} /> },
]

const ALL_ROLES = ['viewer', 'publisher', 'editor', 'support', 'admin']

// ─── Shared micro-components ──────────────────────────────────────────────────

const Badge = ({ children, color = 'default' }: { children: React.ReactNode; color?: string }) => {
  const cls: Record<string, string> = {
    admin:     'bg-red-100 text-red-700 border-red-200',
    editor:    'bg-purple-100 text-purple-700 border-purple-200',
    publisher: 'bg-blue-100 text-blue-700 border-blue-200',
    support:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    viewer:    'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border',
    open:      'bg-yellow-100 text-yellow-700 border-yellow-200',
    resolved:  'bg-green-100 text-green-700 border-green-200',
    dismissed: 'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border',
    default:   'bg-gisviz-canvas text-gisviz-ink border-gisviz-border',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${cls[color as string] || cls.default}`}>
      {children}
    </span>
  )
}

// Two-step confirm delete button — each instance has its own local state
// so one confirmation never accidentally triggers another row's delete.
function ConfirmBtn({ onConfirm, busy }: { onConfirm: () => void; busy?: boolean }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) return (
    <button onClick={() => setConfirming(true)}
      className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-alert hover:bg-red-50 transition-colors" title="Delete">
      <Trash2 size={14} />
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => { onConfirm(); setConfirming(false) }} disabled={busy}
        className="p-1 rounded bg-gisviz-alert text-white hover:bg-red-700 transition-colors disabled:opacity-50">
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
  title: string; icon: React.ReactNode; count?: number | string;
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
  <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gisviz-accent" /></div>
)

// ─── Page root ────────────────────────────────────────────────────────────────

export default function AdminControlPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<Tab>('categories')
  const [ddOpen, setDdOpen]       = useState(false)
  const [globalErr, setGlobalErr] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth')
  }, [authLoading, isAuthenticated, router])

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
        <div className="flex items-center gap-3">
          <Link href="/admin/analytics"
            className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
            <ArrowUpRight size={14} /> Analytics
          </Link>
          <div className="relative">
            <button onClick={() => setDdOpen(p => !p)}
              className="flex items-center gap-2 bg-gisviz-card border border-gisviz-border px-4 py-2 rounded-md font-mono text-[12px] text-gisviz-ink shadow-sm hover:border-gisviz-accent transition-colors min-w-[160px] justify-between">
              <span className="flex items-center gap-2">{meta.icon} {meta.label}</span>
              <ChevronDown size={13} className={`transition-transform ${ddOpen ? 'rotate-180' : ''}`} />
            </button>
            {ddOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-gisviz-card border border-gisviz-border rounded-md shadow-lg z-30 py-1 overflow-hidden">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setDdOpen(false) }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-[12px] font-mono transition-colors ${
                      activeTab === tab.id ? 'bg-gisviz-accent/10 text-gisviz-accent font-bold' : 'text-gisviz-ink hover:bg-gisviz-canvas'
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-[12px] font-mono text-gisviz-alert flex items-center justify-between">
          {globalErr}
          <button onClick={() => setGlobalErr('')}><X size={14} /></button>
        </div>
      )}

      {activeTab === 'categories' && <CategoriesPanel onError={setGlobalErr} />}
      {activeTab === 'users'      && <UsersPanel      onError={setGlobalErr} adminUser={user} />}
      {activeTab === 'keywords'   && <KeywordsPanel   onError={setGlobalErr} />}
      {activeTab === 'posts'      && <PostsPanel      onError={setGlobalErr} />}
      {activeTab === 'reports'    && <ReportsPanel    onError={setGlobalErr} />}
      {activeTab === 'comments'   && <CommentsPanel   onError={setGlobalErr} />}
      {activeTab === 'unverified' && <UnverifiedPanel onError={setGlobalErr} />}
      {activeTab === 'roles'      && <RolesPanel      onError={setGlobalErr} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
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
              className="flex items-center gap-1 px-3 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">
              <Plus size={13} /> Add
            </button>
          </>
        }
      >
        {showAdd && (
          <div className="px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/30 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[11px] font-mono text-gisviz-ink-soft mb-1 uppercase">Label</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Remote Sensing"
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded px-3 py-1.5 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none" />
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[11px] font-mono text-gisviz-ink-soft mb-1 uppercase">Slug</label>
              <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="remote-sensing"
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded px-3 py-1.5 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none" />
            </div>
            <button
              onClick={() => act('create', async () => { await gisvizApi.createCategory(newLabel, newSlug); setNewLabel(''); setNewSlug(''); setShowAdd(false) })}
              disabled={busy === 'create' || !newLabel || !newSlug}
              className="flex items-center gap-1 px-4 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold disabled:opacity-50 hover:bg-opacity-90 transition-colors">
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
                            className="p-1.5 rounded bg-gisviz-accent text-white hover:bg-opacity-90 disabled:opacity-50 transition-colors">
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
                        className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-[11px] font-mono hover:bg-green-100 transition-colors disabled:opacity-50">
                        {busy === p.pending_id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
                      </button>
                      <button onClick={() => act(`rej-${p.pending_id}`, () => gisvizApi.rejectPendingCategory(p.pending_id))} disabled={!!busy}
                        className="flex items-center gap-1 px-2 py-1 bg-red-50 text-gisviz-alert border border-red-200 rounded text-[11px] font-mono hover:bg-red-100 transition-colors disabled:opacity-50">
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
// USERS
// ─────────────────────────────────────────────────────────────────────────────
function UsersPanel({ onError, adminUser }: { onError: (e: string) => void; adminUser: any }) {
  const [users, setUsers]   = useState<any[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [skip, setSkip]     = useState(0)
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
            <button type="submit" className="px-3 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">Go</button>
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
                      <div className="text-[10px] text-gisviz-ink-soft mt-0.5">{u.post_count} posts · {u.follower_count} followers</div>
                    </td>
                    <td className="px-4 py-3 text-gisviz-ink-soft hidden lg:table-cell text-[11px]">{u.email_address}</td>
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
                            ? <ToggleRight size={20} className="text-green-600" />
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
            <span className="text-[11px] font-mono text-gisviz-ink-soft">
              {skip + 1}–{Math.min(skip + LIMIT, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button onClick={() => { const s = Math.max(0, skip - LIMIT); setSkip(s); load(s, search) }} disabled={skip === 0}
                className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">← Prev</button>
              <button onClick={() => { const s = skip + LIMIT; setSkip(s); load(s, search) }} disabled={skip + LIMIT >= total}
                className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">Next →</button>
            </div>
          </div>
        </>
      )}
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORDS
// ─────────────────────────────────────────────────────────────────────────────
function KeywordsPanel({ onError }: { onError: (e: string) => void }) {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState<number | null>(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await gisvizApi.fetchAllKeywords()) }
    catch { onError('Failed to load keywords') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const filtered = (data?.keywords || []).filter((k: any) =>
    !filter || k.word.includes(filter.toLowerCase())
  )

  return (
    <Panel title="Keywords" icon={<Hash size={14} />} count={data?.total ?? '…'}
      actions={
        <div className="flex gap-2 items-center">
          <button onClick={load} title="Refresh"
            className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
              className="pl-8 pr-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none w-40" />
          </div>
        </div>
      }
    >
      {loading ? <Spinner /> : (
        <div className="p-6">
          {filtered.length === 0
            ? <EmptyState text="No keywords match." />
            : (
              <div className="flex flex-wrap gap-2">
                {filtered.map((kw: any) => (
                  <div key={kw.keyword_id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded-full font-mono text-[12px] text-gisviz-ink">
                    <Hash size={10} className="text-gisviz-ink-soft shrink-0" />
                    <span>{kw.word}</span>
                    <span className="text-gisviz-ink-soft text-[10px]">({kw.usage_count})</span>
                    <ConfirmBtn
                      onConfirm={() => {
                        setBusy(kw.keyword_id)
                        gisvizApi.deleteKeyword(kw.keyword_id)
                          .then(load)
                          .catch((e: any) => onError(e.response?.data?.detail || 'Delete failed'))
                          .finally(() => setBusy(null))
                      }}
                      busy={busy === kw.keyword_id}
                    />
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────────────────────────────────────
function PostsPanel({ onError }: { onError: (e: string) => void }) {
  const [posts, setPosts]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [skip, setSkip]     = useState(0)
  const LIMIT = 20

  const load = useCallback(async (s = 0, q = '') => {
    setLoading(true)
    try { setPosts(await gisvizApi.fetchAllPosts(s, LIMIT, q || undefined)) }
    catch { onError('Failed to load posts') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  return (
    <Panel title="Posts" icon={<FileText size={14} />}
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
            <button type="submit" className="px-3 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">Go</button>
          </form>
        </div>
      }
    >
      {loading ? <Spinner /> : (
        <>
          <table className="w-full text-[12px] font-mono">
            <thead><tr className="border-b border-gisviz-border">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Publisher</th>
              <th className="text-right px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Likes</th>
              <th className="px-4 py-3 w-20"></th>
            </tr></thead>
            <tbody className="divide-y divide-gisviz-border/50">
              {posts.length === 0
                ? <tr><td colSpan={4}><EmptyState text="No posts found." /></td></tr>
                : posts.map((p: any) => (
                  <tr key={p.post_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                    <td className="px-6 py-3">
                      <Link href={`/post/${p.post_id}`} target="_blank" className="text-gisviz-accent hover:underline flex items-center gap-1 line-clamp-1">
                        {p.title} <ExternalLink size={10} />
                      </Link>
                      <div className="text-[10px] text-gisviz-ink-soft mt-0.5">{new Date(p.created_timestamp).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Link href={`/profile/${p.publisher_handle}`} className="text-gisviz-ink hover:text-gisviz-accent transition-colors">
                        @{p.publisher_handle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-gisviz-ink-soft hidden sm:table-cell">{p.total_likes_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* ↓ FIX: correct edit URL /post/edit/[id] not /post/[id]/edit */}
                        <Link href={`/post/edit/${p.post_id}`}
                          className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-canvas transition-colors" title="Edit">
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
                ))
              }
            </tbody>
          </table>
          <div className="flex justify-end gap-2 px-6 py-3 border-t border-gisviz-border bg-gisviz-canvas/30">
            <button onClick={() => { const s = Math.max(0, skip - LIMIT); setSkip(s); load(s, search) }} disabled={skip === 0}
              className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">← Prev</button>
            <button onClick={() => { const s = skip + LIMIT; setSkip(s); load(s, search) }} disabled={posts.length < LIMIT}
              className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">Next →</button>
          </div>
        </>
      )}
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────
function ReportsPanel({ onError }: { onError: (e: string) => void }) {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [filter, setFilter]   = useState<'all' | 'open' | 'resolved' | 'dismissed'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { setReports(await gisvizApi.fetchReports()) }
    catch { onError('Failed to load reports') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const act = (id: string, status: string) => {
    setBusy(id)
    gisvizApi.updateReportStatus(id, status as any)
      .then(load)
      .catch((e: any) => onError(e.response?.data?.detail || 'Failed'))
      .finally(() => setBusy(null))
  }

  const visible = reports.filter(r => filter === 'all' || r.status === filter)

  return (
    <Panel title="Reports" icon={<Flag size={14} />} count={reports.length}
      actions={
        <div className="flex gap-1 items-center flex-wrap">
          {(['all', 'open', 'resolved', 'dismissed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
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
      {loading ? <Spinner /> : visible.length === 0
        ? <EmptyState text="No reports match this filter." />
        : (
          <table className="w-full text-[12px] font-mono">
            <thead><tr className="border-b border-gisviz-border">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Post</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Reason</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Status</th>
              <th className="px-4 py-3 w-44"></th>
            </tr></thead>
            <tbody className="divide-y divide-gisviz-border/50">
              {visible.map((r: any) => (
                <tr key={r.report_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                  <td className="px-6 py-3">
                    <Link href={`/post/${r.post_id}`} target="_blank" className="text-gisviz-accent hover:underline flex items-center gap-1">
                      View Post <ExternalLink size={10} />
                    </Link>
                    <div className="text-[10px] text-gisviz-ink-soft mt-0.5">{new Date(r.created_timestamp).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3 text-gisviz-ink-soft hidden md:table-cell max-w-xs">
                    <span className="line-clamp-2">{r.reason}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Badge color={r.status}>{r.status}</Badge></td>
                  <td className="px-4 py-3">
                    {r.status === 'open' && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => act(r.report_id, 'resolved')} disabled={!!busy}
                          className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-[11px] font-mono hover:bg-green-100 transition-colors disabled:opacity-50">
                          {busy === r.report_id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Resolve
                        </button>
                        <button onClick={() => act(r.report_id, 'dismissed')} disabled={!!busy}
                          className="flex items-center gap-1 px-2 py-1 bg-gisviz-canvas border border-gisviz-border rounded text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink transition-colors disabled:opacity-50">
                          <X size={11} /> Dismiss
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────────────────────────────────────
function CommentsPanel({ onError }: { onError: (e: string) => void }) {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [skip, setSkip]     = useState(0)
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
            <button type="submit" className="px-3 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">Go</button>
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
                    <div className="text-[10px] text-gisviz-ink-soft mt-0.5">{new Date(c.created_timestamp).toLocaleDateString()}</div>
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
              className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">← Prev</button>
            <button onClick={() => { const s = skip + LIMIT; setSkip(s); load(s, search) }} disabled={comments.length < LIMIT}
              className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">Next →</button>
          </div>
        </>
      )}
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// UNVERIFIED  — no sort, refresh button fetches from DB
// ─────────────────────────────────────────────────────────────────────────────
function UnverifiedPanel({ onError }: { onError: (e: string) => void }) {
  const [users, setUsers]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState<string | null>(null)
  const [days, setDays]         = useState(7)
  const [bulkBusy, setBulkBusy] = useState(false)

  // load is stable — only recreated when days or onError changes
  const load = useCallback(async (d?: number) => {
    setLoading(true)
    try {
      const result = await gisvizApi.adminFetchUnverified(d ?? days)
      setUsers(result)
    } catch { onError('Failed to load unverified users') }
    finally { setLoading(false) }
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
    try { await gisvizApi.adminBulkDeleteUnverified(30); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Bulk delete failed') }
    finally { setBulkBusy(false) }
  }

  return (
    <Panel title="Unverified Users" icon={<UserX size={14} />} count={users.length}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh button — calls load() directly, always fresh from DB */}
          <button onClick={() => load()} title="Refresh from DB"
            className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-mono text-gisviz-ink-soft whitespace-nowrap">Older than</label>
            <select
              value={days}
              onChange={e => {
                const d = Number(e.target.value)
                setDays(d)
                load(d)   // ← immediately reload with new day filter
              }}
              className="bg-gisviz-canvas border border-gisviz-border rounded px-2 py-1 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none">
              {[1, 3, 7, 14, 30, 60].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          {users.length > 0 && (
            <button onClick={handleBulkDelete} disabled={bulkBusy}
              className="flex items-center gap-1 px-3 py-1.5 bg-gisviz-alert text-white rounded text-[11px] font-mono font-bold hover:bg-red-700 transition-colors disabled:opacity-50">
              {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Bulk Delete (30+ days)
            </button>
          )}
        </div>
      }
    >
      {loading ? <Spinner /> : users.length === 0
        ? <EmptyState text={`No unverified accounts older than ${days} day(s).`} />
        : (
          <table className="w-full text-[12px] font-mono">
            <thead><tr className="border-b border-gisviz-border">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Handle</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Email</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Registered</th>
              <th className="px-4 py-3 w-36"></th>
            </tr></thead>
            <tbody className="divide-y divide-gisviz-border/50">
              {users.map((u: any) => (
                <tr key={u.user_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                  <td className="px-6 py-3 font-medium text-gisviz-ink">@{u.user_handle}</td>
                  <td className="px-4 py-3 text-gisviz-ink-soft hidden sm:table-cell text-[11px]">{u.email_address}</td>
                  <td className="px-4 py-3 text-gisviz-ink-soft hidden md:table-cell">{new Date(u.created_timestamp).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handleVerify(u.user_id)} disabled={!!busy}
                        className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-[11px] font-mono hover:bg-green-100 transition-colors disabled:opacity-50">
                        {busy === u.user_id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Verify
                      </button>
                      <ConfirmBtn onConfirm={() => handleDelete(u.user_id)} busy={busy === u.user_id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES  — live permission toggles saved to DB immediately
// ─────────────────────────────────────────────────────────────────────────────

// These permission keys map directly to what the backend checks.
// Toggling them here → PUT /admin/roles/{id} → DB updated → 
// next time that user's JWT is refreshed they get the new permissions.
const PERM_KEYS: { key: string; label: string; desc: string }[] = [
  { key: 'admin',        label: 'Admin Panel',         desc: '/admin/* pages' },
  { key: 'publish',      label: 'Publish Posts',        desc: 'Create & edit own posts' },
  { key: 'moderate',     label: 'Moderate Content',     desc: 'Delete comments, resolve reports' },
  { key: 'manage_tags',  label: 'Manage Categories',    desc: 'Approve / reject suggestions' },
  { key: 'view_reports', label: 'View Reports',         desc: 'Read access to reports tab' },
]

function RolesPanel({ onError }: { onError: (e: string) => void }) {
  const [roles, setRoles]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)  // "roleId:permKey"
  const [delBusy, setDelBusy] = useState<number | null>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPerms, setNewPerms] = useState<Record<string, boolean>>({})
  const [createBusy, setCreateBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRoles(await gisvizApi.adminFetchRoles()) }
    catch { onError('Failed to load roles') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  // Toggle a permission and save immediately — no separate Save button needed
  const togglePermission = async (role: any, permKey: string) => {
    const savingKey = `${role.role_id}:${permKey}`
    setSaving(savingKey)
    const updated = { ...role.permissions, [permKey]: !role.permissions[permKey] }
    try {
      await gisvizApi.adminUpdateRole(role.role_id, role.name, updated)
      // Update local state immediately — no need to reload everything
      setRoles(prev => prev.map(r =>
        r.role_id === role.role_id ? { ...r, permissions: updated } : r
      ))
    } catch (e: any) {
      onError(e.response?.data?.detail || 'Failed to update permission')
    } finally {
      setSaving(null)
    }
  }

  const handleRename = async (role: any, newNameVal: string) => {
    setSaving(`${role.role_id}:name`)
    try {
      await gisvizApi.adminUpdateRole(role.role_id, newNameVal, role.permissions)
      setEditing(null)
      await load()
    } catch (e: any) { onError(e.response?.data?.detail || 'Rename failed') }
    finally { setSaving(null) }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreateBusy(true)
    try {
      await gisvizApi.adminCreateRole(newName.trim().toLowerCase(), newPerms)
      setShowNew(false); setNewName(''); setNewPerms({})
      await load()
    } catch (e: any) { onError(e.response?.data?.detail || 'Create failed') }
    finally { setCreateBusy(false) }
  }

  const handleDelete = async (id: number) => {
    setDelBusy(id)
    try { await gisvizApi.adminDeleteRole(id); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Delete failed') }
    finally { setDelBusy(null) }
  }

  return (
    <div className="space-y-6">
      {/* ── Role permission matrix ── */}
      <Panel title="Role Permissions" icon={<KeyRound size={14} />}
        actions={
          <div className="flex gap-2 items-center">
            <button onClick={load} title="Refresh from DB"
              className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowNew(p => !p)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">
              <Plus size={13} /> New Role
            </button>
          </div>
        }
      >
        {showNew && (
          <div className="px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/30 space-y-3">
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-[11px] font-mono text-gisviz-ink-soft mb-1 uppercase">Role Name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. moderator"
                  className="bg-gisviz-canvas border border-gisviz-border rounded px-3 py-1.5 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {PERM_KEYS.map(p => (
                <label key={p.key} className="flex items-start gap-2 cursor-pointer group">
                  <input type="checkbox" checked={!!newPerms[p.key]}
                    onChange={() => setNewPerms(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                    className="mt-0.5 accent-gisviz-accent" />
                  <div>
                    <p className="text-[12px] font-mono text-gisviz-ink group-hover:text-gisviz-accent transition-colors">{p.label}</p>
                    <p className="text-[10px] font-mono text-gisviz-ink-soft">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={createBusy || !newName.trim()}
                className="flex items-center gap-1 px-4 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold disabled:opacity-50 hover:bg-opacity-90 transition-colors">
                {createBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Create
              </button>
              <button onClick={() => { setShowNew(false); setNewName(''); setNewPerms({}) }}
                className="px-4 py-1.5 rounded border border-gisviz-border text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] font-mono min-w-[560px]">
              <thead>
                <tr className="border-b border-gisviz-border bg-gisviz-canvas/30">
                  <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Role</th>
                  {PERM_KEYS.map(p => (
                    <th key={p.key} className="px-3 py-3 text-center">
                      <div className="text-[10px] font-mono text-gisviz-ink-soft uppercase tracking-wider">{p.label}</div>
                      <div className="text-[9px] font-mono text-gisviz-border">{p.desc}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gisviz-border/50">
                {roles.map(role => (
                  <tr key={role.role_id} className="hover:bg-gisviz-canvas/20 transition-colors">
                    <td className="px-6 py-4">
                      {editing?.role_id === role.role_id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editing.name}
                            onChange={e => setEditing({ ...editing, name: e.target.value })}
                            className="bg-gisviz-canvas border border-gisviz-accent rounded px-2 py-1 text-[12px] font-mono text-gisviz-ink outline-none w-28"
                          />
                          <button onClick={() => handleRename(role, editing.name)}
                            disabled={saving === `${role.role_id}:name`}
                            className="p-1 rounded bg-gisviz-accent text-white hover:bg-opacity-90 disabled:opacity-50">
                            {saving === `${role.role_id}:name` ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          </button>
                          <button onClick={() => setEditing(null)} className="p-1 rounded border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink">
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gisviz-ink capitalize">{role.name}</span>
                          <Badge color="default">{role.user_count}</Badge>
                          {['admin', 'viewer'].includes(role.name) && <Badge color="admin">system</Badge>}
                        </div>
                      )}
                    </td>
                    {PERM_KEYS.map(p => {
                      const hasPerm = !!role.permissions[p.key]
                      const isSaving = saving === `${role.role_id}:${p.key}`
                      const isSystem = ['admin', 'viewer'].includes(role.name) && p.key === 'admin'
                      return (
                        <td key={p.key} className="px-3 py-4 text-center">
                          <button
                            onClick={() => !isSystem && togglePermission(role, p.key)}
                            disabled={isSaving || isSystem}
                            title={isSystem ? 'Cannot remove admin permission from admin role' : (hasPerm ? `Remove ${p.label}` : `Grant ${p.label}`)}
                            className={`mx-auto flex items-center justify-center w-8 h-8 rounded-full transition-all disabled:cursor-not-allowed ${
                              isSystem
                                ? 'bg-gisviz-accent/20 text-gisviz-accent cursor-not-allowed'
                                : hasPerm
                                  ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-gisviz-alert'
                                  : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-border hover:border-gisviz-accent hover:text-gisviz-accent'
                            }`}
                          >
                            {isSaving
                              ? <Loader2 size={12} className="animate-spin" />
                              : hasPerm
                                ? <Check size={13} />
                                : <X size={13} />
                            }
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        {!['admin', 'viewer'].includes(role.name) && (
                          <>
                            <button onClick={() => setEditing({ ...role })}
                              className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-canvas transition-colors">
                              <Edit2 size={13} />
                            </button>
                            <ConfirmBtn
                              onConfirm={() => handleDelete(role.role_id)}
                              busy={delBusy === role.role_id}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── How permissions work note ── */}
      <div className="bg-gisviz-canvas border border-gisviz-border rounded-sm px-5 py-4 text-[12px] font-mono text-gisviz-ink-soft space-y-1">
        <p className="text-gisviz-ink font-bold mb-2 flex items-center gap-2"><Shield size={13} /> How role permissions take effect</p>
        <p>• Clicking a permission cell saves it to the DB immediately — no extra Save button needed.</p>
        <p>• Users with that role see the change on their <strong>next login</strong> or when their session token is refreshed.</p>
        <p>• <strong>admin</strong> and <strong>viewer</strong> are system roles — their core permissions cannot be removed.</p>
        <p>• To apply changes to an already-logged-in admin session, use the browser's logout → login flow.</p>
      </div>
    </div>
  )
}