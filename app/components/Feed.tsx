'use client'
import React, { useEffect, useState } from 'react'
import { Heart, Share2, Bookmark, Plus } from 'lucide-react'
import Link from 'next/link'
import MapComponent from './MapComponent'
import { gisvizApi } from '../../services/api'

interface SpatialGeometry { type: string; coordinates: [number, number]; }
interface Category { category_id: number; slug: string; label: string; usage_count: number; }
interface GeographicPublication {
  publication_id: string
  author_user_id: string
  author_handle: string
  author_avatar_url: string
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

export default function Feed() {
  const [posts, setPosts] = useState<GeographicPublication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [likeBusy, setLikeBusy] = useState<string | null>(null)

  useEffect(() => {
    gisvizApi
      .fetchGlobalStream()
      .then((data: GeographicPublication[]) => setPosts(data))
      .catch(() => setPosts([]))
      .finally(() => setIsLoading(false))
  }, [])

  const handleLike = async (publicationId: string) => {
    if (likeBusy) return
    setLikeBusy(publicationId)
    try {
      const res = await gisvizApi.toggleLike(publicationId)
      setPosts((prev) =>
        prev.map((p) =>
          p.publication_id === publicationId
            ? { ...p, total_likes_count: res.total_likes_count }
            : p
        )
      )
    } catch {
      // leave the count unchanged on failure
    } finally {
      setLikeBusy(null)
    }
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
        <p className="text-gisviz-ink-soft">No publications yet.</p>
        <button className="flex items-center gap-2 bg-gisviz-accent/10 text-gisviz-accent border border-gisviz-accent/20 hover:bg-gisviz-accent hover:text-white px-5 py-2 rounded-full text-sm font-bold transition-all">
          <Plus size={16} /> Add the first one
        </button>
      </div>
    )

  return (
    <div className="h-[calc(100vh-4rem)] md:h-auto overflow-y-scroll md:overflow-visible snap-y snap-mandatory md:snap-none scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-24 pt-4 md:pt-0">

      {/* ADD POST BUTTON */}
      <div className="flex justify-center mb-6 snap-start">
        <button className="flex items-center gap-2 bg-gisviz-accent/10 text-gisviz-accent border border-gisviz-accent/20 hover:bg-gisviz-accent hover:text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm">
          <Plus size={16} /> Add Post
        </button>
      </div>

      {posts.map((post) => (
        <div key={post.publication_id} className="snap-start snap-always md:snap-align-none w-full pb-8">
          <article className="bg-gisviz-card border border-gisviz-border rounded-xl p-5 shadow-sm transition-all hover:shadow-md overflow-hidden">

            {/* Title + date */}
            <div className="flex justify-between items-start mb-4 gap-4">
              <Link href={post.share_url || `/post/${post.publication_id}`} className="hover:opacity-70 transition-opacity">
                <h2 className="text-xl md:text-2xl font-display font-medium text-gisviz-ink uppercase tracking-wide leading-snug cursor-pointer">
                  {post.publication_title}
                </h2>
              </Link>
              <span className="text-xs font-mono font-medium text-gisviz-ink-soft whitespace-nowrap pt-1 bg-gisviz-canvas px-2 py-1 rounded-md border border-gisviz-border mt-1">
                {new Date(post.created_timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {/* CATEGORIES */}
            <div className="flex flex-wrap gap-2 mb-4">
              {post.categories.map((cat) => (
                <span
                  key={cat.category_id}
                  className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase bg-gisviz-rail-soft text-gisviz-ink rounded-full border border-gisviz-border/30"
                >
                  {cat.label}
                </span>
              ))}
            </div>

            {/* Map */}
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
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-wider opacity-75">Visual Credit:</span>
                <div className="flex items-center gap-1.5 bg-gisviz-canvas pr-2.5 pl-1 py-0.5 rounded-full border border-gisviz-border">
                  {post.author_avatar_url ? (
                    <img src={post.author_avatar_url} className="w-5 h-5 rounded-full object-cover" alt={post.author_handle} />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gisviz-rail-soft" />
                  )}
                  <span className="font-bold text-gisviz-ink text-[11px]">@{post.author_handle}</span>
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="border-t border-gisviz-border pt-4 grid grid-cols-3 divide-x divide-gisviz-border text-gisviz-ink-soft">
              <button className="flex items-center justify-center gap-2 hover:text-gisviz-accent transition-colors text-sm font-medium group">
                <Bookmark size={18} className="group-hover:fill-gisviz-accent/20" />
                <span>Save</span>
              </button>
              <button
                onClick={() => handleLike(post.publication_id)}
                disabled={likeBusy === post.publication_id}
                className="flex items-center justify-center gap-2 hover:text-gisviz-accent transition-colors text-sm font-medium group disabled:opacity-50"
              >
                <Heart size={18} className="group-hover:fill-gisviz-accent/20" />
                <span>{post.total_likes_count || 'Like'}</span>
              </button>
              <button className="flex items-center justify-center gap-2 hover:text-gisviz-ink transition-colors text-sm font-medium">
                <Share2 size={18} />
                <span>Share</span>
              </button>
            </div>

          </article>
        </div>
      ))}
    </div>
  )
}