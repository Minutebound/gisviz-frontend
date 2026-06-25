'use client'

import React, { useEffect, useState } from 'react'
import { 
  ThumbsUp, 
  Bookmark, 
  Plus, 
  Loader2, 
  ShieldCheck, 
  ExternalLink, 
  MessageSquare, 
  MoreHorizontal, 
  Flag, 
  Share2 
} from 'lucide-react'
import Link from 'next/link'
import MapComponent from './MapComponent'
import { gisvizApi } from '../../services/api'
import ShareModal from '../components/SharePost'
import ReportModal from '../components/ReportPost'

interface SpatialGeometry { type: string; coordinates: [number, number]; }
interface Category { category_id: number; slug: string; label: string; usage_count: number; }
interface GeographicPublication {
  publication_id: string
  publisher_user_id: string
  publisher_handle: string
  publisher_avatar_url: string
  publication_title: string
  categories: Category[]
  layer_attribute_metadata: Record<string, unknown>
  spatial_geometry: SpatialGeometry
  share_slug: string
  share_url: string
  total_likes_count: number
  total_comments_count: number
  created_timestamp: string
  updated_timestamp?: string
}

const POSTS_PER_PAGE = 10;

export default function Feed() {
  const [posts, setPosts] = useState<GeographicPublication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [likeBusy, setLikeBusy] = useState<string | null>(null)
  
  // Interactive UI Registry Arrays
  const [likedPosts, setLikedPosts] = useState<string[]>([])
  const [savedPosts, setSavedPosts] = useState<string[]>([])
  
  // Modal & Dropdown States
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [shareModalPost, setShareModalPost] = useState<GeographicPublication | null>(null)
  const [reportModalId, setReportModalId] = useState<string | null>(null)

  // Pagination State
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Hydrate local layout saves on mount
  useEffect(() => {
    const localSaves = JSON.parse(localStorage.getItem('gisviz_saved') || '[]')
    setSavedPosts(localSaves)
  }, [])

  // Close dropdown when clicking outside
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
      console.error("Failed to load spatial feed:", error)
      if (isInitial) setPosts([])
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  // Initial Load
  useEffect(() => {
    fetchPosts(0, true)
  }, [])

  const handleLike = async (publicationId: string) => {
    if (likeBusy) return
    setLikeBusy(publicationId)
    
    const wasAlreadyLiked = likedPosts.includes(publicationId)

    try {
      const res = await gisvizApi.toggleLike(publicationId)
      
      // Update targeted metadata metrics
      setPosts((prev) =>
        prev.map((p) =>
          p.publication_id === publicationId
            ? { ...p, total_likes_count: res.total_likes_count }
            : p
        )
      )

      // Toggle tracking registration
      setLikedPosts((prev) =>
        wasAlreadyLiked
          ? prev.filter((id) => id !== publicationId)
          : [...prev, publicationId]
      )
    } catch (error) {
      console.error("Like interaction pipeline failure:", error)
    } finally {
      setLikeBusy(null)
    }
  }

  const handleSave = (publicationId: string) => {
    const isCurrentlySaved = savedPosts.includes(publicationId)
    let updatedSaves: string[]

    if (isCurrentlySaved) {
      updatedSaves = savedPosts.filter((id) => id !== publicationId)
    } else {
      updatedSaves = [...savedPosts, publicationId]
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
        <p className="text-gisviz-ink-soft">No spatial publications found in database.</p>
        <button className="flex items-center gap-2 bg-gisviz-accent/10 text-gisviz-accent border border-gisviz-accent/20 hover:bg-gisviz-accent hover:text-white px-5 py-2 rounded-full text-sm font-bold transition-all">
          <Plus size={16} /> Render the first layer
        </button>
      </div>
    )

  return (
    <div className="h-[calc(100vh-4rem)] md:h-auto overflow-y-scroll md:overflow-visible snap-y snap-mandatory md:snap-none scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-24 pt-4 md:pt-0 relative">

      {/* ADD POST BUTTON */}
      <div className="flex justify-center mb-6 snap-start">
        <button className="flex items-center gap-2 bg-gisviz-accent/10 text-gisviz-accent border border-gisviz-accent/20 hover:bg-gisviz-accent hover:text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm">
          <Plus size={16} /> Publish a Visual
        </button>
      </div>

      {posts.map((post, index) => {
        const isPostLiked = likedPosts.includes(post.publication_id)
        const isPostSaved = savedPosts.includes(post.publication_id)

        return (
          <React.Fragment key={post.publication_id}>
            
            {/* INJECTED NATIVE ADVERTISEMENT */}
            {index === 1 && (
              <div className="snap-start snap-always md:snap-align-none w-full pb-8">
                <article className="relative bg-gisviz-rail border border-gisviz-border rounded-none p-[18px] overflow-hidden flex flex-col group cursor-pointer min-h-[200px] justify-center">
                  <i className="absolute w-[11px] h-[11px] border-[1.5px] border-gisviz-accent/50 z-10 top-0 left-0 border-r-0 border-b-0" />
                  <i className="absolute w-[11px] h-[11px] border-[1.5px] border-gisviz-accent/50 z-10 bottom-0 right-0 border-l-0 border-t-0" />
                  
                  <div className="flex justify-between items-start mb-4 z-10">
                    <span className="font-mono text-[10px] tracking-[0.22em] text-gisviz-ink-soft uppercase border border-gisviz-border px-[7px] py-[3px]">
                      PROMOTED VECTOR
                    </span>
                    <ShieldCheck className="w-5 h-5 text-gisviz-accent" />
                  </div>
                  <div className="relative z-10 max-w-lg">
                    <h4 className="font-display font-semibold text-[21px] text-white mb-2 leading-[1.2] tracking-[-0.015em] group-hover:text-gisviz-accent transition-colors">
                      Enterprise Spatial Analytics Engine
                    </h4>
                    <p className="text-[13px] text-slate-400 mb-4 leading-relaxed font-sans">
                      Process millions of geographic coordinates in milliseconds. Upgrade your vector pipeline with cloud-native PostGIS architecture.
                    </p>
                    <button className="flex items-center gap-[6px] font-mono text-[11.5px] border border-gisviz-accent bg-transparent text-gisviz-accent px-[11px] py-[7px] rounded-md hover:bg-gisviz-accent hover:text-white transition-colors">
                      <span>Explore infrastructure</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                  <div className="absolute top-0 right-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&fit=crop')] bg-cover bg-center opacity-[0.08] mix-blend-overlay pointer-events-none"></div>
                </article>
              </div>
            )}

            <div className="snap-start snap-always md:snap-align-none w-full pb-8">
              <article className="bg-gisviz-card border border-gisviz-border rounded-xl p-5 shadow-sm transition-all hover:shadow-md overflow-hidden relative">

                {/* Title + Date + Options Menu */}
                <div className="flex justify-between items-start mb-4 gap-4">
                  <Link href={`/post/${post.publication_id}`} className="hover:opacity-70 transition-opacity flex-1">
                    <h2 className="text-xl md:text-2xl font-display font-medium text-gisviz-ink uppercase tracking-wide leading-snug cursor-pointer">
                      {post.publication_title}
                    </h2>
                  </Link>
                  <div className="flex items-center gap-2 pt-1 relative">
                    <span className="text-xs font-mono font-medium text-gisviz-ink-soft whitespace-nowrap bg-gisviz-canvas px-2 py-1 rounded-md border border-gisviz-border">
                      {new Date(post.created_timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    
                    {/* 3-Dot Dropdown Button */}
                    <button 
                      onClick={(e) => toggleDropdown(e, post.publication_id)}
                      className="p-1 text-gisviz-ink-soft hover:text-gisviz-accent hover:bg-gisviz-rail-soft rounded-full transition-colors"
                    >
                      <MoreHorizontal size={20} />
                    </button>

                    {/* Dropdown Menu */}
                    {openDropdownId === post.publication_id && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-gisviz-card border border-gisviz-border rounded-xl shadow-lg z-20 plate-enter overflow-hidden py-1" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            setShareModalPost(post)
                            setOpenDropdownId(null)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent transition-colors"
                        >
                          <Share2 size={16} /> Share Map
                        </button>
                        <div className="border-t border-gisviz-border my-1"></div>
                        <button 
                          onClick={() => {
                            setReportModalId(post.publication_id)
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

                {/* CATEGORIES */}
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

                {/* Map Grid Surface */}
                <div className="w-[calc(100%+2.5rem)] -mx-5 h-[400px] bg-gisviz-paper border-y border-gisviz-border overflow-hidden mb-4 rounded-none">
                  <MapComponent
                    longitude={post.spatial_geometry.coordinates[0]}
                    latitude={post.spatial_geometry.coordinates[1]}
                    interactive={false}
                  />
                </div>

                {/* Source & credit */}
                <div className="flex items-center justify-between text-xs text-gisviz-ink-soft font-mono mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="uppercase tracking-wider opacity-75">Data Source:</span>
                    <span className="font-bold text-gisviz-ink">PostGIS • EPSG:4326</span>
                  </div>
                  
                  {/* Clickable Visual Credit Section */}
                  <div className="flex items-center gap-2">
                    <span className="uppercase tracking-wider opacity-75">Visual Credit:</span>
                    <Link 
                      href={`/profile/${post.publisher_handle}`} 
                      className="flex items-center gap-1.5 bg-gisviz-canvas pr-2.5 pl-1 py-0.5 rounded-full border border-gisviz-border hover:border-gisviz-accent transition-colors group/author"
                    >
                      {post.publisher_avatar_url ? (
                        <img src={post.publisher_avatar_url} className="w-5 h-5 rounded-full object-cover" alt={post.publisher_handle} />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-gisviz-accent to-emerald-400" />
                      )}
                      <span className="font-bold text-gisviz-ink text-[11px] group-hover/author:text-gisviz-accent transition-colors">
                        @{post.publisher_handle}
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="border-t border-gisviz-border pt-4 grid grid-cols-3 divide-x divide-gisviz-border text-gisviz-ink-soft">
                  <button 
                    onClick={() => handleSave(post.publication_id)}
                    className={`flex items-center justify-center gap-2 hover:text-gisviz-accent transition-colors text-sm font-medium group ${isPostSaved ? 'text-gisviz-accent' : ''}`}
                  >
                    <Bookmark size={18} className={isPostSaved ? 'fill-current' : 'group-hover:fill-gisviz-accent/20'} />
                    <span>{isPostSaved ? 'Saved' : 'Save'}</span>
                  </button>
                  
                  <button
                    onClick={() => handleLike(post.publication_id)}
                    disabled={likeBusy === post.publication_id}
                    className={`flex items-center justify-center gap-2 hover:text-gisviz-accent transition-colors text-sm font-medium group disabled:opacity-50 ${isPostLiked ? 'text-gisviz-accent' : ''}`}
                  >
                    <ThumbsUp size={18} className={isPostLiked ? 'fill-current' : 'group-hover:fill-gisviz-accent/20'} />
                    <span>{post.total_likes_count || 'Like'}</span>
                  </button>
                  
                  {/* Updated Comment Button */}
                  <Link href={`/post/${post.publication_id}`} className="flex items-center justify-center gap-2 hover:text-gisviz-ink transition-colors text-sm font-medium group">
                    <MessageSquare size={18} className="group-hover:text-gisviz-ink" />
                    <span>{post.total_comments_count || 0} Comments</span>
                  </Link>
                </div>

              </article>
            </div>
          </React.Fragment>
        )
      })}

      {/* PAGINATION CONTROLS */}
      {hasMore ? (
        <div className="flex justify-center mt-4 mb-8 snap-start">
          <button 
            onClick={() => fetchPosts(offset)}
            disabled={isLoadingMore}
            className="flex items-center gap-2 bg-gisviz-canvas text-gisviz-ink-soft border border-gisviz-border hover:border-gisviz-accent hover:text-gisviz-accent px-6 py-3 rounded-full text-sm font-bold transition-all shadow-sm disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Fetching Spatial Data...
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

      {/* Modals rendered at the top level of the component */}
      {shareModalPost && (
        <ShareModal 
          isOpen={!!shareModalPost} 
          onClose={() => setShareModalPost(null)}
          url={shareModalPost.share_url || `${typeof window !== 'undefined' ? window.location.origin : ''}/post/${shareModalPost.publication_id}`}
          title={shareModalPost.publication_title}
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