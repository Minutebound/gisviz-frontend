import React from 'react'

interface LogoProps {
  className?: string
  /** Kept so existing callers keep working; the size now comes from `height`. */
  textClassName?: string
  scale?: number
  /** Height of the wordmark in px (width follows the picture's 1078 x 321 shape). */
  height?: number
}

/**
 * The gisviz wordmark: orange calligraphic italic "gisviz" with a small grey "beta".
 * It is a picture (public/gisviz-wordmark.png, transparent, drawn at 2x) because that lettering is not
 * in the site's font list (Instrument Sans, Space Grotesk, JetBrains Mono, Barlow Condensed).
 */
export default function Logo({ className = '', scale = 1, height = 40 }: LogoProps) {
  return (
    <span
      style={{ transform: `scale(${scale})`, transformOrigin: 'left center' }}
      className={`group inline-flex items-center transition-opacity hover:opacity-80 ${className}`}
    >
      <img
        src="/gisviz-wordmark.png"
        alt="gisviz beta, home"
        width={Math.round((height * 1078) / 321)}
        height={height}
        draggable={false}
        style={{ height, width: 'auto' }}
        className="block select-none"
      />
    </span>
  )
}
