'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import Navbar from '../../components/Navbar'
import MapComponent from '../../components/MapComponent'
import { ThumbsUp, Share2, Bookmark, MapPin, Layers, CalendarDays, MessageCircle } from 'lucide-react'

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

export default function PostDetail() {
  const params = useParams()
  const [post, setPost] = useState<GeographicPublication | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    axios.get('http://localhost:8001/api/v1/publications')
      .then(res => {
        const foundPost = res.data.find((p: GeographicPublication) => p.id === params.id) || res.data[0];
        setPost(foundPost);
      })
      .catch(err => console.error("Error fetching publication:", err))
      .finally(() => setIsLoading(false))
  }, [params.id])

  if (isLoading || !post) return (
    <div className="min-h-screen bg-gisviz-canvas">
      <Navbar />
      <div className="flex flex-col justify-center items-center h-[70vh] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-[2px] border-gisviz-border border-t-gisviz-accent"></div>
        <p className="font-mono text-[11px] tracking-[0.22em] text-gisviz-ink-soft uppercase">Loading plate…</p>
      </div>
    </div>
  )

  const lon = post.geometry?.coordinates?.[0] || 0
  const lat = post.geometry?.coordinates?.[1] || 0

  const projectionString = post.layer_metadata?.projection || 'EPSG:4326'
  const epsgCode = projectionString.split(':')[1] || '4326'

  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_handle}`

  return (
    <div className="min-h-screen font-sans bg-gisviz-canvas">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px]">

          {/* THE BIG VISUAL: Spans 8 Columns */}
          <div className="lg:col-span-8 flex flex-col gap-[12px]">
            {/* The Main Plate */}
            <div className="bg-gisviz-card border border-gisviz-border rounded-none p-[8px]">
              <div className="relative w-full h-[65vh] border border-gisviz-border overflow-hidden bg-[#0b1b2b]">
                
                {/* Crop marks */}
                <i className="absolute w-[11px] h-[11px] border-[1.5px] border-gisviz-accent z-10 -top-[1px] -left-[1px] border-r-0 border-b-0" />
                <i className="absolute w-[11px] h-[11px] border-[1.5px] border-gisviz-accent z-10 -top-[1px] -right-[1px] border-l-0 border-b-0" />
                <i className="absolute w-[11px] h-[11px] border-[1.5px] border-gisviz-accent z-10 -bottom-[1px] -left-[1px] border-r-0 border-t-0" />
                <i className="absolute w-[11px] h-[11px] border-[1.5px] border-gisviz-accent z-10 -bottom-[1px] -right-[1px] border-l-0 border-t-0" />

                <MapComponent longitude={lon} latitude={lat} />

                {/* Tactical coordinate chip — bottom-left */}
                <div className="absolute bottom-[12px] left-[12px] z-20 flex items-center gap-[6px] bg-[rgba(11,27,43,0.75)] border border-[rgba(255,255,255,0.15)] px-[8px] py-[4px] backdrop-blur-sm">
                  <MapPin size={11} className="text-gisviz-survey" strokeWidth={2.5} />
                  <span className="font-mono text-[10px] text-white tracking-[0.04em] uppercase">
                    {lat.toFixed(4)}°, {lon.toFixed(4)}°
                  </span>
                </div>

                {/* Tactical EPSG chip — bottom-right */}
                <div className="absolute bottom-[12px] right-[12px] z-20 flex items-center gap-[6px] bg-[rgba(11,27,43,0.75)] border border-[rgba(255,255,255,0.15)] px-[8px] py-[4px] backdrop-blur-sm">
                  <Layers size={11} className="text-gisviz-accent" strokeWidth={2.5} />
                  <span className="font-mono text-[10px] text-white tracking-[0.04em] uppercase">
                    EPSG:{epsgCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar (Tactical grid) */}
            <div className="grid grid-cols-3 gap-[10px]">
              <button className="bg-gisviz-card border border-gisviz-border py-[11px] rounded-md flex items-center justify-center gap-[8px] font-display font-semibold text-[13px] tracking-[0.01em] text-gisviz-ink hover:text-gisviz-survey hover:border-gisviz-survey transition-all active:translate-y-[1px]">
                <ThumbsUp size={16} /> <span className="tabular-nums">{post.likes_count || 0} Likes</span>
              </button>
              <button className="bg-gisviz-card border border-gisviz-border py-[11px] rounded-md flex items-center justify-center gap-[8px] font-display font-semibold text-[13px] tracking-[0.01em] text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent transition-all active:translate-y-[1px]">
                <Bookmark size={16} /> <span className="tabular-nums">{post.saves_count || 'Save Data'}</span>
              </button>
              <button className="bg-gisviz-card border border-gisviz-border py-[11px] rounded-md flex items-center justify-center gap-[8px] font-display font-semibold text-[13px] tracking-[0.01em] text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent transition-all active:translate-y-[1px]">
                <Share2 size={16} /> Share
              </button>
            </div>
          </div>

          {/* DETAILS & METADATA: Spans 4 Columns */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="bg-gisviz-card border border-gisviz-border rounded-none flex flex-col h-full">
              
              {/* Header Strip */}
              <div className="px-[20px] py-[14px] border-b border-gisviz-border bg-gisviz-surface">
                <span className="font-mono text-[10px] tracking-[0.22em] text-gisviz-accent uppercase">
                  Telemetry & Metadata
                </span>
              </div>

              <div className="p-[20px] flex flex-col gap-[24px]">
                {/* Title & Date */}
                <div>
                  <h1 className="font-display font-semibold text-[24px] text-gisviz-ink leading-[1.2] tracking-[-0.015em] mb-[8px]">
                    {post.title}
                  </h1>
                  <div className="flex items-center gap-[6px] font-mono text-[11px] text-gisviz-ink-soft">
                    <CalendarDays size={13} />
                    <span>RECORDED ON {fmtDate(post.created_at)}</span>
                  </div>
                </div>

                {/* Author Profile Plate */}
                <Link href={`/profile/${post.author_handle}`} className="flex items-center gap-[12px] py-[16px] border-y border-dashed border-gisviz-border group cursor-pointer">
                  <img 
                    src={post.author_avatar_url || defaultAvatar} 
                    className="w-[42px] h-[42px] rounded-full border border-gisviz-border group-hover:border-gisviz-accent transition-colors object-cover bg-gisviz-paper" 
                    alt={post.author_handle} 
                  />
                  <div className="flex flex-col">
                    <p className="font-semibold text-[15px] text-gisviz-ink group-hover:text-gisviz-accent transition-colors leading-tight">
                      @{post.author_handle}
                    </p>
                    <p className="font-mono text-[10.5px] text-gisviz-ink-soft mt-[3px] uppercase">
                      Surveyor
                    </p>
                  </div>
                </Link>

                {/* Tags & Metadata */}
                <div className="flex flex-col gap-[24px]">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gisviz-ink-soft mb-[10px]">
                      Taxonomic Labels
                    </p>
                    <div className="flex flex-wrap gap-[6px]">
                      {post.tags?.map((label: string, idx: number) => (
                        <b key={idx} className="font-medium text-[10px] tracking-[0.06em] uppercase border border-gisviz-border text-gisviz-accent px-[7px] py-[3px] bg-transparent">
                          {label}
                        </b>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gisviz-ink-soft mb-[10px]">
                      Spatial Context
                    </p>
                    <div className="flex flex-col border border-gisviz-border rounded-none bg-gisviz-surface">
                      <div className="flex items-center justify-between p-[12px] border-b border-dashed border-gisviz-border font-mono text-[11px]">
                        <span className="flex items-center gap-[8px] text-gisviz-ink-soft">
                          <Layers size={13} className="text-gisviz-accent" strokeWidth={2.5} /> CRS
                        </span>
                        <span className="font-semibold text-gisviz-ink">{epsgCode}</span>
                      </div>
                      <div className="flex items-center justify-between p-[12px] border-b border-dashed border-gisviz-border font-mono text-[11px]">
                        <span className="flex items-center gap-[8px] text-gisviz-ink-soft">
                          <MapPin size={13} className="text-gisviz-survey" strokeWidth={2.5} /> LAT
                        </span>
                        <span className="font-semibold text-gisviz-ink">{lat.toFixed(6)}°</span>
                      </div>
                      <div className="flex items-center justify-between p-[12px] font-mono text-[11px]">
                        <span className="flex items-center gap-[8px] text-gisviz-ink-soft">
                          <MapPin size={13} className="text-gisviz-survey" strokeWidth={2.5} /> LON
                        </span>
                        <span className="font-semibold text-gisviz-ink">{lon.toFixed(6)}°</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Summary */}
                  <div className="flex items-center gap-[16px] pt-[8px] font-mono text-[11px] text-gisviz-ink-soft">
                    <span className="flex items-center gap-[6px]">
                      <MessageCircle size={13} /> {post.comments_count || 0} DISCUSSIONS
                    </span>
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