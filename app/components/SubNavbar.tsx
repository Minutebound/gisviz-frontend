'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

// 1. The navigation links to display
const navLinks = [
  { label: 'Back to Feed', href: '/', icon: <ChevronLeft size={14} /> },
  
]

// 2. Define the base paths where the SubNavbar should be visible.
// Because it uses `.startsWith()`, adding '/post' will automatically 
// cover all dynamic post routes like '/post/123' or '/post/[id]'.
const VISIBLE_ROUTES = [
  '/post',     // Displays on all single publication pages
  '/profile',  // Displays on /profile/[handle] (if you use a /profile/ prefix)
  '/settings', // Displays on the settings page
]

export default function SubNavbar() {
  const pathname = usePathname()

  // 3. Check if the current URL matches any of our allowed routes
  const isStandardRoute = VISIBLE_ROUTES.some((route) => pathname.startsWith(route))
  
  // NOTE: If your profile pages are hosted directly at the root (e.g., `/[handle]`)
  // rather than `/profile/[handle]`, you can use an exclusion check instead to ensure 
  // it shows on handles but hides on the main feed and auth pages:
  const isRootHandleRoute = pathname !== '/' && pathname !== '/auth' && !pathname.startsWith('/api')

  // Determine final visibility
  const shouldShow = isStandardRoute || isRootHandleRoute // Remove `|| isRootHandleRoute` if you explicitly use /profile/[handle]

  // If the current path is not in the array, render nothing (null)
  if (!shouldShow) return null

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 mb-2">
      <div className="flex items-center gap-6">
        {navLinks.map((link) => (
          <Link 
            key={link.href}
            href={link.href} 
            className="inline-flex items-center gap-2 text-xs font-mono text-gisviz-ink-soft hover:text-gisviz-accent transition-colors"
          >
            {link.icon} {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}