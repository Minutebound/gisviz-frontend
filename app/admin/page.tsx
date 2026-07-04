'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, Tag, Users, Hash, FileText, Flag,
  Plus, Trash2, Edit2, X, Check, Loader2, Search,
  ChevronDown, ToggleLeft, ToggleRight, ExternalLink,
  RefreshCw, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../services/api'
import AccessRestricted from '../components/AccessRestricted'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'categories' | 'users' | 'keywords' | 'posts' | 'reports'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'categories', label: 'Categories',  icon: <Tag size={15} /> },
  { id: 'users',      label: 'Users',       icon: <Users size={15} /> },
  { id: 'keywords',   label: 'Keywords',    icon: <Hash size={15} /> },
  { id: 'posts',      label: 'Posts',       icon: <FileText size={15} /> },
  { id: 'reports',    label: 'Reports',     icon: <Flag size={15} /> },
]

const ROLES = ['viewer', 'publisher', 'editor', 'support', 'admin']

// ─── Shared sub-components ────────────────────────────────────────────────────
const Badge = ({ children, color = 'default' }: { children: React.ReactNode; color?: string }) => {
  const colours: Record<string, string> = {
    admin:     'bg-red-100 text-red-700 border-red-200',
    editor:    'bg-purple-100 text-purple-700 border-purple-200',
    publisher: 'bg-blue-100 text-blue-700 border-blue-200',
    support:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    viewer:    'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border',
    active:    'bg-green-100 text-green-700 border-green-200',
    inactive:  'bg-red-50 text-red-500 border-red-200',
    pending:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    resolved:  'bg-green-100 text-green-700 border-green-200',
    dismissed: 'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border',
    default:   'bg-gisviz-canvas text-gisviz-ink border-gisviz-border',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${colours[color as string] || colours.default}`}>
      {children}
    </span>
  )
}

const ConfirmBtn = ({ onConfirm, label = 'Delete', busy }: { onConfirm: () => void; label?: string; busy?: boolean }) => {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) return (
    <button onClick={() => setConfirming(true)} className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-alert hover:bg-red-50 transition-colors" title={label}>
      <Trash2 size={14} />
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => { onConfirm(); setConfirming(false) }} disabled={busy} className="p-1 rounded bg-gisviz-alert text-white hover:bg-red-700 transition-colors disabled:opacity-50">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button onClick={() => setConfirming(false)} className="p-1 rounded bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
        <X size={12} />
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()

  const [activeTab, setActiveTab]     = useState<Tab>('categories')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [pageError, setPageError]     = useState('')

  // Redirect if not auth
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

  const activeTabMeta = TABS.find(t => t.id === activeTab)!

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
            <ShieldCheck className="text-gisviz-accent" size={28} />
            Admin Panel
          </h1>
          <p className="text-gisviz-ink-soft font-mono text-[12px] mt-1">
            Platform management — restricted to <Badge color="admin">admin</Badge>
          </p>
        </div>

        {/* Tab dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(p => !p)}
            className="flex items-center gap-2 bg-gisviz-card border border-gisviz-border px-4 py-2.5 rounded-md font-mono text-[12px] text-gisviz-ink shadow-sm hover:border-gisviz-accent transition-colors min-w-[160px] justify-between"
          >
            <span className="flex items-center gap-2">{activeTabMeta.icon} {activeTabMeta.label}</span>
            <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-gisviz-card border border-gisviz-border rounded-md shadow-lg z-20 py-1 overflow-hidden">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setDropdownOpen(false) }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-[12px] font-mono transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gisviz-accent/10 text-gisviz-accent font-bold'
                      : 'text-gisviz-ink hover:bg-gisviz-canvas'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {pageError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-[12px] font-mono text-gisviz-alert flex items-center justify-between">
          {pageError}
          <button onClick={() => setPageError('')}><X size={14} /></button>
        </div>
      )}

      {/* Tab panels */}
      {activeTab === 'categories' && <CategoriesPanel onError={setPageError} />}
      {activeTab === 'users'      && <UsersPanel      onError={setPageError} />}
      {activeTab === 'keywords'   && <KeywordsPanel   onError={setPageError} />}
      {activeTab === 'posts'      && <PostsPanel      onError={setPageError} />}
      {activeTab === 'reports'    && <ReportsPanel    onError={setPageError} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CategoriesPanel({ onError }: { onError: (e: string) => void }) {
  const [cats, setCats]         = useState<any[]>([])
  const [pending, setPending]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
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

  const handleCreate = async () => {
    if (!newLabel.trim() || !newSlug.trim()) return
    setBusy('create')
    try {
      await gisvizApi.createCategory(newLabel, newSlug)
      setNewLabel(''); setNewSlug(''); setShowAdd(false)
      await load()
    } catch (e: any) { onError(e.response?.data?.detail || 'Create failed') }
    finally { setBusy(null) }
  }

  const handleUpdate = async (id: number) => {
    setBusy(String(id))
    try {
      await gisvizApi.updateCategory(id, editLabel, editSlug)
      setEditingId(null)
      await load()
    } catch (e: any) { onError(e.response?.data?.detail || 'Update failed') }
    finally { setBusy(null) }
  }

  const handleDelete = async (id: number) => {
    setBusy(String(id))
    try { await gisvizApi.deleteCategory(id); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Delete failed') }
    finally { setBusy(null) }
  }

  const handleApprove = async (id: string) => {
    setBusy(id)
    try { await gisvizApi.approvePendingCategory(id); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Approve failed') }
    finally { setBusy(null) }
  }

  const handleReject = async (id: string) => {
    setBusy(id)
    try { await gisvizApi.rejectPendingCategory(id); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Reject failed') }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-6">
      {/* Active categories */}
      <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/50">
          <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest flex items-center gap-2">
            <Tag size={14} className="text-gisviz-accent" /> Active Categories ({cats.length})
          </h2>
          <div className="flex gap-2">
            <button onClick={load} className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors" title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button onClick={() => setShowAdd(p => !p)} className="flex items-center gap-1 px-3 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/30 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-mono text-gisviz-ink-soft mb-1 uppercase">Label</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Remote Sensing"
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded px-3 py-1.5 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-mono text-gisviz-ink-soft mb-1 uppercase">Slug</label>
              <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="e.g. remote-sensing"
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded px-3 py-1.5 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none" />
            </div>
            <button onClick={handleCreate} disabled={busy === 'create' || !newLabel || !newSlug}
              className="flex items-center gap-1 px-4 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold disabled:opacity-50 hover:bg-opacity-90 transition-colors">
              {busy === 'create' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Create
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gisviz-accent" /></div>
        ) : (
          <table className="w-full text-[12px] font-mono">
            <thead><tr className="border-b border-gisviz-border">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Label</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Slug</th>
              <th className="text-right px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Usage</th>
              <th className="px-4 py-3 w-24"></th>
            </tr></thead>
            <tbody className="divide-y divide-gisviz-border/50">
              {cats.map(cat => (
                <tr key={cat.category_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                  <td className="px-6 py-3">
                    {editingId === cat.category_id ? (
                      <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                        className="w-full bg-gisviz-canvas border border-gisviz-accent rounded px-2 py-1 text-[12px] font-mono text-gisviz-ink outline-none" />
                    ) : (
                      <span className="text-gisviz-ink font-medium">{cat.label}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gisviz-ink-soft hidden sm:table-cell">
                    {editingId === cat.category_id ? (
                      <input value={editSlug} onChange={e => setEditSlug(e.target.value)}
                        className="w-full bg-gisviz-canvas border border-gisviz-accent rounded px-2 py-1 text-[12px] font-mono text-gisviz-ink outline-none" />
                    ) : cat.slug}
                  </td>
                  <td className="px-4 py-3 text-right text-gisviz-ink-soft hidden md:table-cell">{cat.usage_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === cat.category_id ? (
                        <>
                          <button onClick={() => handleUpdate(cat.category_id)} disabled={busy === String(cat.category_id)}
                            className="p-1.5 rounded bg-gisviz-accent text-white hover:bg-opacity-90 transition-colors disabled:opacity-50">
                            {busy === String(cat.category_id) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => { setEditingId(cat.category_id); setEditLabel(cat.label); setEditSlug(cat.slug) }}
                          className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-canvas transition-colors">
                          <Edit2 size={14} />
                        </button>
                      )}
                      <ConfirmBtn onConfirm={() => handleDelete(cat.category_id)} busy={busy === String(cat.category_id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending suggestions */}
      {pending.length > 0 && (
        <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/50">
            <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-500" /> Pending Suggestions ({pending.length})
            </h2>
          </div>
          <table className="w-full text-[12px] font-mono">
            <thead><tr className="border-b border-gisviz-border">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Label</th>
              <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Slug</th>
              <th className="px-4 py-3 w-32"></th>
            </tr></thead>
            <tbody className="divide-y divide-gisviz-border/50">
              {pending.map(p => (
                <tr key={p.pending_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                  <td className="px-6 py-3 text-gisviz-ink font-medium">{p.label}</td>
                  <td className="px-4 py-3 text-gisviz-ink-soft hidden sm:table-cell">{p.normalized_slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleApprove(p.pending_id)} disabled={busy === p.pending_id}
                        className="flex items-center gap-1 px-2 py-1 bg-gisviz-safe/10 text-gisviz-safe border border-gisviz-safe/30 rounded text-[11px] font-mono hover:bg-gisviz-safe/20 transition-colors disabled:opacity-50">
                        {busy === p.pending_id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
                      </button>
                      <button onClick={() => handleReject(p.pending_id)} disabled={busy === p.pending_id}
                        className="flex items-center gap-1 px-2 py-1 bg-red-50 text-gisviz-alert border border-red-200 rounded text-[11px] font-mono hover:bg-red-100 transition-colors disabled:opacity-50">
                        <X size={11} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function UsersPanel({ onError }: { onError: (e: string) => void }) {
  const { user: me } = useAuth() as any
  const [users, setUsers]   = useState<any[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [skip, setSkip]     = useState(0)
  const LIMIT = 20

  const load = useCallback(async (s = skip, q = search) => {
    setLoading(true)
    try {
      const res = await gisvizApi.fetchAllUsers(s, LIMIT, q || undefined)
      setUsers(res.users); setTotal(res.total)
    } catch { onError('Failed to load users') }
    finally { setLoading(false) }
  }, [skip, search, onError])

  useEffect(() => { load() }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); setSkip(0); load(0, search)
  }

  const handleRoleChange = async (userId: string, role: string) => {
    setBusy(userId)
    try { await gisvizApi.updateUserRole(userId, role); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Role update failed') }
    finally { setBusy(null) }
  }

  const handleToggleStatus = async (userId: string, isActive: boolean) => {
    setBusy(userId)
    try { await gisvizApi.setUserStatus(userId, !isActive); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Status update failed') }
    finally { setBusy(null) }
  }

  const handleDelete = async (userId: string) => {
    setBusy(userId)
    try { await gisvizApi.deleteUser(userId); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Delete failed') }
    finally { setBusy(null) }
  }

  return (
    <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/50 flex-wrap gap-3">
        <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest flex items-center gap-2">
          <Users size={14} className="text-gisviz-accent" /> Users ({total})
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search handle or email…"
              className="pl-8 pr-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none w-56" />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gisviz-accent" /></div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] font-mono min-w-[640px]">
              <thead><tr className="border-b border-gisviz-border">
                <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Handle</th>
                <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider">Role</th>
                <th className="text-center px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 w-20"></th>
              </tr></thead>
              <tbody className="divide-y divide-gisviz-border/50">
                {users.map(u => (
                  <tr key={u.user_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                    <td className="px-6 py-3">
                      <Link href={`/profile/${u.user_handle}`} className="text-gisviz-accent hover:underline flex items-center gap-1">
                        @{u.user_handle} <ExternalLink size={10} />
                      </Link>
                      <div className="text-[10px] text-gisviz-ink-soft mt-0.5">{u.post_count} posts · {u.follower_count} followers</div>
                    </td>
                    <td className="px-4 py-3 text-gisviz-ink-soft hidden md:table-cell">{u.email_address}</td>
                    <td className="px-4 py-3">
                      {u.user_id === me?.user_id ? (
                        <Badge color="admin">admin (you)</Badge>
                      ) : (
                        <select
                          value={u.role_name}
                          onChange={e => handleRoleChange(u.user_id, e.target.value)}
                          disabled={!!busy}
                          className="bg-gisviz-canvas border border-gisviz-border rounded px-2 py-1 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none disabled:opacity-50"
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(u.user_id, u.is_active)}
                        disabled={!!busy || u.user_id === me?.user_id}
                        className="disabled:opacity-40 transition-colors"
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {busy === u.user_id
                          ? <Loader2 size={18} className="animate-spin text-gisviz-ink-soft" />
                          : u.is_active
                            ? <ToggleRight size={20} className="text-gisviz-safe" />
                            : <ToggleLeft  size={20} className="text-gisviz-ink-soft" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {u.user_id !== me?.user_id && (
                        <ConfirmBtn onConfirm={() => handleDelete(u.user_id)} busy={busy === u.user_id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gisviz-border bg-gisviz-canvas/30">
            <span className="text-[11px] font-mono text-gisviz-ink-soft">
              Showing {skip + 1}–{Math.min(skip + LIMIT, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button onClick={() => { setSkip(Math.max(0, skip - LIMIT)); load(Math.max(0, skip - LIMIT)) }}
                disabled={skip === 0} className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">
                ← Prev
              </button>
              <button onClick={() => { setSkip(skip + LIMIT); load(skip + LIMIT) }}
                disabled={skip + LIMIT >= total} className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORDS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function KeywordsPanel({ onError }: { onError: (e: string) => void }) {
  const [data, setData]     = useState<{ total: number; keywords: any[] } | null>(null)
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

  const handleDelete = async (id: number) => {
    setBusy(id)
    try { await gisvizApi.deleteKeyword(id); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Delete failed') }
    finally { setBusy(null) }
  }

  const filtered = (data?.keywords || []).filter(k =>
    !filter || k.word.includes(filter.toLowerCase())
  )

  return (
    <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/50 flex-wrap gap-3">
        <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest flex items-center gap-2">
          <Hash size={14} className="text-gisviz-accent" /> Keywords ({data?.total ?? '…'})
        </h2>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
              className="pl-8 pr-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none w-44" />
          </div>
          <button onClick={load} className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors"><RefreshCw size={14} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gisviz-accent" /></div>
      ) : (
        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            {filtered.map(kw => (
              <div key={kw.keyword_id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded-full font-mono text-[12px] text-gisviz-ink group">
                <Hash size={11} className="text-gisviz-ink-soft" />
                <span>{kw.word}</span>
                <span className="text-gisviz-ink-soft text-[10px]">({kw.usage_count})</span>
                <ConfirmBtn onConfirm={() => handleDelete(kw.keyword_id)} busy={busy === kw.keyword_id} />
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-[12px] font-mono text-gisviz-ink-soft">No keywords match.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function PostsPanel({ onError }: { onError: (e: string) => void }) {
  const [posts, setPosts]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [skip, setSkip]     = useState(0)
  const LIMIT = 20

  const load = useCallback(async (s = skip, q = search) => {
    setLoading(true)
    try { setPosts(await gisvizApi.fetchAllPosts(s, LIMIT, q || undefined)) }
    catch { onError('Failed to load posts') }
    finally { setLoading(false) }
  }, [skip, search, onError])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    setBusy(id)
    try { await gisvizApi.adminDeletePost(id); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Delete failed') }
    finally { setBusy(null) }
  }

  return (
    <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/50 flex-wrap gap-3">
        <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest flex items-center gap-2">
          <FileText size={14} className="text-gisviz-accent" /> Posts
        </h2>
        <form onSubmit={e => { e.preventDefault(); setSkip(0); load(0, search) }} className="flex gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title…"
              className="pl-8 pr-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none w-56" />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-gisviz-accent text-white rounded text-[12px] font-mono font-bold hover:bg-opacity-90 transition-colors">Search</button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gisviz-accent" /></div>
      ) : (
        <table className="w-full text-[12px] font-mono">
          <thead><tr className="border-b border-gisviz-border">
            <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Title</th>
            <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Publisher</th>
            <th className="text-right px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Likes</th>
            <th className="px-4 py-3 w-24"></th>
          </tr></thead>
          <tbody className="divide-y divide-gisviz-border/50">
            {posts.map((p: any) => (
              <tr key={p.post_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                <td className="px-6 py-3">
                  <Link href={`/post/${p.post_id}`} target="_blank" className="text-gisviz-accent hover:underline flex items-center gap-1 line-clamp-1">
                    {p.title} <ExternalLink size={10} />
                  </Link>
                  <div className="text-[10px] text-gisviz-ink-soft mt-0.5">
                    {new Date(p.created_timestamp).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Link href={`/profile/${p.publisher_handle}`} className="text-gisviz-ink hover:text-gisviz-accent transition-colors">
                    @{p.publisher_handle}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-gisviz-ink-soft hidden sm:table-cell">{p.total_likes_count}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/post/edit/${p.post_id}`}
                      className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-canvas transition-colors" title="Edit">
                      <Edit2 size={14} />
                    </Link>
                    <ConfirmBtn onConfirm={() => handleDelete(p.post_id)} busy={busy === p.post_id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gisviz-border bg-gisviz-canvas/30">
        <button onClick={() => { setSkip(Math.max(0, skip - LIMIT)); load(Math.max(0, skip - LIMIT)) }}
          disabled={skip === 0} className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">
          ← Prev
        </button>
        <button onClick={() => { setSkip(skip + LIMIT); load(skip + LIMIT) }}
          disabled={posts.length < LIMIT} className="px-3 py-1 rounded border border-gisviz-border text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-40 transition-colors">
          Next →
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ReportsPanel({ onError }: { onError: (e: string) => void }) {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [filter, setFilter]   = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { setReports(await gisvizApi.fetchReports()) }
    catch { onError('Failed to load reports') }
    finally { setLoading(false) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const handleStatus = async (id: string, status: 'resolved' | 'dismissed') => {
    setBusy(id)
    try { await gisvizApi.updateReportStatus(id, status); await load() }
    catch (e: any) { onError(e.response?.data?.detail || 'Update failed') }
    finally { setBusy(null) }
  }

  const visible = reports.filter(r => filter === 'all' || r.status === filter)

  return (
    <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/50 flex-wrap gap-3">
        <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest flex items-center gap-2">
          <Flag size={14} className="text-gisviz-accent" /> Reports ({reports.length})
        </h2>
        <div className="flex gap-1">
          {(['all', 'pending', 'resolved', 'dismissed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-[11px] font-mono transition-colors ${
                filter === f
                  ? 'bg-gisviz-accent text-white'
                  : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'
              }`}>
              {f}
            </button>
          ))}
          <button onClick={load} className="p-1.5 rounded hover:bg-gisviz-canvas text-gisviz-ink-soft hover:text-gisviz-ink transition-colors ml-1"><RefreshCw size={14} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gisviz-accent" /></div>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center text-[12px] font-mono text-gisviz-ink-soft">No reports match this filter.</div>
      ) : (
        <table className="w-full text-[12px] font-mono">
          <thead><tr className="border-b border-gisviz-border">
            <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Post</th>
            <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Reason</th>
            <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Status</th>
            <th className="px-4 py-3 w-40"></th>
          </tr></thead>
          <tbody className="divide-y divide-gisviz-border/50">
            {visible.map((r: any) => (
              <tr key={r.report_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                <td className="px-6 py-3">
                  <Link href={`/post/${r.post_id}`} target="_blank" className="text-gisviz-accent hover:underline flex items-center gap-1">
                    View Post <ExternalLink size={10} />
                  </Link>
                  <div className="text-[10px] text-gisviz-ink-soft mt-0.5">
                    {new Date(r.created_timestamp).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-gisviz-ink-soft hidden md:table-cell max-w-xs">
                  <span className="line-clamp-2">{r.reason}</span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <Badge color={r.status}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  {r.status === 'pending' && (
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handleStatus(r.report_id, 'resolved')} disabled={busy === r.report_id}
                        className="flex items-center gap-1 px-2 py-1 bg-gisviz-safe/10 text-gisviz-safe border border-gisviz-safe/30 rounded text-[11px] font-mono hover:bg-gisviz-safe/20 transition-colors disabled:opacity-50">
                        {busy === r.report_id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Resolve
                      </button>
                      <button onClick={() => handleStatus(r.report_id, 'dismissed')} disabled={busy === r.report_id}
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
      )}
    </div>
  )
}