import React from 'react'

interface LogoProps {
  className?: string
  /** Size of "gisviz"; "beta" is set relative to it. Default 38px. */
  textClassName?: string
  scale?: number
}

/**
 * The gisviz wordmark, set in text: orange calligraphic serif italic "gisviz" (--font-logo, EB Garamond)
 * with a small, wide-spaced grey mono italic "beta" (--font-logo-tag, JetBrains Mono).
 * Fonts and colours are the tokens in app/globals.css; the font files load in app/layout.tsx.
 */
export default function Logo({ className = '', textClassName = 'text-[38px]', scale = 1 }: LogoProps) {
  return (
    <span
      aria-label="gisviz beta, home"
      style={{ transform: `scale(${scale})`, transformOrigin: 'left center' }}
      className={`group inline-flex items-baseline gap-[0.22em] whitespace-nowrap transition-opacity hover:opacity-80 ${textClassName} ${className}`}
    >
      <span aria-hidden className="font-logo italic font-semibold leading-none tracking-[-0.01em] text-gisviz-logo pb-[0.08em]">
        gisviz
      </span>
      <span aria-hidden className="font-logo-tag italic font-medium text-[0.46em] leading-none tracking-[0.22em] text-gisviz-logo-tag">
        beta
      </span>
    </span>
  )
}
