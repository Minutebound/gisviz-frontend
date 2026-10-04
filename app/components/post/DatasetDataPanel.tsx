'use client'

/**
 * "Data" panel on the post page. Shown only when the post's dataset has show_data on (set by an
 * admin on /admin/datasets). The rows are fetched from GET /datasets/{id}/rows only when the reader
 * clicks "View data", never when the page loads.
 */
import React, { useState } from 'react'
import { ChevronDown, Loader2, Table2 } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'
import type { PublicDatasetRows } from '../../../types/visuals'

const LIMIT = 50

export default function DatasetDataPanel({ datasetId, totalRows }: { datasetId: string; totalRows?: number | null }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<PublicDatasetRows | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggle = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (data || loading) return
    setLoading(true); setError('')
    try { setData(await gisvizApi.fetchDatasetRows(datasetId, LIMIT)) }
    catch (e: any) {
      setError(e?.response?.status === 403 ? 'The data of this dataset is not published.' : 'Could not load the data.')
    } finally { setLoading(false) }
  }

  return (
    <div className="rounded-[12px] border border-gisviz-border bg-gisviz-card shadow-sm overflow-hidden mb-6">
      <button onClick={toggle} aria-expanded={open}
              className="w-full px-5 py-3.5 bg-gisviz-paper/50 flex items-center justify-between gap-3 text-left hover:bg-gisviz-paper transition-colors">
        <span className="font-display text-[15px] font-bold text-gisviz-ink flex items-center gap-2">
          <Table2 size={16} className="text-gisviz-accent" /> Data
          {totalRows != null && <span className="font-mono text-[12px] font-normal text-gisviz-ink-soft">{Number(totalRows).toLocaleString()} rows</span>}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gisviz-ink-soft">
          {open ? 'Hide data' : 'View data'}
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="border-t border-gisviz-border">
          {loading && <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin text-gisviz-accent" /></div>}
          {error && <p className="px-5 py-4 text-[13px] text-gisviz-alert">{error}</p>}
          {data && (
            <>
              <div className="overflow-auto max-h-[420px]">
                <table className="text-left text-[12.5px] min-w-full">
                  <thead className="sticky top-0 bg-gisviz-paper text-gisviz-ink-soft">
                    <tr>{data.columns.map(c => <th key={c} className="px-4 py-2.5 font-medium font-mono whitespace-nowrap border-b border-gisviz-border">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr key={i} className="border-t border-gisviz-border/40">
                        {data.columns.map(c => (
                          <td key={c} className="px-4 py-2 whitespace-nowrap text-gisviz-ink max-w-[280px] truncate">
                            {r[c] === null || r[c] === undefined ? <span className="text-gisviz-ink-soft">—</span> : String(r[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-2.5 border-t border-gisviz-border text-[11.5px] font-mono text-gisviz-ink-soft">
                First {data.rows.length.toLocaleString()} of {Number(data.total_rows).toLocaleString()} rows
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}