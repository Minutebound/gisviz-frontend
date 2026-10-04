'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Heart, Bookmark, Share2, MessageSquare, ArrowLeft,
  Loader2, Send, CornerDownRight, X,
  ThumbsUp, ExternalLink, Database, FileText, Calendar,
  User, Layers, MapPin
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../connector/api'
import ShareModal from '../../components/SharePost'
import InteractiveVisual, { type VisualSpec } from '../../components/InteractiveVisual'
import VisualBackdrop from '../../components/visuals/VisualBackdrop'
import { toDesign } from '../../../lib/poster'
import { resolveSpec, visualHeightFor } from '../../../lib/visualSpec'
import { DEFAULT_ACCENT, useRegions, useVisualCatalog } from '../../../lib/referenceData'

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://'
const API_BASE_URL = RAW_API_URL.replace('/api/v0', '').replace(/\/$/, '')

interface CommentData {
  comment_id: string
  post_id: string
  user_id: string
  publisher_handle: string
  publisher_avatar_path: string | null
  parent_comment_id: string | null
  content: string
  is_edited: boolean
  created_timestamp: string
  replies: CommentData[]
}

export default function PostDetail() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any

  const [post, setPost] = useState<any>(null)
  const [comments, setComments] = useState<CommentData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [bookmarkBusy, setBookmarkBusy] = useState(false)

  const [isImageFullscreen, setIsImageFullscreen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ id: string; handle: string } | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  useEffect(() => {
    if (!postId || authLoading) return
    setIsLoading(true)
    setIsLiked(false)
    setIsBookmarked(false)

    const load = async () => {
      try {
        const [foundPost, commentsData] = await Promise.all([
          gisvizApi.fetchPost(postId),
          gisvizApi.fetchComments(postId),
        ])
        setPost(foundPost)
        setLikeCount(foundPost.total_likes_count)
        setComments(commentsData || [])
        if (foundPost.is_liked != null) setIsLiked(foundPost.is_liked)
        if (foundPost.is_bookmarked != null) setIsBookmarked(foundPost.is_bookmarked)
      } catch (err) {
        console.error('Failed to fetch post', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [postId, isAuthenticated, authLoading])

  // Count this visit once per page open (the server counts each visitor once a day, in the analytics DB).
  const viewedRef = useRef<string | null>(null)
  const [viewCount, setViewCount] = useState<number | null>(null)
  const regionList = useRegions()          // misc DB
  const catalog = useVisualCatalog()       // misc DB
  useEffect(() => {
    if (!postId || authLoading || viewedRef.current === postId) return
    viewedRef.current = postId
    setViewCount(null)
    gisvizApi.recordPostView(postId).then(r => setViewCount(r.views_count)).catch(() => {})
  }, [postId, authLoading])

  const handleLike = async () => {
    if (!isAuthenticated) { router.push('/auth'); return }
    if (likeBusy) return
    setLikeBusy(true)
    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1)
    try {
      const res = await gisvizApi.toggleLike(postId)
      setIsLiked(res.liked)
      setLikeCount(res.total_likes_count)
    } catch {
      setIsLiked(wasLiked)
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1)
    } finally {
      setLikeBusy(false)
    }
  }

  const handleBookmark = async () => {
    if (!isAuthenticated) { router.push('/auth'); return }
    if (bookmarkBusy) return
    setBookmarkBusy(true)
    const wasBookmarked = isBookmarked
    setIsBookmarked(!wasBookmarked)
    try {
      const res = await gisvizApi.toggleBookmark(postId)
      setIsBookmarked(res.bookmarked)
    } catch {
      setIsBookmarked(wasBookmarked)
    } finally {
      setBookmarkBusy(false)
    }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    setCommentError('')
    if (!newComment.trim() || !isAuthenticated) return
    setIsSubmittingComment(true)
    try {
      await gisvizApi.addComment(postId, newComment, replyingTo?.id)
      const updated = await gisvizApi.fetchComments(postId)
      setComments(updated || [])
      setNewComment('')
      setReplyingTo(null)
      setPost((prev: any) => prev ? { ...prev, total_comments_count: prev.total_comments_count + 1 } : prev)
    } catch (err: any) {
      setCommentError(err.response?.data?.detail || 'Failed to post comment.')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // ── Comment Renderer ──
  const renderComment = (comment: CommentData, isReply = false): React.ReactNode => {
    const avatarUrl = comment.publisher_avatar_path
      ? `${API_BASE_URL}${comment.publisher_avatar_path.startsWith('/') ? '' : '/'}${comment.publisher_avatar_path}`
      : null
    return (
      <div key={comment.comment_id} className={`flex gap-3 ${isReply ? 'pl-4 mt-3 border-l-2 border-gisviz-border/50' : 'pt-5 first:pt-0'}`}>
        <div className="shrink-0 pt-0.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt={comment.publisher_handle} className="w-8 h-8 rounded-full object-cover border border-gisviz-border bg-gisviz-paper" />
          ) : (
            <div className="w-8 h-8 rounded-full border border-gisviz-border bg-gradient-to-tr from-gisviz-accent to-gisviz-safe flex items-center justify-center text-[color:var(--accent-on)] text-[12px] font-bold uppercase shadow-inner shrink-0">
              {comment.publisher_handle.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/profile/${comment.publisher_handle}`} className="text-[13.5px] font-semibold text-gisviz-ink hover:text-gisviz-accent transition-colors">
              @{comment.publisher_handle}
            </Link>
            <span className="text-[12px] text-gisviz-ink-soft">
              {new Date(comment.created_timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="text-[14px] text-gisviz-ink leading-relaxed break-words">
            {comment.content}
          </p>

          {!isReply && isAuthenticated && (
            <button
              onClick={() => setReplyingTo({ id: comment.comment_id, handle: comment.publisher_handle })}
              className="mt-2 text-[12.5px] font-medium text-gisviz-ink-soft hover:text-gisviz-accent flex items-center gap-1.5 transition-colors"
            >
              <CornerDownRight size={14} /> Reply
            </button>
          )}

          {!isReply && comment.replies?.length > 0 && (
            <div className="mt-1 space-y-1">
              {comment.replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex justify-center items-center">
        <Loader2 className="animate-spin text-gisviz-accent" size={32} />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-4rem)] text-center px-4">
        <h2 className="text-[24px] font-display font-bold text-gisviz-ink mb-2">Post not found</h2>
        <p className="text-[14.5px] text-gisviz-ink-soft mb-6">This post may have been deleted or is unavailable.</p>
        <Link href="/" className="inline-flex items-center gap-2 text-[14px] font-semibold bg-gisviz-accent text-[color:var(--accent-on)] px-6 py-2.5 rounded-[10px] shadow-sm hover:brightness-110 transition-[filter]">
          <ArrowLeft size={16} /> Return to Feed
        </Link>
      </div>
    )
  }

  const visualUrl = post.visual_image_path
    ? `${API_BASE_URL}${post.visual_image_path.startsWith('/') ? '' : '/'}${post.visual_image_path}`
    : null
  const avatarUrl = post.publisher_avatar_path
    ? `${API_BASE_URL}${post.publisher_avatar_path.startsWith('/') ? '' : '/'}${post.publisher_avatar_path}`
    : null
  const displayHandle = post.publisher_handle
  const isOwnPost = isAuthenticated && user && String(post.publisher_user_id) === String(user.user_id)

  // Interactive visual wins over the static image when present.
  // Priority: ?demo=… (testing) → post.visual_spec (from backend) → static image.
  const visualSpec: VisualSpec | null =
    resolveSpec(post.visual_spec as VisualSpec | undefined) ?? null
  const vt = (visualSpec as any)?.visual_type || (visualSpec ? (visualSpec.kind === 'map' ? 'map' : visualSpec.chart_type) : post.chart_type)
  const visualTypeName = vt ? (catalog.types.find(t => t.code === vt || t.renderer_code === vt)?.name ?? String(vt)) : null
  const regionName = (code: string) => regionList.find(r => r.code === code)?.name ?? code
  const visualHeight = visualHeightFor(visualSpec, 820)                       // no poster: a fixed desktop width
  const posterDesign = toDesign(post.backdrop ?? 'auto')                       // null = the publisher chose no poster
  // poster footer: where the numbers come from, in parentheses, linked
  const posterSources = [
    ...(post.dataset?.source_name || post.source_name ? [{ label: post.dataset?.source_name || post.source_name,
      url: post.dataset?.source_url || post.source_url }] : []),
    ...(post.source_name && post.dataset?.source_name && post.source_name !== post.dataset.source_name ? [{ label: post.source_name, url: post.source_url }] : []),
    ...(post.dataset?.title ? [{ label: `${post.dataset.title}${post.dataset.license ? `, ${post.dataset.license}` : ''}`, url: null }] : []),
  ]

  return (
    <main className="mx-auto w-full max-w-7xl px-4 sm:px-8 lg:px-[72px] pt-4 sm:pt-6 pb-14">

      <div className="flex flex-col lg:flex-row gap-8 xl:gap-14 items-start mt-4">

        {/* ── LEFT COLUMN (Enterprise Content Layout) ── */}
        <div className="flex-1 min-w-0 flex flex-col w-full order-1">

          {/* 1. Visual (Hero): interactive when a spec exists, else the static image */}
          {visualSpec && !posterDesign ? (
            <div className="mb-8">
              <InteractiveVisual spec={visualSpec} datasetId={post.dataset_id}
                                 showData={!!post.dataset?.show_data} height={visualHeight} />
            </div>
          ) : visualSpec ? (
            <VisualBackdrop regionCode={post.region} regions={regionList} design={posterDesign!}
                            accent={post.theme_color || (visualSpec as any).accent || post.categories?.[0]?.theme_color || DEFAULT_ACCENT}
                            eyebrow={post.categories?.[0]?.label}
                            title={(visualSpec as any).title || post.title} subtitle={(visualSpec as any).subtitle}
                            sources={posterSources} note={post.note}
                            renderVisual={w => (
                              <InteractiveVisual spec={visualSpec} datasetId={post.dataset_id}
                                                 showData={!!post.dataset?.show_data} height={visualHeightFor(visualSpec, w)} />
                            )} />
          ) : visualUrl ? (
            <div
              className="w-full rounded-[16px] bg-gisviz-canvas border border-gisviz-border overflow-hidden cursor-zoom-in shadow-sm group relative mb-8"
              onClick={() => setIsImageFullscreen(true)}
            >
              <img
                src={visualUrl}
                alt={post.title}
                className="w-full h-auto max-h-[70vh] object-cover group-hover:scale-[1.01] transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
            </div>
          ) : (
             <div className="w-full h-[300px] sm:h-[400px] rounded-[16px] bg-gisviz-canvas border border-gisviz-border flex items-center justify-center text-gisviz-ink-soft shadow-sm mb-8">
               No visual content available for this post.
             </div>
          )}

          {/* 2. Header Information & Actions Inline */}
          <header className="mb-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 mb-4">

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {post.categories?.length > 0 && (
                    <span className="inline-flex items-center h-[26px] px-3 rounded-[6px] bg-gisviz-paper border border-gisviz-border text-[11px] font-mono font-bold tracking-widest uppercase text-gisviz-ink-soft shadow-sm">
                      {post.categories[0].label}
                    </span>
                  )}
                  {post.keywords?.slice(0, 5).map((kw: any) => (
                    <span key={kw.keyword_id} className="text-[12px] font-mono text-gisviz-ink-soft">
                      #{kw.word.replace(/\s+/g, '')}
                    </span>
                  ))}
                </div>

                <h1 className="font-display text-[32px] sm:text-[40px] font-bold text-gisviz-ink leading-[1.15] tracking-tight">
                  {post.title}
                </h1>
              </div>

              {/* Action Buttons (Icons Only) */}
              <div className="flex items-center gap-2.5 shrink-0 md:pt-8">
                <button
                  onClick={handleLike}
                  disabled={likeBusy}
                  className={`flex items-center justify-center gap-1.5 min-w-[40px] h-10 px-3.5 rounded-full border transition-all shadow-sm disabled:opacity-50 ${
                    isLiked
                      ? 'border-gisviz-accent/40 bg-gisviz-accent/10 text-gisviz-accent'
                      : 'border-gisviz-border bg-gisviz-card text-gisviz-ink hover:bg-gisviz-paper hover:border-gisviz-border-strong'
                  }`}
                  title="Like"
                >
                  {likeBusy ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} className={isLiked ? 'fill-current' : ''} />}
                  {likeCount > 0 && <span className="text-[13px] font-semibold">{likeCount}</span>}
                </button>

                {!isOwnPost && (
                  <button
                    onClick={handleBookmark}
                    disabled={bookmarkBusy}
                    className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all shadow-sm disabled:opacity-50 ${
                      isBookmarked
                        ? 'border-gisviz-accent/40 bg-gisviz-accent/10 text-gisviz-accent'
                        : 'border-gisviz-border bg-gisviz-card text-gisviz-ink hover:bg-gisviz-paper hover:border-gisviz-border-strong'
                    }`}
                    title="Bookmark"
                  >
                    {bookmarkBusy ? <Loader2 size={16} className="animate-spin" /> : <Bookmark size={16} className={isBookmarked ? 'fill-current' : ''} />}
                  </button>
                )}

                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-gisviz-border bg-gisviz-card hover:bg-gisviz-paper hover:border-gisviz-border-strong text-gisviz-ink transition-all shadow-sm"
                  title="Share"
                >
                  <Share2 size={16} />
                </button>
              </div>

            </div>

            {/* Meta Info (Publisher, Date, & Views) — phones/tablets; desktop shows it in the right column */}
            <div className="flex lg:hidden flex-wrap items-center gap-4 text-[13.5px] text-gisviz-ink-soft font-medium mt-2">
              <Link href={`/profile/${displayHandle}`} className="flex items-center gap-2 hover:text-gisviz-accent transition-colors">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayHandle} className="w-10 h-10 rounded-full object-cover border border-gisviz-border bg-gisviz-paper" />
                ) : (
                  <User size={18} />
                )}
                <span className="text-gisviz-ink font-semibold hover:text-gisviz-accent transition-colors">@{displayHandle}</span>
              </Link>
              <span className="w-1 h-1 rounded-full bg-gisviz-border" />
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {new Date(post.created_timestamp).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="w-1 h-1 rounded-full bg-gisviz-border" />
              <span className="flex items-center gap-1.5">
                <FileText size={14} /> {Math.max(viewCount ?? 0, post.views_count ?? 0).toLocaleString()} {Math.max(viewCount ?? 0, post.views_count ?? 0) === 1 ? 'View' : 'Views'}
              </span>
            </div>
          </header>

          {/* 4. Large Description & Document Flow (Separate Container) */}
          {post.description && (
            <div className="rounded-[12px] border border-gisviz-border bg-gisviz-card shadow-sm overflow-hidden mb-10 p-6 sm:p-8">
              <h3 className="font-display text-[18px] font-bold text-gisviz-ink mb-5 flex items-center gap-2 border-b border-gisviz-border/60 pb-4">
                <FileText size={18} className="text-gisviz-accent" /> Detailed Story
              </h3>
              <div className="prose prose-sm max-w-none text-[15.5px] text-gisviz-ink leading-[1.8] whitespace-pre-wrap">
                {post.description}
              </div>
            </div>
          )}


          {/* 5. Discussion — below the visual and the story */}
          {/* Comments Panel */}
          <div id="discussion" className="rounded-[16px] border border-gisviz-border bg-gisviz-card shadow-sm flex flex-col overflow-hidden">

            {/* Comments Header */}
            <div className="px-5 py-4 border-b border-gisviz-border shrink-0 bg-gisviz-paper/30">
              <h2 className="font-display text-[16px] font-bold text-gisviz-ink flex items-center gap-2">
                <MessageSquare size={16} className="text-gisviz-accent" />
                Discussion ({post.total_comments_count})
              </h2>
            </div>

            {/* Comments Feed */}
            <div className="max-h-[640px] overflow-y-auto px-5 py-2 space-y-1 divide-y divide-gisviz-border/50" style={{ scrollbarWidth: 'thin' }}>
              {comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-70">
                  <MessageSquare size={24} className="text-gisviz-ink-soft mb-2" />
                  <p className="text-[13.5px] font-medium text-gisviz-ink">No comments yet</p>
                  <p className="text-[12.5px] text-gisviz-ink-soft">Be the first to share your thoughts.</p>
                </div>
              ) : (
                comments.map(c => renderComment(c))
              )}
            </div>

            {/* Comment Input */}
            {isAuthenticated ? (
              <div className="shrink-0 p-4 border-t border-gisviz-border bg-gisviz-paper/30">
                {replyingTo && (
                  <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-gisviz-ink-soft bg-gisviz-paper border border-gisviz-border px-3 py-1.5 rounded-lg shadow-sm">
                    <span>Replying to <span className="font-semibold text-gisviz-ink">@{replyingTo.handle}</span></span>
                    <button onClick={() => setReplyingTo(null)} className="hover:text-gisviz-alert transition-colors"><X size={14} /></button>
                  </div>
                )}
                {commentError && (
                  <p className="text-[12.5px] text-gisviz-alert mb-2 font-medium">{commentError}</p>
                )}
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 h-10 bg-gisviz-card border border-gisviz-border rounded-[8px] px-3.5 text-[13.5px] text-gisviz-ink placeholder:text-gisviz-ink-soft focus:outline-none focus:ring-1 focus:ring-gisviz-accent shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="h-10 px-4 bg-gisviz-accent text-[color:var(--accent-on)] rounded-[8px] font-semibold text-[13.5px] disabled:opacity-50 flex items-center justify-center shadow-sm hover:brightness-110 transition-[filter]"
                  >
                    {isSubmittingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>
              </div>
            ) : (
              <div className="shrink-0 p-5 border-t border-gisviz-border bg-gisviz-paper/30 text-center">
                <Link href="/auth" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-gisviz-accent hover:underline">
                  Log in to join the conversation
                </Link>
              </div>
            )}
          </div>

        </div>

        {/* ── RIGHT COLUMN (desktop): publisher, post details, the dataset — compact ── */}
        <aside className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col gap-4 lg:sticky lg:top-[24px] order-2">

          {/* Publisher */}
          <div className="hidden lg:block rounded-[14px] border border-gisviz-border bg-gisviz-card shadow-sm p-5">
            <Link href={`/profile/${displayHandle}`} className="flex items-center gap-3 group">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayHandle} className="w-11 h-11 rounded-full object-cover border border-gisviz-border bg-gisviz-paper" />
                : <span className="w-11 h-11 rounded-full grid place-items-center bg-gisviz-paper border border-gisviz-border"><User size={18} className="text-gisviz-ink-soft" /></span>}
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold text-gisviz-ink group-hover:text-gisviz-accent truncate">@{displayHandle}</span>
                <span className="block text-[12.5px] text-gisviz-ink-soft">Publisher</span>
              </span>
            </Link>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Views', Math.max(viewCount ?? 0, post.views_count ?? 0).toLocaleString()],
                ['Likes', likeCount.toLocaleString()],
                ['Comments', Number(post.total_comments_count || 0).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-gisviz-paper/60 border border-gisviz-border/60 py-2">
                  <dd className="font-display text-[16px] font-bold text-gisviz-ink tabular-nums">{v}</dd>
                  <dt className="text-[10.5px] font-mono uppercase tracking-wider text-gisviz-ink-soft">{k}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-gisviz-ink-soft">
              <Calendar size={13} /> {new Date(post.created_timestamp).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Post details */}
          <div className="rounded-[14px] border border-gisviz-border bg-gisviz-card shadow-sm overflow-hidden">
            <h3 className="px-5 py-3 border-b border-gisviz-border bg-gisviz-paper/50 font-display text-[14px] font-bold text-gisviz-ink">About this post</h3>
            <dl className="divide-y divide-gisviz-border/50 text-[13px]">
              {post.region && (
                <div className="flex justify-between gap-3 px-5 py-2.5"><dt className="text-gisviz-ink-soft">Region</dt>
                  <dd className="flex items-center gap-1.5 font-medium text-gisviz-ink"><MapPin size={13} /> {regionName(post.region)}</dd></div>
              )}
              {post.categories?.length > 0 && (
                <div className="flex justify-between gap-3 px-5 py-2.5"><dt className="text-gisviz-ink-soft">Category</dt>
                  <dd className="flex flex-wrap justify-end gap-1.5">
                    {post.categories.map((c: any) => (
                      <Link key={c.slug} href={`/?category=${encodeURIComponent(c.slug)}`}
                        className="rounded-md px-2 py-0.5 text-[12px] font-semibold"
                        style={{ background: `${c.theme_color || '#888888'}1f`, color: c.theme_color || undefined }}>{c.label}</Link>
                    ))}
                  </dd></div>
              )}
              {visualTypeName && (
                <div className="flex justify-between gap-3 px-5 py-2.5"><dt className="text-gisviz-ink-soft">Visual</dt>
                  <dd className="font-medium text-gisviz-ink text-right">{visualTypeName}</dd></div>
              )}
              {post.note && (
                <div className="px-5 py-2.5"><dt className="text-gisviz-ink-soft mb-1">Author note</dt>
                  <dd className="text-gisviz-ink leading-relaxed">{post.note}</dd></div>
              )}
            </dl>
          </div>

          {/* The dataset (only what a reader needs) */}
          {(post.dataset || post.source_name) && (
            <div className="rounded-[14px] border border-gisviz-border bg-gisviz-card shadow-sm overflow-hidden">
              <h3 className="px-5 py-3 border-b border-gisviz-border bg-gisviz-paper/50 font-display text-[14px] font-bold text-gisviz-ink flex items-center gap-2">
                <Database size={15} className="text-gisviz-accent" /> Data
              </h3>
              <dl className="divide-y divide-gisviz-border/50 text-[13px]">
                {post.dataset && (
                  <div className="px-5 py-2.5"><dt className="text-gisviz-ink-soft">Dataset</dt>
                    <dd><Link href="/datasets" className="font-semibold text-gisviz-accent hover:underline">{post.dataset.title}</Link></dd></div>
                )}
                {(post.dataset?.source_name || post.source_name) && (() => {
                  const name = post.dataset?.source_name || post.source_name
                  const url = post.dataset?.source_url || post.source_url
                  const href = url ? (url.startsWith('http') ? url : `https://${url}`) : null
                  return (
                    <div className="flex justify-between gap-3 px-5 py-2.5"><dt className="text-gisviz-ink-soft">Source</dt>
                      <dd className="text-right font-medium text-gisviz-ink">
                        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-gisviz-accent">{name} <ExternalLink size={12} /></a> : name}
                      </dd></div>
                  )
                })()}
                {[
                  ['Publisher', post.dataset?.publisher],
                  ['Licence', post.dataset?.license],
                  ['Updated', post.dataset?.updated_at ? new Date(post.dataset.updated_at).toLocaleDateString() : null],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3 px-5 py-2.5"><dt className="text-gisviz-ink-soft">{k}</dt>
                    <dd className="text-right font-medium text-gisviz-ink">{v as string}</dd></div>
                ))}
              </dl>
            </div>
          )}
        </aside>
      </div>

      {/* ── Fullscreen Image Overlay (static-image posts only) ── */}
      {isImageFullscreen && visualUrl && !visualSpec && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setIsImageFullscreen(false)}
        >
          <button
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-gisviz-accent transition-colors backdrop-blur-md"
            aria-label="Close fullscreen"
          >
            <X size={20} />
          </button>
          <img
            src={visualUrl}
            alt={post.title}
            className="max-w-full max-h-full object-contain rounded-[10px] shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Share Modal ── */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        url={`${typeof window !== 'undefined' ? window.location.origin : ''}/post/${postId}`}
        title={post.title}
      />
    </main>
  )
}