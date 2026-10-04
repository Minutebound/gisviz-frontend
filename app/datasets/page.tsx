'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  ChevronDown,
  Info,
  ArrowUpRight,
  Loader2,
  Settings2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../connector/api'
import { canManageDatasets } from '../../lib/roles'
import type { CatalogDetail, CatalogPage, DatasetCard as Card } from '../../types/visuals'

const PAGE_SIZE = 20
type Tab = 'all' | 'spatial' | 'tabular'

function FormatBadge({ format }: { format?: string | null }) {
  const formatLabels: Record<string, { label: string; bg: string; text: string }> = {
    geojson: { label: 'GeoJSON', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300' },
    csv: { label: 'CSV', bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300' },
    tsv: { label: 'TSV', bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300' },
    duckdb: { label: 'DuckDB', bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
    parquet: { label: 'Parquet', bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-700 dark:text-sky-300' },
    json: { label: 'JSON', bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300' },
    gpkg: { label: 'GeoPackage', bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300' },
    shp: { label: 'Shapefile', bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
    kml: { label: 'KML', bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
  }
  const f = (format || '').toLowerCase()
  const match = formatLabels[f] || { label: f ? f.toUpperCase() : 'DATA', bg: 'bg-gisviz-rail-soft', text: 'text-gisviz-ink' }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono text-[11px] font-semibold ${match.bg} ${match.text}`}>
      {match.label}
    </span>
  )
}

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

const fmtBytes = (n?: number | null) => {
  if (n === null || n === undefined) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

const fmtBbox = (b?: number[] | null) =>
  b && b.length === 4 ? `[${b.map(v => Number(v).toFixed(3)).join(', ')}]` : 'Not spatial'

function DatasetCard({ dataset }: { dataset: Card }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<CatalogDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const isSpatial = !!dataset.geometry_type

  // this dataset's columns + post count are fetched only when its Metadata button is clicked
  useEffect(() => {
    if (!expanded || detail) return
    let cancelled = false
    gisvizApi.fetchCatalogDataset(dataset.dataset_id)
      .then((r: CatalogDetail) => { if (!cancelled) setDetail(r) })
      .catch(() => { if (!cancelled) setDetailError('Could not load the metadata.') })
    return () => { cancelled = true }
  }, [expanded, detail, dataset.dataset_id])

  const sourceHref = dataset.source_url
    ? (dataset.source_url.startsWith('http') ? dataset.source_url : `https://${dataset.source_url}`)
    : null

  return (
    <article className="w-full rounded-xl border border-gisviz-border bg-gisviz-card hover:border-gisviz-border-strong hover:shadow-sm transition-all flex flex-col overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <FormatBadge format={dataset.format} />
            <span className="text-[12px] font-mono text-gisviz-ink-soft">{isSpatial ? (dataset.crs || 'EPSG:4326') : 'Tabular'}</span>
            {dataset.category && (
              <>
                <span className="text-[12px] text-gisviz-border-strong">·</span>
                <span className="text-[12px] font-medium text-gisviz-ink-soft capitalize">{dataset.category}</span>
              </>
            )}
          </div>

          <h2 className="font-display text-[18px] font-bold text-gisviz-ink tracking-tight mb-1.5">
            {dataset.title}
          </h2>
          {dataset.description && (
            <p className="text-[14px] text-gisviz-ink-soft leading-relaxed max-w-4xl line-clamp-2 lg:line-clamp-1">
              {dataset.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[12.5px] text-gisviz-ink-soft">
            <div>
              <span className="text-gisviz-ink-soft/80">Brought to you by: </span>
              {sourceHref ? (
                <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-gisviz-ink hover:text-gisviz-accent transition-colors">
                  {dataset.publisher || dataset.source_name || 'Source'}
                </a>
              ) : (
                <span className="font-semibold text-gisviz-ink">{dataset.publisher || dataset.source_name || 'GISViz'}</span>
              )}
            </div>
            <span className="hidden sm:inline text-gisviz-border-strong">·</span>
            <span>Updated {fmtDate(dataset.updated_at)}</span>
            <span className="hidden sm:inline text-gisviz-border-strong">·</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 font-medium text-gisviz-ink hover:text-gisviz-accent transition-colors"
            >
              <Info size={14} />
              {expanded ? 'Hide Metadata' : 'Metadata'}
              <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-6 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-gisviz-border/60">
          <div className="grid grid-cols-2 lg:flex items-center gap-6 text-left lg:text-right font-mono text-[12.5px]">
            <div>
              <span className="block text-[10.5px] uppercase tracking-wider text-gisviz-ink-soft/70">{isSpatial ? 'Features' : 'Rows'}</span>
              <span className="font-semibold text-gisviz-ink">{Number(dataset.row_count || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="block text-[10.5px] uppercase tracking-wider text-gisviz-ink-soft/70">Geometry</span>
              <span className="font-semibold text-gisviz-ink">{dataset.geometry_type || 'None'}</span>
            </div>
            <div>
              <span className="block text-[10.5px] uppercase tracking-wider text-gisviz-ink-soft/70">Size</span>
              <span className="font-semibold text-gisviz-ink">{fmtBytes(dataset.file_size_bytes)}</span>
            </div>
          </div>

          <div className="shrink-0 min-w-[140px] flex justify-end">
            {sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open the source of this data${dataset.source_name ? ` (${dataset.source_name})` : ''}`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] bg-gisviz-accent text-[13px] font-semibold text-[color:var(--accent-on)] hover:brightness-105 transition-all shadow-sm"
              >
                Access Data <ArrowUpRight size={14} className="opacity-70" />
              </a>
            ) : (
              <span className="inline-flex items-center h-9 px-4 rounded-[8px] border border-gisviz-border text-[12.5px] text-gisviz-ink-soft" title="No public source link for this dataset">
                No source link
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gisviz-border/60 bg-gisviz-paper/40 p-5 sm:px-6 sm:py-6 text-[13px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3">
              <h4 className="font-semibold text-gisviz-ink mb-3 font-mono text-[11px] uppercase tracking-wider">
                Columns
              </h4>
              <div className="rounded-lg border border-gisviz-border bg-gisviz-card overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gisviz-paper/60 text-[11.5px] text-gisviz-ink-soft border-b border-gisviz-border">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Field Name</th>
                      <th className="px-4 py-2.5 font-medium">Data Type</th>
                      <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gisviz-border/50 text-[12.5px]">
                    {!detail && !detailError && (
                      <tr><td colSpan={3} className="px-4 py-5 text-center"><Loader2 size={16} className="inline animate-spin text-gisviz-accent" /></td></tr>
                    )}
                    {detailError && (
                      <tr><td colSpan={3} className="px-4 py-4 text-center text-gisviz-alert">{detailError}</td></tr>
                    )}
                    {detail && detail.columns.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-gisviz-ink-soft italic">
                          No column information for this dataset.
                        </td>
                      </tr>
                    )}
                    {detail?.columns.map(f => (
                      <tr key={f.column_name}>
                        <td className="px-4 py-2.5 font-mono text-gisviz-ink font-medium">{f.column_name}</td>
                        <td className="px-4 py-2.5 font-mono text-gisviz-accent">{(f.sql_type || f.dtype).toLowerCase()}</td>
                        <td className="px-4 py-2.5 text-gisviz-ink-soft hidden sm:table-cell">
                          {f.label && f.label !== f.column_name ? `${f.label} · ` : ''}{f.dtype} · {Number(f.n_distinct).toLocaleString()} distinct
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-gisviz-border/60 pt-5 lg:pt-0 lg:pl-6">
              <h4 className="font-semibold text-gisviz-ink mb-3 font-mono text-[11px] uppercase tracking-wider">
                Metadata
              </h4>
              <dl className="flex flex-col gap-4">
                <div>
                  <dt className="text-[11.5px] text-gisviz-ink-soft mb-1">Bounding Box (BBox)</dt>
                  <dd className="font-mono text-[11.5px] text-gisviz-ink bg-gisviz-card border border-gisviz-border rounded-md px-2.5 py-1.5 break-all">
                    {fmtBbox(dataset.bbox)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-gisviz-ink-soft mb-1">File Size</dt>
                  <dd className="text-[13px] text-gisviz-ink font-medium">{fmtBytes(dataset.file_size_bytes)}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-gisviz-ink-soft mb-1">Dataset ID</dt>
                  <dd className="font-mono text-[12px] text-gisviz-ink">{dataset.dataset_id}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-gisviz-ink-soft mb-1">License & Terms</dt>
                  <dd className="text-[13px] text-gisviz-ink font-medium">{dataset.license || 'Unknown'}</dd>
                </div>
                {dataset.source_name && (
                  <div>
                    <dt className="text-[11.5px] text-gisviz-ink-soft mb-1">Source</dt>
                    <dd className="text-[13px] text-gisviz-ink font-medium">
                      {sourceHref
                        ? <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="hover:text-gisviz-accent">{dataset.source_name}</a>
                        : dataset.source_name}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-[11.5px] text-gisviz-ink-soft mb-1">Posts Using It</dt>
                  <dd className="text-[13px] text-gisviz-ink font-medium">{detail ? detail.post_count : '…'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export default function DatasetsPage() {
  const { user } = useAuth() as any
  const manager = !!user && canManageDatasets(user)

  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [category, setCategory] = useState('')
  const [items, setItems] = useState<Card[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<CatalogPage['categories']>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const query = (skip: number) =>
    gisvizApi.listCatalog({ q: term, category, kind: activeTab === 'all' ? '' : activeTab, skip, limit: PAGE_SIZE })

  // first page whenever a filter changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    query(0)
      .then((r: CatalogPage) => {
        if (cancelled) return
        setItems(r.items); setTotal(r.total); setCategories(r.categories); setError('')
      })
      .catch(() => { if (!cancelled) setError('Could not load the dataset catalog.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, category, activeTab])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const r: CatalogPage = await query(items.length)
      setItems(prev => [...prev, ...r.items]); setTotal(r.total)
    } catch { setError('Could not load more datasets.') }
    finally { setLoadingMore(false) }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      <header className="flex flex-col gap-5 pb-6 border-b border-gisviz-border">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-[-0.03em] text-gisviz-ink mt-1">
            Datasets
          </h1>
          <p className="text-[14.5px] text-gisviz-ink-soft mt-1 max-w-xl">
            Access geospatial layers in standard formats.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search format, layer, region..."
              className="w-full h-10 pl-9 pr-3 rounded-[10px] border border-gisviz-border bg-gisviz-card text-[13.5px] text-gisviz-ink placeholder:text-gisviz-ink-soft focus:outline-none focus:ring-1 focus:ring-gisviz-accent"
            />
          </div>

          {categories.length > 0 && (
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="h-10 px-3 rounded-[10px] border border-gisviz-border bg-gisviz-card text-[13px] font-medium text-gisviz-ink focus:outline-none focus:ring-1 focus:ring-gisviz-accent capitalize"
            >
              <option value="">All categories</option>
              {categories.map(c => (
                <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
              ))}
            </select>
          )}

          <div className="inline-flex h-10 p-1 rounded-[10px] border border-gisviz-border bg-gisviz-paper/80">
            {(['all', 'spatial', 'tabular'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 rounded-[8px] text-[13px] font-semibold transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-gisviz-card text-gisviz-ink shadow-sm'
                    : 'text-gisviz-ink-soft hover:text-gisviz-ink'
                }`}
              >
                {tab === 'all' ? 'All Sources' : tab === 'spatial' ? 'Spatial' : 'Tabular'}
              </button>
            ))}
          </div>

          {manager && (
            <Link
              href="/admin/datasets"
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-[10px] border border-gisviz-border bg-gisviz-card text-[13px] font-semibold text-gisviz-ink hover:border-gisviz-accent hover:text-gisviz-accent transition-colors"
            >
              <Settings2 size={15} /> Manage
            </Link>
          )}
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-3">
        {loading && items.length === 0 && (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gisviz-accent" /></div>
        )}

        {error && (
          <div className="rounded-xl border border-gisviz-border bg-gisviz-card py-6 px-6 text-center text-[13.5px] text-gisviz-alert">{error}</div>
        )}

        <div className={`flex flex-col gap-3 transition-opacity ${loading && items.length ? 'opacity-60' : ''}`}>
          {items.map(dataset => (
            <DatasetCard key={dataset.dataset_id} dataset={dataset} />
          ))}
        </div>

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-gisviz-border bg-gisviz-card py-16 px-6 text-center">
            <p className="font-display text-[16px] font-bold text-gisviz-ink">
              No datasets found matching your criteria
            </p>
            <p className="text-[13.5px] text-gisviz-ink-soft mt-1">
              Try adjusting your search query or reset the filter tab.
            </p>
          </div>
        )}

        {items.length < total && (
          <div className="flex justify-center pt-3">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-[10px] border border-gisviz-border bg-gisviz-card text-[13px] font-semibold text-gisviz-ink hover:border-gisviz-accent hover:text-gisviz-accent disabled:opacity-60"
            >
              {loadingMore && <Loader2 size={14} className="animate-spin" />}
              Load more ({(total - items.length).toLocaleString()} remaining)
            </button>
          </div>
        )}
      </div>
    </main>
  )
}