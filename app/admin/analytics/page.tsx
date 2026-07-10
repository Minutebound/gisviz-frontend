'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart2, Users, FileText, MessageSquare,
  Tag, Hash, Flag, TrendingUp, TrendingDown, Minus,
  Loader2, RefreshCw, ArrowUpRight, Activity, Database,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'
import AccessRestricted from '../../components/AccessRestricted'

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M'
  : n >= 1_000   ? (n / 1_000).toFixed(1) + 'K'
  : String(n ?? 0)

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0)
    return <span className="text-gisviz-ink-soft font-mono text-[12px]">—</span>
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100)
  if (pct > 0) return (
    <span className="flex items-center gap-0.5 text-gisviz-safe/70 font-mono text-[12px]">
      <TrendingUp size={11} />+{pct}% vs last week
    </span>
  )
  if (pct < 0) return (
    <span className="flex items-center gap-0.5 text-gisviz-alert font-mono text-[12px]">
      <TrendingDown size={11} />{pct}% vs last week
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-gisviz-ink-soft font-mono text-[12px]">
      <Minus size={11} />No change
    </span>
  )
}

function StatCard({ icon, label, value, sub, trend }: {
  icon: React.ReactNode; label: string; value: number;
  sub?: string; trend?: React.ReactNode
}) {
  return (
    <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-5 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-gisviz-ink-soft">{icon}</span>
        {trend}
      </div>
      <p className="text-[28px] font-display font-bold text-gisviz-ink leading-none">{fmt(value)}</p>
      <p className="text-[12px] font-mono text-gisviz-ink-soft uppercase tracking-wider">{label}</p>
      {sub && <p className="text-[12px] font-mono text-gisviz-ink-soft">{sub}</p>}
    </div>
  )
}

type TopBy = 'likes' | 'bookmarks' | 'comments'
type UserBy = 'followers' | 'posts'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()

  const [overview, setOverview]     = useState<any>(null)
  const [topPosts, setTopPosts]     = useState<any[]>([])
  const [topUsers, setTopUsers]     = useState<any[]>([])
  const [commenters, setCommenters] = useState<any[]>([])

  const [loading, setLoading]           = useState(false) // ← false: no auto-load
  const [topPostsBusy, setTopPostsBusy] = useState(false)
  const [topUsersBusy, setTopUsersBusy] = useState(false)
  const [topPostsBy, setTopPostsBy]     = useState<TopBy>('likes')
  const [topUsersBy, setTopUsersBy]     = useState<UserBy>('followers')
  const [hasLoaded, setHasLoaded]       = useState(false)

  /**
   * triggerLoad is a counter passed to TrendCharts.
   * Starts at 0 (charts don't fetch). Each time the user clicks
   * Load Data / Refresh it increments, telling TrendCharts to re-fetch.
   * This is the ONLY mechanism that causes any data to load.
   */
  const [triggerLoad, setTriggerLoad] = useState(0)

  // Auth redirect only — no data fetch
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth')
  }, [authLoading, isAuthenticated, router])

  // ── The one and only data-load function ───────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, tp, tu, cm] = await Promise.all([
        gisvizApi.adminFetchOverview(),
        gisvizApi.adminFetchTopPosts('likes'),
        gisvizApi.adminFetchTopUsers('followers'),
        gisvizApi.adminFetchTopCommenters(),
      ])
      setOverview(ov)
      setTopPosts(tp)
      setTopUsers(tu)
      setCommenters(cm)
      setHasLoaded(true)
      // Increment trigger so TrendCharts also refreshes
      setTriggerLoad(n => n + 1)
    } catch (e) {
      console.error('Analytics load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const switchTopPosts = async (by: TopBy) => {
    setTopPostsBy(by); setTopPostsBusy(true)
    try { setTopPosts(await gisvizApi.adminFetchTopPosts(by)) }
    catch { /* swallow */ }
    finally { setTopPostsBusy(false) }
  }

  const switchTopUsers = async (by: UserBy) => {
    setTopUsersBy(by); setTopUsersBusy(true)
    try { setTopUsers(await gisvizApi.adminFetchTopUsers(by)) }
    catch { /* swallow */ }
    finally { setTopUsersBusy(false) }
  }

  if (authLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )
  if (!user || user.role_name !== 'admin')
    return <AccessRestricted requiredRoles={['admin']} currentRole={user?.role_name} />

  const t  = overview?.totals    || {}
  const tw = overview?.this_week || {}
  const lw = overview?.last_week || {}
  const asOf = overview?.as_of   || null

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 pb-20">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
            <BarChart2 className="text-gisviz-accent" size={28} /> Analytics Dashboard
          </h1>
          <p className="text-gisviz-ink-soft font-mono text-[12px] mt-1 flex items-center gap-1.5">
            <Database size={11} />
            Snapshot warehouse
            {asOf && <span className="text-gisviz-ink-soft/60 ml-1">· as of {asOf}</span>}
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
          <Link href="/admin/activity"
            className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
            <Activity size={14} /> Activity
          </Link>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gisviz-accent text-gisviz-white rounded-md font-mono text-[12px] font-bold hover:bg-opacity-90 transition-colors disabled:opacity-60 shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : hasLoaded ? 'Refresh' : 'Load Data'}
          </button>
        </div>
      </div>

      {/* ── Not yet loaded ── */}
      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gisviz-ink-soft">
          <Database size={36} className="opacity-30" />
          <p className="font-mono text-[12px]">
            Click <strong className="text-gisviz-ink">Load Data</strong> to fetch from the snapshot warehouse.
          </p>
          <p className="font-mono text-[12px] opacity-60">
            Numbers reflect the last Dagster snapshot — not live counts.
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center py-24">
          <Loader2 size={32} className="animate-spin text-gisviz-accent" />
        </div>
      )}

      {/* ── Data (shown only after first successful load) ── */}
      {hasLoaded && !loading && (
        <>
          {/* Stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <StatCard
              icon={<Users size={18} />} label="Total Users" value={t.users ?? 0}
              trend={<Trend current={tw.new_users ?? 0} previous={lw.new_users ?? 0} />}
              sub={`+${tw.new_users ?? 0} this week`} />
            <StatCard
              icon={<FileText size={18} />} label="Total Posts" value={t.posts ?? 0}
              trend={<Trend current={tw.new_posts ?? 0} previous={lw.new_posts ?? 0} />}
              sub={`+${tw.new_posts ?? 0} this week`} />
            <StatCard icon={<Tag size={18} />}  label="Categories"   value={t.categories  ?? 0} />
            <StatCard icon={<Hash size={18} />} label="Keywords"     value={t.keywords    ?? 0} />
            <StatCard
              icon={<Flag size={18} />} label="Open Reports" value={t.open_reports ?? 0}
              sub={t.open_reports > 0 ? 'Needs attention' : 'All clear'} />
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Top Posts */}
            <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gisviz-border bg-gisviz-canvas/50">
                <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest">Top Posts</h2>
                <div className="flex gap-1">
                  {(['likes', 'bookmarks', 'comments'] as TopBy[]).map(b => (
                    <button key={b} onClick={() => switchTopPosts(b)}
                      className={`px-2 py-0.5 rounded text-[12px] font-mono transition-colors ${
                        topPostsBy === b
                          ? 'bg-gisviz-accent text-white'
                          : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'
                      }`}>{b}</button>
                  ))}
                </div>
              </div>
              {topPostsBusy ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gisviz-accent" /></div>
              ) : topPosts.length === 0 ? (
                <div className="py-8 text-center text-[12px] font-mono text-gisviz-ink-soft">No posts in snapshot yet.</div>
              ) : (
                <div className="divide-y divide-gisviz-border/50">
                  {topPosts.map((p, i) => (
                    <div key={p.post_id} className="flex items-start gap-3 px-5 py-3 hover:bg-gisviz-canvas/30 transition-colors">
                      <span className="text-[12px] font-mono text-gisviz-ink-soft w-4 shrink-0 mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <Link href={`/post/${p.post_id}`} target="_blank"
                          className="text-[12px] font-mono text-gisviz-ink hover:text-gisviz-accent truncate block">
                          {p.title}
                        </Link>
                        <span className="text-[12px] font-mono text-gisviz-ink-soft">@{p.publisher_handle}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-mono font-bold text-gisviz-ink">
                          {fmt(topPostsBy === 'likes' ? p.total_likes_count : p.total_comments_count)}
                        </p>
                        <p className="text-[12px] font-mono text-gisviz-ink-soft">{topPostsBy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Users */}
            <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gisviz-border bg-gisviz-canvas/50">
                <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest">Top Users</h2>
                <div className="flex gap-1">
                  {(['followers', 'posts'] as UserBy[]).map(b => (
                    <button key={b} onClick={() => switchTopUsers(b)}
                      className={`px-2 py-0.5 rounded text-[12px] font-mono transition-colors ${
                        topUsersBy === b
                          ? 'bg-gisviz-accent text-white'
                          : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'
                      }`}>{b}</button>
                  ))}
                </div>
              </div>
              {topUsersBusy ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gisviz-accent" /></div>
              ) : topUsers.length === 0 ? (
                <div className="py-8 text-center text-[12px] font-mono text-gisviz-ink-soft">No users in snapshot yet.</div>
              ) : (
                <div className="divide-y divide-gisviz-border/50">
                  {topUsers.map((u, i) => (
                    <div key={u.user_id} className="flex items-center gap-3 px-5 py-3 hover:bg-gisviz-canvas/30 transition-colors">
                      <span className="text-[12px] font-mono text-gisviz-ink-soft w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${u.user_handle}`}
                          className="text-[12px] font-mono text-gisviz-ink hover:text-gisviz-accent">
                          @{u.user_handle}
                        </Link>
                        <p className="text-[12px] font-mono text-gisviz-ink-soft">{u.role_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-mono font-bold text-gisviz-ink">
                          {fmt(topUsersBy === 'followers' ? u.follower_count : u.post_count)}
                        </p>
                        <p className="text-[12px] font-mono text-gisviz-ink-soft">{topUsersBy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Most active commenters */}
          <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gisviz-border bg-gisviz-canvas/50">
              <h2 className="font-mono text-[12px] font-bold text-gisviz-ink uppercase tracking-widest flex items-center gap-2">
                <MessageSquare size={13} className="text-gisviz-accent" /> Most Active Commenters
              </h2>
            </div>
            {commenters.length === 0 ? (
              <div className="py-8 text-center text-[12px] font-mono text-gisviz-ink-soft">No commenters in snapshot yet.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-x divide-y divide-gisviz-border/50">
                {commenters.map((c, i) => (
                  <div key={c.user_id} className="flex flex-col items-center py-4 px-3 hover:bg-gisviz-canvas/30 transition-colors text-center">
                    <span className="text-[12px] font-mono text-gisviz-ink-soft mb-1">#{i + 1}</span>
                    <Link href={`/profile/${c.user_handle}`}
                      className="text-[12px] font-mono text-gisviz-ink hover:text-gisviz-accent truncate w-full text-center">
                      @{c.user_handle}
                    </Link>
                    <p className="text-[16px] font-bold font-display text-gisviz-ink mt-1">{fmt(c.comment_count)}</p>
                    <p className="text-[12px] font-mono text-gisviz-ink-soft">comments</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}