'use client'

import React, { useEffect, useState } from 'react'
import { 
  ThumbsUp, 
  Bookmark, 
  Plus, 
  Loader2, 
  MessageSquare, 
  MoreHorizontal, 
  Flag, 
  Share2,
  Image as ImageIcon
} from 'lucide-react'
import Link from 'next/link'
import { gisvizApi } from '../../services/api'
import ShareModal from '../components/SharePost'
import ReportModal from '../components/ReportPost'

interface Category { category_id: number; slug: string; label: string; usage_count: number; }
interface Keyword { keyword_id: number; word: string; }
interface Post {
  post_id: string
  publisher_user_id: string
  publisher_handle: string
  publisher_avatar_path: string | null
  title: string
  description: string | null
  visual_image_path: string | null
  categories: Category[]
  keywords: Keyword[]
  share_slug: string
  share_url: string
  total_likes_count: number
  total_comments_count: number
  created_timestamp: string
  updated_timestamp?: string
}

const POSTS_PER_PAGE = 25;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [likeBusy, setLikeBusy] = useState<string | null>(null)
  
  const [likedPosts, setLikedPosts] = useState<string[]>([])
  const [savedPosts, setSavedPosts] = useState<string[]>([])
  
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [shareModalPost, setShareModalPost] = useState<Post | null>(null)
  const [reportModalId, setReportModalId] = useState<string | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    const localSaves = JSON.parse(localStorage.getItem('gisviz_saved') || '[]')
    setSavedPosts(localSaves)
  }, [])

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null)
    if (openDropdownId) {
      window.addEventListener('click', handleClickOutside)
    }
    return () => window.removeEventListener('click', handleClickOutside)
  }, [openDropdownId])

  const fetchPosts = async (currentOffset: number, isInitial = false) => {
    if (!isInitial) setIsLoadingMore(true)
    
    try {
      const data = await gisvizApi.fetchGlobalStream(currentOffset, POSTS_PER_PAGE)
      
      if (data.length < POSTS_PER_PAGE) {
        setHasMore(false)
      }
      
      if (isInitial) {
        setPosts(data)
      } else {
        setPosts((prev) => [...prev, ...data])
      }
      
      setOffset(currentOffset + POSTS_PER_PAGE)
    } catch (error) {
      console.error("Failed to load feed:", error)
      if (isInitial) setPosts([])
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchPosts(0, true)
  }, [])

 const handleLike = async (postId: string) => {
    if (likeBusy) return
    setLikeBusy(postId)

    try {
      // The backend returns { liked: boolean, total_likes_count: number }
      const res = await gisvizApi.toggleLike(postId)
      
      setPosts((prev) =>
        prev.map((p) =>
          p.post_id === postId
            ? { ...p, total_likes_count: res.total_likes_count }
            : p
        )
      )

      // Use the absolute truth from the server instead of guessing!
      setLikedPosts((prev) =>
        res.liked
          ? [...new Set([...prev, postId])] // Add it safely (Set prevents duplicates)
          : prev.filter((id) => id !== postId) // Remove it
      )
    } catch (error) {
      console.error("Like interaction failure:", error)
    } finally {
      setLikeBusy(null)
    }
  }

  const handleSave = (postId: string) => {
    const isCurrentlySaved = savedPosts.includes(postId)
    let updatedSaves: string[]

    if (isCurrentlySaved) {
      updatedSaves = savedPosts.filter((id) => id !== postId)
    } else {
      updatedSaves = [...savedPosts, postId]
    }

    setSavedPosts(updatedSaves)
    localStorage.setItem('gisviz_saved', JSON.stringify(updatedSaves))
  }

  const toggleDropdown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setOpenDropdownId(openDropdownId === id ? null : id)
  }

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gisviz-accent"></div>
      </div>
    )

  if (posts.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <p className="text-gisviz-ink-soft">No posts found in database.</p>
        <Link href="/upload" className="flex items-center gap-2 bg-gisviz-accent/10 text-gisviz-accent border border-gisviz-accent/20 hover:bg-gisviz-accent hover:text-white px-5 py-2 rounded-full text-sm font-bold transition-all">
          <Plus size={16} /> Upload the first Visual
        </Link>
      </div>
    )

  return (
    <div className="h-[calc(100vh-4rem)] md:h-auto overflow-y-scroll md:overflow-visible snap-y snap-mandatory md:snap-none scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-24 pt-4 md:pt-0 relative">

      <div className="flex justify-center mb-6 snap-start">
        <Link href="/upload" className="flex items-center gap-2 bg-gisviz-accent/10 text-gisviz-accent border border-gisviz-accent/20 hover:bg-gisviz-accent hover:text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm">
          <Plus size={16} /> Publish a Visual
        </Link>
      </div>

      {posts.map((post) => {
        const isPostLiked = likedPosts.includes(post.post_id)
        const isPostSaved = savedPosts.includes(post.post_id)

        return (
          <div key={post.post_id} className="snap-start snap-always md:snap-align-none w-full pb-8">
            <article className="bg-gisviz-card border border-gisviz-border rounded-xl p-5 shadow-sm transition-all hover:shadow-md overflow-hidden relative">

              <div className="flex justify-between items-start mb-4 gap-4">
                <Link href={`/post/${post.post_id}`} className="hover:opacity-70 transition-opacity flex-1">
                  <h2 className="text-xl md:text-2xl font-display font-medium text-gisviz-ink uppercase tracking-wide leading-snug cursor-pointer hover:underline">
                    {post.title}
                  </h2>
                </Link>
                <div className="flex items-center gap-2 pt-1 relative">
                  <span className="text-xs font-mono font-medium text-gisviz-ink-soft whitespace-nowrap bg-gisviz-canvas px-2 py-1 rounded-md border border-gisviz-border">
                    {new Date(post.created_timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  
                  <button 
                    onClick={(e) => toggleDropdown(e, post.post_id)}
                    className="p-1 text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-rail-soft rounded-full transition-colors"
                  >
                    <MoreHorizontal size={20} />
                  </button>

                  {openDropdownId === post.post_id && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-gisviz-card border border-gisviz-border rounded-xl shadow-lg z-20 plate-enter overflow-hidden py-1" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => {
                          setShareModalPost(post)
                          setOpenDropdownId(null)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent transition-colors"
                      >
                        <Share2 size={16} /> Share Post
                      </button>
                      <div className="border-t border-gisviz-border my-1"></div>
                      <button 
                        onClick={() => {
                          setReportModalId(post.post_id)
                          setOpenDropdownId(null)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <Flag size={16} /> Report
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {post.categories.map((cat) => (
                  <span
                    key={cat.category_id}
                    className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase bg-gisviz-rail-soft text-gisviz-ink rounded-md border border-gisviz-border/30"
                  >
                    {cat.label}
                  </span>
                ))}
              </div>

              {/* Professional Visual Image Render with Dominant Color Blur */}
                <div className="w-[calc(100%+2.5rem)] -mx-5 border-y border-gisviz-border overflow-hidden mb-4 rounded-none relative flex items-center justify-center bg-black">
                  {post.visual_image_path ? (
                    <>
                      {/* Blurred Backdrop for matching dominant color */}
                      <div 
                        className="absolute inset-0 bg-cover bg-center opacity-60 blur-3xl scale-125 saturate-150"
                        style={{ backgroundImage: `url(${API_BASE_URL}${post.visual_image_path})` }}
                      />
                      {/* Clear Foreground Image: 
                          w-full forces it to touch the left/right edges.
                          h-auto allows vertical images to grow as tall as needed natively!
                      */}
                      <img 
                        src={`${API_BASE_URL}${post.visual_image_path}`} 
                        alt={post.title} 
                        className="w-full h-auto relative z-10 drop-shadow-2xl"
                      />
                    </>
                  ) : (
                    <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-gisviz-ink-soft gap-2 bg-gisviz-canvas z-10">
                      <ImageIcon size={32} />
                      <span className="font-mono text-sm uppercase">No Visual Provided</span>
                    </div>
                  )}
                </div>

              <div className="flex items-center justify-between text-xs text-gisviz-ink-soft font-mono mb-4">
                <div className="flex items-center gap-1.5">
                  {post.keywords.length > 0 && (
                    <span className="uppercase tracking-wider opacity-75">
                     Source: {post.keywords.slice(0, 3).map(k => k.word).join(', ')}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wider opacity-75">Visual Credit:</span>
                  <Link 
                    href={`/profile/${post.publisher_handle}`} 
                    className="flex items-center gap-1.5 bg-gisviz-canvas pr-2.5 pl-1 py-0.5 rounded-full border border-gisviz-border hover:border-gisviz-accent transition-colors group/author"
                  >
                    {post.publisher_avatar_path ? (
                      <img src={`${API_BASE_URL}${post.publisher_avatar_path}`} className="w-5 h-5 rounded-full object-cover" alt={post.publisher_handle} />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-gisviz-accent to-emerald-400 flex items-center justify-center text-white text-[10px] font-bold uppercase font-mono">
                        {post.publisher_handle.charAt(0)}
                      </div>
                    )}
                    <span className="font-bold text-gisviz-ink text-[11px] group-hover/author:text-gisviz-accent transition-colors">
                      @{post.publisher_handle}
                    </span>
                  </Link>
                </div>
              </div>

              <div className="border-t border-gisviz-border pt-4 grid grid-cols-3 divide-x divide-gisviz-border text-gisviz-ink-soft">
                <button 
                  onClick={() => handleSave(post.post_id)}
                  className={`flex items-center justify-center gap-2 hover:text-gisviz-accent transition-colors text-sm font-medium group ${isPostSaved ? 'text-gisviz-accent' : ''}`}
                >
                  <Bookmark size={18} className={isPostSaved ? 'fill-current' : 'group-hover:fill-gisviz-accent/20'} />
                  <span>{isPostSaved ? 'Saved' : 'Save'}</span>
                </button>
                
                <button
                  onClick={() => handleLike(post.post_id)}
                  disabled={likeBusy === post.post_id}
                  className={`flex items-center justify-center gap-2 transition-colors text-sm font-medium group disabled:opacity-50 ${
                    isPostLiked ? 'text-gisviz-accent' : 'text-gisviz-ink hover:text-gisviz-accent'
                  }`}
                >
                  <ThumbsUp 
                    size={18} 
                    className={isPostLiked ? 'fill-current' : 'fill-none group-hover:fill-gisviz-accent/20'} 
                  />
                  <span>{post.total_likes_count || 'Like'}</span>
                </button>
                
                <Link href={`/post/${post.post_id}`} className="flex items-center justify-center gap-2 hover:text-gisviz-ink transition-colors text-sm font-medium group">
                  <MessageSquare size={18} className="group-hover:text-gisviz-ink" />
                  <span>{post.total_comments_count || 0} Comments</span>
                </Link>
              </div>

            </article>
          </div>
        )
      })}

      {hasMore ? (
        <div className="flex justify-center mt-4 mb-8 snap-start">
          <button 
            onClick={() => fetchPosts(offset)}
            disabled={isLoadingMore}
            className="flex items-center gap-2 bg-gisviz-canvas text-gisviz-ink-soft border border-gisviz-border hover:border-gisviz-accent hover:text-gisviz-accent px-6 py-3 rounded-full text-sm font-bold transition-all shadow-sm disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Fetching Posts...
              </>
            ) : (
              'Load More Publications'
            )}
          </button>
        </div>
      ) : (
        <div className="text-center py-8 text-xs font-mono text-gisviz-ink-soft uppercase tracking-widest border-t border-gisviz-border/50 mt-4 mx-8">
          — No more in Feed —
        </div>
      )}

      {shareModalPost && (
        <ShareModal 
          isOpen={!!shareModalPost} 
          onClose={() => setShareModalPost(null)}
          url={shareModalPost.share_url || `${typeof window !== 'undefined' ? window.location.origin : ''}/post/${shareModalPost.post_id}`}
          title={shareModalPost.title}
        />
      )}

      {reportModalId && (
        <ReportModal 
          isOpen={!!reportModalId} 
          onClose={() => setReportModalId(null)}
          publicationId={reportModalId}
        />
      )}

    </div>
  )
}