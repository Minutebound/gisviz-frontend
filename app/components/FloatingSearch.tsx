'use client'

import React, { useState } from 'react'
import { Search } from 'lucide-react'
import SearchOverlay from './SearchOverlay' // Adjust import path if needed

export default function FloatingSearch() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return (
    <>
      <div className="pointer-events-auto relative shadow-2xl rounded-2xl group">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-geomap-ink-soft group-hover:text-geomap-accent transition-colors" />
        </div>
        <button
          onClick={() => setIsSearchOpen(true)}
          className="block w-full text-left pl-12 pr-6 py-4 bg-theme-canvas backdrop-blur-xl border border-geomap-border rounded-2xl text-gisviz-ink hover:text-geomap-ink hover:border-geomap-accent focus:outline-none focus:border-geomap-accent focus:ring-2 focus:ring-geomap-accent shadow-lg transition-all"
        >
          Search datasets, locations, or authors...
        </button>
      </div>

      {/* Mount the Overlay */}
      <SearchOverlay 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
    </>
  )
}