'use client'
/**
 * RegionFilter — the region dropdown of the feed and the datasets page.
 * Lists only Global and the 7 continents (regions table, misc DB). There is no "All regions" row: Global is
 * the whole world and is the default (value ""), so picking Global — or the × — clears the filter.
 * Picking a continent also returns content tagged with its countries (expanded on the server).
 */
import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe2, X } from 'lucide-react'
import { topRegions, useRegions } from '../../lib/referenceData'

export default function RegionFilter({ value, onChange, className = '' }: {
  value: string
  onChange: (code: string) => void
  className?: string
}) {
  const all = useRegions()
  const options = topRegions(all)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // a country set from a link (e.g. ?region=ke) still shows its own name
  const isGlobal = !value || value === 'global'
  const label = isGlobal ? (all.find(r => r.code === 'global')?.name || 'Global') : (all.find(r => r.code === value)?.name || value)
  const pick = (code: string) => { onChange(code === 'global' || code === value ? '' : code); setOpen(false) }

  return (
    <div className={`relative shrink-0 ${className}`} ref={ref}>
      <div className={`inline-flex items-center h-9 rounded-[8px] border text-[13px] font-medium transition-all shadow-sm ${
        !isGlobal ? 'border-gisviz-accent text-gisviz-accent bg-gisviz-accent/5' : 'border-gisviz-border bg-gisviz-paper text-gisviz-ink hover:border-gisviz-border-strong'}`}>
        <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
                aria-label={`Region: ${label}`}
                className="inline-flex items-center gap-1.5 h-full pl-3.5 pr-2.5">
          <Globe2 size={14} className={!isGlobal ? 'text-gisviz-accent' : 'text-gisviz-ink-soft'} />
          <span className="max-w-[110px] sm:max-w-[150px] truncate">{label}</span>
          {isGlobal && <ChevronDown size={14} className="text-gisviz-ink-soft shrink-0" />}
        </button>
        {!isGlobal && (
          <button type="button" onClick={() => onChange('')} aria-label="Clear region filter"
                  className="h-full pr-2.5 pl-0.5 text-gisviz-accent/70 hover:text-gisviz-accent">
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div role="listbox" className="absolute left-0 mt-2 w-56 rounded-xl border border-gisviz-border bg-gisviz-card shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 text-[10.5px] font-mono uppercase tracking-wider text-gisviz-ink-soft border-b border-gisviz-border mb-1">Region</div>
          {options.map(r => {
            const active = r.code === 'global' ? isGlobal : r.code === value
            return (
              <button key={r.code} type="button" role="option" aria-selected={active} onClick={() => pick(r.code)}
                className="w-full text-left px-3 py-2 text-[13px] font-medium text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent flex items-center justify-between gap-2 transition-colors">
                <span className={active ? 'font-semibold text-gisviz-accent' : ''}>{r.name}</span>
                {active && <Check size={14} className="text-gisviz-accent shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}