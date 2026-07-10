'use client'

/**
 * app/admin/architecture/page.tsx
 *
 * Generates a live system architecture diagram by calling Claude
 * (via the Anthropic API from the artifact) with the actual codebase
 * context injected. Claude returns structured JSON describing the
 * architecture layers, components, and connections — which this page
 * renders as an interactive SVG + card grid.
 *
 * Nothing is hardcoded. The diagram updates if you add services
 * (trigger a new generation). The system context is built from the
 * ARCHITECTURE_CONTEXT string below, which you update as the app grows.
 */

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Cpu, Loader2, RefreshCw, ArrowUpRight, ZoomIn, ZoomOut } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import AccessRestricted from '../../components/AccessRestricted'

// ── Codebase context fed to Claude ───────────────────────────────────────────
// Update this string when you add new services, databases, or integrations.
const ARCHITECTURE_CONTEXT = `
You are analysing the gisviz platform. Here is the complete technical stack:

BACKEND (FastAPI, Python 3.11):
- app/main.py: FastAPI entry point, registers routers
- app/api/v1/endpoints/auth.py: JWT auth, OTP email verification, password reset
- app/api/v1/endpoints/users.py: User profiles, follow graph, settings
- app/api/v1/endpoints/posts.py: Post CRUD, likes, bookmarks, comments, reports
- app/api/v1/endpoints/categories.py: Category management
- app/api/v1/endpoints/search.py: Global search (users, posts, categories, keywords)
- app/api/v1/endpoints/uploads.py: Avatar, banner, visual image uploads
- app/api/v1/endpoints/admin.py: Admin control panel, analytics, audit trail
- app/api/v1/endpoints/support.py: Public support ticket submission
- app/analytics/snapshot.py: ETL that writes daily snapshots to analytics_db

DATABASES (PostgreSQL 15, separate per domain):
- users_db: PlatformUserRecord, RoleRecord, FollowCurrentRecord, FollowEventRecord, UserLocationRecord, SupportTicketRecord
- posts_db: PostRecord, PostLikeRecord, PostBookmarkRecord, PostCommentRecord, CategoryRecord, KeywordRecord, PendingCategoryRecord, PostReportRecord
- analytics_db: DimDate, DimUser, DimPost, DimCategory, FactDailySnapshot, FactPostEngagement, FactCategoryDaily, FactWeeklyDelta, FactTopPost, FactTopUser, FactTopCommenter, EtlRunLog
- admin_db: AdminActionLog, RoleChangeHistory, ReportResolution, AdminSetting

CACHE: Redis 7 — session caching, feed TTL caching

FRONTEND (Next.js 14, TypeScript, Tailwind CSS):
- app/page.tsx: Home feed
- app/auth/: Login, register, OTP verify, forgot/reset password
- app/profile/[handle]/: Public user profile
- app/post/[id]/: Post detail + comments
- app/add-post/: Upload new publication
- app/settings/: User settings (profile, security, account)
- app/admin/: Admin home, analytics, control panel, activity, architecture, ERD
- services/api.ts: Axios client, JWT injection, TTL cache

INFRASTRUCTURE:
- Cloudflare: DNS, CDN, TLS termination, DDoS protection, R2 (file uploads)
- IONOS VPS L (4 vCPU, 8 GB RAM, 240 GB NVMe)
- Docker Compose: all services containerised
- Caddy: reverse proxy, origin TLS
- PM2: Next.js process management
- Loki + Promtail: log aggregation
- GitHub Actions: CI/CD (main→staging, production→prod deploy)
- Alembic: DB migrations (multi-database)

EXTERNAL SERVICES:
- IONOS SMTP: transactional email (OTPs, password reset)
- Cloudflare R2: user-uploaded images (S3-compatible)
- Apache Airflow (local Mac): nightly analytics ETL scheduler
`

type ArchNode = {
  id: string
  label: string
  layer: string
  tech: string
  color: string
  desc: string
  connections: string[]
}

type ArchData = {
  layers: Array<{ id: string; label: string; color: string }>
  nodes: ArchNode[]
  techCards: Array<{ name: string; version: string; role: string; color: string }>
}

export default function ArchitecturePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()
  const [data, setData]         = useState<ArchData | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [zoom, setZoom]         = useState(1)
  const [selected, setSelected] = useState<ArchNode | null>(null)

  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth')
  }, [authLoading, isAuthenticated, router])

  const generate = useCallback(async () => {
    setLoading(true)
    setError('')
    setSelected(null)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: `You are a software architecture analyser. Given a codebase description, return ONLY valid JSON (no markdown, no backticks) describing the system architecture in this exact schema:
{
  "layers": [{"id":"string","label":"string","color":"hex color"}],
  "nodes": [{"id":"string","label":"string","layer":"layer id","tech":"technology name","color":"hex color","desc":"one sentence description","connections":["other node ids"]}],
  "techCards": [{"name":"string","version":"string","role":"string","color":"hex color"}]
}
Rules:
- layers: client, edge, backend, cache, database, infra, external (use these exact ids)
- nodes: 8-16 nodes covering the main architectural components
- connections: directional, show data flow
- techCards: one card per distinct technology, 10-16 total
- colors: use these per layer — client:#2b6cb0, edge:#c05621, backend:#2f855a, cache:#b7791f, database:#6b46c1, infra:#2c7a7b, external:#97266d
- respond with ONLY the JSON object, nothing else`,
          messages: [{
            role: 'user',
            content: `Analyse this system and generate the architecture diagram JSON:\n${ARCHITECTURE_CONTEXT}`,
          }],
        }),
      })
      const result = await response.json()
      const text = result.content?.find((b: any) => b.type === 'text')?.text || ''
      const cleaned = text.replace(/```json|```/g, '').trim()
      const parsed: ArchData = JSON.parse(cleaned)
      setData(parsed)
    } catch (e: any) {
      setError('Failed to generate architecture diagram. Check your API connection.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  if (authLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )
  if (!user || user.role_name !== 'admin')
    return <AccessRestricted requiredRoles={['admin']} currentRole={user?.role_name} />

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-2">
            <Cpu className="text-gisviz-accent" size={24} /> System Architecture
          </h1>
          <p className="text-[12px] font-mono text-gisviz-ink-soft mt-0.5">
            AI-generated from codebase context — not hardcoded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin"
            className="px-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1">
            <ArrowUpRight size={13} /> Admin Home
          </Link>
          <Link href="/admin/erd"
            className="px-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1">
            <ArrowUpRight size={13} /> ERD
          </Link>
          {data && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                className="p-1.5 rounded border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink">
                <ZoomOut size={14} />
              </button>
              <span className="text-[11px] font-mono text-gisviz-ink-soft w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                className="p-1.5 rounded border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink">
                <ZoomIn size={14} />
              </button>
            </>
          )}
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gisviz-accent text-gisviz-white rounded font-mono text-[12px] font-bold hover:bg-opacity-90 disabled:opacity-60">
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : <><RefreshCw size={14} /> {data ? 'Regenerate' : 'Generate Diagram'}</>
            }
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 bg-gisviz-alert/10 border border-gisviz-alert/50 rounded text-[12px] font-mono text-gisviz-alert">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-3 text-gisviz-ink-soft">
          <Cpu size={40} className="opacity-20" />
          <p className="font-mono text-[12px]">Click <strong className="text-gisviz-ink">Generate Diagram</strong> to analyse the codebase.</p>
          <p className="font-mono text-[11px] opacity-60">Claude reads the architecture context and produces the diagram. Takes ~10 seconds.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 size={36} className="animate-spin text-gisviz-accent" />
          <p className="font-mono text-[12px] text-gisviz-ink-soft">Claude is analysing the codebase…</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Layer legend */}
          <div className="flex flex-wrap gap-2 mb-6">
            {data.layers.map(l => (
              <span key={l.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[11px] bg-gisviz-canvas border border-gisviz-border text-gisviz-ink">
                <span className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>

          {/* Architecture diagram — layer-based layout */}
          <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-auto mb-8">
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 0.2s' }}
                 className="p-6 min-w-[800px]">
              <ArchDiagram data={data} selected={selected} onSelect={setSelected} />
            </div>
          </div>

          {/* Selected node detail */}
          {selected && (
            <div className="mb-6 p-4 bg-gisviz-canvas border border-gisviz-accent/30 rounded-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: selected.color }} />
                <span className="font-mono font-bold text-[12px] text-gisviz-ink">{selected.label}</span>
                <span className="text-[11px] font-mono text-gisviz-ink-soft">({selected.tech})</span>
              </div>
              <p className="font-mono text-[12px] text-gisviz-ink-soft">{selected.desc}</p>
              {selected.connections.length > 0 && (
                <p className="font-mono text-[11px] text-gisviz-ink-soft mt-1">
                  Connects to: {selected.connections.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Technology cards */}
          <h2 className="font-mono text-[12px] font-bold text-gisviz-ink-soft uppercase tracking-widest mb-3">
            Technology Stack
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {data.techCards.map(tc => (
              <div key={tc.name}
                className="bg-gisviz-card border border-gisviz-border rounded-sm p-3 shadow-sm hover:border-gisviz-accent transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: tc.color }} />
                  <span className="font-mono font-bold text-[12px] text-gisviz-ink truncate">{tc.name}</span>
                </div>
                {tc.version && (
                  <span className="text-[12px] font-mono text-gisviz-ink-soft">{tc.version}</span>
                )}
                <p className="text-[11px] font-mono text-gisviz-ink-soft mt-1 leading-snug">{tc.role}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── SVG Architecture diagram ──────────────────────────────────────────────────
function ArchDiagram({ data, selected, onSelect }: {
  data: ArchData
  selected: ArchNode | null
  onSelect: (n: ArchNode | null) => void
}) {
  const LAYER_ORDER = ['client', 'edge', 'backend', 'cache', 'database', 'infra', 'external']
  const COL_W = 140, COL_H = 60, GAP_X = 20, GAP_Y = 30, PAD = 20

  // Group nodes by layer, compute positions
  const byLayer: Record<string, ArchNode[]> = {}
  for (const n of data.nodes) {
    if (!byLayer[n.layer]) byLayer[n.layer] = []
    byLayer[n.layer].push(n)
  }

  const positions: Record<string, { x: number; y: number }> = {}
  let currentY = PAD
  const layers = LAYER_ORDER.filter(l => byLayer[l]?.length)

  for (const layerId of layers) {
    const nodes = byLayer[layerId] || []
    const totalW = nodes.length * COL_W + (nodes.length - 1) * GAP_X
    let startX = PAD
    nodes.forEach((n, i) => {
      positions[n.id] = { x: startX + i * (COL_W + GAP_X), y: currentY }
    })
    currentY += COL_H + GAP_Y
  }

  const SVG_W = Math.max(...Object.values(positions).map(p => p.x + COL_W)) + PAD * 2
  const SVG_H = currentY + PAD

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
      {/* Connection lines */}
      {data.nodes.map(n =>
        n.connections.map(targetId => {
          const from = positions[n.id]
          const to   = positions[targetId]
          if (!from || !to) return null
          const x1 = from.x + COL_W / 2
          const y1 = from.y + COL_H
          const x2 = to.x   + COL_W / 2
          const y2 = to.y
          return (
            <line key={`${n.id}-${targetId}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={n.color} strokeWidth="1.5" strokeOpacity="0.35"
              strokeDasharray="4 3"
              markerEnd="url(#arrow)"
            />
          )
        })
      )}
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#8888" />
        </marker>
      </defs>
      {/* Nodes */}
      {data.nodes.map(n => {
        const p = positions[n.id]
        if (!p) return null
        const isSelected = selected?.id === n.id
        return (
          <g key={n.id} onClick={() => onSelect(isSelected ? null : n)}
            style={{ cursor: 'pointer' }}>
            <rect x={p.x} y={p.y} width={COL_W} height={COL_H} rx={4}
              fill={n.color} fillOpacity={isSelected ? 0.25 : 0.12}
              stroke={n.color} strokeWidth={isSelected ? 2 : 1}
              strokeOpacity={0.7}
            />
            <text x={p.x + COL_W / 2} y={p.y + 22} textAnchor="middle"
              fill={n.color} fontSize="11" fontWeight="bold" fontFamily="monospace">
              {n.label.length > 14 ? n.label.slice(0, 13) + '…' : n.label}
            </text>
            <text x={p.x + COL_W / 2} y={p.y + 38} textAnchor="middle"
              fill={n.color} fontSize="9" fontFamily="monospace" opacity="0.7">
              {n.tech.length > 18 ? n.tech.slice(0, 17) + '…' : n.tech}
            </text>
          </g>
        )
      })}
      {/* Layer labels on left */}
      {layers.map((layerId, i) => {
        const nodes = byLayer[layerId]
        const firstPos = positions[nodes[0].id]
        const layerDef = data.layers.find(l => l.id === layerId)
        if (!firstPos || !layerDef) return null
        return (
          <text key={layerId} x={4} y={firstPos.y + COL_H / 2 + 4}
            fill={layerDef.color} fontSize="9" fontFamily="monospace"
            fontWeight="bold" opacity="0.5" writingMode="horizontal-tb">
            {layerDef.label.toUpperCase()}
          </text>
        )
      })}
    </svg>
  )
}