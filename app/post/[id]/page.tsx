'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ThumbsUp, 
  Share2, 
  Bookmark, 
  MessageSquare, 
  Send, 
  Loader2, 
  MapPin,
  ChevronLeft,
  Image as ImageIcon,
  X
} from 'lucide-react'
import { gisvizApi } from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import SharePost from '../../components/SharePost'

// 1. Interfaces
interface Category { category_id: number; slug: string; label: string; usage_count: number; }
interface Keyword { keyword_id: number; word: string; }
interface Post {
  post_id: string
  publisher_handle: string
  publisher_avatar_path: string | null
  title: string
  description: string | null
  visual_image_path: string | null
  categories: Category[]
  keywords: Keyword[]
  total_likes_count: number
  total_comments_count: number
  created_timestamp: string
  share_url: string
}

interface CommentData {
  comment_id: string
  publisher_handle: string
  publisher_avatar_path: string | null
  content: string
  created_timestamp: string
  replies?: CommentData[]
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export default function PostDetail() {
  const params = useParams()
  const postId = params.id as string
  const { isAuthenticated } = useAuth()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<CommentData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Interactive States
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isSaved, setIsSaved] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  
  // Commenting
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ id: string, handle: string } | null>(null)

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  // Fetch Data
  useEffect(() => {
    const fetchPostData = async () => {
      try {
        const foundPost = await gisvizApi.fetchPost(postId)
        setPost(foundPost)
        setLikeCount(foundPost.total_likes_count)
        
        const localSaves = JSON.parse(localStorage.getItem('gisviz_saved') || '[]')
        if (localSaves.includes(foundPost.post_id)) setIsSaved(true)

        const commentsData = await gisvizApi.fetchComments(postId)
        setComments(commentsData)

      } catch (error) {
        console.error("Failed to fetch post data", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (postId) fetchPostData()
  }, [postId])

  const handleLike = async () => {
    if (likeBusy) return
    setLikeBusy(true)
    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1)
    try {
      const res = await gisvizApi.toggleLike(postId)
      setIsLiked(res.liked)
      setLikeCount(res.total_likes_count)
    } catch (error) {
      setIsLiked(wasLiked)
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1)
    } finally {
      setLikeBusy(false)
    }
  }

  const handleSave = () => {
    const newSavedState = !isSaved
    setIsSaved(newSavedState)
    const savedPosts = JSON.parse(localStorage.getItem('gisviz_saved') || '[]')
    if (newSavedState) {
      localStorage.setItem('gisviz_saved', JSON.stringify([...savedPosts, postId]))
    } else {
      localStorage.setItem('gisviz_saved', JSON.stringify(savedPosts.filter((id: string) => id !== postId)))
    }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    setCommentError('')
    if (!newComment.trim() || !isAuthenticated) return

    setIsSubmittingComment(true)
    try {
      // Pass the replyingTo ID if we are in a nested reply mode
      await gisvizApi.addComment(postId, newComment, replyingTo?.id)
      
      // Re-fetch comments to get the fresh tree directly from backend
      const updatedComments = await gisvizApi.fetchComments(postId)
      setComments(updatedComments)
      
      setNewComment('')
      setReplyingTo(null)
      setPost(prev => prev ? { ...prev, total_comments_count: prev.total_comments_count + 1 } : prev)
    } catch (error: any) {
      setCommentError(error.response?.data?.detail || 'An error occurred while posting the comment.')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // Recursive Comment Renderer
  const renderComment = (comment: CommentData, isReply = false) => (
    <div key={comment.comment_id} className={`flex gap-3 ${isReply ? 'mt-3 border-l-2 border-gisviz-border/50 pl-3' : 'pt-4 first:pt-0'}`}>
      <div className="shrink-0 pt-1">
        {comment.publisher_avatar_path ? (
          <img src={`${API_BASE_URL}${comment.publisher_avatar_path}`} alt={comment.publisher_handle} className="w-7 h-7 rounded-full border border-gisviz-border object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gisviz-rail-soft border border-gisviz-border flex items-center justify-center font-bold text-gisviz-ink-soft font-mono text-[12px]">
             {comment.publisher_handle.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="bg-gisviz-canvas/50 rounded-sm p-3 border border-gisviz-border/50">
          <div className="flex justify-between items-start mb-1">
            <Link href={`/profile/${comment.publisher_handle}`} className="text-xs font-bold font-mono text-gisviz-ink hover:text-gisviz-accent transition-colors">
              @{comment.publisher_handle || 'Unknown'}
            </Link>
            <span className="text-[12px] font-mono text-gisviz-ink-soft">
              {new Date(comment.created_timestamp).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-gisviz-ink">{comment.content}</p>
        </div>
        
        {/* Reply Button (Only on top-level comments to keep tree clean) */}
        {!isReply && isAuthenticated && (
          <button 
            onClick={() => setReplyingTo({ id: comment.comment_id, handle: comment.publisher_handle })}
            className="text-[12px] font-mono font-bold text-gisviz-ink-soft hover:text-gisviz-accent uppercase mt-1.5 ml-1 transition-colors"
          >
            Reply
          </button>
        )}

        {/* Render Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    </div>
  )
  
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gisviz-accent" size={32} /></div>
  if (!post) return <div className="min-h-screen flex flex-col items-center justify-center gap-4"><MapPin size={48} className="opacity-50" /><h2 className="text-[16px]">Not Found</h2></div>

  const displayHandle = post.publisher_handle || 'Unknown'
  const avatarUrl = post.publisher_avatar_path ? `${API_BASE_URL}${post.publisher_avatar_path}` : null

  return (
    <div className="font-sans pb-12 relative max-w-7xl mx-auto px-4 mt-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Visual, Actions, and Description */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="relative bg-gisviz-card border border-gisviz-border rounded-sm shadow-md plate-enter p-2">
            <div className="w-full max-h-[75vh] flex items-center justify-center bg-black overflow-hidden rounded-sm relative z-10 border border-gisviz-border/50">
              {post.visual_image_path ? (
                <>
                  <div className="absolute inset-0 bg-cover bg-center opacity-60 blur-3xl scale-125 saturate-150" style={{ backgroundImage: `url(${API_BASE_URL}${post.visual_image_path})` }} />
                  <img src={`${API_BASE_URL}${post.visual_image_path}`} alt={post.title} className="w-full h-auto max-h-[75vh] object-contain relative z-10 drop-shadow-2xl" />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-gisviz-ink-soft opacity-50 bg-gisviz-canvas w-full">
                  <ImageIcon size={64} className="mb-4" />
                  <span className="font-mono uppercase text-sm">No Visual Attached</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-4">
            <button 
              onClick={handleLike} 
              disabled={likeBusy} 
              className={`bg-gisviz-card border border-gisviz-border py-3 rounded-sm shadow-sm flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-wider transition-colors group disabled:opacity-50 ${
                !isLiked 
                  ? 'text-gisviz-accent bg-gisviz-accent/5 border-gisviz-accent/30' 
                  : 'text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent/50'
              }`}
            >
              <ThumbsUp 
                size={18} 
                className={!isLiked ? 'fill-current' : 'fill-none group-hover:fill-gisviz-accent/20'} 
              /> 
              <span>{likeCount}</span>
            </button>
            <button onClick={handleSave} className={`bg-gisviz-card border border-gisviz-border py-3 rounded-sm shadow-sm flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-wider ${isSaved ? 'text-gisviz-accent bg-gisviz-accent/5' : 'text-gisviz-ink hover:text-gisviz-accent'}`}>
              <Bookmark size={18} className={isSaved ? 'fill-current' : ''} /> <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
            <button onClick={() => setIsShareModalOpen(true)} className="bg-gisviz-card border border-gisviz-border py-3 rounded-sm shadow-sm flex items-center justify-center gap-2 text-gisviz-ink hover:text-gisviz-accent font-mono text-sm uppercase tracking-wider">
              <Share2 size={18} /> Share
            </button>
          </div>

          {/* Description Moved Below Actions */}
          {post.description && (
            <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-6 shadow-sm mt-2">
              <h3 className="font-display font-bold text-gisviz-ink mb-4 uppercase tracking-wide text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-gisviz-survey rounded-sm"></span> Description
              </h3>
              <p className="text-sm text-gisviz-ink leading-relaxed whitespace-pre-wrap">
                {post.description}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Info & Comments (Sticky Layout) */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-20 lg:h-[calc(90vh-6rem)]">
          
          {/* Post Info Container */}
          <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-6 shadow-md shrink-0">
            {/* 1. Highlighted Category */}
            {post.categories.length > 0 && (
              <span className="inline-block px-2.5 py-1 bg-gisviz-rail-soft text-gisviz-ink text-[12px] font-mono font-bold tracking-widest uppercase rounded-sm mb-4">
                {post.categories[0].label}
              </span>
            )}
            
            {/* 2. Title */}
            <h1 className="text-[16px] lg:text-[24px] font-display font-bold text-gisviz-ink mb-4 leading-tight uppercase tracking-wide">
              {post.title}
            </h1>

            {/* 3 & 4. Published On / By */}
            <div className="flex flex-col gap-3 pb-5 mb-5">
              <div className="text-xs font-mono text-gisviz-ink-soft">
                Published on {new Date(post.created_timestamp).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/profile/${displayHandle}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-6 h-6 rounded-full border border-gisviz-border object-cover" alt={displayHandle} />
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-gisviz-border bg-gradient-to-tr from-gisviz-accent to-emerald-400 flex items-center justify-center text-white font-mono text-[12px] font-bold">
                      {displayHandle.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-bold font-mono text-gisviz-ink text-sm hover:text-gisviz-accent transition-colors">@{displayHandle}</span>
                </Link>
              </div>
            </div>

            {/* 5. Keywords */}
            {post.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.keywords.map((kw) => (
                  <span key={kw.keyword_id} className="text-[12px] font-mono font-bold text-gisviz-ink-soft border border-gisviz-border bg-gisviz-canvas px-2 py-0.5 rounded-sm">
                    #{kw.word}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Discussion Thread / Comments Plate */}
          <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-md flex-1 flex flex-col min-h-0 h-[500px] lg:h-auto">
            <div className="p-4 border-b border-gisviz-border bg-gisviz-canvas/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-gisviz-accent" />
                <h3 className="font-display font-bold text-gisviz-ink text-sm uppercase tracking-wide">
                  Discussion Thread
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-gisviz-ink-soft bg-gisviz-rail-soft px-2 py-0.5 rounded-sm">
                {post.total_comments_count}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scroll-smooth space-y-2">
              {comments.length === 0 ? (
                <p className="text-center text-xs font-mono text-gisviz-ink-soft py-8">No analysis submitted yet.</p>
              ) : (
                comments.map(comment => renderComment(comment, false))
              )}
            </div>

            <div className="p-4 border-t border-gisviz-border bg-gisviz-canvas/30 shrink-0">
              {isAuthenticated ? (
                <form onSubmit={handlePostComment} className="flex flex-col gap-2">
                  {replyingTo && (
                    <div className="flex items-center justify-between bg-gisviz-accent/10 border border-gisviz-accent/20 px-3 py-1.5 rounded-sm">
                      <span className="text-[12px] uppercase tracking-wider font-mono font-bold text-gisviz-accent">
                        Replying to @{replyingTo.handle}
                      </span>
                      <button type="button" onClick={() => setReplyingTo(null)} className="text-gisviz-accent hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={replyingTo ? "Write a reply..." : "Submit analysis or inquiry..."}
                      className="w-full bg-gisviz-card border border-gisviz-border rounded-sm py-2.5 pl-3 pr-12 text-sm text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-sans shadow-inner"
                    />
                    <button 
                      type="submit"
                      disabled={isSubmittingComment || !newComment.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gisviz-accent hover:bg-gisviz-accent/10 rounded-sm transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      {isSubmittingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                  {commentError && <p className="text-xs text-red-500 font-mono mt-1">{commentError}</p>}
                </form>
              ) : (
                <div className="text-center p-3 border border-dashed border-gisviz-border rounded-sm">
                  <p className="text-xs font-mono text-gisviz-ink-soft">
                    <Link href="/auth" className="text-gisviz-accent font-bold hover:underline">Authenticate</Link> to join the Discussion Thread.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {post && (
        <SharePost 
          isOpen={isShareModalOpen} 
          onClose={() => setIsShareModalOpen(false)}
          url={post.share_url || `${typeof window !== 'undefined' ? window.location.origin : ''}/post/${post.post_id}`}
          title={post.title}
        />
      )}
    </div>
  )
}