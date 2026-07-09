'use client'

/**
 * SearchOverlay.tsx — Enterprise Search
 *
 * Design decisions:
 *
 * 1. ALIGNMENT — the panel drops directly below the FloatingSearch bar,
 *    inside the same feed column. It is NOT a viewport-centred modal.
 *    `fixed inset-0` on the backdrop, panel pinned via `ref` measurement
 *    of the trigger rect so it tracks the feed column on any screen width.
 *
 * 2. POINTER ISOLATION — the backdrop captures ALL pointer events first.
 *    The panel itself uses `e.stopPropagation()` on every interactive
 *    surface so clicks inside never bubble to the backdrop → no accidental
 *    close, and no hover events bleed through to Feed cards below.
 *
 * 3. OUTSIDE CLICK — backdrop `onPointerDown` calls onClose immediately,
 *    before any mousedown reaches Feed. Using `onPointerDown` (not onClick)
 *    prevents the ~100ms gap where feed hover styles would briefly activate.
 *
 * 4. RESULTS — users (handle + avatar) and posts (thumbnail + title) only.
 *    Categories and tags removed as per product spec.
 *
 * 5. KEYBOARD — arrow keys navigate rows, Enter activates, Escape closes.
 *
 * 6. PANEL FEEL — each row is a full-width interactive surface (not just
 *    the text), with keyboard focus ring matching the design system.
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? ''

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
  // categories and tags exist on the response but we intentionally ignore them
}

export interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Ref to the FloatingSearch trigger element.
   * The overlay panel aligns its top-left to this rect.
   */
  triggerRef: React.RefObject<HTMLDivElement | null>
}

// ─── Flat result list for keyboard navigation ───────────────────────────────

type FlatResult =
  | { kind: 'user'; data: UserResult }
  | { kind: 'post'; data: PostResult }

// ─── Constants ──────────────────────────────────────────────────────────────

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

  // ── Panel position — aligned to trigger ─────────────────────────────────
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  const measureAndPlace = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPanelStyle({
      position:  'fixed',
      top:       rect.bottom + 8,      // 8px gap below the search bar
      left:      rect.left,
      width:     rect.width,
      maxHeight: `calc(100vh - ${rect.bottom + 24}px)`,
    })
  }, [triggerRef])

  // Re-measure on open and on resize
  useEffect(() => {
    if (!isOpen) return
    measureAndPlace()
    window.addEventListener('resize', measureAndPlace)
    return () => window.removeEventListener('resize', measureAndPlace)
  }, [isOpen, measureAndPlace])

  // ── Focus + scroll lock ──────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setQuery('')
      setResults(null)
      setError('')
      setActiveIdx(-1)
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

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

  // ── Flat list for keyboard nav ───────────────────────────────────────────
  const flat: FlatResult[] = results
    ? [
        ...results.users.map(u => ({ kind: 'user' as const, data: u })),
        ...results.posts.map(p => ({ kind: 'post' as const, data: p })),
      ]
    : []

  const navigate = (href: string) => {
    onClose()
    router.push(href)
  }

  const activateResult = (item: FlatResult) => {
    if (item.kind === 'user') navigate(`/profile/${item.data.user_handle}`)
    else                      navigate(`/${item.data.post_id}`)
  }

  // ── Arrow-key / Enter navigation ─────────────────────────────────────────
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

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !panelRef.current) return
    const el = panelRef.current.querySelector<HTMLElement>(
      `[data-result-idx="${activeIdx}"]`
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const hasUsers = (results?.users.length ?? 0) > 0
  const hasPosts = (results?.posts.length ?? 0) > 0
  const hasAny   = hasUsers || hasPosts

  if (!isOpen) return null

  return (
    <>
      {/* ── Full-screen backdrop — captures all pointer events ─────────────
          Using onPointerDown (fires before onMouseEnter on feed cards)
          so feed hover never activates while the overlay is open.        */}
      <div
        aria-hidden="true"
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         40,
          // Intentionally transparent — no dim, feed visible through
          background:     'transparent',
          cursor:         'default',
        }}
        onPointerDown={(e) => {
          // Only close if the click is genuinely outside the panel
          if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
            onClose()
          }
        }}
      />

      {/* ── Search panel — sits above backdrop ───────────────────────────── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Search"
        aria-modal="true"
        style={{
          ...panelStyle,
          zIndex:       50,
          display:      'flex',
          flexDirection:'column',
          overflow:     'hidden',
          // Isolate the panel from the backdrop layer completely
          isolation:    'isolate',
        }}
        className="
          bg-gisviz-card
          border border-gisviz-border
          rounded-xl
          shadow-[0_8px_40px_-8px_rgba(0,0,0,0.28)]
          animate-in fade-in slide-in-from-top-2 duration-200
        "
        // Stop ALL pointer events from bubbling up to the backdrop
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onMouseEnter={e => e.stopPropagation()}
      >

        {/* ── Search input bar ─────────────────────────────────────────── */}
        <div className="
          flex items-center gap-3 px-4 py-3.5
          border-b border-gisviz-border
          bg-gisviz-canvas/60 shrink-0
        ">
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
            className="
              flex-1 min-w-0
              bg-transparent outline-none
              text-[16px] font-mono text-gisviz-ink
              placeholder:text-gisviz-ink-soft/50
              [&::-webkit-search-cancel-button]:hidden
            "
          />

          {query && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              className="
                p-1 rounded-md shrink-0
                text-gisviz-ink-soft/60
                hover:text-gisviz-ink hover:bg-gisviz-border/40
                transition-colors
              "
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="
              p-1 rounded-md shrink-0
              text-gisviz-ink-soft/60
              hover:text-gisviz-ink hover:bg-gisviz-border/40
              transition-colors
            "
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Results scrollable area ───────────────────────────────────── */}
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="overflow-y-auto overscroll-contain flex-1"
        >

          {/* Idle / too short */}
          {!query.trim() && (
            <div className="py-10 flex flex-col items-center gap-3 text-gisviz-ink-soft/40">
              <Search className="w-7 h-7" />
              <span className="text-[12px] font-mono">
                Search posts and user handles
              </span>
            </div>
          )}

          {query.trim().length > 0 && query.trim().length < MIN_CHARS && (
            <div className="py-10 text-center text-[12px] font-mono text-gisviz-ink-soft/60">
              Type {MIN_CHARS - query.trim().length} more character{query.trim().length < MIN_CHARS - 1 ? 's' : ''}…
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="py-8 text-center text-[12px] font-mono text-gisviz-alert/80">
              {error}
            </div>
          )}

          {/* No results */}
          {!loading && !error && query.trim().length >= MIN_CHARS && !hasAny && (
            <div className="py-12 flex flex-col items-center gap-2">
              <p className="text-[12px] font-mono text-gisviz-ink-soft">
                No results for{' '}
                <span className="text-gisviz-ink font-bold">"{query.trim()}"</span>
              </p>
              <p className="text-[12px] font-mono text-gisviz-ink-soft/50">
                Try a different keyword
              </p>
            </div>
          )}

          {/* ── USER RESULTS ────────────────────────────────────────────── */}
          {hasUsers && results && (
            <section aria-label="User handles">
              <div className="
                flex items-center gap-2 px-4 pt-3 pb-1.5
                sticky top-0 bg-gisviz-card/95
                backdrop-blur-sm
                border-b border-gisviz-border/30
              ">
                <User className="w-3 h-3 text-gisviz-accent" />
                <span className="
                  text-[12px] font-mono font-bold
                  text-gisviz-ink-soft uppercase tracking-[0.12em]
                ">
                  Users
                </span>
                <span className="ml-auto text-[12px] font-mono text-gisviz-ink-soft/50">
                  {results.users.length}
                </span>
              </div>

              <ul className="px-2 py-1.5">
                {results.users.map((u, sectionIdx) => {
                  const flatIdx = sectionIdx            // users come first in flat[]
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
                        onClick={() => navigate(`/profile/${u.user_handle}`)}
                        onMouseEnter={() => setActiveIdx(flatIdx)}
                        onMouseLeave={() => setActiveIdx(-1)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                          text-left transition-colors duration-100 group
                          focus:outline-none focus-visible:ring-2
                          focus-visible:ring-gisviz-accent
                          ${isActive
                            ? 'bg-gisviz-canvas text-gisviz-ink'
                            : 'text-gisviz-ink hover:bg-gisviz-canvas/60'
                          }
                        `}
                      >
                        {/* Avatar */}
                        <div className="
                          w-8 h-8 rounded-full shrink-0 overflow-hidden
                          bg-gisviz-border/30
                          flex items-center justify-center
                          border border-gisviz-border/40
                        ">
                          {avatarUrl
                            ? <img
                                src={avatarUrl}
                                alt={u.user_handle}
                                className="w-full h-full object-cover"
                              />
                            : <User className="w-4 h-4 text-gisviz-ink-soft/60" />
                          }
                        </div>

                        {/* Handle */}
                        <div className="flex-1 min-w-0">
                          <p className="
                            text-[12px] font-mono font-bold
                            text-gisviz-ink truncate leading-none
                          ">
                            @{u.user_handle}
                          </p>
                        </div>

                        {/* Arrow — only visible on active/hover */}
                        <ArrowUpRight className={`
                          w-3.5 h-3.5 shrink-0 transition-opacity
                          text-gisviz-accent
                          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}
                        `} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* ── POST RESULTS ────────────────────────────────────────────── */}
          {hasPosts && results && (
            <section aria-label="Posts">
              <div className="
                flex items-center gap-2 px-4 pt-3 pb-1.5
                sticky top-0 bg-gisviz-card/95
                backdrop-blur-sm
                border-b border-gisviz-border/30
              ">
                <FileText className="w-3 h-3 text-gisviz-accent" />
                <span className="
                  text-[12px] font-mono font-bold
                  text-gisviz-ink-soft uppercase tracking-[0.12em]
                ">
                  Posts
                </span>
                <span className="ml-auto text-[12px] font-mono text-gisviz-ink-soft/50">
                  {results.posts.length}
                </span>
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
                        onClick={() => navigate(`/${p.post_id}`)}
                        onMouseEnter={() => setActiveIdx(flatIdx)}
                        onMouseLeave={() => setActiveIdx(-1)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                          text-left transition-colors duration-100 group
                          focus:outline-none focus-visible:ring-2
                          focus-visible:ring-gisviz-accent
                          ${isActive
                            ? 'bg-gisviz-canvas text-gisviz-ink'
                            : 'text-gisviz-ink hover:bg-gisviz-canvas/60'
                          }
                        `}
                      >
                        {/* Thumbnail */}
                        <div className="
                          w-10 h-10 rounded-md shrink-0 overflow-hidden
                          bg-gisviz-border/20
                          flex items-center justify-center
                          border border-gisviz-border/30
                        ">
                          {thumbUrl
                            ? <img
                                src={thumbUrl}
                                alt={p.title}
                                className="w-full h-full object-cover"
                              />
                            : <FileText className="w-4 h-4 text-gisviz-ink-soft/40" />
                          }
                        </div>

                        {/* Title */}
                        <p className="
                          flex-1 min-w-0
                          text-[12px] font-mono font-bold
                          text-gisviz-ink truncate leading-snug
                        ">
                          {p.title}
                        </p>

                        {/* Arrow */}
                        <ArrowUpRight className={`
                          w-3.5 h-3.5 shrink-0 transition-opacity
                          text-gisviz-accent
                          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}
                        `} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="
          px-4 py-2.5
          border-t border-gisviz-border/30
          bg-gisviz-canvas/40
          shrink-0
          flex items-center gap-4
        ">
          <span className="text-[12px] font-mono text-gisviz-ink-soft/40 flex items-center gap-1">
            <kbd className="
              px-1.5 py-0.5 rounded
              bg-gisviz-border/30
              text-[9px] font-mono
            ">↑↓</kbd>
            navigate
          </span>
          <span className="text-[12px] font-mono text-gisviz-ink-soft/40 flex items-center gap-1">
            <kbd className="
              px-1.5 py-0.5 rounded
              bg-gisviz-border/30
              text-[9px] font-mono
            ">↵</kbd>
            open
          </span>
          <span className="text-[12px] font-mono text-gisviz-ink-soft/40 flex items-center gap-1">
            <kbd className="
              px-1.5 py-0.5 rounded
              bg-gisviz-border/30
              text-[9px] font-mono
            ">Esc</kbd>
            close
          </span>
        </div>

      </div>
    </>
  )
}