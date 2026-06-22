'use client'
import React, { useEffect, useState } from 'react'
import { ThumbsUp, Share2, Bookmark, Plus, ShieldCheck, ExternalLink, MapPin, Layers, MoreHorizontal, Flag, X, Link as LinkIcon, MessageCircle, Globe, Mail, Check } from 'lucide-react'
import Link from 'next/link'
import axios from 'axios'
import MapComponent from './MapComponent'

interface SpatialGeometry { type: string; coordinates: [number, number]; }

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

/* ---- formatting helpers ---- */
const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
const fmtLon = (lon: number) => `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

export default function Feed() {
  const [posts, setPosts] = useState<GeographicPublication[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [sharePost, setSharePost] = useState<GeographicPublication | null>(null)
  const [reportPost, setReportPost] = useState<GeographicPublication | null>(null)

  useEffect(() => {
    axios.get('http://localhost:8001/api/v1/publications')
      .then(res => setPosts(res.data))
      .catch(err => console.error("Error fetching feed:", err))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!openMenuId) return
    const close = () => setOpenMenuId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openMenuId])

  if (isLoading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gisviz-border border-t-gisviz-accent"></div>
      <p className="text-xs font-mono uppercase tracking-widest text-gisviz-ink-soft">Loading plates…</p>
    </div>
  )

  return (
    <div className="max-w-[1200px] h-[calc(100vh-4rem)] md:h-auto overflow-y-scroll md:overflow-visible snap-y snap-mandatory md:snap-none scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-24 pt-6 md:pt-0">

      {/* ADD POST BUTTON */}
      <div className="flex justify-center mb-8 snap-start mt-2 md:mt-0">
        <button className="flex items-center gap-2 bg-gisviz-accent text-white border-0 hover:brightness-110 px-[14px] py-[9px] rounded-md font-display font-semibold text-[13px] tracking-[0.01em] transition-all active:translate-y-[1px]">
          <Plus size={15} strokeWidth={2.5} /> New plate
        </button>
      </div>

      <div className="flex flex-col gap-[30px]">
        {posts.map((post, index) => {
          const lon = post.geometry?.coordinates?.[0] || 0
          const lat = post.geometry?.coordinates?.[1] || 0
          
          return (
          <React.Fragment key={post.id}>

            <div className="snap-start snap-always md:snap-align-none w-full">
              {/* THE PLATE CONTAINER */}
              <article className="bg-gisviz-card border border-gisviz-border rounded-none">

                {/* PLATE HEADER */}
                <header className="px-[18px] pt-[16px] pb-[10px]">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 sm:gap-4">
                    
                    {/* Title & Keywords Group */}
                    <div className="flex flex-col min-w-0">
                      <Link href={`/post/${post.id}`} className="min-w-0 group/title">
                        <h2 className="font-display font-semibold text-[18px] sm:text-[21px] text-gisviz-ink leading-[1.2] tracking-[-0.015em] m-0 group-hover/title:text-gisviz-accent transition-colors">
                          {post.title}
                        </h2>
                      </Link>
                      
                      {/* Keywords relocated below the title, using the old plate number style */}
                      {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-[8px] mt-[10px]">
                        {post.tags.map((t, idx) => (
                          <span 
                            key={idx} 
                            className="font-mono text-[10px] tracking-[0.08em] text-gisviz-accent uppercase border border-gisviz-border bg-gisviz-surface px-[7px] py-[3px] rounded-md"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    </div>

                    {/* Date & Action Menu Group */}
                    <div className="flex items-center gap-2 shrink-0 sm:pt-[4px]">
                      <time className="font-mono text-[10.5px] text-gisviz-ink-soft whitespace-nowrap">
                        {fmtDate(post.created_at)}
                      </time>

                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === post.id ? null : post.id)
                          }}
                          className="flex items-center justify-center w-7 h-7 rounded-md border border-transparent text-gisviz-ink-soft hover:text-gisviz-accent hover:border-gisviz-border transition-colors"
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {openMenuId === post.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-8 right-0 z-50 w-44 bg-gisviz-card border border-gisviz-border rounded-md shadow-lg py-1.5 flex flex-col"
                          >
                            <button
                              onClick={() => { setSharePost(post); setOpenMenuId(null) }}
                              className="flex items-center gap-3 px-4 py-2 text-[13px] text-gisviz-ink hover:bg-gisviz-paper hover:text-gisviz-accent transition-colors"
                            >
                              <Share2 size={14} /> Share
                            </button>
                            <button
                              onClick={() => { setReportPost(post); setOpenMenuId(null) }}
                              className="flex items-center gap-3 px-4 py-2 text-[13px] text-gisviz-ink hover:bg-gisviz-paper hover:text-gisviz-survey transition-colors"
                            >
                              <Flag size={14} /> Report
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </header>

                {/* THE MAP FRAME (With Corner Crop Marks) */}
                <div className="relative mx-[0px] my-[6px] border border-gisviz-border">
                  <div className="relative w-full h-[400px] sm:aspect-[24/10] sm:h-auto overflow-hidden bg-[#0b1b2b]">
                    <MapComponent longitude={lon} latitude={lat} interactive={false} />
                  </div>
                </div>

                {/* DATA STRIP (Flex Row: Telemetry on left, Data Source/Note on right) */}
                <div className="flex flex-col sm:flex-row justify-between gap-[12px] px-[18px] py-[12px] font-mono text-[11px]">
                  
          
                  {/* Data Source & Note */}
                  <div className="flex flex-wrap items-center sm:justify-end gap-x-[18px] gap-y-2 text-gisviz-ink-soft">
                    <span className="flex items-center gap-1.5">
                      <span className="opacity-75">Data Source:</span>
                      <a
                        href="https://postgis.net"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gisviz-ink hover:text-gisviz-accent underline decoration-dotted underline-offset-2 transition-colors"
                      >
                        PostGIS
                      </a>
                    </span>
                    <span className="opacity-80 sm:inline-block">
                      Note: Sourced from DB
                    </span>
                  </div>

                </div>

                {/* FOOTER */}
                <footer className="flex justify-between items-center gap-[12px] px-[18px] py-[11px] border-t border-gisviz-border">
                  <Link
                    href={`/profile/${post.author_handle}`}
                    className="flex items-center gap-[9px] text-[13px] font-semibold text-gisviz-ink hover:text-gisviz-accent transition-colors"
                  >
                    <img
                      src={post.author_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_handle}`}
                      className="w-[28px] h-[28px] rounded-full object-cover border border-gisviz-border bg-gisviz-paper"
                      alt={post.author_handle}
                    />
                    <span>@{post.author_handle}</span>
                  </Link>

                  <div className="flex gap-[6px]">
                    <button className="flex items-center gap-[6px] font-mono text-[11.5px] border border-gisviz-border bg-transparent text-gisviz-ink-soft px-[11px] py-[7px] rounded-md cursor-pointer transition-colors hover:border-gisviz-accent hover:text-gisviz-accent group">
                      <ThumbsUp size={15} className="group-hover:fill-gisviz-accent/20 transition-all" />
                      {post.likes_count || 'Like'}
                    </button>
                    <button className="flex items-center gap-[6px] font-mono text-[11.5px] border border-gisviz-border bg-transparent text-gisviz-ink-soft px-[11px] py-[7px] rounded-md cursor-pointer transition-colors hover:border-gisviz-accent hover:text-gisviz-accent group">
                      <Bookmark size={15} className="group-hover:fill-gisviz-accent/20 transition-all" />
                      <span className="hidden sm:inline">Save</span>
                    </button>
                    <button className="flex items-center gap-[6px] font-mono text-[11.5px] border border-gisviz-border bg-transparent text-gisviz-ink-soft px-[11px] py-[7px] rounded-md cursor-pointer transition-colors hover:border-gisviz-ink hover:text-gisviz-ink">
                      <MessageCircle size={15} />
                      {post.comments_count || '0'}
                    </button>
                  </div>
                </footer>

              </article>
            </div>

            {/* INJECTED NATIVE ADVERTISEMENT */}
            {index === 1 && (
              <div className="snap-start snap-always md:snap-align-none w-full">
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

          </React.Fragment>
          )
        })}
      </div>

      {/* SHARE MODAL */}
      {sharePost && (
        <ShareModal post={sharePost} onClose={() => setSharePost(null)} />
      )}

      {/* REPORT MODAL */}
      {reportPost && (
        <ReportModal post={reportPost} onClose={() => setReportPost(null)} />
      )}
    </div>
  )
}

/* ---------------- SHARE MODAL ---------------- */
function ShareModal({ post, onClose }: { post: GeographicPublication; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/post/${post.id}`
    : `/post/${post.id}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(post.title)

  const socials = [
    { name: 'X / Twitter', icon: MessageCircle, href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}` },
    { name: 'Facebook', icon: Globe, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: 'Email', icon: Mail, href: `mailto:?subject=${encodedText}&body=${encodedUrl}` },
  ]

  return (
    <ModalShell onClose={onClose} title="Share publication">
      <p className="text-[13px] text-gisviz-ink-soft mb-4 leading-relaxed font-sans">
        Share <span className="font-semibold text-gisviz-ink">{post.title}</span>
      </p>

      {/* copy link row */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 min-w-0 bg-gisviz-paper border border-gisviz-border rounded-md px-3 py-2.5 font-mono text-[11px] text-gisviz-ink-soft truncate">
          {shareUrl}
        </div>
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 shrink-0 bg-gisviz-accent text-white px-[14px] py-[9px] rounded-md font-display font-semibold text-[13px] tracking-[0.01em] hover:brightness-110 transition-all active:translate-y-[1px]"
        >
          {copied ? <Check size={15} /> : <LinkIcon size={15} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* socials */}
      <div className="grid grid-cols-3 gap-2">
        {socials.map(s => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 py-3 rounded-md border border-gisviz-border hover:border-gisviz-accent hover:text-gisviz-accent transition-colors text-gisviz-ink"
          >
            <s.icon size={18} className="text-gisviz-accent" />
            <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-center leading-tight">{s.name}</span>
          </a>
        ))}
      </div>
    </ModalShell>
  )
}

/* ---------------- REPORT MODAL ---------------- */
function ReportModal({ post, onClose }: { post: GeographicPublication; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const reasons = ['Inaccurate data', 'Inappropriate content', 'Copyright / attribution', 'Spam or misleading', 'Other']

  const submit = () => {
    setSubmitted(true)
  }

  return (
    <ModalShell onClose={onClose} title={submitted ? 'Report submitted' : 'Report publication'}>
      {submitted ? (
        <div className="flex flex-col items-center text-center py-4 gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-md border border-gisviz-accent bg-gisviz-accent-soft text-gisviz-accent">
            <Check size={24} />
          </div>
          <p className="text-[13px] font-sans text-gisviz-ink-soft leading-relaxed max-w-xs">
            Thanks — your report has been recorded and our team will review it.
          </p>
          <button
            onClick={onClose}
            className="mt-1 bg-gisviz-accent text-white px-[14px] py-[9px] rounded-md font-display font-semibold text-[13px] tracking-[0.01em] hover:brightness-110 transition-all active:translate-y-[1px]"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <p className="text-[13px] font-sans text-gisviz-ink-soft mb-4 leading-relaxed">
            Tell us what's wrong with <span className="font-semibold text-gisviz-ink">{post.title}</span>.
          </p>

          {/* reason chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {reasons.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`px-[11px] py-[7px] rounded-md font-mono text-[11px] border transition-colors ${
                  reason === r
                    ? 'bg-gisviz-accent text-white border-gisviz-accent'
                    : 'bg-transparent text-gisviz-ink border-gisviz-border hover:border-gisviz-accent/50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* details */}
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            rows={3}
            placeholder="Add any details (optional)…"
            className="w-full bg-gisviz-paper border border-gisviz-border rounded-md px-3 py-2.5 font-sans text-[13px] text-gisviz-ink placeholder-gisviz-ink-soft focus:outline-none focus:border-gisviz-accent transition-all resize-none mb-4"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-[14px] py-[9px] rounded-md border border-gisviz-border font-display font-semibold text-[13px] tracking-[0.01em] text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!reason}
              className="px-[14px] py-[9px] rounded-md border-0 font-display font-semibold text-[13px] tracking-[0.01em] bg-gisviz-accent text-white hover:brightness-110 transition-all active:translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit report
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

/* ---------------- SHARED MODAL SHELL ---------------- */
function ModalShell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gisviz-card border border-gisviz-border rounded-md p-[18px] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gisviz-border">
          <h3 className="font-display font-semibold text-[18px] text-gisviz-ink tracking-tight m-0">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-7 h-7 rounded-md border border-transparent text-gisviz-ink-soft hover:text-gisviz-accent hover:border-gisviz-border transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}