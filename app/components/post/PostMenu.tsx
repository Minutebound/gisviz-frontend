'use client'
/** The ⋯ menu at the right end of a post's bar (feed card, post page): Share and Report. Report needs an account. */
import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, MoreHorizontal, Share2 } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import ReportModal from '../ReportPost'

export default function PostMenu({ postId, onShare, className = '' }: {
  postId: string
  onShare: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { isAuthenticated } = useAuth() as any

  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [open])

  const item = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-gisviz-ink hover:bg-gisviz-paper'
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setOpen(false); fn() }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={open}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
              className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${
                open ? 'border-gisviz-accent/40 bg-gisviz-accent/10 text-gisviz-accent' : 'border-transparent text-gisviz-ink-soft hover:border-gisviz-border hover:bg-gisviz-paper hover:text-gisviz-ink'}`}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+4px)] z-50 w-44 overflow-hidden rounded-[10px] border border-gisviz-border bg-gisviz-card py-1 shadow-xl">
          <button type="button" role="menuitem" className={item} onClick={stop(onShare)}><Share2 size={14} /> Share</button>
          <button type="button" role="menuitem" className={`${item} text-gisviz-alert`}
                  onClick={stop(() => (isAuthenticated ? setReporting(true) : router.push('/auth')))}>
            <Flag size={14} /> Report
          </button>
        </div>
      )}
      <ReportModal isOpen={reporting} onClose={() => setReporting(false)} publicationId={postId} />
    </div>
  )
}