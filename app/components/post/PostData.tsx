'use client'
/**
 * The box right under the post's visual:
 *   Description   the publisher's text about the visual
 *   Data          the dataset's rows: only for readers the dataset's access level lets see them (public dataset
 *                 whose licence allows it, or a private one they own / it was shared with)
 * Readers without access to the rows get no Data tab: only the description. With only one of the two there are no
 * tabs, just that one under its heading. The data's source, licence, size and update date are in the side panel.
 */
import React, { useState } from 'react'
import { FileText, Lock, Table2 } from 'lucide-react'
import { DatasetTable } from '../InteractiveVisual'

export default function PostData({ post }: { post: any }) {
  const ds = post.dataset
  const hasDescription = !!post.description?.trim()
  const canSeeRows = !!ds?.show_data                  // decided by the server from the dataset's access level
  const [tab, setTab] = useState<'description' | 'data'>(hasDescription ? 'description' : 'data')
  if (!hasDescription && !canSeeRows) return null

  const both = hasDescription && canSeeRows
  const active = both ? tab : hasDescription ? 'description' : 'data'
  const head = 'inline-flex h-9 items-center gap-1.5 border-b-2 px-1 text-[13px] font-semibold transition-colors'
  const tabBtn = (on: boolean) => `${head} ${on
    ? 'border-gisviz-accent text-gisviz-ink' : 'border-transparent text-gisviz-ink-soft hover:text-gisviz-ink'}`

  const descriptionLabel = <><FileText size={14} /> Description</>
  const dataLabel = (
    <>
      <Table2 size={14} /> Data
      {ds?.row_count != null && <span className="font-mono text-[11px] font-normal text-gisviz-ink-soft">{Number(ds.row_count).toLocaleString()}</span>}
      {ds?.visibility === 'private' && <Lock size={11} className="text-gisviz-ink-soft" aria-label="Private dataset: you have access" />}
    </>
  )

  return (
    <section id="description" className="overflow-hidden rounded-[14px] border border-gisviz-border bg-gisviz-card">
      {both ? (
        <div role="tablist" className="flex items-center gap-5 border-b border-gisviz-border px-4">
          <button type="button" role="tab" aria-selected={tab === 'description'} onClick={() => setTab('description')} className={tabBtn(tab === 'description')}>
            {descriptionLabel}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'data'} onClick={() => setTab('data')} className={tabBtn(tab === 'data')}>
            {dataLabel}
          </button>
        </div>
      ) : (
        <h2 className="border-b border-gisviz-border px-4">
          <span className={`${head} border-transparent text-gisviz-ink`}>{hasDescription ? descriptionLabel : dataLabel}</span>
        </h2>
      )}
      {active === 'description' ? (
        <div role={both ? 'tabpanel' : undefined} className="whitespace-pre-wrap px-5 py-4 text-[15px] leading-[1.75] text-gisviz-ink sm:px-6">
          {post.description}
        </div>
      ) : (
        <div role={both ? 'tabpanel' : undefined} className="h-[440px]"><DatasetTable datasetId={ds.dataset_id} /></div>
      )}
    </section>
  )
}