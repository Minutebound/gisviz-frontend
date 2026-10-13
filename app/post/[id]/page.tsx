'use client'
/**
 * Post page: the visual on its poster (a slim row of reader controls under it) · title and actions · a Description | Data
 * tab box · discussion. The side panel has two cards in one pattern: About this post, then Data (source, licence,
 * attribution, size, freshness).
 * Private posts 404 for everyone without access (the server decides); the publisher manages access here.
 */
import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bookmark, Edit2, Eye, Loader2, ThumbsUp, Users, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../connector/api'
import ShareModal from '../../components/SharePost'
import InteractiveVisual, { type VisualSpec } from '../../components/InteractiveVisual'
import VisualBackdrop from '../../components/visuals/VisualBackdrop'
import PostComments from '../../components/post/PostComments'
import PostSidebar from '../../components/post/PostSidebar'
import PostData from '../../components/post/PostData'
import PostMenu from '../../components/post/PostMenu'
import AccessPanel from '../../components/access/AccessPanel'
import { mediaUrl } from '../../components/feed/FeedCard'
import { toDesign } from '../../../lib/poster'
import { resolveSpec, visualHeightFor } from '../../../lib/visualSpec'
import { DEFAULT_ACCENT, useRegions, useVisualCatalog } from '../../../lib/referenceData'

export default function PostDetail() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string
  const { isAuthenticated, isLoading: authLoading } = useAuth() as any

  const [post, setPost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(0)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState<'like' | 'save' | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [zoom, setZoom] = useState(false)
  const regions = useRegions()
  const catalog = useVisualCatalog()

  useEffect(() => {
    if (!postId || authLoading) return
    setLoading(true)
    gisvizApi.fetchPost(postId)
      .then(p => { setPost(p); setLikes(p.total_likes_count); setLiked(!!p.is_liked); setSaved(!!p.is_bookmarked) })
      .catch(() => setPost(null))
      .finally(() => setLoading(false))
  }, [postId, isAuthenticated, authLoading])

  // count this visit once per page open (the server counts each visitor once a day)
  const viewed = useRef<string | null>(null)
  const [views, setViews] = useState<number | null>(null)
  useEffect(() => {
    if (!post || viewed.current === postId) return
    viewed.current = postId
    gisvizApi.recordPostView(postId).then(r => setViews(r.views_count)).catch(() => {})
  }, [post, postId])

  const toggle = async (kind: 'like' | 'save') => {
    if (!isAuthenticated) { router.push('/auth'); return }
    if (busy) return
    setBusy(kind)
    try {
      if (kind === 'like') {
        const r = await gisvizApi.toggleLike(postId)
        setLiked(r.liked); setLikes(r.total_likes_count)
      } else {
        setSaved((await gisvizApi.toggleBookmark(postId)).bookmarked)
      }
    } catch { /* unchanged */ } finally { setBusy(null) }
  }

  if (loading) return <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><Loader2 className="animate-spin text-gisviz-accent" size={30} /></div>
  if (!post) return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center">
      <h2 className="mb-2 font-display text-[22px] font-bold text-gisviz-ink">Post not found</h2>
      <p className="mb-6 text-[14px] text-gisviz-ink-soft">It may have been deleted, or it is private and was not shared with you.</p>
      <Link href="/" className="inline-flex items-center gap-2 rounded-[10px] bg-gisviz-accent px-5 py-2.5 text-[14px] font-semibold text-[color:var(--accent-on)]">
        <ArrowLeft size={16} /> Back to the feed
      </Link>
    </div>
  )

  const spec: VisualSpec | null = resolveSpec(post.visual_spec as VisualSpec | undefined) ?? null
  const image = mediaUrl(post.visual_image_path)
  const vt = (spec as any)?.visual_type || (spec ? (spec.kind === 'map' ? 'map' : spec.chart_type) : null)
  const visualTypeName = vt ? (catalog.types.find(t => t.code === vt || t.renderer_code === vt)?.name ?? String(vt)) : null
  const regionName = (code: string) => regions.find(r => r.code === code)?.name ?? code
  const design = toDesign(post.backdrop ?? 'auto')
  const accent = post.theme_color || (spec as any)?.accent || post.categories?.[0]?.theme_color || DEFAULT_ACCENT
  const ds = post.dataset
  const sources = [
    ...(ds?.source_name || post.source_name ? [{ label: ds?.source_name || post.source_name, url: ds?.source_url || post.source_url }] : []),
    ...(post.source_name && ds?.source_name && post.source_name !== ds.source_name ? [{ label: post.source_name, url: post.source_url }] : []),
    ...(ds?.attribution ? [{ label: ds.attribution, url: null }]
      : ds?.title ? [{ label: `${ds.title}${ds.licence?.name || ds.license ? `, ${ds.licence?.name || ds.license}` : ''}`, url: null }] : []),
  ]
  const visual = (w: number) => <InteractiveVisual spec={spec!} datasetId={post.dataset_id} showData={!!ds?.show_data} height={visualHeightFor(spec, w)} tools="reader" />
  const viewCount = Math.max(views ?? 0, post.views_count ?? 0)
  const iconBtn = (on: boolean) => `inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
    on ? 'border-gisviz-accent/40 bg-gisviz-accent/10 text-gisviz-accent' : 'border-gisviz-border bg-gisviz-card text-gisviz-ink hover:bg-gisviz-paper'}`

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-14 pt-4 sm:px-8 lg:px-12">
      <div className="mt-2 flex flex-col items-start gap-6 lg:flex-row xl:gap-8">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-5">

          {/* the visual */}
          {spec && design ? (
            <VisualBackdrop regionCode={post.region} regions={regions} design={design} accent={accent}
                            eyebrow={post.categories?.[0]?.label} title={(spec as any).title || post.title}
                            subtitle={(spec as any).subtitle} sources={sources} note={post.note} renderVisual={visual} />
          ) : spec ? (
            <div>{visual(820)}</div>
          ) : image ? (
            <button type="button" onClick={() => setZoom(true)} className="overflow-hidden rounded-[14px] border border-gisviz-border">
              <img src={image} alt={post.title} className="max-h-[70vh] w-full object-cover" />
            </button>
          ) : null}

          {/* title, badges, actions */}
          <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-[26px] font-bold leading-[1.15] tracking-tight text-gisviz-ink sm:text-[32px]">{post.title}</h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button onClick={() => toggle('like')} disabled={busy === 'like'} className={iconBtn(liked)} title="Like">
                <ThumbsUp size={15} className={liked ? 'fill-current' : ''} /> {likes.toLocaleString()}
              </button>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-gisviz-ink-soft" title="Views">
                <Eye size={15} /> {viewCount.toLocaleString()}
              </span>
              {!post.can_manage && (
                <button onClick={() => toggle('save')} disabled={busy === 'save'} className={iconBtn(saved)} title="Bookmark">
                  <Bookmark size={15} className={saved ? 'fill-current' : ''} />
                </button>
              )}
              {post.can_manage && (
                <>
                  <button onClick={() => setAccessOpen(true)} className={iconBtn(false)} title="Who can see this post">
                    <Users size={15} /> Access
                  </button>
                  <Link href={`/post/${postId}/edit`} className={iconBtn(false)} title="Edit"><Edit2 size={15} /> Edit</Link>
                </>
              )}
              <PostMenu postId={postId} onShare={() => setShareOpen(true)} />
            </div>
          </header>

          {/* Description | Data tabs, right under the visual */}
          <PostData post={post} />

          <PostComments postId={postId} count={post.total_comments_count} signedIn={!!isAuthenticated}
                        onAdded={() => setPost((p: any) => ({ ...p, total_comments_count: p.total_comments_count + 1 }))} />
        </div>

        <PostSidebar post={post} views={viewCount} likes={likes} regionName={regionName} visualTypeName={visualTypeName} />
      </div>

      {zoom && image && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(false)}>
          <button className="absolute right-6 top-6 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white" aria-label="Close"><X size={20} /></button>
          <img src={image} alt={post.title} className="max-h-full max-w-full rounded-[10px] object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {accessOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setAccessOpen(false)}>
          <div className="w-full max-w-md rounded-t-[16px] border border-gisviz-border bg-gisviz-card p-5 shadow-xl sm:rounded-[16px]" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[17px] font-bold text-gisviz-ink">Who can see this post</h2>
              <button onClick={() => setAccessOpen(false)} className="text-gisviz-ink-soft hover:text-gisviz-ink" aria-label="Close"><X size={18} /></button>
            </div>
            <AccessPanel kind="post" id={postId} onVisibility={v => setPost((p: any) => ({ ...p, visibility: v }))} />
          </div>
        </div>
      )}

      <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)}
                  url={`${typeof window !== 'undefined' ? window.location.origin : ''}/post/${postId}`} title={post.title} />
    </main>
  )
}