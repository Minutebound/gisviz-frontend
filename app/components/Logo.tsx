import React from 'react'
import Link from 'next/link'

interface LogoProps {
  className?: string
  textClassName?: string
  /**
   * Scales the entire logo up or down.
   * e.g., 1 is normal, 1.5 is 50% larger, 0.8 is 20% smaller.
   */
  scale?: number
}

export default function Logo({
  className = "",
  textClassName = "text-[24px]", // Slightly larger default since calligraphic fonts run smaller
  scale = 1,
}: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="gisviz home"
      // Applying the scale via an inline transform style centered to the left
      style={{ transform: `scale(${scale})`, transformOrigin: 'left center' }}
      className={`group flex items-center transition-opacity hover:opacity-80 ${className}`}
    >
      {/* 
        - text-gisviz-accent: Applies your emerald green color
        - font-[cursive]: Tells Tailwind to use the system's default calligraphic/script font
        - italic & tracking-wider: Enhances the flowing, handwritten feel
      */}
      <div className={`text-gisviz-accent font-bold italic tracking-wider lowercase font-[cursive] ${textClassName}`}>
        
        
        {/* DESKTOP VIEW (sm and up): Shows the full 'gisviz' */}
        <span>gisviz</span>
         <span
        className="rounded-md bg-gisviz-infos px-[7px] py-[3px] text-[8px] font-medium leading-none tracking-[0.1em] text-gisviz-ink-soft"
        style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }}
      > 
        beta
      </span>
      </div>
    </Link>
  )
}