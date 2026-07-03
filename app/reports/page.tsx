'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flag, Trash2, UserX, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../services/api'
import AccessRestricted from '../components/AccessRestricted'

const ALLOWED_ROLES = ['admin', 'editor', 'support']

export default function ModerationDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any

  const [reports, setReports] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const roleName: string = user?.role_name?.toLowerCase() || 'viewer'
  const hasAccess = isAuthenticated && ALLOWED_ROLES.includes(roleName)

  useEffect(() => {
    if (authLoading || !hasAccess) return
    const load = async () => {
      try {
        const data = await gisvizApi.getReports()
        setReports(data)
      } catch (err) {
        console.error('Failed to load reports', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [authLoading, hasAccess])

  const handleDeletePost = async (postId: string, reportId: string) => {
    setProcessing(reportId)
    try {
      await gisvizApi.deletePost(postId)
      setReports(prev => prev.filter(r => r.report_id !== reportId))
    } catch (err) {
      console.error('Failed to delete post', err)
    } finally {
      setProcessing(null)
    }
  }

  const handleDeactivate = async (userId: string, reportId: string) => {
    setProcessing(userId)
    try {
      await gisvizApi.deactivateUser(userId, false)
      setReports(prev => prev.filter(r => r.report_id !== reportId))
    } catch (err) {
      console.error('Failed to deactivate user', err)
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

  // ── Access gate — shown immediately from role, no API call made ──
  if (!hasAccess) {
    return (
      <AccessRestricted
        requiredRoles={ALLOWED_ROLES}
        currentRole={roleName}
        message="The moderation queue is restricted to administrators, editors, and support staff."
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
          <Flag className="text-gisviz-alert/80" size={24} /> Moderation Queue
        </h1>
        <p className="text-gisviz-ink-soft font-mono text-[12px] mt-2">
          Manage reported content and user access.
        </p>
      </div>

      <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-left font-mono text-[12px] border-collapse">
          <thead className="bg-gisviz-canvas text-gisviz-ink-soft uppercase border-b border-gisviz-border">
            <tr>
              <th className="p-4">Post Title</th>
              <th className="p-4">Publisher</th>
              <th className="p-4">Reason</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.report_id} className="border-b border-gisviz-border hover:bg-gisviz-canvas/50 transition-colors">
                <td className="p-4">
                  <Link
                    href={`/post/${report.post_id}`}
                    className="font-bold text-gisviz-ink hover:text-gisviz-accent flex items-center gap-1"
                  >
                    {report.post_title || 'Untitled'} <ExternalLink size={10} />
                  </Link>
                </td>
                <td className="p-4">
                  <Link
                    href={`/profile/${report.publisher_handle}`}
                    className="text-gisviz-accent hover:underline font-bold"
                  >
                    @{report.publisher_handle || 'Unknown'}
                  </Link>
                </td>
                <td className="p-4 text-gisviz-ink max-w-[200px] truncate">
                  {report.reason}
                </td>
                <td className="p-4 flex gap-4 justify-end">
                  <button
                    onClick={() => handleDeletePost(report.post_id, report.report_id)}
                    disabled={processing === report.report_id}
                    className="text-gisviz-alert/80 hover:text-gisviz-alert flex items-center gap-1 font-bold disabled:opacity-50"
                  >
                    {processing === report.report_id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />
                    } Remove
                  </button>
                  <button
                    onClick={() => handleDeactivate(report.publisher_user_id, report.report_id)}
                    disabled={processing === report.publisher_user_id}
                    className="text-orange-500 hover:text-orange-700 flex items-center gap-1 font-bold disabled:opacity-50"
                  >
                    {processing === report.publisher_user_id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <UserX size={14} />
                    } Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {reports.length === 0 && (
          <div className="p-10 text-center text-gisviz-ink-soft font-mono border-t border-gisviz-border">
            <AlertCircle className="mx-auto mb-2 opacity-50" size={20} />
            No pending reports to review.
          </div>
        )}
      </div>
    </div>
  )
}