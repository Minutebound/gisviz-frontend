'use client'

/**
 * app/admin/page.tsx — Admin Home
 *
 * Landing page with navigation cards to every admin destination:
 *   Analytics · Control Panel · Activity (audit trail)
 * plus deep links into each Control Panel tab.
 */

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, BarChart2, Tag, Users, Hash, FileText, Flag,
  MessageSquare, UserX, KeyRound, ArrowRight, Activity, Loader2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import AccessRestricted from '../components/AccessRestricted'

// Main areas — Analytics, Control Panel, Activity
const AREAS = [
  {
    href: '/admin/analytics',
    icon: <BarChart2 size={22} />,
    title: 'Analytics Dashboard',
    desc: 'Platform metrics, top posts & users, growth trends. Served from the snapshot warehouse.',
  },
  {
    href: '/admin/control',
    icon: <ShieldCheck size={22} />,
    title: 'Control Panel',
    desc: 'Full moderation workspace — manage every part of the platform.',
  },
  {
    href: '/admin/activity',
    icon: <Activity size={22} />,
    title: 'Admin Activity',
    desc: 'Permanent audit trail of every moderation action — who did what, and when.',
  },
]

// Control-panel tabs, as deep links
const CONTROL_TABS = [
  { tab: 'categories', icon: <Tag size={16} />,           label: 'Categories',      desc: 'Approve / edit category tags' },
  { tab: 'users',      icon: <Users size={16} />,         label: 'Users',           desc: 'Roles, status, deletion' },
  { tab: 'keywords',   icon: <Hash size={16} />,          label: 'Keywords',        desc: 'Manage keyword tags' },
  { tab: 'posts',      icon: <FileText size={16} />,      label: 'Posts',           desc: 'Moderate publications' },
  { tab: 'reports',    icon: <Flag size={16} />,          label: 'Reports',         desc: 'Resolve content reports' },
  { tab: 'comments',   icon: <MessageSquare size={16} />, label: 'Comments',        desc: 'Moderate comments' },
  { tab: 'unverified', icon: <UserX size={16} />,         label: 'Unverified',      desc: 'Verify / purge accounts' },
  { tab: 'roles',      icon: <KeyRound size={16} />,      label: 'Access & Roles',  desc: 'Roles, permissions, page access' },
]

export default function AdminHomePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()

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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 pb-20">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
          <ShieldCheck className="text-gisviz-accent" size={28} /> Admin Home
        </h1>
        <p className="text-gisviz-ink-soft font-mono text-[12px] mt-1">
          Signed in as <span className="text-gisviz-ink font-bold">@{user.user_handle}</span> · admin
        </p>
      </div>

      {/* Main areas — now 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {AREAS.map(a => (
          <Link key={a.href} href={a.href}
            className="group bg-gisviz-card border border-gisviz-border rounded-sm p-6 shadow-sm hover:border-gisviz-accent transition-colors flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-gisviz-accent">{a.icon}</span>
              <ArrowRight size={18} className="text-gisviz-border group-hover:text-gisviz-accent group-hover:translate-x-0.5 transition-all" />
            </div>
            <h2 className="text-[16px] font-display font-bold text-gisviz-ink">{a.title}</h2>
            <p className="text-[12px] font-mono text-gisviz-ink-soft leading-relaxed">{a.desc}</p>
          </Link>
        ))}
      </div>

      {/* Control panel sections */}
      <div className="mb-4">
        <h2 className="font-mono text-[12px] font-bold text-gisviz-ink-soft uppercase tracking-widest flex items-center gap-2">
          <Activity size={13} className="text-gisviz-accent" /> Control Panel Sections
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CONTROL_TABS.map(t => (
          <Link key={t.tab} href={`/admin/control?tab=${t.tab}`}
            className="group bg-gisviz-card border border-gisviz-border rounded-sm p-4 shadow-sm hover:border-gisviz-accent transition-colors flex flex-col gap-2">
            <div className="flex items-center gap-2 text-gisviz-ink">
              <span className="text-gisviz-ink-soft group-hover:text-gisviz-accent transition-colors">{t.icon}</span>
              <span className="text-[13px] font-mono font-bold">{t.label}</span>
            </div>
            <p className="text-[11px] font-mono text-gisviz-ink-soft leading-snug">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}