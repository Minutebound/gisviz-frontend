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
      <div className={`text-gisviz-accent font-bold italic tracking-wider lowercase font-[cursive] ${textClassName}`}>
        <span>gisviz</span>
        <span
          className="rounded-md bg-gisviz-infos px-[7px] py-[3px] text-[8px] font-medium leading-none tracking-[0.1em] text-gisviz-ink-soft"
          style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }}
        >
          beta
        </span>
      </div>
    </span>
  )
}