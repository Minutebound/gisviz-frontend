'use client'

/**
 * app/admin/erd/page.tsx
 *
 * Generates a live Entity-Relationship Diagram by sending the actual
 * SQLAlchemy model definitions (from models.py) to Claude. Claude
 * returns structured JSON of tables, columns, and relationships which
 * this page renders as an interactive SVG ERD.
 *
 * Nothing is hardcoded — add a table to models.py, update the
 * MODELS_CONTEXT string below, and click Regenerate.
 */

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Database, Loader2, RefreshCw, ArrowUpRight, ZoomIn, ZoomOut, Key } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import AccessRestricted from '../../components/AccessRestricted'

// ── Actual model definitions (update when models.py changes) ─────────────────
const MODELS_CONTEXT = `
DATABASE: users_db (UsersBase)

Table: roles
  role_id    INTEGER PK autoincrement
  name       VARCHAR(50) UNIQUE NOT NULL
  permissions JSONB DEFAULT {}

Table: platform_users
  user_id           UUID PK
  user_handle       VARCHAR(50) UNIQUE NOT NULL INDEX
  email_address     VARCHAR(255) UNIQUE NOT NULL INDEX
  hashed_security_password VARCHAR NOT NULL
  is_verified       INTEGER DEFAULT 0
  verification_otp  VARCHAR(6) nullable
  otp_expires_at    TIMESTAMPTZ nullable
  password_reset_token VARCHAR(64) nullable
  reset_token_expires_at TIMESTAMPTZ nullable
  avatar_path       VARCHAR nullable
  banner_path       VARCHAR nullable
  title             VARCHAR(100) nullable
  linkedin_url      VARCHAR(255) nullable
  medium_url        VARCHAR(255) nullable
  website_url       VARCHAR(255) nullable
  role_id           INTEGER FK roles.role_id INDEX nullable
  follower_count    INTEGER DEFAULT 0
  following_count   INTEGER DEFAULT 0
  post_count        INTEGER DEFAULT 0
  is_active         INTEGER DEFAULT 1
  created_timestamp TIMESTAMPTZ DEFAULT now()
  updated_timestamp TIMESTAMPTZ

Table: user_locations
  location_id  UUID PK
  user_id      UUID FK platform_users.user_id UNIQUE
  place        VARCHAR(100) nullable
  state        VARCHAR(100) nullable
  country      VARCHAR(100) nullable
  formatted_string VARCHAR(255) nullable

Table: follow_events
  event_id       UUID PK
  actor_user_id  UUID NOT NULL INDEX
  target_user_id UUID NOT NULL INDEX
  action         VARCHAR(10) NOT NULL
  occurred_timestamp TIMESTAMPTZ DEFAULT now()

Table: follows_current
  actor_user_id  UUID PK
  target_user_id UUID PK
  followed_since TIMESTAMPTZ DEFAULT now()

Table: support_tickets
  ticket_id     UUID PK
  user_id       UUID FK platform_users.user_id nullable ondelete SET NULL
  contact_email VARCHAR(255) nullable
  category      VARCHAR(50) NOT NULL INDEX
  subject       VARCHAR(255) NOT NULL
  description   TEXT NOT NULL
  status        VARCHAR(20) DEFAULT open INDEX
  created_timestamp TIMESTAMPTZ DEFAULT now()
  updated_timestamp TIMESTAMPTZ

---
DATABASE: posts_db (PostsBase)

Table: posts
  post_id              UUID PK
  publisher_user_id    UUID NOT NULL INDEX
  title                VARCHAR(255) NOT NULL
  description          TEXT nullable
  visual_image_path    VARCHAR nullable
  note                 TEXT nullable
  source_name          VARCHAR(255) nullable
  source_url           VARCHAR(1024) nullable
  share_slug           VARCHAR(32) UNIQUE INDEX NOT NULL
  total_likes_count    INTEGER DEFAULT 0
  total_comments_count INTEGER DEFAULT 0
  is_active            INTEGER DEFAULT 1 INDEX
  created_timestamp    TIMESTAMPTZ DEFAULT now()
  updated_timestamp    TIMESTAMPTZ

Table: post_likes
  like_id           UUID PK
  post_id           UUID FK posts.post_id CASCADE INDEX
  user_id           UUID NOT NULL INDEX
  created_timestamp TIMESTAMPTZ
  UNIQUE(post_id, user_id)

Table: post_bookmarks
  bookmark_id       UUID PK
  post_id           UUID FK posts.post_id CASCADE INDEX
  user_id           UUID NOT NULL INDEX
  created_timestamp TIMESTAMPTZ
  UNIQUE(post_id, user_id)

Table: post_comments
  comment_id        UUID PK
  post_id           UUID FK posts.post_id CASCADE INDEX
  user_id           UUID NOT NULL INDEX
  parent_comment_id UUID FK post_comments.comment_id CASCADE nullable
  content           TEXT NOT NULL
  is_edited         INTEGER DEFAULT 0
  created_timestamp TIMESTAMPTZ
  updated_timestamp TIMESTAMPTZ

Table: categories
  category_id       INTEGER PK autoincrement
  slug              VARCHAR(60) UNIQUE INDEX NOT NULL
  label             VARCHAR(80) NOT NULL
  usage_count       INTEGER DEFAULT 0
  created_timestamp TIMESTAMPTZ

Table: post_categories
  post_id     UUID PK FK posts.post_id CASCADE
  category_id INTEGER PK FK categories.category_id CASCADE

Table: keywords
  keyword_id  INTEGER PK autoincrement
  word        VARCHAR(80) UNIQUE INDEX NOT NULL
  usage_count INTEGER DEFAULT 0

Table: post_keywords
  post_id    UUID PK FK posts.post_id CASCADE
  keyword_id INTEGER PK FK keywords.keyword_id CASCADE

Table: pending_categories
  pending_id           UUID PK
  label                VARCHAR(80) NOT NULL
  normalized_slug      VARCHAR(60) NOT NULL INDEX
  suggested_by_user_id UUID NOT NULL INDEX
  status               VARCHAR(12) DEFAULT pending INDEX
  created_timestamp    TIMESTAMPTZ
  reviewed_timestamp   TIMESTAMPTZ nullable

Table: post_reports
  report_id        UUID PK
  post_id          UUID FK posts.post_id CASCADE INDEX
  reporter_user_id UUID NOT NULL INDEX
  reason           TEXT NOT NULL
  status           VARCHAR(20) DEFAULT open
  created_timestamp TIMESTAMPTZ

---
DATABASE: analytics_db (AnalyticsBase)

Table: dim_date
  date_key     DATE PK
  year         INTEGER
  quarter      INTEGER
  month        INTEGER
  day          INTEGER
  day_of_week  INTEGER
  week_of_year INTEGER
  is_weekend   INTEGER

Table: dim_user
  user_id            UUID PK
  user_handle        VARCHAR(50)
  role_name          VARCHAR(50) nullable
  first_seen_date    DATE nullable
  last_synced_timestamp TIMESTAMPTZ

Table: dim_post
  post_id            UUID PK
  title              VARCHAR(255) nullable
  publisher_user_id  UUID nullable INDEX
  publisher_handle   VARCHAR(50) nullable
  created_date       DATE nullable
  last_synced_timestamp TIMESTAMPTZ

Table: dim_category
  category_id        INTEGER PK
  slug               VARCHAR(60)
  label              VARCHAR(80)
  last_synced_timestamp TIMESTAMPTZ

Table: fact_daily_snapshot
  snapshot_date    DATE PK FK dim_date.date_key
  total_users      BIGINT
  total_posts      BIGINT
  total_likes      BIGINT
  total_bookmarks  BIGINT
  total_comments   BIGINT
  total_follows    BIGINT
  total_categories BIGINT
  total_keywords   BIGINT
  open_reports     BIGINT
  new_users        INTEGER
  new_posts        INTEGER
  captured_timestamp TIMESTAMPTZ

Table: fact_post_engagement
  snapshot_date DATE PK FK dim_date.date_key
  post_id       UUID PK
  likes         BIGINT
  bookmarks     BIGINT
  comments      BIGINT
  captured_timestamp TIMESTAMPTZ

Table: fact_category_daily
  snapshot_date DATE PK FK dim_date.date_key
  category_id   INTEGER PK
  usage_count   BIGINT
  post_count    BIGINT
  captured_timestamp TIMESTAMPTZ

Table: fact_weekly_delta
  snapshot_date        DATE PK
  this_week_new_users  INTEGER
  this_week_new_posts  INTEGER
  last_week_new_users  INTEGER
  last_week_new_posts  INTEGER
  captured_timestamp   TIMESTAMPTZ

Table: fact_top_post
  snapshot_date        DATE PK
  rank_by              VARCHAR(12) PK
  rank                 INTEGER PK
  post_id              UUID
  title                VARCHAR(255) nullable
  publisher_handle     VARCHAR(50) nullable
  total_likes_count    BIGINT
  total_comments_count BIGINT
  metric_value         BIGINT
  captured_timestamp   TIMESTAMPTZ

Table: fact_top_user
  snapshot_date  DATE PK
  rank_by        VARCHAR(12) PK
  rank           INTEGER PK
  user_id        UUID
  user_handle    VARCHAR(50) nullable
  role_name      VARCHAR(50) nullable
  follower_count BIGINT
  post_count     BIGINT
  metric_value   BIGINT
  captured_timestamp TIMESTAMPTZ

Table: fact_top_commenter
  snapshot_date  DATE PK
  rank           INTEGER PK
  user_id        UUID
  user_handle    VARCHAR(50) nullable
  comment_count  BIGINT
  captured_timestamp TIMESTAMPTZ

Table: etl_run_log
  run_id             UUID PK
  job_name           VARCHAR(80) INDEX
  snapshot_date      DATE nullable INDEX
  status             VARCHAR(20)
  rows_written       INTEGER
  error_message      TEXT nullable
  started_timestamp  TIMESTAMPTZ
  finished_timestamp TIMESTAMPTZ nullable
  duration_seconds   NUMERIC(10,3) nullable

---
DATABASE: admin_db (AdminBase)

Table: admin_action_log
  action_id          UUID PK
  admin_user_id      UUID NOT NULL INDEX
  admin_handle       VARCHAR(50) nullable
  action_type        VARCHAR(60) NOT NULL INDEX
  target_type        VARCHAR(40) nullable
  target_id          VARCHAR(64) nullable INDEX
  payload            JSONB
  ip_address         VARCHAR(64) nullable
  occurred_timestamp TIMESTAMPTZ INDEX

Table: role_change_history
  change_id          UUID PK
  subject_user_id    UUID NOT NULL INDEX
  changed_by_user_id UUID NOT NULL INDEX
  old_role           VARCHAR(50) nullable
  new_role           VARCHAR(50) NOT NULL
  reason             TEXT nullable
  occurred_timestamp TIMESTAMPTZ INDEX

Table: report_resolution
  resolution_id      UUID PK
  report_id          UUID NOT NULL INDEX
  post_id            UUID nullable INDEX
  resolved_by_user_id UUID NOT NULL INDEX
  resolution         VARCHAR(30) NOT NULL
  notes              TEXT nullable
  occurred_timestamp TIMESTAMPTZ INDEX

Table: admin_setting
  setting_key        VARCHAR(80) PK
  setting_value      JSONB
  updated_by_user_id UUID nullable
  updated_timestamp  TIMESTAMPTZ
`

type Column = {
  name: string
  type: string
  isPK: boolean
  isFK: boolean
  fkTarget?: string
  nullable: boolean
}
type ERDTable = {
  id: string
  label: string
  database: string
  dbColor: string
  columns: Column[]
}
type ERDRelationship = {
  from: string
  fromCol: string
  to: string
  toCol: string
  type: '1:N' | 'N:M' | '1:1'
}
type ERDData = {
  tables: ERDTable[]
  relationships: ERDRelationship[]
}

const DB_COLORS: Record<string, string> = {
  users_db:     '#2b6cb0',
  posts_db:     '#2f855a',
  analytics_db: '#6b46c1',
  admin_db:     '#c05621',
}

export default function ERDPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()
  const [data, setData]           = useState<ERDData | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [zoom, setZoom]           = useState(0.75)
  const [selectedDb, setSelectedDb] = useState<string | null>(null)
  const [selected, setSelected]   = useState<ERDTable | null>(null)

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
          max_tokens: 6000,
          system: `You are a database schema analyser. Given SQLAlchemy model definitions, return ONLY valid JSON (no markdown, no backticks) in this exact schema:
{
  "tables": [
    {
      "id": "table_name",
      "label": "Display Name",
      "database": "users_db|posts_db|analytics_db|admin_db",
      "dbColor": "#hex",
      "columns": [
        {"name":"col_name","type":"TYPE","isPK":bool,"isFK":bool,"fkTarget":"other_table.col or null","nullable":bool}
      ]
    }
  ],
  "relationships": [
    {"from":"table_id","fromCol":"col","to":"table_id","toCol":"col","type":"1:N|N:M|1:1"}
  ]
}
Rules:
- Include ALL tables from the model definitions
- dbColor values: users_db=#2b6cb0, posts_db=#2f855a, analytics_db=#6b46c1, admin_db=#c05621
- Only include actual FK relationships, not cross-DB references (different databases can't FK each other)
- Respond ONLY with the JSON object`,
          messages: [{
            role: 'user',
            content: `Generate the ERD JSON from these model definitions:\n${MODELS_CONTEXT}`,
          }],
        }),
      })
      const result = await response.json()
      const text = result.content?.find((b: any) => b.type === 'text')?.text || ''
      const cleaned = text.replace(/```json|```/g, '').trim()
      const parsed: ERDData = JSON.parse(cleaned)
      setData(parsed)
    } catch (e: any) {
      setError('Failed to generate ERD. Check your API connection and try again.')
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

  const databases = data ? [...new Set(data.tables.map(t => t.database))] : []
  const visibleTables = data
    ? selectedDb ? data.tables.filter(t => t.database === selectedDb) : data.tables
    : []

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-2">
            <Database className="text-gisviz-accent" size={24} /> Entity-Relationship Diagram
          </h1>
          <p className="text-[12px] font-mono text-gisviz-ink-soft mt-0.5">
            AI-generated from models.py — {data ? `${data.tables.length} tables · ${data.relationships.length} relationships` : 'not generated yet'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin"
            className="px-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1">
            <ArrowUpRight size={13} /> Admin Home
          </Link>
          <Link href="/admin/architecture"
            className="px-3 py-1.5 bg-gisviz-canvas border border-gisviz-border rounded font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1">
            <ArrowUpRight size={13} /> Architecture
          </Link>
          {data && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
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
              : <><RefreshCw size={14} /> {data ? 'Regenerate' : 'Generate ERD'}</>
            }
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-gisviz-alert/10 border border-gisviz-alert/50 rounded text-[12px] font-mono text-gisviz-alert">{error}</div>
      )}

      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-3 text-gisviz-ink-soft">
          <Database size={40} className="opacity-20" />
          <p className="font-mono text-[12px]">Click <strong className="text-gisviz-ink">Generate ERD</strong> to build the diagram from your model definitions.</p>
          <p className="font-mono text-[11px] opacity-60">All 4 databases · {MODELS_CONTEXT.split('Table:').length - 1} tables · Takes ~15 seconds</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 size={36} className="animate-spin text-gisviz-accent" />
          <p className="font-mono text-[12px] text-gisviz-ink-soft">Claude is parsing all 4 databases…</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* DB filter tabs */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button onClick={() => setSelectedDb(null)}
              className={`px-3 py-1 rounded font-mono text-[11px] transition-colors ${
                !selectedDb ? 'bg-gisviz-accent text-white' : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'
              }`}>All ({data.tables.length})</button>
            {databases.map(db => (
              <button key={db} onClick={() => setSelectedDb(db === selectedDb ? null : db)}
                className={`px-3 py-1 rounded font-mono text-[11px] transition-colors flex items-center gap-1.5 ${
                  selectedDb === db ? 'text-white' : 'bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'
                }`}
                style={selectedDb === db ? { background: DB_COLORS[db] } : {}}>
                <span className="w-2 h-2 rounded-sm" style={{ background: DB_COLORS[db] }} />
                {db} ({data.tables.filter(t => t.database === db).length})
              </button>
            ))}
          </div>

          {/* ERD canvas */}
          <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-auto mb-6" style={{ maxHeight: '70vh' }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 0.2s' }}>
              <ERDCanvas
                tables={visibleTables}
                relationships={data.relationships.filter(r =>
                  visibleTables.find(t => t.id === r.from) && visibleTables.find(t => t.id === r.to)
                )}
                selected={selected}
                onSelect={t => setSelected(selected?.id === t.id ? null : t)}
              />
            </div>
          </div>

          {/* Selected table detail */}
          {selected && (
            <div className="mb-6 bg-gisviz-card border border-gisviz-border rounded-sm shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gisviz-border"
                   style={{ borderLeftColor: selected.dbColor, borderLeftWidth: 3 }}>
                <Database size={13} style={{ color: selected.dbColor }} />
                <span className="font-mono font-bold text-[12px] text-gisviz-ink">{selected.label}</span>
                <span className="text-[11px] font-mono text-gisviz-ink-soft">({selected.database})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="border-b border-gisviz-border bg-gisviz-canvas/50">
                      <th className="text-left px-4 py-2 text-gisviz-ink-soft uppercase">Column</th>
                      <th className="text-left px-4 py-2 text-gisviz-ink-soft uppercase">Type</th>
                      <th className="text-left px-4 py-2 text-gisviz-ink-soft uppercase">Key</th>
                      <th className="text-left px-4 py-2 text-gisviz-ink-soft uppercase">Nullable</th>
                      <th className="text-left px-4 py-2 text-gisviz-ink-soft uppercase">References</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gisviz-border/50">
                    {selected.columns.map(col => (
                      <tr key={col.name} className="hover:bg-gisviz-canvas/30">
                        <td className="px-4 py-1.5 font-bold text-gisviz-ink">{col.name}</td>
                        <td className="px-4 py-1.5 text-gisviz-ink-soft">{col.type}</td>
                        <td className="px-4 py-1.5">
                          {col.isPK && <span className="text-yellow-600 font-bold">PK</span>}
                          {col.isFK && <span className="text-blue-600 font-bold ml-1">FK</span>}
                        </td>
                        <td className="px-4 py-1.5 text-gisviz-ink-soft">{col.nullable ? 'yes' : 'no'}</td>
                        <td className="px-4 py-1.5 text-gisviz-accent">{col.fkTarget || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── ERD Canvas ────────────────────────────────────────────────────────────────
function ERDCanvas({ tables, relationships, selected, onSelect }: {
  tables: ERDTable[]
  relationships: ERDRelationship[]
  selected: ERDTable | null
  onSelect: (t: ERDTable) => void
}) {
  const COL_W = 200
  const ROW_H = 22
  const HEADER_H = 32
  const PAD = 30
  const COLS = 4

  // Compute table height and position in grid
  const tableHeights: Record<string, number> = {}
  const positions: Record<string, { x: number; y: number; h: number }> = {}

  tables.forEach((t, i) => {
    const h = HEADER_H + t.columns.length * ROW_H + 8
    tableHeights[t.id] = h
  })

  // Group by DB for better layout
  const byDb: Record<string, ERDTable[]> = {}
  for (const t of tables) {
    if (!byDb[t.database]) byDb[t.database] = []
    byDb[t.database].push(t)
  }

  let col = 0, row = 0
  const colHeights = Array(COLS).fill(PAD)

  tables.forEach((t) => {
    const c = col % COLS
    const x = PAD + c * (COL_W + PAD)
    const y = colHeights[c]
    const h = tableHeights[t.id]
    positions[t.id] = { x, y, h }
    colHeights[c] += h + PAD
    col++
  })

  const SVG_W = COLS * (COL_W + PAD) + PAD
  const SVG_H = Math.max(...colHeights) + PAD

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
         style={{ minWidth: SVG_W, minHeight: SVG_H }}>
      <defs>
        <marker id="erd-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#8884" />
        </marker>
      </defs>

      {/* Relationships */}
      {relationships.map((rel, i) => {
        const from = positions[rel.from]
        const to   = positions[rel.to]
        if (!from || !to) return null
        // Find column index for y offset
        const fromTbl = tables.find(t => t.id === rel.from)
        const toTbl   = tables.find(t => t.id === rel.to)
        const fromColIdx = fromTbl?.columns.findIndex(c => c.name === rel.fromCol) ?? 0
        const toColIdx   = toTbl?.columns.findIndex(c => c.name === rel.toCol) ?? 0
        const x1 = from.x + COL_W
        const y1 = from.y + HEADER_H + fromColIdx * ROW_H + ROW_H / 2
        const x2 = to.x
        const y2 = to.y + HEADER_H + toColIdx * ROW_H + ROW_H / 2
        const mx = (x1 + x2) / 2
        return (
          <g key={i}>
            <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none" stroke="#6666" strokeWidth="1.5"
              strokeDasharray="4 3" markerEnd="url(#erd-arrow)" />
            <text x={mx} y={Math.min(y1, y2) - 4} textAnchor="middle"
              fill="#8888" fontSize="8" fontFamily="monospace">{rel.type}</text>
          </g>
        )
      })}

      {/* Tables */}
      {tables.map(t => {
        const p = positions[t.id]
        if (!p) return null
        const isSelected = selected?.id === t.id
        return (
          <g key={t.id} onClick={() => onSelect(t)} style={{ cursor: 'pointer' }}>
            {/* Header */}
            <rect x={p.x} y={p.y} width={COL_W} height={p.h} rx={4}
              fill={isSelected ? `${t.dbColor}22` : '#fff'}
              stroke={isSelected ? t.dbColor : '#ddd'} strokeWidth={isSelected ? 2 : 1} />
            <rect x={p.x} y={p.y} width={COL_W} height={HEADER_H} rx={4}
              fill={t.dbColor} fillOpacity={0.85} />
            <rect x={p.x} y={p.y + HEADER_H - 4} width={COL_W} height={4} fill={t.dbColor} fillOpacity={0.85} />
            <text x={p.x + 8} y={p.y + 21}
              fill="white" fontSize="11" fontWeight="bold" fontFamily="monospace">
              {t.label.length > 22 ? t.label.slice(0, 21) + '…' : t.label}
            </text>
            {/* Columns */}
            {t.columns.map((col, ci) => {
              const cy = p.y + HEADER_H + ci * ROW_H + 4
              return (
                <g key={col.name}>
                  <text x={p.x + 8} y={cy + 14}
                    fill={col.isPK ? '#c05621' : col.isFK ? '#2b6cb0' : '#444'}
                    fontSize="9" fontFamily="monospace" fontWeight={col.isPK || col.isFK ? 'bold' : 'normal'}>
                    {col.isPK ? '🔑 ' : col.isFK ? '🔗 ' : '  '}
                    {col.name.length > 18 ? col.name.slice(0, 17) + '…' : col.name}
                  </text>
                  <text x={p.x + COL_W - 4} y={cy + 14} textAnchor="end"
                    fill="#aaa" fontSize="8" fontFamily="monospace">
                    {col.type.length > 14 ? col.type.slice(0, 13) : col.type}
                    {col.nullable ? '?' : ''}
                  </text>
                  {ci < t.columns.length - 1 && (
                    <line x1={p.x + 4} y1={cy + ROW_H} x2={p.x + COL_W - 4} y2={cy + ROW_H}
                      stroke="#eee" strokeWidth="0.5" />
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}