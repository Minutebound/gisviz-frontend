'use client'

/**
 * NavigationProgress
 *
 * Renders a thin accent-colored bar at the very top of the viewport that
 * animates forward whenever Next.js App Router is navigating between routes.
 *
 * How it works:
 *  - Intercepts clicks on <a> tags (which Next.js <Link> components render).
 *  - Starts the bar immediately on click — before the new page JS has even
 *    loaded — so the user gets instant visual feedback.
 *  - Listens to pathname + searchParams changes to detect when navigation
 *    has completed and hides the bar.
 *
 * Usage: mount once inside RootLayout, above {children}:
 *   <NavigationProgress />
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const [completing, setCompleting] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(() => {
    // Clear any in-progress completion
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (timerRef.current) clearInterval(timerRef.current)

    setCompleting(false)
    setWidth(0)
    setVisible(true)

    // Slowly tick toward 85% — never reaches 100% until navigation completes
    let current = 0
    timerRef.current = setInterval(() => {
      current += Math.random() * 8 + 2   // random 2–10% increments
      if (current > 85) {
        current = 85
        clearInterval(timerRef.current!)
      }
      setWidth(current)
    }, 200)
  }, [])

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCompleting(true)
    setWidth(100)
    // Give the CSS transition time to reach 100%, then fade out
    hideTimerRef.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
      setCompleting(false)
    }, 400)
  }, [])

  // ── Detect link clicks to start the bar ──────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href) return
      // Only trigger for internal links (no protocol, no target="_blank")
      if (href.startsWith('/') && !target.getAttribute('target')) {
        start()
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [start])

  // ── Detect route completion ───────────────────────────────────────
  useEffect(() => {
    finish()
  }, [pathname, searchParams, finish])

  if (!visible) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none"
      aria-hidden="true"
    >
      <div
        style={{
          width: `${width}%`,
          transition: completing
            ? 'width 0.3s ease-out'
            : 'width 0.2s ease-in-out',
        }}
        className="h-full bg-gisviz-accent shadow-[0_0_8px_1px_var(--accent)]"
      />
    </div>
  )
}