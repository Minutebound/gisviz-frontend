'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Navbar from '../../components/Navbar'
import MapComponent from '../../components/MapComponent'
import { Heart, Share2, Bookmark } from 'lucide-react'
import { gisvizApi } from '../../../services/api'

interface Category { category_id: number; slug: string; label: string; usage_count: number; }
interface Publication {
  publication_id: string
  author_handle: string
  author_avatar_url: string
  publication_title: string
  categories: Category[]
  layer_attribute_metadata: { projection?: string; [k: string]: unknown }
  spatial_geometry: { type: string; coordinates: [number, number] }
  total_likes_count: number
  total_comments_count: number
  created_timestamp: string
}

export default function PostDetail() {
  const params = useParams()
  const [post, setPost] = useState<Publication | null>(null)

  useEffect(() => {
    // Until a fetch-by-slug endpoint exists, resolve from the stream.
    gisvizApi
      .fetchGlobalStream()
      .then((data: Publication[]) =>
        setPost(data.find((p) => p.publication_id === params.id) || data[0] || null)
      )
      .catch(() => setPost(null))
  }, [params.id])

  if (!post) return <div className="h-screen bg-gisviz-canvas/50"></div>

  const projection =
    typeof post.layer_attribute_metadata?.projection === 'string'
      ? post.layer_attribute_metadata.projection.split(':')[1]
      : '4326'

  return (
    <div className="min-h-screen bg-gisviz-canvas/50 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Big visual */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-gisviz-card border border-gisviz-border rounded-2xl p-2 shadow-sm">
              <div className="w-full h-[70vh] rounded-xl overflow-hidden">
                <MapComponent
                  longitude={post.spatial_geometry.coordinates[0]}
                  latitude={post.spatial_geometry.coordinates[1]}
                />
              </div>
            </div>

            {/* Action bar */}
            <div className="flex gap-4">
              <button className="flex-1 bg-gisviz-card border border-gisviz-border py-3 rounded-xl flex items-center justify-center gap-2 hover:text-gisviz-accent transition-colors font-bold text-gisviz-ink">
                <Heart size={20} /> {post.total_likes_count}
              </button>
              <button className="flex-1 bg-gisviz-card border border-gisviz-border py-3 rounded-xl flex items-center justify-center gap-2 hover:text-gisviz-accent transition-colors font-bold text-gisviz-ink">
                <Bookmark size={20} /> Save Data
              </button>
              <button className="flex-1 bg-gisviz-card border border-gisviz-border py-3 rounded-xl flex items-center justify-center gap-2 hover:text-gisviz-accent transition-colors font-bold text-gisviz-ink">
                <Share2 size={20} /> Share
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-gisviz-card border border-gisviz-border rounded-2xl p-6 shadow-sm">
              <h1 className="text-3xl font-display font-bold text-gisviz-ink mb-6 leading-tight">
                {post.publication_title}
              </h1>

              {/* Author */}
              <div className="flex items-center gap-4 pb-6 border-b border-gisviz-border">
                {post.author_avatar_url ? (
                  <img src={post.author_avatar_url} className="w-12 h-12 rounded-full border-2 border-gisviz-border" alt={post.author_handle} />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-gisviz-border bg-gisviz-rail-soft" />
                )}
                <div>
                  <p className="font-bold text-gisviz-ink text-lg">@{post.author_handle}</p>
                  <p className="text-sm text-gisviz-ink-soft">Published {new Date(post.created_timestamp).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Tags + metadata */}
              <div className="pt-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gisviz-ink-soft font-bold mb-2">Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {post.categories.map((cat) => (
                      <span key={cat.category_id} className="px-3 py-1 text-xs font-bold tracking-wider uppercase bg-gisviz-rail-soft text-gisviz-accent rounded-md border border-gisviz-border/50">
                        {cat.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-gisviz-ink-soft font-bold mb-2">Spatial Context</p>
                  <div className="bg-gisviz-canvas rounded-xl p-3 border border-gisviz-border font-mono text-xs text-gisviz-ink space-y-1">
                    <p>EPSG: {projection}</p>
                    <p>Lat: {post.spatial_geometry.coordinates[1].toFixed(6)}</p>
                    <p>Lon: {post.spatial_geometry.coordinates[0].toFixed(6)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}