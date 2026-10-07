'use client'
/**
 * Post page side panel: two cards with one pattern (label → value rows).
 *   the post   publisher and date · category, region, visual, type (batch / stream)
 *   Data       dataset, source (a link to it), licence, size, when the dataset was last updated
 * Views and likes sit with the actions under the visual; the rows of the data are in its Data tab.
 */
import React from 'react'
import Link from 'next/link'
import { BarChart3, Calendar, Database, ExternalLink, HardDrive, Layers, Lock, MapPin, Radio, Rows3, Scale, User, Users } from 'lucide-react'
import { mediaUrl } from '../feed/FeedCard'

function Row({ icon, k, children }: { icon: React.ReactNode; k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2 px-4 py-2 text-[12.5px]">
      <dt className="flex items-center gap-1.5 text-gisviz-ink-soft"><span className="shrink-0 opacity-70">{icon}</span>{k}</dt>
      <dd className="min-w-0 break-words font-medium text-gisviz-ink">{children}</dd>
    </div>
  )
}

export function fmtBytes(n?: number | null) {
  if (!n || n <= 0) return null
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}

export default function PostSidebar({ post, regionName, visualTypeName }: {
  post: any
  views?: number
  likes?: number
  regionName: (code: string) => string
  visualTypeName: string | null
}) {
  const avatar = mediaUrl(post.publisher_avatar_path)
  const ds = post.dataset
  const source = ds?.source_name || post.source_name
  const sourceUrl = ds?.source_url || post.source_url
  const href = sourceUrl ? (sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`) : null
  const size = fmtBytes(ds?.file_size_bytes)
  // when the dataset's data last changed (a stream's last row, a batch dataset's last upload)
  const updatedAt = ds?.data_updated_at || ds?.updated_at
  const updated = updatedAt ? new Date(updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const stream = (ds?.pipeline || (post.post_type === 'live' ? 'stream' : 'batch')) === 'stream'
  const card = 'overflow-hidden rounded-[14px] border border-gisviz-border bg-gisviz-card'

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-6 lg:w-[300px]">
      <section className={card}>
        <Link href={`/profile/${post.publisher_handle}`} className="group flex items-center gap-3 border-b border-gisviz-border/70 px-4 py-3">
          {avatar
            ? <img src={avatar} alt="" className="h-10 w-10 rounded-full border border-gisviz-border object-cover" />
            : <span className="grid h-10 w-10 place-items-center rounded-full border border-gisviz-border bg-gisviz-paper"><User size={17} className="text-gisviz-ink-soft" /></span>}
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-gisviz-ink group-hover:text-gisviz-accent">@{post.publisher_handle}</span>
            <span className="flex items-center gap-1 text-[12px] text-gisviz-ink-soft"><Calendar size={11} />
              {new Date(post.created_timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </span>
        </Link>
        <dl className="divide-y divide-gisviz-border/50 py-1">
          {post.categories?.length > 0 && (
            <Row icon={<Layers size={12} />} k="Category">
              <span className="flex flex-wrap gap-1">
                {post.categories.map((c: any) => (
                  <Link key={c.slug} href={`/?category=${encodeURIComponent(c.slug)}`} className="rounded px-1.5 py-px text-[12px] font-semibold"
                        style={{ background: `${c.theme_color || '#888888'}1f`, color: c.theme_color || undefined }}>{c.label}</Link>
                ))}
              </span>
            </Row>
          )}
          {post.region && <Row icon={<MapPin size={12} />} k="Region">{regionName(post.region)}</Row>}
          {visualTypeName && <Row icon={<BarChart3 size={12} />} k="Visual">{visualTypeName}</Row>}
          <Row icon={stream ? <Radio size={12} /> : <Rows3 size={12} />} k="Type">
            {stream ? <span className="text-gisviz-alert">Stream</span> : 'Batch'}
          </Row>
        </dl>
      </section>

      {(ds || source) && (
        <section className={card}>
          <h2 className="flex items-center gap-2 border-b border-gisviz-border/70 px-4 py-2.5 text-[13px] font-semibold text-gisviz-ink">
            <Database size={14} className="text-gisviz-accent" /> Data
          </h2>
          <dl className="divide-y divide-gisviz-border/50 py-1">
            {ds && (
              <Row icon={<Database size={12} />} k="Dataset">
                <span className="inline-flex items-start gap-1">{ds.visibility === 'private' && <Lock size={11} className="mt-0.5 shrink-0 text-gisviz-ink-soft" />}{ds.title}</span>
              </Row>
            )}
            {source && (
              <Row icon={<Users size={12} />} k="Source">
                {href
                  ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-gisviz-accent underline decoration-gisviz-accent/40 underline-offset-2 hover:decoration-gisviz-accent">
                      {source}<ExternalLink size={11} className="mt-0.5 shrink-0" />
                    </a>
                  : source}
              </Row>
            )}
            {(ds?.licence || ds?.license) && (
              <Row icon={<Scale size={12} />} k="Licence">
                {ds.licence?.url
                  ? <a href={ds.licence.url} target="_blank" rel="noopener noreferrer" className="hover:text-gisviz-accent">{ds.licence.name}</a>
                  : ds.licence?.name || ds.license}
              </Row>
            )}
            {updated && <Row icon={<Calendar size={12} />} k="Updated">{updated}</Row>}
            {size && <Row icon={<HardDrive size={12} />} k="Size">{size}</Row>}
          </dl>
        </section>
      )}
    </aside>
  )
}