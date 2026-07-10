import React from 'react'

interface LogoProps {
  className?: string
  textClassName?: string
  scale?: number
}

export default function Logo({
  className = "",
  textClassName = "text-[24px]",
  scale = 1,
}: LogoProps) {
  return (
    <span
      aria-label="gisviz home"
      style={{ transform: `scale(${scale})`, transformOrigin: 'left center' }}
      className={`group flex items-center transition-opacity hover:opacity-80 ${className}`}
    >
      
      <div style={{ fontFamily: '"Barlow Condensed", ui-monospace, monospace' }} className={`text-gisviz-accent text-[24px] font-semibold ${textClassName}`}>
        <span>gisviz</span>
        <span
          className="italic rounded-md bg-gisviz-infos ml-1 px-[4px] py-[3px] text-[8px] bg-gisviz-ink-soft/20 font-medium leading-none tracking-[0.1em] text-gisviz-ink"
          style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }}
        >
          beta
        </span>
      </div>
    </span>
  )
}