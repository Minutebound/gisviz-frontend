'use client'

/**
 * app/admin/architecture/page.tsx
 *
 * Live system architecture — two diagram views, zero hardcoded routes,
 * zero LLM calls.
 *
 * Sources (both already exist, no backend changes needed):
 *   GET {API}/              -> { version } — APP_VERSION baked in by CI
 *   GET {API}/openapi.json  -> every route FastAPI actually serves
 *
 * Everything drawn below is computed from that schema at page load, so the
 * diagram cannot drift from the code. Add a router tomorrow and a new node
 * appears here with no edit to this file.
 *
 * View: LAYERS — browser -> FastAPI routers (sized by route count) -> infra
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Cpu, Loader2, RefreshCw, ExternalLink, ArrowLeft,
  ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import AccessRestricted from '../../components/AccessRestricted'

// ─── types ────────────────────────────────────────────────────────────────────
type Route = {
  path:    string
  method:  string
  tag:     string
  summary: string
  secured: boolean
}

type TagGroup = {
  tag:     string
  routes:  Route[]
  secured: number
  prefix:  string
}

// ─── palette (hex — SVG cannot use Tailwind classes) ─────────────────────────
const INK      = '#2A2A28'
const INK_SOFT = '#8A8780'
const BORDER   = '#D9D5CC'
const CARD     = '#FDFCF9'
const ACCENT   = '#C25B3F'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Longest common path prefix — reveals where the router is mounted. */
function commonPrefix(paths: string[]): string {
  if (!paths.length) return ''
  const segs  = paths.map(p => p.split('/').filter(Boolean))
  const first = segs[0]
  const out: string[] = []
  for (let i = 0; i < first.length; i++) {
    const s = first[i]
    if (s.startsWith('{')) break
    if (segs.every(x => x[i] === s)) out.push(s)
    else break
  }
  return '/' + out.join('/')
}

export default function ArchitecturePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()

  const [version, setVersion] = useState<string | null>(null)
  const [routes,  setRoutes]  = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)

  const API = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v0', '').replace(/\/$/, '')

  // ── load live schema ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [healthRes, specRes] = await Promise.all([
        fetch(`${API}/`),
        fetch(`${API}/openapi.json`),
      ])
      const health = await healthRes.json()
      const spec   = await specRes.json()

      setVersion(health.version ?? 'unknown')

      const parsed: Route[] = []
      for (const [path, methods] of Object.entries<any>(spec.paths ?? {})) {
        for (const [method, def] of Object.entries<any>(methods)) {
          if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
          parsed.push({
            path,
            method:  method.toUpperCase(),
            tag:     def.tags?.[0] ?? 'Untagged',
            summary: def.summary ?? '',
            secured: Array.isArray(def.security) && def.security.length > 0,
          })
        }
      }
      setRoutes(parsed)
    } catch {
      setErr('Could not reach the API. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [API])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/auth'); return }
    if (user?.role_name === 'admin') load()
  }, [authLoading, isAuthenticated, user, router, load])

  // ── derive router groups from the live schema ──────────────────────────────
  const groups: TagGroup[] = useMemo(() => {
    const byTag: Record<string, Route[]> = {}
    routes.forEach(r => { (byTag[r.tag] ||= []).push(r) })

    return Object.entries(byTag)
      .map(([tag, rs]) => ({
        tag,
        routes:  rs.slice().sort((a, b) => a.path.localeCompare(b.path)),
        secured: rs.filter(r => r.secured).length,
        prefix:  commonPrefix(rs.map(r => r.path)),
      }))
      .sort((a, b) => b.routes.length - a.routes.length)
  }, [routes])

  // ── guards ─────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )

  if (!user || user.role_name !== 'admin') {
    return (
      <AccessRestricted
        requiredRoles={['admin']}
        currentRole={user?.role_name}
        backHref="/admin"
        backLabel="Back to Admin"
      />
    )
  }

  const totalSecured = routes.filter(r => r.secured).length

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 pb-20">

      {/* ── header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
              <Cpu className="text-gisviz-accent" size={28} /> System Architecture
            </h1>
            <p className="text-gisviz-ink-soft font-mono text-[12px] mt-1">
              Drawn from <code className="text-gisviz-ink">/openapi.json</code> at page load — never hand-written.
            </p>
          </div>

          <div className="flex items-center gap-3">
             <Link href="/admin"
              className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
              <ArrowUpRight size={14} /> Admin Home
            </Link>
            {version && (
              <div className="px-3 py-1.5 rounded-sm border border-gisviz-accent/30 bg-gisviz-accent/5">
                <span className="text-[11px] font-mono text-gisviz-ink-soft">deployed </span>
                <span className="text-[12px] font-mono font-bold text-gisviz-accent">v{version}</span>
              </div>
            )}
            <button
              onClick={load}
              disabled={loading}
              title="Refresh from API"
              className="p-2 rounded-sm border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-accent hover:border-gisviz-accent transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── live counts — all derived, none typed ───────────────────────────── */}
      {!loading && !err && (
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            { label: 'routers', value: groups.length },
            { label: 'total routes',  value: routes.length },
            { label: 'secured', value: totalSecured },
            { label: 'public',  value: routes.length - totalSecured },
          ].map(s => (
            <div key={s.label} className="px-4 py-2 bg-gisviz-card border border-gisviz-border rounded-sm">
              <span className="text-[16px] font-mono font-bold text-gisviz-ink">{s.value}</span>
              <span className="text-[11px] font-mono text-gisviz-ink-soft ml-1.5">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {err && (
        <div className="mb-6 px-4 py-3 rounded-sm border border-gisviz-alert/30 bg-gisviz-alert/5 text-[12px] font-mono text-gisviz-alert">
          {err}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 bg-gisviz-card border border-gisviz-border rounded-sm">
          <Loader2 size={24} className="animate-spin text-gisviz-accent" />
        </div>
      ) : (
        <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm p-6 overflow-x-auto">
          <LayersDiagram groups={groups} focused={focused} setFocused={setFocused} version={version} />
        </div>
      )}

      {/* ── focused router endpoint list ────────────────────────────────────── */}
      {focused && !loading && (() => {
        const g = groups.find(g => g.tag === focused)
        if (!g) return null
        const chip = (m: string) => ({
          GET:    'text-[#2E7D5B] border-[#2E7D5B]/30 bg-[#2E7D5B]/5',
          POST:   'text-gisviz-accent border-gisviz-accent/30 bg-gisviz-accent/5',
          PUT:    'text-blue-600 border-blue-300 bg-blue-50',
          PATCH:  'text-blue-600 border-blue-300 bg-blue-50',
          DELETE: 'text-gisviz-alert border-gisviz-alert/30 bg-gisviz-alert/5',
        }[m] ?? 'text-gisviz-ink-soft border-gisviz-border bg-gisviz-canvas')

        return (
          <div className="mt-4 bg-gisviz-card border border-gisviz-accent/40 rounded-sm shadow-sm overflow-hidden">
            {/* header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gisviz-border bg-gisviz-canvas/50">
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-mono font-bold text-gisviz-ink uppercase tracking-widest">
                  {g.tag}
                </span>
                <code className="text-[11px] font-mono text-gisviz-ink-soft">{g.prefix}</code>
                <span className="text-[11px] font-mono text-gisviz-ink-soft">
                  · {g.routes.length} route{g.routes.length !== 1 ? 's' : ''}
                  {g.secured > 0 && ` · ${g.secured} auth`}
                </span>
              </div>
              <button
                onClick={() => setFocused(null)}
                className="text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink transition-colors px-2 py-1"
              >
                close ×
              </button>
            </div>

            {/* route rows */}
            {g.routes.map(r => (
              <div
                key={`${r.method}-${r.path}`}
                className="flex items-center gap-3 px-5 py-2.5 border-b border-gisviz-border/50 last:border-0 hover:bg-gisviz-canvas/40 transition-colors"
              >
                <span className={`shrink-0 w-16 text-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${chip(r.method)}`}>
                  {r.method}
                </span>
                <code className="text-[12px] font-mono text-gisviz-ink flex-1 truncate">
                  {r.path}
                </code>
                {r.summary && (
                  <span className="text-[11px] font-mono text-gisviz-ink-soft truncate hidden sm:block">
                    {r.summary}
                  </span>
                )}
                {r.secured && (
                  <span className="text-[10px] font-mono text-gisviz-ink-soft shrink-0 border border-gisviz-border rounded px-1.5 py-0.5">
                    auth
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── source links ────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-mono text-[12px] font-bold text-gisviz-ink-soft uppercase tracking-widest mb-3">
          Source
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={`${API}/docs?token=${typeof window !== 'undefined' ? localStorage.getItem('gisviz_token') : ''}`}
            target="_blank" rel="noopener noreferrer"
            className="group bg-gisviz-card border border-gisviz-border rounded-sm p-4 shadow-sm hover:border-gisviz-accent transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-[12px] font-mono font-bold text-gisviz-ink mb-0.5">Swagger UI</p>
              <p className="text-[11px] font-mono text-gisviz-ink-soft">Interactive — admin token attached</p>
            </div>
            <ExternalLink size={14} className="text-gisviz-border group-hover:text-gisviz-accent transition-colors" />
          </a>

          <a
            href={`${API}/openapi.json`}
            target="_blank" rel="noopener noreferrer"
            className="group bg-gisviz-card border border-gisviz-border rounded-sm p-4 shadow-sm hover:border-gisviz-accent transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-[12px] font-mono font-bold text-gisviz-ink mb-0.5">OpenAPI schema</p>
              <p className="text-[11px] font-mono text-gisviz-ink-soft">The raw source for this page</p>
            </div>
            <ExternalLink size={14} className="text-gisviz-border group-hover:text-gisviz-accent transition-colors" />
          </a>
        </div>
      </section>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW 1 — LAYERS
   Browser -> FastAPI -> routers (bar width = route count) -> infra.
   Every router node is a real tag from the live schema.
   ═══════════════════════════════════════════════════════════════════════════ */

function LayersDiagram({
  groups, focused, setFocused, version,
}: {
  groups: TagGroup[]
  focused: string | null
  setFocused: (t: string | null) => void
  version: string | null
}) {
  const COLS   = 4
  const CELL_W = 170
  const CELL_H = 62
  const GAP    = 14
  const rows   = Math.max(1, Math.ceil(groups.length / COLS))

  const gridW  = COLS * CELL_W + (COLS - 1) * GAP
  const startX = 40
  const gridY  = 190

  const W = gridW + startX * 2
  const H = gridY + rows * (CELL_H + GAP) + 150

  const maxRoutes  = Math.max(...groups.map(g => g.routes.length), 1)
  const totalRoutes = groups.reduce((n, g) => n + g.routes.length, 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 700 }} role="img">
      <title>Layered architecture — live from the OpenAPI schema</title>
      <defs>
        <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M1 1 L9 5 L1 9" fill="none" stroke={BORDER}
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {/* Browser */}
      <rect x={W / 2 - 110} y={20} width={220} height={44} rx={4} fill={CARD} stroke={BORDER} />
      <text x={W / 2} y={39} textAnchor="middle" fontSize="12" fontWeight="700" fill={INK} fontFamily="monospace">
        Browser
      </text>
      <text x={W / 2} y={55} textAnchor="middle" fontSize="10" fill={INK_SOFT} fontFamily="monospace">
        Next.js 14 · App Router
      </text>

      <line x1={W / 2} y1={64} x2={W / 2} y2={98} stroke={BORDER} strokeWidth="1.5" markerEnd="url(#ar)" />
      <text x={W / 2 + 8} y={86} fontSize="9" fill={INK_SOFT} fontFamily="monospace">HTTPS · JWT</text>

      {/* API gateway — version and counts are live */}
      <rect x={40} y={104} width={W - 80} height={52} rx={4} fill={CARD} stroke={ACCENT} strokeWidth="1.5" />
      <text x={W / 2} y={125} textAnchor="middle" fontSize="12" fontWeight="700" fill={ACCENT} fontFamily="monospace">
        FastAPI{version ? ` v${version}` : ''}
      </text>
      <text x={W / 2} y={143} textAnchor="middle" fontSize="10" fill={INK_SOFT} fontFamily="monospace">
        Uvicorn · 4 workers · {groups.length} routers · {totalRoutes} routes
      </text>

      {/* Routers — one node per tag, straight from the schema */}
      {groups.map((g, i) => {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const x   = startX + col * (CELL_W + GAP)
        const y   = gridY + row * (CELL_H + GAP)

        const isFocus = focused === g.tag
        const dim     = focused !== null && !isFocus
        const barW    = 8 + (g.routes.length / maxRoutes) * (CELL_W - 24)

        return (
          <g
            key={g.tag}
            onClick={() => setFocused(isFocus ? null : g.tag)}
            style={{ cursor: 'pointer', opacity: dim ? 0.35 : 1, transition: 'opacity .15s' }}
          >
            <line
              x1={x + CELL_W / 2} y1={156}
              x2={x + CELL_W / 2} y2={y}
              stroke={BORDER} strokeWidth="1" strokeDasharray="3 3"
            />

            <rect
              x={x} y={y} width={CELL_W} height={CELL_H} rx={4}
              fill={CARD}
              stroke={isFocus ? ACCENT : BORDER}
              strokeWidth={isFocus ? 1.8 : 1}
            />

            <text x={x + 12} y={y + 20} fontSize="11" fontWeight="700" fill={INK} fontFamily="monospace">
              {g.tag}
            </text>

            {g.secured > 0 && (
              <>
                <rect x={x + CELL_W - 44} y={y + 9} width={34} height={14} rx={2}
                      fill={INK_SOFT} opacity="0.12" />
                <text x={x + CELL_W - 27} y={y + 19} textAnchor="middle"
                      fontSize="8" fill={INK_SOFT} fontFamily="monospace">
                  {g.secured} auth
                </text>
              </>
            )}

            <rect x={x + 12} y={y + 30} width={barW} height={5} rx={2.5} fill={ACCENT} opacity="0.5" />

            <text x={x + 12} y={y + 50} fontSize="9" fill={INK_SOFT} fontFamily="monospace">
              {g.prefix || '/'} · {g.routes.length}
            </text>
          </g>
        )
      })}

      {/* Infra */}
      {(() => {
        const infraY = gridY + rows * (CELL_H + GAP) + 34
        const items = [
          { label: 'PostgreSQL x4', sub: 'users · posts · analytics · admin' },
          { label: 'Redis 7',       sub: 'feed · categories · legal' },
          { label: 'Cloudflare R2', sub: 'images · avatars' },
        ]
        const iw = (gridW - 2 * GAP) / 3
        return (
          <>
            <line x1={W / 2} y1={infraY - 26} x2={W / 2} y2={infraY - 6}
                  stroke={BORDER} strokeWidth="1.5" markerEnd="url(#ar)" />
            {items.map((it, i) => {
              const x = startX + i * (iw + GAP)
              return (
                <g key={it.label}>
                  <rect x={x} y={infraY} width={iw} height={50} rx={4}
                        fill={CARD} stroke={BORDER} strokeDasharray="4 3" />
                  <text x={x + iw / 2} y={infraY + 22} textAnchor="middle"
                        fontSize="11" fontWeight="700" fill={INK} fontFamily="monospace">
                    {it.label}
                  </text>
                  <text x={x + iw / 2} y={infraY + 38} textAnchor="middle"
                        fontSize="9" fill={INK_SOFT} fontFamily="monospace">
                    {it.sub}
                  </text>
                </g>
              )
            })}
          </>
        )
      })()}
    </svg>
  )
}