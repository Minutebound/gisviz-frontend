'use client'

/**
 * app/admin/control/AccessControlPanel.tsx
 *
 * Replaces the old RolesPanel in the "Roles" tab of /admin/control.
 * Three stacked sections:
 *
 *   1. Roles          — full CRUD (create / rename / delete) + user counts
 *   2. Page access    — pages × roles matrix (derived from permissions)
 *   3. Permissions    — roles × permission-keys matrix (live toggle, as before)
 *
 * Design principle: a PAGE requires a PERMISSION; a ROLE grants PERMISSIONS.
 * Section 2 is therefore read-derived from section 3 — never a second source
 * of truth. Editing a role's permissions (section 3) updates the page matrix
 * (section 2) automatically on the next refresh.
 *
 * Wire-up in app/admin/control/page.tsx:
 *   import AccessControlPanel from './AccessControlPanel'
 *   ...in the tab switch, replace <RolesPanel .../> with:
 *   {activeTab === 'roles' && <AccessControlPanel onError={setGlobalErr} />}
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Shield, KeyRound, Layers, Plus, Trash2, Edit2, X, Check,
  Loader2, Save, Lock, FileText,
} from 'lucide-react'
import { gisvizApi } from '../../../services/api'

// ── types ─────────────────────────────────────────────────────────────
type Role = { role_id: number; name: string; permissions: Record<string, boolean>; user_count: number }
type PermDef = { key: string; label: string; desc: string }
type PageDef = { key: string; label: string; path: string; required_permission: string | null; description: string }
type MatrixRole = { role_id: number; name: string; user_count: number }
type MatrixPage = PageDef & { access: Record<number, boolean> }

const SYSTEM_ROLES = ['admin', 'viewer']

// ── shared bits (match control page styling) ──────────────────────────
const Panel = ({ icon, title, count, actions, children }: {
  icon: React.ReactNode; title: string; count?: number | string;
  actions?: React.ReactNode; children: React.ReactNode
}) => (
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

const Spinner = () => (
  <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gisviz-accent" /></div>
)

// ── main ──────────────────────────────────────────────────────────────
export default function AccessControlPanel({ onError }: { onError: (e: string) => void }) {
  const [roles, setRoles]       = useState<Role[]>([])
  const [perms, setPerms]       = useState<PermDef[]>([])
  const [pages, setPages]       = useState<MatrixPage[]>([])
  const [matrixRoles, setMatrixRoles] = useState<MatrixRole[]>([])
  const [loading, setLoading]   = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, pagesRes, matrixRes] = await Promise.all([
        gisvizApi.adminFetchRoles(),
        gisvizApi.adminFetchAccessPages(),
        gisvizApi.adminFetchAccessMatrix(),
      ])
      setRoles(rolesRes)
      setPerms(pagesRes.permissions)
      setPages(matrixRes.pages)
      setMatrixRoles(matrixRes.roles)
    } catch {
      onError('Failed to load access-control data')
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <RolesSection roles={roles} onError={onError} onChanged={loadAll} />
      <PageAccessSection pages={pages} roles={matrixRoles} />
      <PermissionsSection roles={roles} perms={perms} onError={onError} onChanged={loadAll} />

      {/* explainer */}
      <div className="bg-gisviz-canvas border border-gisviz-border rounded-sm px-5 py-4 text-[12px] font-mono text-gisviz-ink-soft space-y-1">
        <p className="text-gisviz-ink font-bold mb-2 flex items-center gap-2"><Shield size={13} /> How access control works</p>
        <p>• A <strong>page</strong> requires a <strong>permission</strong>; a <strong>role</strong> grants permissions.</p>
        <p>• The <strong>Page access</strong> grid is derived — edit a role's permissions below and it updates on refresh.</p>
        <p>• <strong>admin</strong> is a superuser permission: it satisfies every page automatically.</p>
        <p>• <strong>admin</strong> and <strong>viewer</strong> are system roles and cannot be deleted.</p>
        <p>• Changes apply to a user on their <strong>next login</strong> / token refresh.</p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 1 — Roles: full CRUD + user counts
// ══════════════════════════════════════════════════════════════════════
function RolesSection({ roles, onError, onChanged }: {
  roles: Role[]; onError: (e: string) => void; onChanged: () => void
}) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName]   = useState('')
  const [rowBusy, setRowBusy]     = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const create = async () => {
    if (!newName.trim()) return
    setCreateBusy(true)
    try {
      await gisvizApi.adminCreateRole(newName.trim().toLowerCase(), {})
      setNewName(''); setShowNew(false); onChanged()
    } catch (e: any) {
      onError(e?.response?.data?.detail || 'Create role failed')
    } finally { setCreateBusy(false) }
  }

  const rename = async (role: Role) => {
    if (!editName.trim()) return
    setRowBusy(role.role_id)
    try {
      await gisvizApi.adminUpdateRole(role.role_id, editName.trim().toLowerCase(), role.permissions)
      setEditingId(null); onChanged()
    } catch (e: any) {
      onError(e?.response?.data?.detail || 'Rename failed')
    } finally { setRowBusy(null) }
  }

  const remove = async (role: Role) => {
    setRowBusy(role.role_id)
    try {
      await gisvizApi.adminDeleteRole(role.role_id)
      setConfirmId(null); onChanged()
    } catch (e: any) {
      onError(e?.response?.data?.detail || 'Delete failed')
    } finally { setRowBusy(null) }
  }

  return (
    <Panel
      icon={<KeyRound size={13} />}
      title="Roles"
      count={roles.length}
      actions={
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gisviz-accent/10 text-gisviz-accent border border-gisviz-accent/30 rounded font-mono text-[11px] hover:bg-gisviz-accent/20 transition-colors">
          <Plus size={13} /> New Role
        </button>
      }
    >
      {showNew && (
        <div className="px-6 py-4 border-b border-gisviz-border bg-gisviz-canvas/30 flex items-center gap-2 flex-wrap">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="role name (e.g. curator)"
            className="flex-1 min-w-[180px] px-3 py-1.5 bg-gisviz-card border border-gisviz-border rounded font-mono text-[12px] text-gisviz-ink focus:border-gisviz-accent outline-none" />
          <button onClick={create} disabled={createBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded font-mono text-[11px] hover:bg-green-100 transition-colors disabled:opacity-50">
            {createBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Create
          </button>
          <button onClick={() => { setShowNew(false); setNewName('') }}
            className="p-1.5 text-gisviz-ink-soft hover:text-gisviz-ink"><X size={14} /></button>
        </div>
      )}

      <table className="w-full text-[12px] font-mono">
        <thead><tr className="border-b border-gisviz-border">
          <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Role</th>
          <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider">Users</th>
          <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden sm:table-cell">Type</th>
          <th className="px-4 py-3 w-28"></th>
        </tr></thead>
        <tbody className="divide-y divide-gisviz-border/50">
          {roles.map(role => {
            const isSystem = SYSTEM_ROLES.includes(role.name)
            const isEditing = editingId === role.role_id
            return (
              <tr key={role.role_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                <td className="px-6 py-3">
                  {isEditing ? (
                    <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && rename(role)}
                      className="px-2 py-1 bg-gisviz-card border border-gisviz-accent rounded font-mono text-[12px] text-gisviz-ink outline-none w-40" />
                  ) : (
                    <span className="font-bold text-gisviz-ink">{role.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gisviz-ink-soft">{role.user_count}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                    isSystem
                      ? 'bg-gisviz-accent/10 text-gisviz-accent border-gisviz-accent/20'
                      : 'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border'}`}>
                    {isSystem ? 'system' : 'custom'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {isEditing ? (
                      <>
                        <button onClick={() => rename(role)} disabled={rowBusy === role.role_id}
                          className="p-1.5 rounded text-green-600 hover:bg-green-50">
                          {rowBusy === role.role_id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-ink"><X size={13} /></button>
                      </>
                    ) : !isSystem ? (
                      <>
                        <button onClick={() => { setEditingId(role.role_id); setEditName(role.name) }}
                          className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-canvas transition-colors">
                          <Edit2 size={13} />
                        </button>
                        {confirmId === role.role_id ? (
                          <button onClick={() => remove(role)} disabled={rowBusy === role.role_id}
                            className="flex items-center gap-1 px-2 py-1 bg-red-50 text-gisviz-alert border border-red-200 rounded text-[11px] hover:bg-red-100 transition-colors">
                            {rowBusy === role.role_id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Sure?
                          </button>
                        ) : (
                          <button onClick={() => setConfirmId(role.role_id)}
                            className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-alert hover:bg-red-50 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </>
                    ) : (
                      <Lock size={13} className="text-gisviz-ink-soft/40" />
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 2 — Page access matrix (derived, read-only)
// ══════════════════════════════════════════════════════════════════════
function PageAccessSection({ pages, roles }: { pages: MatrixPage[]; roles: MatrixRole[] }) {
  return (
    <Panel icon={<Layers size={13} />} title="Page Access" count={pages.length}>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] font-mono">
          <thead><tr className="border-b border-gisviz-border">
            <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Page</th>
            <th className="text-left px-4 py-3 text-gisviz-ink-soft uppercase tracking-wider hidden md:table-cell">Requires</th>
            {roles.map(r => (
              <th key={r.role_id} className="px-3 py-3 text-center text-gisviz-ink-soft uppercase tracking-wider">{r.name}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-gisviz-border/50">
            {pages.map(page => (
              <tr key={page.key} className="hover:bg-gisviz-canvas/30 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-gisviz-ink-soft/50 shrink-0" />
                    <div>
                      <p className="font-bold text-gisviz-ink">{page.label}</p>
                      <p className="text-[10px] text-gisviz-ink-soft">{page.path}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {page.required_permission ? (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gisviz-canvas text-gisviz-ink-soft border border-gisviz-border">
                      {page.required_permission}
                    </span>
                  ) : (
                    <span className="text-gisviz-ink-soft/50 text-[11px]">any user</span>
                  )}
                </td>
                {roles.map(r => (
                  <td key={r.role_id} className="px-3 py-3 text-center">
                    {page.access[r.role_id] ? (
                      <Check size={14} className="inline text-green-600" />
                    ) : (
                      <X size={14} className="inline text-gisviz-border" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 border-t border-gisviz-border bg-gisviz-canvas/30 text-[11px] font-mono text-gisviz-ink-soft">
        Derived from role permissions below — read-only. To change access, toggle the role's permission.
      </div>
    </Panel>
  )
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 3 — Permissions matrix (live toggle, saves immediately)
// ══════════════════════════════════════════════════════════════════════
function PermissionsSection({ roles, perms, onError, onChanged }: {
  roles: Role[]; perms: PermDef[]; onError: (e: string) => void; onChanged: () => void
}) {
  const [saving, setSaving] = useState<string | null>(null)  // "roleId:permKey"

  const toggle = async (role: Role, permKey: string) => {
    // admin role's admin permission is locked on
    if (role.name === 'admin' && permKey === 'admin') return
    const key = `${role.role_id}:${permKey}`
    setSaving(key)
    const updated = { ...role.permissions, [permKey]: !role.permissions[permKey] }
    try {
      await gisvizApi.adminUpdateRole(role.role_id, role.name, updated)
      onChanged()   // reload so the page matrix above stays in sync
    } catch (e: any) {
      onError(e?.response?.data?.detail || 'Permission update failed')
    } finally { setSaving(null) }
  }

  return (
    <Panel icon={<Shield size={13} />} title="Permissions" count={`${roles.length}×${perms.length}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] font-mono">
          <thead><tr className="border-b border-gisviz-border">
            <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider">Role</th>
            {perms.map(p => (
              <th key={p.key} className="px-3 py-3 text-center text-gisviz-ink-soft uppercase tracking-wider" title={p.desc}>
                {p.label}
              </th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-gisviz-border/50">
            {roles.map(role => (
              <tr key={role.role_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                <td className="px-6 py-3 font-bold text-gisviz-ink">{role.name}</td>
                {perms.map(p => {
                  const hasPerm = role.permissions?.[p.key] === true
                  const locked  = role.name === 'admin' && p.key === 'admin'
                  const isSaving = saving === `${role.role_id}:${p.key}`
                  return (
                    <td key={p.key} className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggle(role, p.key)}
                        disabled={locked || isSaving}
                        title={locked ? 'Admin role always has admin permission'
                          : hasPerm ? `Remove ${p.label}` : `Grant ${p.label}`}
                        className={`mx-auto flex items-center justify-center w-8 h-8 rounded-full transition-all disabled:cursor-not-allowed ${
                          locked
                            ? 'bg-gisviz-accent/20 text-gisviz-accent cursor-not-allowed'
                            : hasPerm
                              ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-gisviz-alert'
                              : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-border hover:border-gisviz-accent hover:text-gisviz-accent'
                        }`}>
                        {isSaving ? <Loader2 size={12} className="animate-spin" />
                          : hasPerm ? <Check size={13} /> : <X size={13} />}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}