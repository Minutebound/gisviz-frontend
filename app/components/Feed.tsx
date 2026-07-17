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
import { useRouter } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
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
  note: string | null
  source_name: string | null
  source_url: string | null
  updated_timestamp?: string
  is_liked: boolean | null
  is_bookmarked: boolean | null
}

const POSTS_PER_PAGE = 12
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://'

const formatTimeAgo = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function Feed() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'stream' | 'trending'>('stream')
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [likeBusy, setLikeBusy] = useState<string | null>(null)
  const [bookmarkBusy, setBookmarkBusy] = useState<string | null>(null)

  const [likedPosts, setLikedPosts]           = useState<Record<string, boolean>>({})
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Record<string, boolean>>({})

  const [openDropdownId, setOpenDropdownId]   = useState<string | null>(null)
  const [shareModalPost, setShareModalPost]   = useState<Post | null>(null)
  const [reportModalId, setReportModalId]     = useState<string | null>(null)

  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    if (authLoading) return
    fetchPosts(0, true, 'stream')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated])

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null)
    if (openDropdownId) window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [openDropdownId])

  const fetchPosts = async (currentOffset: number, isInitial = false, tab = activeTab) => {
    if (!isInitial) setIsLoadingMore(true)
    try {
      let data: Post[] = []
      if (tab === 'stream') {
        data = await gisvizApi.fetchGlobalStream(currentOffset, POSTS_PER_PAGE)
      } else {
        data = await gisvizApi.fetchTrendingFull(POSTS_PER_PAGE)
      }

      if (tab === 'trending' || data.length < POSTS_PER_PAGE) setHasMore(false)
      else setHasMore(true)

      const newLiked: Record<string, boolean>      = {}
      const newBookmarked: Record<string, boolean> = {}
      data.forEach((p) => {
        if (p.is_liked      != null) newLiked[p.post_id]      = p.is_liked
        if (p.is_bookmarked != null) newBookmarked[p.post_id] = p.is_bookmarked
      })

      if (isInitial) {
        setPosts(data)
        setLikedPosts(newLiked)
        setBookmarkedPosts(newBookmarked)
      } else {
        setPosts((prev) => [...prev, ...data])
        setLikedPosts((prev) => ({ ...prev, ...newLiked }))
        setBookmarkedPosts((prev) => ({ ...prev, ...newBookmarked }))
      }
      setOffset(currentOffset + POSTS_PER_PAGE)
    } catch (error) {
      console.error(`Failed to load ${tab} feed:`, error)
      if (isInitial) setPosts([])
    } finally {
      if (isInitial) setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  const handleTabSwitch = (tab: 'stream' | 'trending') => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setIsLoading(true)
    setPosts([])
    setOffset(0)
    setHasMore(true)
    fetchPosts(0, true, tab)
  }

  const handleLike = async (postId: string) => {
    if (!isAuthenticated) { router.push('/auth'); return }
    if (likeBusy) return
    setLikeBusy(postId)
    const wasLiked = likedPosts[postId] ?? false
    setLikedPosts((prev) => ({ ...prev, [postId]: !wasLiked }))
    setPosts((prev) => prev.map((p) =>
      p.post_id === postId
        ? { ...p, total_likes_count: wasLiked ? p.total_likes_count - 1 : p.total_likes_count + 1 }
        : p
    ))
    try {
      const res = await gisvizApi.toggleLike(postId)
      setLikedPosts((prev) => ({ ...prev, [postId]: res.liked }))
      setPosts((prev) => prev.map((p) =>
        p.post_id === postId ? { ...p, total_likes_count: res.total_likes_count } : p
      ))
    } catch (error) {
      setLikedPosts((prev) => ({ ...prev, [postId]: wasLiked }))
      setPosts((prev) => prev.map((p) =>
        p.post_id === postId
          ? { ...p, total_likes_count: wasLiked ? p.total_likes_count + 1 : p.total_likes_count - 1 }
          : p
      ))
      console.error('Like interaction failure:', error)
    } finally {
      setLikeBusy(null)
    }
  }

  const handleBookmark = async (postId: string) => {
    if (!isAuthenticated) { router.push('/auth'); return }
    if (bookmarkBusy) return
    setBookmarkBusy(postId)
    const wasBookmarked = bookmarkedPosts[postId] ?? false
    setBookmarkedPosts((prev) => ({ ...prev, [postId]: !wasBookmarked }))
    try {
      const res = await gisvizApi.toggleBookmark(postId)
      setBookmarkedPosts((prev) => ({ ...prev, [postId]: res.bookmarked }))
    } catch (error) {
      setBookmarkedPosts((prev) => ({ ...prev, [postId]: wasBookmarked }))
      console.error('Bookmark interaction failure:', error)
    } finally {
      setBookmarkBusy(null)
    }
  }

  const toggleDropdown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setOpenDropdownId(openDropdownId === id ? null : id)
  }

  return (
    <div className="
      h-[calc(100vh-4rem)] md:h-auto
      overflow-y-auto md:overflow-visible
      scroll-smooth
      [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]
      pb-24 pt-4 md:pt-0
      relative
    ">

      {/* ── HEADER ── */}
      <div className="
        flex flex-col justify-start
        pt-2 pb-4 md:py-0
      ">
        <div className="flex justify-between items-center mb-6">

          {/* Animated Segmented Control */}
          <div className="flex bg-gisviz-canvas border border-gisviz-border rounded-full p-1 relative shadow-sm w-56 shrink-0">
            <div
              className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-gisviz-card shadow-sm border border-gisviz-border rounded-full transition-transform duration-300 ease-out ${
                activeTab === 'stream' ? 'translate-x-0' : 'translate-x-full'
              }`}
            />
            <button
              onClick={() => handleTabSwitch('stream')}
              className={`relative z-10 flex-1 py-1.5 text-[12px] font-bold rounded-full transition-colors duration-300 ${
                activeTab === 'stream' ? 'text-gisviz-ink' : 'text-gisviz-ink-soft'
              }`}
            >
              Stream
            </button>
            <button
              onClick={() => handleTabSwitch('trending')}
              className={`relative z-10 flex-1 py-1.5 text-[12px] font-bold rounded-full transition-colors duration-300 ${
                activeTab === 'trending' ? 'text-gisviz-ink' : 'text-gisviz-ink-soft'
              }`}
            >
              Trending
            </button>
          </div>

          <Link
            href="/post/upload"
            className="flex items-center gap-2 bg-gisviz-accent text-gisviz-white px-4 py-2 rounded-full text-[12px] font-bold hover:bg-opacity-90 transition-all shadow-sm"
          >
            <Plus size={16} /> Publish
          </Link>
        </div>
      </div>

      {/* ── FEED CONTENT ── */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gisviz-accent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
          <p className="text-gisviz-ink-soft">No posts found in {activeTab === 'stream' ? 'Stream' : 'Trending'}.</p>
        </div>
      ) : (
        <>
          {posts.map((post) => {
            const isPostLiked      = likedPosts[post.post_id]      ?? false
            const isPostBookmarked = bookmarkedPosts[post.post_id] ?? false
            const isOwnPost        = isAuthenticated && user?.user_id === post.publisher_user_id
            const allTags = [...post.categories.map(c => c.label), ...post.keywords.map(k => k.word)]

            return (
              <div
                key={post.post_id}
                className="w-full pb-8"
              >
                <article className="bg-gisviz-card border border-gisviz-border rounded-xl p-5 shadow-sm transition-shadow hover:shadow-md relative">
                  
                  {/* Title & Dropdown */}
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <Link href={`/post/${post.post_id}`} className="hover:opacity-80 transition-opacity block flex-1">
                      <h2 className="text-[16px] md:text-[24px] font-bold text-gisviz-ink text-camelcase leading-snug tracking-tight">
                        <span className="px-1.5 py-0.5 box-decoration-clone rounded-sm">
                          {post.title}
                        </span>
                      </h2>
                    </Link>
                    
                    <div className="relative pt-1">
                      <button 
                        onClick={(e) => toggleDropdown(e, post.post_id)}
                        className="p-1 text-gisviz-ink-soft hover:text-gisviz-ink hover:bg-gisviz-rail-soft rounded-full transition-colors -mr-1"
                      >
                        <MoreHorizontal size={20} />
                      </button>

                      {openDropdownId === post.post_id && (
                        <div className="absolute right-0 top-full mt-2 w-40 bg-gisviz-card border border-gisviz-border rounded-xl shadow-lg z-20 overflow-hidden py-1" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => { setShareModalPost(post); setOpenDropdownId(null) }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-[12px] text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent transition-colors"
                          >
                            <Share2 size={16} /> Share Post
                          </button>
                          <div className="border-t border-gisviz-border my-1" />
                          <button 
                            onClick={() => { setReportModalId(post.post_id); setOpenDropdownId(null) }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-[12px] text-gisviz-alert hover:bg-gisviz-alert/10 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <Flag size={16} /> Report
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.map((tag, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-[12px] text-camelcase mb-2 font-medium bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft rounded-md tracking-wide whitespace-nowrap">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                        
                  {/* Visual Image */}
                  <Link href={`/post/${post.post_id}`} className="block mb-4">
                    <div className="w-full rounded-xl overflow-hidden bg-gisviz-canvas border border-gisviz-border relative flex items-center justify-center min-h-[200px]">
                      {post.visual_image_path ? (
                        <img 
                          src={`${API_BASE_URL}${post.visual_image_path}`} 
                          alt={post.title} 
                          className="w-full h-auto object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-gisviz-ink-soft py-12 gap-2">
                          <ImageIcon size={32} />
                          <span className="font-mono text-[12px] uppercase">No Visual</span>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Profile & Metadata */}
                  <div className="flex items-start justify-between mb-5 gap-4">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Link href={`/profile/${post.publisher_handle}`} className="shrink-0">
                        {post.publisher_avatar_path ? (
                          <img
                            src={`${API_BASE_URL}${post.publisher_avatar_path}`}
                            alt={post.publisher_handle}
                            className="w-10 h-10 rounded-full object-cover border border-gisviz-border flex-shrink-0" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full border border-gisviz-border bg-gradient-to-tr from-gisviz-accent to-gisviz-safe flex items-center justify-center text-gisviz-white text-[16px] font-bold uppercase font-mono shadow-inner flex-shrink-0">
                            {post.publisher_handle.charAt(0)}
                          </div>
                        )}
                      </Link>
                      <div className="min-w-0">
                        <Link href={`/profile/${post.publisher_handle}`} className="text-[16px] font-bold text-gisviz-ink hover:text-gisviz-accent truncate block">
                          @{post.publisher_handle}
                        </Link>
                        <span className="text-[12px] font-mono text-gisviz-ink-soft">{formatTimeAgo(post.created_timestamp)}</span>
                      </div>
                    </div>

                    {(post.source_name || post.note) && (
                      <div className="flex flex-col items-end text-[12px] text-gisviz-ink-soft text-right max-w-[50%] gap-0.5">
                        {post.source_name && (
                          <span className="truncate w-full">
                            Source:{' '}
                            {post.source_url ? (
                              <a href={post.source_url.startsWith('http') ? post.source_url : `https://${post.source_url}`} target="_blank" rel="noopener noreferrer" className="text-gisviz-accent hover:underline">
                                {post.source_name}
                              </a>
                            ) : (
                              <span className="font-medium text-gisviz-ink">{post.source_name}</span>
                            )}
                          </span>
                        )}
                        {post.note && (
                          <span className="truncate w-full" title={post.note}>
                            Note: {post.note}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Interaction Footer */}
                  <div className="flex items-center justify-between text-gisviz-ink pt-3 border-t border-gisviz-border/50">
                    <div className="flex items-center gap-6 font-medium text-[16px]">
                      <button
                        onClick={() => handleLike(post.post_id)}
                        disabled={likeBusy === post.post_id}
                        className={`flex items-center gap-2 transition-colors disabled:opacity-50 ${
                          isPostLiked ? 'text-gisviz-accent' : 'hover:text-gisviz-accent text-gisviz-ink-soft'
                        }`}
                      >
                        {likeBusy === post.post_id
                          ? <Loader2 size={20} className="animate-spin" />
                          : <ThumbsUp size={20} className={isPostLiked ? 'fill-current' : ''} />
                        }
                        <span>
                          {post.total_likes_count > 0
                            ? post.total_likes_count >= 1000
                              ? (post.total_likes_count / 1000).toFixed(1) + 'K'
                              : post.total_likes_count
                            : ''}
                        </span>
                      </button>
                      
                      <Link href={`/post/${post.post_id}`} className="flex items-center gap-2 hover:text-gisviz-accent text-gisviz-ink-soft transition-colors">
                        <MessageSquare size={20} />
                        <span>
                          {post.total_comments_count > 0
                            ? post.total_comments_count >= 1000
                              ? (post.total_comments_count / 1000).toFixed(1) + 'K'
                              : post.total_comments_count
                            : ''}{' '}
                          {post.total_comments_count > 1 ? 'Comments' : 'Comment'}
                        </span>
                      </Link>
                    </div>

                    {!isOwnPost && (
                      <button
                        onClick={() => handleBookmark(post.post_id)}
                        disabled={bookmarkBusy === post.post_id}
                        className={`flex items-center gap-2 font-medium text-[16px] transition-colors disabled:opacity-50 ${
                          isPostBookmarked ? 'text-gisviz-accent' : 'text-gisviz-ink-soft hover:text-gisviz-ink'
                        }`}
                      >
                        {bookmarkBusy === post.post_id
                          ? <Loader2 size={20} className="animate-spin" />
                          : <Bookmark size={20} className={isPostBookmarked ? 'fill-current' : ''} />
                        }
                        <span className="hidden sm:inline">{isPostBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                      </button>
                    )}
                  </div>
                </article>
              </div>
            )
          })}

          {hasMore ? (
            <div className="flex justify-center mt-4 mb-8">
              <button 
                onClick={() => fetchPosts(offset)}
                disabled={isLoadingMore}
                className="flex items-center gap-2 bg-gisviz-canvas text-gisviz-ink-soft border border-gisviz-border hover:border-gisviz-accent hover:text-gisviz-accent px-6 py-3 rounded-full text-[12px] font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {isLoadingMore ? <><Loader2 size={16} className="animate-spin" /> Fetching...</> : 'Load More'}
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-[12px] font-mono text-gisviz-ink-soft uppercase tracking-widest mt-4 mx-8">
              — You are caught up —
            </div>
          )}
        </>
      )}

      {shareModalPost && (
        <ShareModal 
          isOpen={!!shareModalPost} 
          onClose={() => setShareModalPost(null)}
          url={`${typeof window !== 'undefined' ? window.location.origin : ''}/post/${shareModalPost.post_id}`}
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