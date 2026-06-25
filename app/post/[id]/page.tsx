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
  ChevronLeft
} from 'lucide-react'
import MapComponent from '../../components/MapComponent'
import { gisvizApi } from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import SharePost from '../../components/SharePost'

interface Category { category_id: number; slug: string; label: string; usage_count: number; }
interface Publication {
  publication_id: string
  author_handle?: string
  publisher_handle?: string
  author_avatar_url?: string
  publisher_avatar_url?: string
  publication_title: string
  categories: Category[]
  layer_attribute_metadata: { projection?: string; [k: string]: unknown }
  spatial_geometry: { type: string; coordinates: [number, number] }
  total_likes_count: number
  total_comments_count: number
  created_timestamp: string
  share_url: string
}

interface CommentData {
  comment_id: string
  author_handle: string
  author_avatar_url: string
  content: string
  created_timestamp: string
  replies: CommentData[]
}

export default function PostDetail() {
  const params = useParams()
  const publicationId = params.id as string
  const { token, isAuthenticated } = useAuth()

  const [post, setPost] = useState<Publication | null>(null)
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

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  useEffect(() => {
    const fetchPostData = async () => {
      try {
        const streamData = await gisvizApi.fetchGlobalStream(0, 100)
        const foundPost = streamData.find((p: Publication) => p.publication_id === publicationId)
        
        if (foundPost) {
          setPost(foundPost)
          setLikeCount(foundPost.total_likes_count)
          
          const localSaves = JSON.parse(localStorage.getItem('gisviz_saved') || '[]')
          if (localSaves.includes(foundPost.publication_id)) setIsSaved(true)
        }

        const commentsRes = await fetch(`/api/v1/publications/${publicationId}/comments`)
        if (commentsRes.ok) {
          const commentsData = await commentsRes.json()
          setComments(commentsData)
        }

      } catch (error) {
        console.error("Failed to fetch publication data", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (publicationId) fetchPostData()
  }, [publicationId])

  const handleLike = async () => {
    if (likeBusy) return
    setLikeBusy(true)

    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1)

    try {
      const res = await gisvizApi.toggleLike(publicationId)
      setIsLiked(res.liked)
      setLikeCount(res.total_likes_count)
    } catch (error) {
      setIsLiked(wasLiked)
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1)
      console.error("Like interaction failed:", error)
    } finally {
      setLikeBusy(false)
    }
  }

  const handleSave = () => {
    const newSavedState = !isSaved
    setIsSaved(newSavedState)
    
    const savedPosts = JSON.parse(localStorage.getItem('gisviz_saved') || '[]')
    if (newSavedState) {
      localStorage.setItem('gisviz_saved', JSON.stringify([...savedPosts, publicationId]))
    } else {
      localStorage.setItem('gisviz_saved', JSON.stringify(savedPosts.filter((id: string) => id !== publicationId)))
    }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    setCommentError('')
    
    if (!newComment.trim() || !isAuthenticated) return

    setIsSubmittingComment(true)
    try {
      const activeToken = token || localStorage.getItem('token')
      
      const res = await fetch(`/api/v1/publications/${publicationId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({ 
          content: newComment,
          parent_comment_id: null 
        })
      })

      // Safely check if the response is actually JSON before parsing
      const contentType = res.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
          const textError = await res.text()
          throw new Error(`Server Error: ${textError.substring(0, 50)}...`)
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'Failed to post comment')
      }

      const postedComment = await res.json()
      
      setComments(prev => [...prev, postedComment])
      setNewComment('')
      setPost(prev => prev ? { ...prev, total_comments_count: prev.total_comments_count + 1 } : prev)

    } catch (error: any) {
      console.error("Comment pipeline failure:", error)
      setCommentError(error.message || 'An error occurred while communicating with the server.')
    } finally {
      setIsSubmittingComment(false)
    }
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gisviz-canvas/50">
        <Loader2 className="animate-spin text-gisviz-accent" size={32} />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gisviz-canvas/50 gap-4">
        <MapPin size={48} className="text-gisviz-ink-soft opacity-50" />
        <h2 className="font-display text-xl text-gisviz-ink">Publication Not Found</h2>
        <Link href="/" className="text-sm font-mono text-gisviz-accent hover:underline flex items-center gap-2">
          <ChevronLeft size={16} /> Return to Global Stream
        </Link>
      </div>
    )
  }

  // Safe Extraction: Handles both old backend cache (publisher_) and new schema (author_)
  const displayHandle = post.author_handle || post.publisher_handle || 'Unknown'
  const displayAvatar = post.author_avatar_url || post.publisher_avatar_url

  const projection = typeof post.layer_attribute_metadata?.projection === 'string'
    ? post.layer_attribute_metadata.projection.split(':')[1]
    : '4326'

  return (
    <div className="font-sans pb-12 relative">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Map & Primary Actions */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          <div className="relative bg-gisviz-card border border-gisviz-border rounded-sm shadow-md plate-enter p-2">
            
            <div className="w-full h-[65vh] min-h-[500px] overflow-hidden rounded-sm relative z-10 border border-gisviz-border/50">
              <MapComponent
                longitude={post.spatial_geometry.coordinates[0]}
                latitude={post.spatial_geometry.coordinates[1]}
                interactive={true}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button 
              onClick={handleLike}
              disabled={likeBusy}
              className={`bg-gisviz-card border border-gisviz-border py-3 rounded-sm shadow-sm flex items-center justify-center gap-2 transition-all font-mono text-sm uppercase tracking-wider disabled:opacity-50 ${isLiked ? 'text-gisviz-accent border-gisviz-accent/30 bg-gisviz-accent/5' : 'text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent/50'}`}
            >
              <ThumbsUp size={18} className={isLiked ? 'fill-current' : ''} /> 
              <span>{likeCount} Likes</span>
            </button>
            <button 
              onClick={handleSave}
              className={`bg-gisviz-card border border-gisviz-border py-3 rounded-sm shadow-sm flex items-center justify-center gap-2 transition-all font-mono text-sm uppercase tracking-wider ${isSaved ? 'text-gisviz-accent border-gisviz-accent/30 bg-gisviz-accent/5' : 'text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent/50'}`}
            >
              <Bookmark size={18} className={isSaved ? 'fill-current' : ''} /> 
              <span>{isSaved ? 'Saved' : 'Save Data'}</span>
            </button>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="bg-gisviz-card border border-gisviz-border py-3 rounded-sm shadow-sm flex items-center justify-center gap-2 hover:text-gisviz-accent hover:border-gisviz-accent/50 transition-all font-mono text-sm uppercase tracking-wider text-gisviz-ink"
            >
              <Share2 size={18} /> Share
            </button>
          </div>
        </div>

        {/* Right Column: Details & Comments */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-6 shadow-md plate-enter relative">
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-gisviz-ink mb-6 leading-tight uppercase tracking-wide">
              {post.publication_title}
            </h1>

            <div className="flex items-center gap-4 pb-6 border-b border-gisviz-border">
              <Link href={`/${displayHandle}`} className="shrink-0 hover:opacity-80 transition-opacity">
                {displayAvatar ? (
                  <img src={displayAvatar} className="w-12 h-12 rounded-full border border-gisviz-border object-cover" alt={displayHandle} />
                ) : (
                  <div className="w-12 h-12 rounded-full border border-gisviz-border bg-gradient-to-tr from-gisviz-accent to-emerald-400 flex items-center justify-center text-white font-mono font-bold">
                    {displayHandle.charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>
              <div>
                <Link href={`/${displayHandle}`} className="font-bold text-gisviz-ink text-base hover:text-gisviz-accent transition-colors">
                  @{displayHandle}
                </Link>
                <p className="text-xs font-mono text-gisviz-ink-soft">Published {new Date(post.created_timestamp).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="pt-6 space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gisviz-ink-soft font-bold mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gisviz-accent rounded-sm"></span> Classification
                </p>
                <div className="flex flex-wrap gap-2">
                  {post.categories.map((cat) => (
                    <span key={cat.category_id} className="px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider uppercase bg-gisviz-canvas text-gisviz-ink rounded-sm border border-gisviz-border">
                      {cat.label}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gisviz-ink-soft font-bold mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gisviz-survey rounded-sm"></span> Spatial Context
                </p>
                <div className="bg-gisviz-canvas rounded-sm p-4 border border-gisviz-border font-mono text-xs text-gisviz-ink space-y-2 shadow-inner">
                  <div className="flex justify-between border-b border-gisviz-border/50 pb-1">
                    <span className="text-gisviz-ink-soft">Projection</span>
                    <span className="font-bold">EPSG:{projection}</span>
                  </div>
                  <div className="flex justify-between border-b border-gisviz-border/50 pb-1">
                    <span className="text-gisviz-ink-soft">Latitude</span>
                    <span className="font-bold">{post.spatial_geometry.coordinates[1].toFixed(6)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gisviz-ink-soft">Longitude</span>
                    <span className="font-bold">{post.spatial_geometry.coordinates[0].toFixed(6)}°</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Discussion / Comments Plate */}
          <div className="bg-gisviz-card border border-gisviz-border rounded-sm shadow-md flex-1 flex flex-col min-h-[400px]">
            <div className="p-4 border-b border-gisviz-border bg-gisviz-canvas/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-gisviz-accent" />
                <h3 className="font-display font-bold text-gisviz-ink text-sm uppercase tracking-wide">
                  Analyst Discussion
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-gisviz-ink-soft bg-gisviz-rail-soft px-2 py-0.5 rounded-sm">
                {post.total_comments_count}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px] scroll-smooth">
              {comments.length === 0 ? (
                <p className="text-center text-xs font-mono text-gisviz-ink-soft py-8">No analysis submitted yet.</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.comment_id} className="flex gap-3">
                    <div className="shrink-0 pt-1">
                      {comment.author_avatar_url ? (
                        <img src={comment.author_avatar_url} alt={comment.author_handle} className="w-8 h-8 rounded-full border border-gisviz-border object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gisviz-rail-soft border border-gisviz-border" />
                      )}
                    </div>
                    <div className="flex-1 bg-gisviz-canvas/50 rounded-sm p-3 border border-gisviz-border/50">
                      <div className="flex justify-between items-start mb-1">
                        <Link href={`/${comment.author_handle}`} className="text-xs font-bold font-mono text-gisviz-ink hover:text-gisviz-accent transition-colors">
                          @{comment.author_handle || 'Unknown'}
                        </Link>
                        <span className="text-[10px] font-mono text-gisviz-ink-soft">
                          {new Date(comment.created_timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gisviz-ink">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gisviz-border bg-gisviz-canvas/30">
              {isAuthenticated ? (
                <form onSubmit={handlePostComment} className="flex flex-col gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Submit analysis or inquiry..."
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
                  {commentError && (
                    <p className="text-xs text-red-500 font-mono mt-1">{commentError}</p>
                  )}
                </form>
              ) : (
                <div className="text-center p-3 border border-dashed border-gisviz-border rounded-sm">
                  <p className="text-xs font-mono text-gisviz-ink-soft">
                    <Link href="/auth" className="text-gisviz-accent font-bold hover:underline">Authenticate</Link> to join the discussion.
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
          url={post.share_url || `${typeof window !== 'undefined' ? window.location.origin : ''}/post/${post.publication_id}`}
          title={post.publication_title}
        />
      )}
    </div>
  )
}