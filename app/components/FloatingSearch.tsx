'use client'

/**
 * FloatingSearch.tsx — updated to pass triggerRef to SearchOverlay
 *
 * The `triggerRef` is attached to this component's outer wrapper.
 * SearchOverlay reads its bounding rect to anchor the panel directly
 * above the bar, flush with the feed column width.
 */

import { useRef, useState } from 'react'
import { Search } from 'lucide-react'
import SearchOverlay from './SearchOverlay'

export default function FloatingSearch() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // Typed as HTMLDivElement | null to match RefObject<HTMLDivElement | null>
  const triggerRef = useRef<HTMLDivElement | null>(null)

  return (
    <>
      {/* Trigger bar */}
      <div ref={triggerRef} className="pointer-events-auto relative shadow-2xl rounded-2xl group">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gisviz-ink-soft group-hover:text-gisviz-accent transition-colors" />
        </div>
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="
            block w-full text-left pl-12 pr-6 py-4
            bg-gisviz-canvas backdrop-blur-xl
            border border-gisviz-border rounded-2xl
            text-gisviz-ink-soft text-[16px] font-mono
            hover:border-gisviz-accent
            focus:outline-none focus:border-gisviz-accent focus:ring-2 focus:ring-gisviz-accent/30
            shadow-lg transition-all
          "
        >
          Search posts and users…
        </button>
      </div>

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        triggerRef={triggerRef}
      />
    </>
  )
}