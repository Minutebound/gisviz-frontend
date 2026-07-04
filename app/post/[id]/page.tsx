'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Heart, Bookmark, Share2, MessageSquare, ArrowLeft,
  Loader2, User, Send, CornerDownRight, Image as ImageIcon, X,
  ThumbsUp, FileText, ExternalLink
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'
import ShareModal from '../../components/SharePost'

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://'
const API_BASE_URL = RAW_API_URL.replace('/api/v1', '').replace(/\/$/, '')

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

  const [post, setPost]         = useState<any>(null)
  const [comments, setComments] = useState<CommentData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isLiked, setIsLiked]           = useState(false)
  const [likeCount, setLikeCount]       = useState(0)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [likeBusy, setLikeBusy]         = useState(false)
  const [bookmarkBusy, setBookmarkBusy] = useState(false)

  const [isImageFullscreen, setIsImageFullscreen]     = useState(false)
  const [newComment, setNewComment]                   = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentError, setCommentError]               = useState('')
  const [replyingTo, setReplyingTo]                   = useState<{ id: string; handle: string } | null>(null)
  const [isShareModalOpen, setIsShareModalOpen]       = useState(false)

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
        setComments(commentsData)
        if (foundPost.is_liked      != null) setIsLiked(foundPost.is_liked)
        if (foundPost.is_bookmarked != null) setIsBookmarked(foundPost.is_bookmarked)
      } catch (err) {
        console.error('Failed to fetch post', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, isAuthenticated, authLoading])

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
      setComments(updated)
      setNewComment('')
      setReplyingTo(null)
      setPost((prev: any) => prev ? { ...prev, total_comments_count: prev.total_comments_count + 1 } : prev)
    } catch (err: any) {
      setCommentError(err.response?.data?.detail || 'Failed to post comment.')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // ── Comment renderer — capped at ONE layer of replies ────────────────────
  // isReply=true means we are already inside a reply → never recurse further.
  const renderComment = (comment: CommentData, isReply = false): React.ReactNode => {
    const avatarUrl = comment.publisher_avatar_path
      ? `${API_BASE_URL}${comment.publisher_avatar_path.startsWith('/') ? '' : '/'}${comment.publisher_avatar_path}`
      : null
    return (
      <div key={comment.comment_id} className={`flex gap-3 ${isReply ? 'pl-3' : 'pt-4 first:pt-0'}`}>
        <div className="shrink-0 pt-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt={comment.publisher_handle} className="w-8 h-8 rounded-full object-cover border border-gisviz-border" />
          ) : (
            <div className="w-8 h-8 rounded-full border border-gisviz-border bg-gradient-to-tr from-gisviz-accent to-gisviz-safe flex items-center justify-center text-white text-[12px] font-bold uppercase font-mono shadow-inner flex-shrink-0">
              {comment.publisher_handle.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/profile/${comment.publisher_handle}`} className="text-[12px] font-bold font-mono text-gisviz-ink hover:text-gisviz-accent transition-colors">
              @{comment.publisher_handle}
            </Link>
            <span className="text-[12px] font-mono text-gisviz-ink-soft">
              {new Date(comment.created_timestamp).toLocaleDateString()}
            </span>
          </div>
          <p className="text-[12px] text-gisviz-ink leading-relaxed font-mono">{comment.content}</p>

          {/* Reply button — only shown on top-level comments, not on replies */}
          {!isReply && isAuthenticated && (
            <button
              onClick={() => setReplyingTo({ id: comment.comment_id, handle: comment.publisher_handle })}
              className="mt-1 text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-accent flex items-center gap-1 transition-colors"
            >
              <CornerDownRight size={12} /> Reply
            </button>
          )}

          {/* Replies — only rendered when this is a top-level comment (isReply=false).
              This hard-caps nesting at exactly one layer deep. */}
          {!isReply && comment.replies?.length > 0 && (
            <div className="mt-2 space-y-2">
              {comment.replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-gisviz-accent" size={32} />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-gisviz-ink-soft font-mono">Post not found.</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-2 text-gisviz-accent hover:underline font-mono text-[12px]">
          <ArrowLeft size={14} /> Back to feed
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
  const displayHandle = post.publisher_handle || 'Unknown'
  const isOwnPost = isAuthenticated && user && String(post.publisher_user_id) === String(user.user_id)

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Visual */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Visual image */}
          {visualUrl && (
            <div
              className="w-full rounded-sm overflow-hidden border border-gisviz-border cursor-zoom-in shadow-sm"
              onClick={() => setIsImageFullscreen(true)}
            >
              <img src={visualUrl} alt={post.title} className="w-full h-auto object-cover" />
            </div>
          )}

          {/* ── Source & Note — below the visual, above the action row ── */}
          {(post.source_name || post.note) && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 text-[12px] font-mono text-gisviz-ink-soft border-l-2 border-gisviz-border pl-3">
              {post.source_name && (
                <span className="flex items-center gap-1.5">
                  <span className="uppercase tracking-wider text-[11px]">Source</span>
                  <span className="text-gisviz-border">·</span>
                  {post.source_url ? (
                    <a
                      href={post.source_url.startsWith('http') ? post.source_url : `https://${post.source_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gisviz-accent hover:underline flex items-center gap-1"
                    >
                      {post.source_name}
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span className="text-gisviz-ink font-medium">{post.source_name}</span>
                  )}
                </span>
              )}
              {post.note && (
                <span className="flex items-center gap-1.5">
                  <span className="uppercase tracking-wider text-[11px]">Note</span>
                  <span className="text-gisviz-border">·</span>
                  <span className="text-gisviz-ink">{post.note}</span>
                </span>
              )}
            </div>
          )}

          {/* Action row: Like · Bookmark · Share */}
          <div className={`grid gap-4 ${isOwnPost ? 'grid-cols-2' : 'grid-cols-3'}`}>

            {/* Like */}
            <button
              onClick={handleLike}
              disabled={likeBusy}
              className={`bg-gisviz-card border border-gisviz-border py-3 rounded-sm shadow-sm flex items-center justify-center gap-2 font-mono text-[12px] uppercase tracking-wider transition-colors disabled:opacity-50 ${
                isLiked ? 'text-gisviz-accent bg-gisviz-accent/5 border-gisviz-accent/40' : 'text-gisviz-ink hover:text-gisviz-accent'
              }`}
            >
              {likeBusy
                ? <Loader2 size={18} className="animate-spin" />
                : <ThumbsUp size={18} className={isLiked ? 'fill-current' : ''} />
              }
              <span>{likeCount > 0 ? likeCount : ''}</span>
            </button>

            {/* Bookmark — hidden on own posts */}
            {!isOwnPost && (
              <button
                onClick={handleBookmark}
                disabled={bookmarkBusy}
                className={`bg-gisviz-card border border-gisviz-border py-3 rounded-sm shadow-sm flex items-center justify-center gap-2 font-mono text-[12px] tracking-wider transition-colors disabled:opacity-50 ${
                  isBookmarked ? 'text-gisviz-accent bg-gisviz-accent/5 border-gisviz-accent/40' : 'text-gisviz-ink hover:text-gisviz-accent'
                }`}
              >
                {bookmarkBusy
                  ? <Loader2 size={18} className="animate-spin" />
                  : <Bookmark size={18} className={isBookmarked ? 'fill-current' : ''} />
                }
                <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
              </button>
            )}

            {/* Share */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="bg-gisviz-card border border-gisviz-border py-3 rounded-sm shadow-sm flex items-center justify-center gap-2 text-gisviz-ink hover:text-gisviz-accent font-mono text-[12px] tracking-wider transition-colors"
            >
              <Share2 size={18} /> Share
            </button>
          </div>

          {/* Description */}
          {post.description && (
            <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-6 shadow-sm">
              <h3 className="font-display font-bold text-gisviz-ink mb-4 uppercase tracking-wide text-[12px] flex items-center gap-2">
                <span className="w-2 h-2 bg-gisviz-survey rounded-sm" /> Description
              </h3>
              <p className="text-[12px] text-gisviz-ink leading-relaxed whitespace-pre-wrap font-mono">
                {post.description}
              </p>
            </div>
          )}
        </div>

        {/* Right: Info + Comments */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-20 lg:h-[calc(90vh-6rem)]">

          {/* Post info */}
          <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-6 shadow-md shrink-0">
            {post.categories?.length > 0 && (
              <span className="inline-block px-2.5 py-1 bg-gisviz-rail-soft text-gisviz-ink text-[12px] font-mono font-bold tracking-widest uppercase rounded-sm mb-4">
                {post.categories[0].label}
              </span>
            )}
            <h1 className="text-[16px] lg:text-[24px] font-display font-bold text-gisviz-ink mb-4 leading-tight uppercase tracking-wide">
              {post.title}
            </h1>
            <div className="text-[12px] font-mono text-gisviz-ink-soft mb-3">
              Published {new Date(post.created_timestamp).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Link href={`/profile/${displayHandle}`} className="shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayHandle} className="w-9 h-9 rounded-full object-cover border border-gisviz-border" />
                ) : (
                  <div className="w-10 h-10 rounded-full border border-gisviz-border bg-gradient-to-tr from-gisviz-accent to-gisviz-safe flex items-center justify-center text-white text-[16px] font-bold uppercase font-mono shadow-inner flex-shrink-0">
                    {post.publisher_handle.charAt(0)}
                  </div>
                )}
              </Link>
              <Link href={`/profile/${displayHandle}`} className="text-[12px] font-mono font-bold text-gisviz-ink hover:text-gisviz-accent transition-colors">
                @{displayHandle}
              </Link>
            </div>
            {post.keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.keywords.map((kw: any) => (
                  <span key={kw.keyword_id} className="px-2 py-0.5 bg-gisviz-canvas border border-gisviz-border rounded text-[12px] font-mono text-gisviz-ink-soft">
                    {kw.word}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-6 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
            <h2 className="font-display font-bold text-gisviz-ink mb-4 uppercase tracking-wide text-[12px] flex items-center gap-2 shrink-0">
              <MessageSquare size={14} className="text-gisviz-accent" />
              Comments ({post.total_comments_count})
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] divide-y divide-gisviz-border/40">
              {comments.length === 0 ? (
                <p className="text-[12px] font-mono text-gisviz-ink-soft py-6 text-center">No comments yet. Be the first.</p>
              ) : (
                comments.map(c => renderComment(c))
              )}
            </div>

            {/* Comment input */}
            {isAuthenticated ? (
              <div className="shrink-0 mt-4 pt-4 border-t border-gisviz-border">
                {replyingTo && (
                  <div className="mb-2 flex items-center justify-between text-[12px] font-mono text-gisviz-ink-soft bg-gisviz-canvas px-3 py-1.5 rounded-md">
                    <span>Replying to @{replyingTo.handle}</span>
                    <button onClick={() => setReplyingTo(null)}><X size={12} /></button>
                  </div>
                )}
                {commentError && (
                  <p className="text-[11px] text-gisviz-alert font-mono mb-2">{commentError}</p>
                )}
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Write a comment…"
                    className="flex-1 bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-[12px] font-mono text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="bg-gisviz-accent text-white px-3 py-2 rounded-md disabled:opacity-50 flex items-center"
                  >
                    {isSubmittingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </form>
              </div>
            ) : (
              <div className="shrink-0 mt-4 pt-4 border-t border-gisviz-border">
                <Link href="/auth" className="text-[12px] font-mono text-gisviz-accent hover:underline">
                  Sign in to comment
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isImageFullscreen && visualUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setIsImageFullscreen(false)}
        >
          <button className="absolute top-4 right-4 text-white hover:text-gisviz-accent transition-colors">
            <X size={28} />
          </button>
          <img
            src={visualUrl}
            alt={post.title}
            className="max-w-full max-h-full object-contain rounded-sm"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        url={`${typeof window !== 'undefined' ? window.location.origin : ''}/post/${postId}`}
        title={post.title}
      />
    </div>
  )
}