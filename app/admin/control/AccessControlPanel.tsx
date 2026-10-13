'use client'

/**
 * app/admin/control/AccessControlPanel.tsx
 *
 * "Roles" tab of /admin/control — ONE table:
 *   rows    = roles   (create / rename / delete, user count, system badge)
 *   columns = pages   (from the backend PAGE_REGISTRY) + any permission no page uses
 *   cells   = does this role get through that page? Click a cell to grant / revoke the
 *             permission that page requires (saved immediately).
 *
 * A PAGE requires a PERMISSION; a ROLE grants PERMISSIONS. Pages that share a permission
 * (e.g. Create + Edit Publication both need "publish") change together, and the cell tooltip says so.
 * admin is a superuser: its row is locked on, and "admin"-only pages can't be granted to other roles.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Shield, KeyRound, Layers, Plus, Trash2, Edit2, X, Check,
  Loader2, Save, Lock, FileText,
} from 'lucide-react'
import { gisvizApi } from '../../../connector/api'

// ── types ─────────────────────────────────────────────────────────────
type Role = { role_id: number; name: string; permissions: Record<string, boolean>; user_count: number }
type PermDef = { key: string; label: string; desc: string }
type PageDef = { key: string; label: string; path: string; required_permission: string | null; description: string }
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
  const [roles, setRoles]   = useState<Role[]>([])
  const [perms, setPerms]   = useState<PermDef[]>([])
  const [pages, setPages]   = useState<MatrixPage[]>([])
  const [loading, setLoading] = useState(true)

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
      <RolesAccessTable roles={roles} perms={perms} pages={pages} onError={onError} onChanged={loadAll} />

      <div className="bg-gisviz-canvas border border-gisviz-border rounded-sm px-5 py-4 text-[12px] font-mono text-gisviz-ink-soft space-y-1">
        <p className="text-gisviz-ink font-bold mb-2 flex items-center gap-2"><Shield size={13} /> How to read this table</p>
        <p>• Each <strong>row</strong> is a role, each <strong>column</strong> is a page. A tick means the role can open that page.</p>
        <p>• The small tag under a page name is the <strong>permission</strong> it requires. Click a cell to grant or revoke that permission for the role.</p>
        <p>• Pages sharing a permission change together (the tooltip lists them). Columns under <strong>Other permissions</strong> are not tied to a page.</p>
        <p>• <strong>admin</strong> is a superuser: its row is locked on, and admin-only pages cannot be granted to other roles.</p>
        <p>• <strong>admin</strong> and <strong>viewer</strong> are system roles and cannot be deleted. Changes apply on a user&apos;s next login / token refresh.</p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// The single roles × pages table
// ══════════════════════════════════════════════════════════════════════
function RolesAccessTable({ roles, perms, pages, onError, onChanged }: {
  roles: Role[]; perms: PermDef[]; pages: MatrixPage[]
  onError: (e: string) => void; onChanged: () => void
}) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName]   = useState('')
  const [rowBusy, setRowBusy]     = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [saving, setSaving]       = useState<string | null>(null)   // "roleId:permKey"

  // permissions no page uses -> shown as extra columns so every permission stays editable
  const usedPerms = new Set(pages.map(p => p.required_permission).filter(Boolean) as string[])
  const otherPerms = perms.filter(p => !usedPerms.has(p.key))

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

  const toggle = async (role: Role, permKey: string) => {
    const key = `${role.role_id}:${permKey}`
    setSaving(key)
    const updated = { ...role.permissions, [permKey]: !role.permissions?.[permKey] }
    try {
      await gisvizApi.adminUpdateRole(role.role_id, role.name, updated)
      onChanged()
    } catch (e: any) {
      onError(e?.response?.data?.detail || 'Permission update failed')
    } finally { setSaving(null) }
  }

  // One clickable cell. `locked` = cannot be changed (admin row, admin-only page).
  const Cell = ({ role, permKey, on, locked, title }: {
    role: Role; permKey: string | null; on: boolean; locked: boolean; title: string
  }) => {
    const busy = permKey !== null && saving === `${role.role_id}:${permKey}`
    const base = 'mx-auto flex items-center justify-center w-8 h-8 rounded-full transition-all'
    if (permKey === null || locked) {
      return (
        <span title={title} className={`${base} ${on ? 'bg-gisviz-accent/15 text-gisviz-accent' : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-border'} cursor-not-allowed`}>
          {on ? <Check size={13} /> : <X size={13} />}
        </span>
      )
    }
    return (
      <button onClick={() => toggle(role, permKey)} disabled={busy} title={title}
        className={`${base} disabled:cursor-wait ${on
          ? 'bg-gisviz-safe/10 text-gisviz-safe/90 hover:bg-gisviz-alert/10 hover:text-gisviz-alert'
          : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-border hover:border-gisviz-accent hover:text-gisviz-accent'}`}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : on ? <Check size={13} /> : <X size={13} />}
      </button>
    )
  }

  const th = 'px-3 py-3 text-center align-bottom font-mono text-[11px] text-gisviz-ink-soft font-bold'

  return (
    <Panel
      icon={<KeyRound size={13} />}
      title="Roles & Page Access"
      count={`${roles.length} roles · ${pages.length} pages`}
      actions={
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gisviz-accent/10 text-gisviz-accent border border-gisviz-accent/30 rounded font-mono text-[12px] hover:bg-gisviz-accent/20 transition-colors">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gisviz-safe/10 text-gisviz-safe/90 border border-gisviz-safe/30 rounded font-mono text-[12px] transition-colors disabled:opacity-50">
            {createBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Create
          </button>
          <button onClick={() => { setShowNew(false); setNewName('') }}
            className="p-1.5 text-gisviz-ink-soft hover:text-gisviz-ink"><X size={14} /></button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] font-mono border-collapse">
          <thead>
            {/* group row */}
            <tr className="border-b border-gisviz-border bg-gisviz-canvas/40">
              <th className="px-6 py-2" />
              <th colSpan={pages.length} className="px-3 py-2 text-center text-[11px] uppercase tracking-widest text-gisviz-ink-soft border-l border-gisviz-border">
                Pages
              </th>
              {otherPerms.length > 0 && (
                <th colSpan={otherPerms.length} className="px-3 py-2 text-center text-[11px] uppercase tracking-widest text-gisviz-ink-soft border-l border-gisviz-border">
                  Other permissions
                </th>
              )}
              <th className="w-24" />
            </tr>
            {/* column row */}
            <tr className="border-b border-gisviz-border">
              <th className="text-left px-6 py-3 text-gisviz-ink-soft uppercase tracking-wider align-bottom min-w-[190px]">Role</th>
              {pages.map((pg, i) => (
                <th key={pg.key} title={pg.description} className={`${th} min-w-[96px] ${i === 0 ? 'border-l border-gisviz-border' : ''}`}>
                  <div className="text-gisviz-ink leading-tight">{pg.label}</div>
                  <div className="font-normal text-gisviz-ink-soft/70 mt-0.5 break-all">{pg.path}</div>
                  <div className="mt-1 inline-block px-1.5 py-0.5 rounded border border-gisviz-border bg-gisviz-canvas font-normal">
                    {pg.required_permission ?? 'any user'}
                  </div>
                </th>
              ))}
              {otherPerms.map((p, i) => (
                <th key={p.key} title={p.desc} className={`${th} min-w-[96px] ${i === 0 ? 'border-l border-gisviz-border' : ''}`}>
                  <div className="text-gisviz-ink leading-tight">{p.label}</div>
                  <div className="mt-1 inline-block px-1.5 py-0.5 rounded border border-gisviz-border bg-gisviz-canvas font-normal">{p.key}</div>
                </th>
              ))}
              <th className="w-24" />
            </tr>
          </thead>

          <tbody className="divide-y divide-gisviz-border/50">
            {roles.map(role => {
              const isSystem = SYSTEM_ROLES.includes(role.name)
              const isAdminRole = role.name === 'admin'
              const isEditing = editingId === role.role_id
              return (
                <tr key={role.role_id} className="hover:bg-gisviz-canvas/30 transition-colors">
                  <td className="px-6 py-3">
                    {isEditing ? (
                      <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && rename(role)}
                        className="px-2 py-1 bg-gisviz-card border border-gisviz-accent rounded font-mono text-[12px] text-gisviz-ink outline-none w-36" />
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gisviz-ink">{role.name}</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          isSystem ? 'bg-gisviz-accent/10 text-gisviz-accent border-gisviz-accent/20'
                                   : 'bg-gisviz-canvas text-gisviz-ink-soft border-gisviz-border'}`}>
                          {isSystem ? 'system' : 'custom'}
                        </span>
                        <span className="text-gisviz-ink-soft">{role.user_count} user{role.user_count === 1 ? '' : 's'}</span>
                      </div>
                    )}
                  </td>

                  {pages.map((pg, i) => {
                    const req = pg.required_permission
                    const on = pg.access?.[role.role_id] ?? (isAdminRole || !req || role.permissions?.[req] === true)
                    const locked = isAdminRole || req === 'admin'
                    const shared = req ? pages.filter(o => o.required_permission === req && o.key !== pg.key).map(o => o.label) : []
                    const title = !req ? 'Open to any signed-in user'
                      : isAdminRole ? 'Admin always has access'
                      : req === 'admin' ? 'Admin-only page'
                      : `${on ? 'Revoke' : 'Grant'} "${req}" for ${role.name}` + (shared.length ? ` (also affects: ${shared.join(', ')})` : '')
                    return (
                      <td key={pg.key} className={`px-3 py-3 text-center ${i === 0 ? 'border-l border-gisviz-border' : ''}`}>
                        <Cell role={role} permKey={req} on={on} locked={locked} title={title} />
                      </td>
                    )
                  })}

                  {otherPerms.map((p, i) => {
                    const on = isAdminRole || role.permissions?.[p.key] === true
                    return (
                      <td key={p.key} className={`px-3 py-3 text-center ${i === 0 ? 'border-l border-gisviz-border' : ''}`}>
                        <Cell role={role} permKey={p.key} on={on} locked={isAdminRole}
                          title={isAdminRole ? 'Admin always has this' : `${on ? 'Revoke' : 'Grant'} ${p.label}`} />
                      </td>
                    )
                  })}

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {isEditing ? (
                        <>
                          <button onClick={() => rename(role)} disabled={rowBusy === role.role_id}
                            className="p-1.5 rounded text-gisviz-safe/70 hover:bg-gisviz-safe/10">
                            {rowBusy === role.role_id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-ink"><X size={13} /></button>
                        </>
                      ) : !isSystem ? (
                        <>
                          <button onClick={() => { setEditingId(role.role_id); setEditName(role.name) }}
                            className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-canvas transition-colors"><Edit2 size={13} /></button>
                          {confirmId === role.role_id ? (
                            <button onClick={() => remove(role)} disabled={rowBusy === role.role_id}
                              className="flex items-center gap-1 px-2 py-1 bg-gisviz-alert/10 text-gisviz-alert border border-gisviz-alert/50 rounded text-[12px] transition-colors">
                              {rowBusy === role.role_id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Sure?
                            </button>
                          ) : (
                            <button onClick={() => setConfirmId(role.role_id)}
                              className="p-1.5 rounded text-gisviz-ink-soft hover:text-gisviz-alert hover:bg-gisviz-alert/10 transition-colors"><Trash2 size={13} /></button>
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
      </div>
    </Panel>
  )
}