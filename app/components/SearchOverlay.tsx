'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2, User, FileText, Tag, FolderOpen } from 'lucide-react'
import { gisvizApi } from '@/services/api'

// Strip /api/v1 so avatar paths resolve to the backend root
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL 
const API_BASE_URL = RAW_API_URL.replace('/api/v1', '').replace(/\/$/, '')

const getAvatarUrl = (path: string | null | undefined): string | null => {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

interface GlobalSearchResults {
  users: { user_id: string; user_handle: string; avatar_path: string | null }[]
  posts: { post_id: string; title: string; share_slug: string; visual_image_path: string | null }[]
  categories: { category_id: string; label: string }[]
  tags: { keyword_id: string; word: string }[]
}

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
}

// -------------------------------------------------------------------
// Section header
// -------------------------------------------------------------------
function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gisviz-border/40">
      <span className="text-gisviz-accent">{icon}</span>
      <span className="text-[12px] font-mono font-bold text-gisviz-ink-soft uppercase tracking-widest">
        {label}
      </span>
      <span className="ml-auto text-[12px] font-mono text-gisviz-ink-soft/60">{count}</span>
    </div>
  )
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus & body scroll lock
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
      setQuery('')
      setResults(null)
      setError('')
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Debounced global search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setResults(null)
      setError('')
      return
    }

    setIsLoading(true)
    setError('')

    const timer = setTimeout(async () => {
      try {
        const data = await gisvizApi.globalSearch(query.trim())
        setResults(data)
      } catch (err: any) {
        const detail = err.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Search failed. Please try again.')
        setResults(null)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const hasResults = results && (
    results.users.length > 0 ||
    results.posts.length > 0 ||
    results.categories.length > 0 ||
    results.tags.length > 0
  )

  const navigate = (href: string) => {
    onClose()
    router.push(href)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-28 px-4 backdrop-blur-sm bg-black/50">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-gisviz-card border border-gisviz-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* --- Search Input Bar --- */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gisviz-border bg-gisviz-canvas">
          <Search className="w-4 h-4 text-gisviz-ink-soft shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search posts, users, categories, tags…"
            className="flex-1 bg-transparent outline-none text-[14px] font-mono text-gisviz-ink placeholder:text-gisviz-ink-soft/60"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-gisviz-accent animate-spin shrink-0" />
          ) : (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gisviz-border/30 transition-colors"
              aria-label="Close search"
            >
              <X className="w-4 h-4 text-gisviz-ink-soft" />
            </button>
          )}
        </div>

        {/* --- Results Panel --- */}
        <div className="max-h-[65vh] overflow-y-auto overscroll-contain">

          {/* Min-length hint */}
          {query.trim().length > 0 && query.trim().length < 3 && (
            <div className="py-10 text-center text-[12px] font-mono text-gisviz-ink-soft">
              Type at least 3 characters to search…
            </div>
          )}

          {/* No results */}
          {query.trim().length >= 3 && !isLoading && !hasResults && !error && (
            <div className="py-12 text-center">
              <p className="text-[13px] font-mono text-gisviz-ink-soft">
                No results found for <span className="text-gisviz-ink font-bold">"{query}"</span>
              </p>
              <p className="text-[11px] font-mono text-gisviz-ink-soft/60 mt-1">
                Try a different keyword or check the spelling.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="py-8 text-center text-[12px] font-mono text-gisviz-alert/80">
              {error}
            </div>
          )}

          {/* --- Grouped Results --- */}
          {hasResults && results && (
            <div className="divide-y divide-gisviz-border/30">

              {/* USERS */}
              {results.users.length > 0 && (
                <div>
                  <SectionHeader icon={<User size={12} />} label="User Handles" count={results.users.length} />
                  <ul className="p-2 space-y-0.5">
                    {results.users.map(u => {
                      const avatarUrl = getAvatarUrl(u.avatar_path)
                      return (
                        <li key={u.user_id}>
                          <button
                            onClick={() => navigate(`/${u.user_handle}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gisviz-canvas transition-colors text-left"
                          >
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-gisviz-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={u.user_handle} className="w-full h-full object-cover" />
                              ) : (
                                <User size={14} className="text-gisviz-ink-soft" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-mono font-bold text-gisviz-ink leading-none">
                                @{u.user_handle}
                              </p>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* POSTS */}
              {results.posts.length > 0 && (
                <div>
                  <SectionHeader icon={<FileText size={12} />} label="Posts" count={results.posts.length} />
                  <ul className="p-2 space-y-0.5">
                    {results.posts.map(p => {
                      const imageUrl = p.visual_image_path
                        ? getAvatarUrl(p.visual_image_path)
                        : null
                      return (
                        <li key={p.post_id}>
                          <button
                            onClick={() => navigate(`/post/${p.post_id}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gisviz-canvas transition-colors text-left"
                          >
                            {/* Thumbnail */}
                            <div className="w-10 h-10 rounded-md bg-gisviz-border/30 overflow-hidden shrink-0 flex items-center justify-center">
                              {imageUrl ? (
                                <img src={imageUrl} alt={p.title} className="w-full h-full object-cover" />
                              ) : (
                                <FileText size={16} className="text-gisviz-ink-soft" />
                              )}
                            </div>
                            <p className="text-[13px] font-mono font-bold text-gisviz-ink truncate">
                              {p.title}
                            </p>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* CATEGORIES */}
              {results.categories.length > 0 && (
                <div>
                  <SectionHeader icon={<FolderOpen size={12} />} label="Categories" count={results.categories.length} />
                  <div className="flex flex-wrap gap-2 p-4">
                    {results.categories.map(c => (
                      <span
                        key={c.category_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-gisviz-accent/10 text-gisviz-accent border border-gisviz-accent/20"
                      >
                        <FolderOpen size={10} />
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* TAGS */}
              {results.tags.length > 0 && (
                <div>
                  <SectionHeader icon={<Tag size={12} />} label="Tags" count={results.tags.length} />
                  <div className="flex flex-wrap gap-2 p-4">
                    {results.tags.map(t => (
                      <span
                        key={t.keyword_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-gisviz-canvas border border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent transition-colors cursor-default"
                      >
                        <Tag size={10} />
                        {t.word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Empty / idle state */}
          {!query.trim() && (
            <div className="py-10 text-center">
              <Search size={28} className="mx-auto text-gisviz-ink-soft/30 mb-3" />
              <p className="text-[12px] font-mono text-gisviz-ink-soft/60">
                Search across posts, User Handles, categories, and tags
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gisviz-border/40 bg-gisviz-canvas/50 flex items-center gap-4">
          <span className="text-[12px] font-mono text-gisviz-ink-soft/50">
            <kbd className="px-1.5 py-0.5 rounded bg-gisviz-border/40 text-[9px]">ESC</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}