'use client'

/**
 * app/admin/erd/page.tsx
 *
 * Entity-Relationship Diagram — drawn from GET /api/v0/admin/schema.
 * That endpoint introspects the live SQLAlchemy Base.metadata objects,
 * so this diagram cannot drift from the code. No LLM, no hardcoded schema.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Database, Loader2, RefreshCw, ArrowUpRight, ZoomIn, ZoomOut, Key, Link2 } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import AccessRestricted from '../../components/AccessRestricted'

type Column = {
  name: string; type: string; isPK: boolean
  isFK: boolean; fkTarget: string | null; nullable: boolean
}
type ERDTable = {
  id: string; label: string; database: string; dbColor: string; columns: Column[]
}
type Rel = { from: string; fromCol: string; to: string; toCol: string; type: string; crossDb?: boolean }
type SchemaData = { tables: ERDTable[]; relationships: Rel[]; cross_db_refs: Rel[] }

const DB_LABEL: Record<string, string> = {
  users_db: 'Users', posts_db: 'Posts', analytics_db: 'Analytics', admin_db: 'Admin',
}

export default function ERDPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()
  const [data,      setData]      = useState<SchemaData | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [zoom,      setZoom]      = useState(0.75)
  const [selected,  setSelected]  = useState<ERDTable | null>(null)
  const [filterDb,  setFilterDb]  = useState<string | null>(null)
  const [showCross, setShowCross] = useState(false)

  const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v0\/?$/, '').replace(/\/$/, '')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    setLoading(true); setError(''); setSelected(null)
    try {
      const token = localStorage.getItem('gisviz_token')
      const res   = await fetch(`${BASE}/api/v0/admin/schema`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const json: SchemaData = await res.json()
      setData(json)
    } catch (e: any) {
      setError(`Failed to load schema: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [BASE])

  useEffect(() => {
    if (user?.role_name === 'admin') load()
  }, [user, load])

  if (authLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )

  if (!user || user.role_name !== 'admin') {
    return <AccessRestricted requiredRoles={['admin']} currentRole={user?.role_name} backHref="/admin" backLabel="Back to Admin" />
  }

  const visibleTables = data ? (filterDb ? data.tables.filter(t => t.database === filterDb) : data.tables) : []
  const visibleIds    = new Set(visibleTables.map(t => t.id))
  const visibleRels   = data ? data.relationships.filter(r => visibleIds.has(r.from) && visibleIds.has(r.to)) : []
  const visibleCross  = (data && showCross) ? data.cross_db_refs.filter(r => visibleIds.has(r.from) && visibleIds.has(r.to)) : []
  const dbs           = data ? [...new Set(data.tables.map(t => t.database))] : []

  return (
    <div className="max-w-full py-8 px-4 pb-20">

      <div className="mb-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
              <Database className="text-gisviz-accent" size={28} /> Entity Relationship Diagram
            </h1>
            <p className="text-gisviz-ink-soft font-mono text-[12px] mt-1">
              Live from <code className="text-gisviz-ink">GET /api/v0/admin/schema</code> — introspects SQLAlchemy metadata directly.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin"
              className="px-4 py-2 bg-gisviz-canvas border border-gisviz-border rounded-md font-mono text-[12px] text-gisviz-ink hover:border-gisviz-accent transition-colors flex items-center gap-1.5">
              <ArrowUpRight size={14} /> Admin Home
            </Link>
            <button onClick={load} disabled={loading} title="Refresh schema"
              className="p-2 rounded-sm border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-accent hover:border-gisviz-accent transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {data && (
        <div className="mb-4 max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterDb(null)}
              className={`px-3 py-1 rounded-sm text-[12px]  font-mono border transition-colors ${!filterDb ? 'bg-gisviz-ink text-gisviz-canvas border-gisviz-ink' : 'bg-gisviz-card border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
              All ({data.tables.length})
            </button>
            {dbs.map(db => {
              const color = data.tables.find(t => t.database === db)?.dbColor ?? '#888'
              const count = data.tables.filter(t => t.database === db).length
              return (
                <button key={db} onClick={() => setFilterDb(filterDb === db ? null : db)}
                  className={`px-3 py-1 rounded-sm text-[12px]  font-mono border transition-colors ${filterDb === db ? 'text-white border-transparent' : 'bg-gisviz-card border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'}`}
                  style={filterDb === db ? { backgroundColor: color, borderColor: color } : {}}>
                  {DB_LABEL[db] ?? db} ({count})
                </button>
              )
            })}
          </div>

          <button onClick={() => setShowCross(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-[12px]  font-mono border transition-colors ${showCross ? 'bg-gisviz-accent text-white border-gisviz-accent' : 'bg-gisviz-card border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
            <Link2 size={11} /> Cross-DB refs
          </button>

          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
              className="p-1.5 rounded-sm border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
              <ZoomOut size={13} />
            </button>
            <span className="text-[12px]  font-mono text-gisviz-ink-soft w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
              className="p-1.5 rounded-sm border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
              <ZoomIn size={13} />
            </button>
          </div>

          <div className="flex gap-3 ml-2">
            {[{label:'tables',value:visibleTables.length},{label:'relations',value:visibleRels.length+visibleCross.length}].map(s => (
              <div key={s.label} className="px-3 py-1 bg-gisviz-card border border-gisviz-border rounded-sm">
                <span className="text-[16px]  font-mono font-bold text-gisviz-ink">{s.value}</span>
                <span className=" text-[12px] font-mono text-gisviz-ink-soft ml-1">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 max-w-6xl mx-auto px-4 py-3 rounded-sm border border-gisviz-alert/30 bg-gisviz-alert/5 text-[12px] font-mono text-gisviz-alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 bg-gisviz-card border border-gisviz-border rounded-sm max-w-6xl mx-auto">
          <Loader2 size={24} className="animate-spin text-gisviz-accent" />
        </div>
      ) : data ? (
        <div className="overflow-auto border border-gisviz-border rounded-sm bg-gisviz-canvas shadow-sm">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <ERDCanvas
              tables={visibleTables}
              relationships={visibleRels}
              crossRefs={visibleCross}
              selected={selected}
              onSelect={t => setSelected(selected?.id === t.id ? null : t)}
            />
          </div>
        </div>
      ) : null}

      {selected && (
        <div className="mt-4 max-w-6xl mx-auto bg-gisviz-card border rounded-sm shadow-sm overflow-hidden"
             style={{ borderColor: selected.dbColor }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gisviz-border"
               style={{ backgroundColor: selected.dbColor + '18' }}>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selected.dbColor }} />
              <span className="text-[12px] font-mono font-bold text-gisviz-ink uppercase tracking-widest">{selected.id}</span>
              <span className="text-[12px]  font-mono text-gisviz-ink-soft">
                {DB_LABEL[selected.database] ?? selected.database} · {selected.columns.length} columns
              </span>
            </div>
            <button onClick={() => setSelected(null)}
              className="text-[12px]  font-mono text-gisviz-ink-soft hover:text-gisviz-ink transition-colors px-2 py-1">
              close ×
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] font-mono">
              <thead>
                <tr className="border-b border-gisviz-border bg-gisviz-canvas/50">
                  {['Column','Type','PK','FK target','Nullable'].map(h => (
                    <th key={h} className="text-left px-5 py-2 text-gisviz-ink-soft font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.columns.map(col => (
                  <tr key={col.name} className="border-b border-gisviz-border/50 last:border-0 hover:bg-gisviz-canvas/40 transition-colors">
                    <td className="px-5 py-2 text-gisviz-ink flex items-center gap-2">
                      {col.isPK && <Key size={10} className="text-gisviz-accent shrink-0" />}
                      {col.name}
                    </td>
                    <td className="px-4 py-2 text-gisviz-ink-soft">{col.type}</td>
                    <td className="px-4 py-2">{col.isPK ? '✓' : ''}</td>
                    <td className="px-4 py-2 text-gisviz-accent">{col.fkTarget ?? '—'}</td>
                    <td className="px-4 py-2 text-gisviz-ink-soft">{col.nullable ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ERDCanvas({ tables, relationships, crossRefs, selected, onSelect }: {
  tables: ERDTable[]; relationships: Rel[]; crossRefs: Rel[]
  selected: ERDTable | null; onSelect: (t: ERDTable) => void
}) {
  const COL_W  = 210; const ROW_H = 20; const HEAD_H = 30
  const GAP_X  = 40;  const GAP_Y = 28; const COLS   = 4;  const PAD = 30

  const heights: Record<string, number> = {}
  tables.forEach(t => { heights[t.id] = HEAD_H + t.columns.length * ROW_H + 6 })

  const colHeights = Array(COLS).fill(PAD)
  const pos: Record<string, { x: number; y: number; h: number }> = {}
  tables.forEach(t => {
    const c = colHeights.indexOf(Math.min(...colHeights))
    const x = PAD + c * (COL_W + GAP_X)
    const y = colHeights[c]
    const h = heights[t.id]
    pos[t.id] = { x, y, h }
    colHeights[c] += h + GAP_Y
  })

  const SVG_W = COLS * (COL_W + GAP_X) + PAD
  const SVG_H = Math.max(...colHeights) + PAD

  function connector(rel: Rel, color: string, dashed = false) {
    const f = pos[rel.from]; const t = pos[rel.to]
    if (!f || !t) return null
    const fromTbl    = tables.find(tb => tb.id === rel.from)
    const toTbl      = tables.find(tb => tb.id === rel.to)
    const fromColIdx = fromTbl?.columns.findIndex(c => c.name === rel.fromCol) ?? 0
    const toColIdx   = toTbl?.columns.findIndex(c => c.name === rel.toCol) ?? 0
    const x1 = f.x + COL_W; const y1 = f.y + HEAD_H + fromColIdx * ROW_H + ROW_H / 2
    const x2 = t.x;         const y2 = t.y + HEAD_H + toColIdx   * ROW_H + ROW_H / 2
    const mx = (x1 + x2) / 2
    return (
      <path key={`${rel.from}-${rel.fromCol}-${rel.to}-${rel.toCol}`}
        d={`M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
        fill="none" stroke={color} strokeWidth="1.2"
        strokeDasharray={dashed ? '5 3' : undefined}
        opacity="0.6" markerEnd={`url(#ea-${color.replace('#', '')})`} />
    )
  }

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ minWidth: SVG_W, display: 'block' }}>
      <defs>
        {['#888','#c05621'].map(c => (
          <marker key={c} id={`ea-${c.replace('#','')}`} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill={c} opacity="0.7" />
          </marker>
        ))}
      </defs>

      {relationships.map(rel => connector(rel, '#888', false))}
      {crossRefs.map(rel => connector(rel, '#c05621', true))}

      {tables.map(t => {
        const p = pos[t.id]; if (!p) return null
        const isSelected = selected?.id === t.id
        return (
          <g key={t.id} onClick={() => onSelect(t)} style={{ cursor: 'pointer' }}>
            <rect x={p.x+2} y={p.y+2} width={COL_W} height={p.h} rx={4} fill="#0001" />
            <rect x={p.x} y={p.y} width={COL_W} height={p.h} rx={4}
              fill="#FDFCF9" stroke={isSelected ? t.dbColor : '#D9D5CC'} strokeWidth={isSelected ? 2 : 1} />
            <rect x={p.x} y={p.y} width={COL_W} height={HEAD_H} rx={4} fill={t.dbColor} />
            <rect x={p.x} y={p.y+HEAD_H-4} width={COL_W} height={4} fill={t.dbColor} />
            <text x={p.x+10} y={p.y+HEAD_H/2+5} fontSize="11" fontWeight="700" fill="#fff" fontFamily="monospace">
              {t.id}
            </text>
            {t.columns.map((col, ci) => {
              const cy = p.y + HEAD_H + ci * ROW_H + ROW_H / 2 + 4
              return (
                <g key={col.name}>
                  {col.isPK && <circle cx={p.x+12} cy={cy-3} r={3} fill={t.dbColor} opacity="0.8" />}
                  {col.isFK && !col.isPK && (
                    <path d={`M${p.x+12},${cy-5} L${p.x+15},${cy-2} L${p.x+12},${cy+1} L${p.x+9},${cy-2} Z`}
                          fill="#8A8780" opacity="0.6" />
                  )}
                  <text x={p.x+22} y={cy} fontSize="10" fontFamily="monospace"
                    fill={col.isPK ? '#2A2A28' : '#8A8780'} fontWeight={col.isPK ? '700' : '400'}>
                    {col.name}
                  </text>
                  <text x={p.x+COL_W-8} y={cy} fontSize="9" fill="#B0ADA8" textAnchor="end" fontFamily="monospace">
                    {col.type.split('(')[0].substring(0,10)}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}