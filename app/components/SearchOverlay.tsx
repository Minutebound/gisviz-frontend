'use client'

/**
 * SearchOverlay.tsx — Enterprise Smart Search
 *
 * Updates:
 * - Smart Positioning: Calculates screen space and pops UP if near the bottom, or DOWN if near the top.
 * - Dynamic Layout: Automatically moves the text input to be closest to the trigger bar.
 * - Safe Exit: Uses a delayed unmount to ensure smooth fade-outs without blocking clicks.
 * - Result Limits: Restricts output to max 5 users and max 5 posts.
 */

import React, {
  useState, useEffect, useRef, useCallback, useId,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, X, Loader2, User, FileText, ArrowUpRight,
} from 'lucide-react'
import { gisvizApi } from '../../services/api'

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v0', '') ?? ''

function resolveUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_BASE}/${path.replace(/^\//, '')}`
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserResult {
  user_id: string
  user_handle: string
  avatar_path: string | null
}

interface PostResult {
  post_id: string
  title: string
  share_slug: string
  visual_image_path: string | null
}

interface SearchResults {
  users: UserResult[]
  posts: PostResult[]
}

export interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLDivElement | null>
}

type FlatResult =
  | { kind: 'user'; data: UserResult }
  | { kind: 'post'; data: PostResult }

const DEBOUNCE_MS = 280
const MIN_CHARS   = 3

// ─── Component ──────────────────────────────────────────────────────────────

export default function SearchOverlay({
  isOpen,
  onClose,
  triggerRef,
}: SearchOverlayProps) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listId   = useId()

  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<SearchResults | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)

  // Delayed Unmount to fix the invisible click-blocking glitch
  const [shouldRender, setShouldRender] = useState(isOpen)
  
  // Smart Positioning State
  const [popDirection, setPopDirection] = useState<'up' | 'down'>('down')
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  // ── Smart Measure & Place ───────────────────────────────────────────────
  const measureAndPlace = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    // If there is more space above the bar, pop UP. Otherwise, pop DOWN.
    if (spaceAbove > spaceBelow) {
      setPopDirection('up')
      setPanelStyle({
        position:  'fixed',
        bottom:    window.innerHeight - rect.top + 8, // 8px gap above trigger
        left:      rect.left,
        width:     rect.width,
        maxHeight: `calc(${rect.top}px - 24px)`,      // Max height bounded by screen top
      })
    } else {
      setPopDirection('down')
      setPanelStyle({
        position:  'fixed',
        top:       rect.bottom + 8,                   // 8px gap below trigger
        left:      rect.left,
        width:     rect.width,
        maxHeight: `calc(100vh - ${rect.bottom + 24}px)`,
      })
    }
  }, [triggerRef])

  // Re-measure on resize
  useEffect(() => {
    if (!isOpen) return
    measureAndPlace()
    window.addEventListener('resize', measureAndPlace)
    return () => window.removeEventListener('resize', measureAndPlace)
  }, [isOpen, measureAndPlace])

  // ── Mount / Unmount Logic ───────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      measureAndPlace() 
      setTimeout(() => inputRef.current?.focus(), 60)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      // Wait for the CSS fade-out animation to finish, then destroy the element
      const t = setTimeout(() => {
        setShouldRender(false)
        setQuery('')
        setResults(null)
        setError('')
        setActiveIdx(-1)
      }, 200)
      return () => clearTimeout(t)
    }
  }, [isOpen, measureAndPlace])

  // ── Escape key ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isOpen, onClose])

  // ── Debounced search ─────────────────────────────────────────────────────
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_CHARS) {
      setResults(null)
      setError('')
      setActiveIdx(-1)
      return
    }
    setLoading(true)
    setError('')
    const t = setTimeout(async () => {
      try {
        const data = await gisvizApi.globalSearch(trimmed)
        
        // LIMIT RESULTS: Max 5 users, Max 5 posts
        data.users = data.users ? data.users.slice(0, 5) : []
        data.posts = data.posts ? data.posts.slice(0, 5) : []
        
        setResults(data)
        setActiveIdx(-1)
      } catch (err: any) {
        const detail = err?.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Search failed. Try again.')
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const flat: FlatResult[] = results
    ? [
        ...results.users.map(u => ({ kind: 'user' as const, data: u })),
        ...results.posts.map(p => ({ kind: 'post' as const, data: p })),
      ]
    : []

  const activateResult = (item: FlatResult) => {
    onClose()
    if (item.kind === 'user') {
      router.push(`/profile/${item.data.user_handle}`)
    } else {
      router.push(`/post/${item.data.post_id}`)  // ← was /p/${share_slug}
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!flat.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      activateResult(flat[activeIdx])
    }
  }

  useEffect(() => {
    if (activeIdx < 0 || !panelRef.current) return
    const el = panelRef.current.querySelector<HTMLElement>(
      `[data-result-idx="${activeIdx}"]`
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!shouldRender) return null

  const hasUsers = (results?.users.length ?? 0) > 0
  const hasPosts = (results?.posts.length ?? 0) > 0
  const hasAny   = hasUsers || hasPosts

  // ────────────────────────────────────────────────────────────────────────
  // DYNAMIC RENDER BLOCKS
  // By splitting these out, we can easily re-order them based on pop direction!
  // ────────────────────────────────────────────────────────────────────────
  
  const InputBar = (
    <div key="input-bar" className={`flex items-center gap-3 px-4 py-3.5 bg-gisviz-canvas/60 shrink-0 ${popDirection === 'up' ? 'border-t border-gisviz-border' : 'border-b border-gisviz-border'}`}>
      {loading
        ? <Loader2 className="w-4 h-4 text-gisviz-accent animate-spin shrink-0" />
        : <Search  className="w-4 h-4 text-gisviz-ink-soft/60 shrink-0" />
      }

      <input
        ref={inputRef}
        type="search"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={hasAny}
        aria-controls={listId}
        aria-activedescendant={activeIdx >= 0 ? `result-${activeIdx}` : undefined}
        placeholder="Search posts and users…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-0 bg-transparent outline-none text-[16px] font-mono text-gisviz-ink placeholder:text-gisviz-ink-soft/50 [&::-webkit-search-cancel-button]:hidden"
      />

      <button
        type="button"
        aria-label={query ? "Clear search" : "Close search"}
        onClick={() => {
          if (query) { setQuery(''); inputRef.current?.focus() } 
          else { onClose() }
        }}
        className="p-1.5 rounded-md shrink-0 text-gisviz-ink-soft/60 hover:text-gisviz-ink hover:bg-gisviz-border/40 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )

  const ShortcutsFooter = (
    <div
      key="shortcuts"
      className={`
        hidden sm:flex                          
        px-4 py-2.5 bg-gisviz-canvas/40 shrink-0 items-center gap-4
        ${popDirection === 'up'
          ? 'border-b border-gisviz-border/30'
          : 'border-t border-gisviz-border/30'
        }
      `}
    >
      <span className="text-[12px] font-mono text-gisviz-ink-soft/40 flex items-center gap-1">
        <kbd className="px-1.5 py-0.5 rounded bg-gisviz-border/30 text-[12px] font-mono">↑↓</kbd> navigate
      </span>
      <span className="text-[12px] font-mono text-gisviz-ink-soft/40 flex items-center gap-1">
        <kbd className="px-1.5 py-0.5 rounded bg-gisviz-border/30 text-[12px] font-mono">↵</kbd> open
      </span>
      <span className="text-[12px] font-mono text-gisviz-ink-soft/40 flex items-center gap-1">
        <kbd className="px-1.5 py-0.5 rounded bg-gisviz-border/30 text-[12px] font-mono">Esc</kbd> close
      </span>
    </div>
  )

  const ResultsArea = (
    <div key="results-area" id={listId} role="listbox" aria-label="Search results" className="overflow-y-auto overscroll-contain flex-1">
      {!query.trim() && (
        <div className="py-10 flex flex-col items-center gap-3 text-gisviz-ink-soft/40">
          <Search className="w-7 h-7" />
          <span className="text-[12px] font-mono">Search posts and user handles</span>
        </div>
      )}

      {query.trim().length > 0 && query.trim().length < MIN_CHARS && (
        <div className="py-10 text-center text-[12px] font-mono text-gisviz-ink-soft/60">
          Type {MIN_CHARS - query.trim().length} more character{query.trim().length < MIN_CHARS - 1 ? 's' : ''}…
        </div>
      )}

      {error && <div className="py-8 text-center text-[12px] font-mono text-gisviz-alert/80">{error}</div>}

      {!loading && !error && query.trim().length >= MIN_CHARS && !hasAny && (
        <div className="py-12 flex flex-col items-center gap-2">
          <p className="text-[12px] font-mono text-gisviz-ink-soft">
            No results for <span className="text-gisviz-ink font-bold">"{query.trim()}"</span>
          </p>
          <p className="text-[12px] font-mono text-gisviz-ink-soft/50">Try a different keyword</p>
        </div>
      )}

      {hasUsers && results && (
        <section aria-label="User handles">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1.5 sticky top-0 bg-gisviz-card/95 backdrop-blur-sm border-b border-gisviz-border/30 z-10">
            <User className="w-3 h-3 text-gisviz-accent" />
            <span className="text-[12px] font-mono font-bold text-gisviz-ink-soft uppercase tracking-[0.12em]">Users</span>
            <span className="ml-auto text-[12px] font-mono text-gisviz-ink-soft/50">{results.users.length}</span>
          </div>
          <ul className="px-2 py-1.5">
            {results.users.map((u, sectionIdx) => {
              const flatIdx = sectionIdx
              const isActive = flatIdx === activeIdx
              const avatarUrl = resolveUrl(u.avatar_path)
              return (
                <li key={u.user_id}>
                  <button
                    id={`result-${flatIdx}`}
                    role="option"
                    aria-selected={isActive}
                    data-result-idx={flatIdx}
                    type="button"
                    onClick={() => activateResult({ kind: 'user', data: u })}
                    onMouseEnter={() => setActiveIdx(flatIdx)}
                    onMouseLeave={() => setActiveIdx(-1)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-100 group
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-gisviz-accent
                      ${isActive ? 'bg-gisviz-canvas text-gisviz-ink' : 'text-gisviz-ink hover:bg-gisviz-canvas/60'}
                    `}
                  >
                    <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-gisviz-border/30 flex items-center justify-center border border-gisviz-border/40">
                      {avatarUrl ? <img src={avatarUrl} alt={u.user_handle} className="w-full h-full object-cover" /> :(
                      <div className="w-10 h-10 rounded-full border border-gisviz-border bg-gradient-to-tr from-gisviz-accent to-gisviz-safe 0 flex items-center justify-center text-gisviz-white text-[16px] font-bold uppercase font-mono shadow-inner flex-shrink-0">
                        {u.user_handle.charAt(0)}
                      </div>
                    )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-mono font-bold text-gisviz-ink truncate leading-none">@{u.user_handle}</p>
                    </div>
                    <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 transition-opacity text-gisviz-accent ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {hasPosts && results && (
        <section aria-label="Posts">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1.5 sticky top-0 bg-gisviz-card/95 backdrop-blur-sm border-b border-gisviz-border/30 z-10">
            <FileText className="w-3 h-3 text-gisviz-accent" />
            <span className="text-[12px] font-mono font-bold text-gisviz-ink-soft uppercase tracking-[0.12em]">Posts</span>
            <span className="ml-auto text-[12px] font-mono text-gisviz-ink-soft/50">{results.posts.length}</span>
          </div>
          <ul className="px-2 py-1.5">
            {results.posts.map((p, sectionIdx) => {
              const flatIdx = (results?.users.length ?? 0) + sectionIdx
              const isActive = flatIdx === activeIdx
              const thumbUrl = resolveUrl(p.visual_image_path)
              return (
                <li key={p.post_id}>
                  <button
                    id={`result-${flatIdx}`}
                    role="option"
                    aria-selected={isActive}
                    data-result-idx={flatIdx}
                    type="button"
                    onClick={() => activateResult({ kind: 'post', data: p })}
                    onMouseEnter={() => setActiveIdx(flatIdx)}
                    onMouseLeave={() => setActiveIdx(-1)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-100 group
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-gisviz-accent
                      ${isActive ? 'bg-gisviz-canvas text-gisviz-ink' : 'text-gisviz-ink hover:bg-gisviz-canvas/60'}
                    `}
                  >
                    <div className="w-10 h-10 rounded-md shrink-0 overflow-hidden bg-gisviz-border/20 flex items-center justify-center border border-gisviz-border/30">
                      {thumbUrl ? <img src={thumbUrl} alt={p.title} className="w-full h-full object-cover" /> : <FileText className="w-4 h-4 text-gisviz-ink-soft/40" />}
                    </div>
                    <p className="flex-1 min-w-0 text-[12px] font-mono font-bold text-gisviz-ink truncate leading-snug">{p.title}</p>
                    <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 transition-opacity text-gisviz-accent ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'transparent' }}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-label="Search"
        aria-modal="true"
        style={{
          ...panelStyle,
          zIndex:       9999,
          display:      'flex',
          flexDirection:'column',
          overflow:     'hidden',
          isolation:    'isolate',
        }}
        className={`
          bg-gisviz-card border border-gisviz-border rounded-xl
          transition-all duration-200 ease-out
          ${popDirection === 'up' ? 'shadow-[0_-8px_40px_-8px_rgba(0,0,0,0.28)]' : 'shadow-[0_8px_40px_-8px_rgba(0,0,0,0.28)]'}
          ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : `opacity-0 pointer-events-none ${popDirection === 'up' ? 'translate-y-3' : '-translate-y-3'}`}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* If popping UP, put the input at the bottom so it sits right next to the trigger button! */}
        {popDirection === 'up' ? (
          <>
            {ShortcutsFooter}
            {ResultsArea}
            {InputBar}
          </>
        ) : (
          <>
            {InputBar}
            {ResultsArea}
            {ShortcutsFooter}
          </>
        )}
      </div>
    </>
  )
}