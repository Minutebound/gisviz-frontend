'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import Navbar from '../../components/Navbar'
import MapComponent from '../../components/MapComponent'
import { MapPin, Layers, CalendarDays, UserPlus, MessageCircle, Grid3x3, ThumbsUp } from 'lucide-react'

interface SpatialGeometry { type: string; coordinates: [number, number]; }

// Matches the new enterprise backend schema
interface GeographicPublication {
  id: string; 
  author_user_id: string; 
  author_handle: string;
  author_avatar_url: string; 
  title: string; 
  tags: string[];
  layer_metadata: any; 
  geometry: SpatialGeometry;
  likes_count: number; 
  comments_count: number; 
  saves_count: number;
  created_at: string;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

export default function ProfilePage() {
  const params = useParams()
  const handle = decodeURIComponent(String(params.handle ?? ''))

  const [allPosts, setAllPosts] = useState<GeographicPublication[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    axios.get('http://localhost:8001/api/v1/publications')
      .then(res => setAllPosts(res.data))
      .catch(err => console.error("Error fetching profile feed:", err))
      .finally(() => setIsLoading(false))
  }, [])

  // Posts authored by this handle (derived from the stream).
  const posts = allPosts.filter(p => p.author_handle === handle)
  const profile = posts[0] // author info comes from any of their posts

  if (isLoading) return (
    <div className="min-h-screen font-sans bg-gisviz-canvas">
      <Navbar />
      <div className="flex flex-col justify-center items-center h-[70vh] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-[2px] border-gisviz-border border-t-gisviz-accent"></div>
        <p className="font-mono text-[11px] tracking-[0.22em] text-gisviz-ink-soft uppercase">Loading surveyor…</p>
      </div>
    </div>
  )

  // Aggregate stats using the new metric columns
  const totalLikes = posts.reduce((s, p) => s + (p.likes_count || 0), 0)
  const totalComments = posts.reduce((s, p) => s + (p.comments_count || 0), 0)

  // The Fallback Avatar URL
  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`

  return (
    <div className="min-h-screen font-sans bg-gisviz-canvas">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* PROFILE HEADER */}
        <div className="bg-gisviz-card border border-gisviz-border rounded-none mb-[30px] relative">
          <div className="relative h-72 sm:h-80 w-full overflow-hidden">
            {/* Banner Image */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&h=400&fit=crop')" }}
            />
            {/* Dark wash for contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A1622]/80 via-[#0A1622]/20 to-transparent" />
            
            {/* Subtle graticule overlay on banner */}
            <svg className="absolute inset-0 w-full h-full opacity-30 mix-blend-overlay" preserveAspectRatio="none">
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* ARC PANEL — Retained the arc layout but restyled for Atlas theme */}
          <div className="absolute bottom-0 left-0 w-full md:w-[90%] lg:w-[85%] bg-gisviz-card/95 rounded-tr-[80px] border-t border-r border-gisviz-border backdrop-blur-md">
            
            <div className="relative pt-[28px] pb-[20px] pr-[24px] sm:pr-[64px] pl-[24px]">
              <div className="flex items-end gap-[18px]">
                <img
                  src={profile?.author_avatar_url || defaultAvatar}
                  alt={handle}
                  className="w-[80px] h-[80px] sm:w-[96px] sm:h-[96px] rounded-none border-[3px] border-gisviz-card object-cover bg-gisviz-paper shrink-0"
                />
                
                <div className="flex-1 min-w-0 pb-[2px]">
                  <h1 className="font-display font-semibold text-[24px] sm:text-[28px] text-gisviz-ink tracking-[-0.015em] leading-[1.1] truncate m-0">
                    @{handle}
                  </h1>
                  <p className="font-mono text-[11px] text-gisviz-ink-soft tracking-[0.06em] uppercase mt-1">Cartographic Surveyor</p>

                  {/* Stat Strip */}
                  <div className="flex flex-wrap gap-x-[18px] gap-y-[8px] mt-[12px] font-mono text-[11px]">
                    <span className="flex items-center gap-[6px] text-gisviz-ink">
                      <Grid3x3 size={13} className="text-gisviz-accent" />
                      <span className="font-semibold">{posts.length}</span>
                      <span className="text-gisviz-ink-soft">PLATES</span>
                    </span>
                    <span className="flex items-center gap-[6px] text-gisviz-ink">
                      <ThumbsUp size={13} className="text-gisviz-survey" />
                      <span className="font-semibold">{totalLikes.toLocaleString()}</span>
                      <span className="text-gisviz-ink-soft">LIKES</span>
                    </span>
                    <span className="flex items-center gap-[6px] text-gisviz-ink">
                      <MessageCircle size={13} className="text-gisviz-ink-soft" />
                      <span className="font-semibold">{totalComments.toLocaleString()}</span>
                      <span className="text-gisviz-ink-soft">COMMENTS</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Atlas Theme Follow Button */}
              <button className="mt-[18px] flex items-center gap-[6px] font-display font-semibold text-[13px] tracking-[0.01em] border border-gisviz-border bg-transparent text-gisviz-ink px-[14px] py-[7px] rounded-md hover:border-gisviz-accent hover:text-gisviz-accent transition-all active:translate-y-[1px]">
                <UserPlus size={15} /> Follow
              </button>
            </div>
          </div>
        </div>

        {/* PUBLICATIONS (Plates Grid) */}
        <div className="mt-[40px]">
          <div className="flex items-center gap-[9px] mb-[20px] pb-[8px] border-b border-dashed border-gisviz-border">
            <Layers size={15} className="text-gisviz-accent" />
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-gisviz-ink-soft">
              Published Plates · {posts.length}
            </h2>
          </div>

          {posts.length === 0 ? (
            <div className="border border-dashed border-gisviz-border py-[48px] px-[20px] text-center bg-gisviz-surface">
              <p className="font-mono text-[13px] text-gisviz-ink-soft">No plates found for @{handle}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[24px]">
              {posts.map((post, index) => {
                const lon = post.geometry?.coordinates?.[0] || 0
                const lat = post.geometry?.coordinates?.[1] || 0
                return (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="bg-gisviz-card border border-gisviz-border rounded-none hover:border-gisviz-accent transition-colors group flex flex-col"
                  >
                    {/* Map Frame with Crop Marks */}
                    <div className="relative w-full aspect-[24/10] bg-[#0b1b2b] border-b border-gisviz-border overflow-hidden">
                      <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent z-10 top-0 left-0 border-r-0 border-b-0" />
                      <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent z-10 top-0 right-0 border-l-0 border-b-0" />
                      <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent z-10 bottom-0 left-0 border-r-0 border-t-0" />
                      <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent z-10 bottom-0 right-0 border-l-0 border-t-0" />
                      
                      <MapComponent longitude={lon} latitude={lat} interactive={false} />
                    </div>

                    {/* Plate Details */}
                    <div className="p-[14px] flex flex-col flex-1">
                      <div className="font-mono text-[10px] tracking-[0.22em] text-gisviz-accent mb-[6px] uppercase">
                        PLATE {String(index + 1).padStart(2, "0")}
                      </div>
                      <h3 className="font-display font-semibold text-[17px] text-gisviz-ink leading-[1.2] tracking-[-0.015em] group-hover:text-gisviz-accent transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      
                      {/* Mini Data Strip */}
                      <div className="mt-auto pt-[14px] flex items-center justify-between font-mono text-[10.5px] text-gisviz-ink-soft">
                        <div className="flex gap-[12px]">
                          <span className="flex items-center gap-[4px]">
                            <ThumbsUp size={12} className="text-gisviz-survey" /> 
                            {post.likes_count || 0}
                          </span>
                          <span className="flex items-center gap-[4px]">
                            <MessageCircle size={12} /> 
                            {post.comments_count || 0}
                          </span>
                        </div>
                        <span className="flex items-center gap-[4px]">
                          <CalendarDays size={12} /> 
                          {fmtDate(post.created_at)}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}