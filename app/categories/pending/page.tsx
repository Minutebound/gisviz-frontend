'use client'

import React, { useEffect, useState } from 'react'
import { Clock, Check, X, AlertCircle, Loader2, CheckSquare } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'
import AccessRestricted from '../../components/AccessRestricted'

const ALLOWED_ROLES = ['admin', 'editor']

export default function PendingCategoriesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any

  const [pendingCategories, setPendingCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const roleName: string = user?.role_name?.toLowerCase() || 'viewer'
  const hasAccess = isAuthenticated && ALLOWED_ROLES.includes(roleName)

  useEffect(() => {
    if (authLoading || !hasAccess) return
    const load = async () => {
      try {
        const data = await gisvizApi.getPendingCategories()
        setPendingCategories(data)
      } catch (err) {
        console.error('Failed to load pending categories', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [authLoading, hasAccess])

  const handleApprove = async (pendingId: string, label: string) => {
    setProcessing(pendingId)
    setActionMsg(null)
    try {
      await gisvizApi.approvePendingCategory(pendingId)
      setPendingCategories(prev => prev.filter(c => c.pending_id !== pendingId))
      setActionMsg({ type: 'success', text: `"${label}" approved and added to categories.` })
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setActionMsg({
        type: 'error',
        text: typeof detail === 'string' ? detail : 'Failed to approve category.',
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (pendingId: string, label: string) => {
    setProcessing(pendingId)
    setActionMsg(null)
    try {
      await gisvizApi.rejectPendingCategory(pendingId)
      setPendingCategories(prev => prev.filter(c => c.pending_id !== pendingId))
      setActionMsg({ type: 'error', text: `"${label}" rejected.` })
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setActionMsg({
        type: 'error',
        text: typeof detail === 'string' ? detail : 'Failed to reject category.',
      })
    } finally {
      setProcessing(null)
    }
  }

  // ── Auth loading ──
  if (authLoading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="animate-spin mx-auto text-gisviz-accent" size={32} />
      </div>
    )
  }

  // ── Access gate ──
  if (!hasAccess) {
    return (
      <AccessRestricted
        requiredRoles={ALLOWED_ROLES}
        currentRole={roleName}
        message="Category moderation is restricted to administrators and editors."
        backHref="/"
        backLabel="Return to Homepage"
      />
    )
  }

  // ── Data loading ──
  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="animate-spin mx-auto text-gisviz-accent" size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
          <Clock className="text-gisviz-accent" size={24} /> Pending Categories
        </h1>
        <p className="text-gisviz-ink-soft font-mono text-[12px] mt-2">
          Review and approve category suggestions submitted by users.
        </p>
      </div>

      {/* Action feedback */}
      {actionMsg && (
        <div className={`mb-6 p-4 rounded-sm border font-mono text-[12px] flex items-center gap-2 ${
          actionMsg.type === 'success'
            ? 'bg-gisviz-safe/5 border-gisviz-safe/20 text-gisviz-safe/80'
            : 'bg-gisviz-alert/5 border-gisviz-alert/20 text-gisviz-alert/80'
        }`}>
          <AlertCircle size={14} />
          {actionMsg.text}
        </div>
      )}

      <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
        {pendingCategories.length === 0 ? (
          <div className="p-12 text-center text-gisviz-ink-soft font-mono">
            <CheckSquare className="mx-auto mb-3 opacity-30" size={32} />
            <p className="text-[12px]">No pending categories to review.</p>
          </div>
        ) : (
          <table className="w-full text-left font-mono text-[12px] border-collapse">
            <thead className="bg-gisviz-canvas text-gisviz-ink-soft uppercase border-b border-gisviz-border">
              <tr>
                <th className="p-4">Suggested Label</th>
                <th className="p-4">Normalized Slug</th>
                <th className="p-4">Submitted</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingCategories.map((cat) => (
                <tr
                  key={cat.pending_id}
                  className="border-b border-gisviz-border hover:bg-gisviz-canvas/50 transition-colors"
                >
                  <td className="p-4 font-bold text-gisviz-ink">{cat.label}</td>
                  <td className="p-4 text-gisviz-ink-soft">{cat.normalized_slug}</td>
                  <td className="p-4 text-gisviz-ink-soft">
                    {new Date(cat.created_timestamp).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => handleApprove(cat.pending_id, cat.label)}
                        disabled={processing === cat.pending_id}
                        className="flex items-center gap-1.5 text-gisviz-safe/80 hover:text-gisviz-safe font-bold disabled:opacity-40 transition-colors"
                      >
                        {processing === cat.pending_id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Check size={13} />
                        }
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(cat.pending_id, cat.label)}
                        disabled={processing === cat.pending_id}
                        className="flex items-center gap-1.5 text-gisviz-alert/80 hover:text-gisviz-alert font-bold disabled:opacity-40 transition-colors"
                      >
                        {processing === cat.pending_id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <X size={13} />
                        }
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}