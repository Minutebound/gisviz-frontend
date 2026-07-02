'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation' // <-- Use the official Next.js hook
import { ChevronLeft } from 'lucide-react'

// 1. The navigation links to display
const navLinks = [
  { label: 'Back to Feed', href: '/', icon: <ChevronLeft size={14} /> },
  
]

// 2. Define the base paths where the SubNavbar should be visible.
const VISIBLE_ROUTES = [
     
  '/profile',  
  '/settings', 
  '/post/upload'    // Added /post/upload here so it explicitly shows up on the upload page
]

export default function SubNavbar() {
  const pathname = usePathname() || '/' // Safely fallback to '/' if null

  // 3. Check if the current URL matches any of our allowed routes
  const isStandardRoute = VISIBLE_ROUTES.some((route) => pathname.startsWith(route))
  
  const isRootHandleRoute = pathname !== '/' && pathname !== '/auth' && !pathname.startsWith('/api')

  // Determine final visibility
  const shouldShow = isStandardRoute || isRootHandleRoute

  if (!shouldShow) return null

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-5">
      <div className="flex items-center gap-4">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} legacyBehavior>
            <a className="inline-flex items-center gap-2 text-[12px] font-mono text-gisviz-ink-soft hover:text-gisviz-accent transition-colors">
              {link.icon} {link.label}
            </a>
          </Link>
        ))}
      </div>
    </div>
  )
}