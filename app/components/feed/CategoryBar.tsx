'use client'

import React, { useEffect, useRef } from 'react'
import { FeedFilters } from '../../../types/gisviz'
import { FOR_YOU, useCategories } from '../../../lib/referenceData'

interface CategoryBarProps {
  filters: FeedFilters
  onChange: (next: FeedFilters) => void
}

export default function CategoryBar({ filters, onChange }: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const categories = [FOR_YOU, ...useCategories()]      // from the posts DB

  // Smoothly center the active category item
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const c = scrollRef.current
      const i = activeRef.current
      const scrollLeft = c.scrollLeft + (i.getBoundingClientRect().left - c.getBoundingClientRect().left) - (c.offsetWidth / 2) + (i.offsetWidth / 2)
      c.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [filters.category])

  return (
    <section className="w-full border-b border-gisviz-border bg-gisviz-card/95 backdrop-blur-sm z-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 lg:px-[72px]">
        <div 
          ref={scrollRef}
          className="flex items-center gap-1.5 py-3 overflow-x-auto no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} 
        >
          <style dangerouslySetInnerHTML={{ __html: `div::-webkit-scrollbar { display: none; }`}} />

          {categories.map(cat => {
            const active = (filters.category ?? '') === cat.slug
            const isAll = cat.slug === ''

            return (
              <React.Fragment key={cat.slug}>
                <button
                  ref={active ? activeRef : null}
                  type="button"
                  onClick={() => onChange({ ...filters, category: cat.slug })}
                  className={`relative shrink-0 h-8 px-4 rounded-full text-[13px] font-medium transition-colors ${
                    active ? 'bg-gisviz-ink text-gisviz-card shadow-sm font-semibold' : 'text-gisviz-ink-soft hover:text-gisviz-ink hover:bg-gisviz-paper'
                  }`}
                >
                  {isAll ? 'All' : cat.label}
                  
                  {/* Down Arrow Hook */}
                  {active && (
                    <span className="absolute -bottom-[12px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gisviz-ink" aria-hidden="true" />
                  )}
                </button>
                
                {/* Vertical Divider after "All" */}
                {isAll && <div className="w-[1px] h-4 bg-gisviz-border mx-1 shrink-0" aria-hidden="true" />}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}