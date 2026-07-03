'use client'

import React from 'react'
import Link from 'next/link'
import { ShieldOff, ArrowLeft, Lock } from 'lucide-react'

interface AccessRestrictedProps {
  /** The role(s) that ARE allowed — shown to the user so they know what's needed */
  requiredRoles?: string[]
  /** The current user's role — shown so they know what they have */
  currentRole?: string
  /** Custom message override */
  message?: string
  /** Where the back arrow links to — defaults to '/' */
  backHref?: string
  backLabel?: string
}

export default function AccessRestricted({
  requiredRoles = ['admin', 'editor'],
  currentRole,
  message,
  backHref = '/',
  backLabel = 'Return to Homepage',
}: AccessRestrictedProps) {
  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      {/* Page header — same structure as reports page */}
      <div className="mb-8">
        <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
          <ShieldOff className="text-gisviz-alert/80" size={24} />
          Access Restricted
        </h1>
        <p className="text-gisviz-ink-soft font-mono text-[12px] mt-2">
          You do not have the required permissions to view this page.
        </p>
      </div>

      {/* Card — same structure as the reports table card */}
      <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">

        {/* Header row */}
        <div className="bg-gisviz-canvas border-b border-gisviz-border px-6 py-4 flex items-center gap-3">
          <Lock size={16} className="text-gisviz-alert/70" />
          <span className="font-mono text-[12px] font-bold text-gisviz-ink-soft uppercase tracking-widest">
            Clearance Required
          </span>
        </div>

        <div className="p-8 sm:p-12 text-center">
          {/* Icon plate */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-sm border-2 border-dashed border-gisviz-alert/30 bg-gisviz-alert/5 mb-6">
            <ShieldOff size={28} className="text-gisviz-alert/60" />
          </div>

          <p className="font-mono text-[12px] text-gisviz-ink-soft max-w-sm mx-auto mb-6 leading-relaxed">
            {message || 'This section is restricted to authorised system roles only. If you believe you should have access, contact a platform administrator.'}
          </p>

          {/* Role info pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            {currentRole && (
              <div className="flex items-center gap-2 bg-gisviz-canvas border border-gisviz-border rounded-sm px-4 py-2 font-mono text-[11px]">
                <span className="text-gisviz-ink-soft uppercase tracking-wider">Your Role</span>
                <span className="font-bold text-gisviz-ink uppercase">{currentRole}</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-gisviz-alert/5 border border-gisviz-alert/20 rounded-sm px-4 py-2 font-mono text-[11px]">
              <Lock size={10} className="text-gisviz-alert/60" />
              <span className="text-gisviz-ink-soft uppercase tracking-wider">Required</span>
              <span className="font-bold text-gisviz-alert/80 uppercase">
                {requiredRoles.join(' · ')}
              </span>
            </div>
          </div>

          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-gisviz-accent hover:underline font-mono text-[12px]"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}