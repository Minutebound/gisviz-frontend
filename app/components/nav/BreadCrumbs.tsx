'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home, Loader2 } from 'lucide-react'
import { gisvizApi } from '../../../connector/api' // Strictly requested import

export default function GlobalSubNav() {
  const pathname = usePathname()
  const [dynamicData, setDynamicData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Fetch dynamic metadata based on the route (e.g., Post Title & Category)
  useEffect(() => {
    if (!pathname) return

    if (pathname.startsWith('/post/')) {
      const segments = pathname.split('/')
      const id = segments[2]
      
      // Skip if it's the upload route or if we already have the data for this ID
      if (!id || id === 'upload' || dynamicData?.id === id) return 
      
      setLoading(true)
      gisvizApi.fetchPost(id)
        .then((post: any) => {
          setDynamicData({
            id: post.post_id,
            category: post.categories?.[0]?.label || 'General',
            catSlug: post.categories?.[0]?.slug || '',
            title: post.title
          })
        })
        .catch(() => setDynamicData({ id, title: 'Unavailable' }))
        .finally(() => setLoading(false))
    } else {
      // Clear dynamic data when leaving a dynamic route
      setDynamicData(null)
    }
  }, [pathname, dynamicData?.id])

  if (!pathname) return null
  if (pathname === '/') return null          // the feed has no breadcrumb

  // On these pages the bar is shown on mobile only (hidden from the sm breakpoint up, as before).
  const mobileOnly =
    pathname === '/' || pathname === '/auth' || pathname === '/services' ||
    pathname === '/datasets' || pathname.startsWith('/legal')

  // ── Route Logic Directory ──
  const crumbs: { label: string; href?: string }[] = []

  const pretty = (seg: string) => decodeURIComponent(seg).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (pathname === '/') {
    // Home: no trailing crumbs, the Feed label itself is the current page
  }
  else if (pathname === '/auth') {
    crumbs.push({ label: 'Sign in' })
  }
  else if (pathname === '/services') {
    crumbs.push({ label: 'Services' })
  }
  else if (pathname === '/datasets') {
    crumbs.push({ label: 'Datasets' })
  }
  else if (pathname.startsWith('/admin/datasets')) {
    crumbs.push({ label: 'Admin', href: '/admin' })
    crumbs.push({ label: 'Datasets', href: '/admin/datasets' })
  }
  else if (pathname.startsWith('/legal')) {
    crumbs.push({ label: 'Legal', href: '/legal' })
    const rest = pathname.split('/').filter(Boolean).slice(1)
    if (rest.length) crumbs.push({ label: pretty(rest[rest.length - 1]) })
  }
  else if (pathname.startsWith('/post/upload')) {
    crumbs.push({ label: 'Publications' })
    crumbs.push({ label: 'New Post', href: '/post/upload' })
  }
  else if (pathname.startsWith('/settings')) {
    crumbs.push({ label: 'Account' })
    crumbs.push({ label: 'Settings', href: '/settings' })
  } 
  else if (pathname.startsWith('/profile/')) {
    const handle = pathname.split('/')[2]
    crumbs.push({ label: 'Profile' })
    crumbs.push({ label: `@${handle}`, href: `/profile/${handle}` })
  } 
  else if (pathname.startsWith('/publish')) {
    crumbs.push({ label: 'Publications' })
    crumbs.push({ label: 'Publish Post', href: '/publish' })
  } 
  else if (pathname.startsWith('/post/')) {
    const segments = pathname.split('/')
    const id = segments[2]
    const isEdit = segments[3] === 'edit'

    if (loading) {
      crumbs.push({ label: 'Loading...', href: '' })
    } else if (dynamicData) {
      crumbs.push({ label: dynamicData.category, href: `/?category=${dynamicData.catSlug}` })
      crumbs.push({ label: dynamicData.title, href: `/post/${id}` })
      if (isEdit) crumbs.push({ label: 'Edit', href: `/post/${id}/edit` })
    } else {
      crumbs.push({ label: 'Post', href: `/post/${id}` })
    }
  } 
  else {
    // Fallback for unknown routes
    const fallback = pathname.split('/').filter(Boolean).pop()
    if (fallback) crumbs.push({ label: fallback.charAt(0).toUpperCase() + fallback.slice(1) })
  }

  return (
    <div className={`w-full border-b border-gisviz-border/60 z-40 ${mobileOnly ? 'sm:hidden' : ''}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-8 lg:px-[72px] h-11 flex items-center">
        
        <nav 
          className="flex items-center gap-1.5 sm:gap-2 text-[12.5px] font-medium text-gisviz-ink-soft overflow-x-auto whitespace-nowrap"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style dangerouslySetInnerHTML={{ __html: `nav::-webkit-scrollbar { display: none; }`}} />
          
          <Link href="/" className="flex items-center gap-1.5 hover:text-gisviz-accent transition-colors shrink-0">
            <Home size={14} className="mb-[1px]" />
            <span className={crumbs.length === 0 ? 'text-gisviz-ink font-semibold' : 'hidden sm:inline'}>Feed</span>
          </Link>

          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1

            return (
              <React.Fragment key={index}>
                <ChevronRight size={14} className="text-gisviz-border shrink-0" />
                
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} className="hover:text-gisviz-accent transition-colors shrink-0">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={`shrink-0 truncate max-w-[160px] sm:max-w-[300px] ${isLast ? 'text-gisviz-ink font-semibold' : ''}`}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            )
          })}
        </nav>

      </div>
    </div>
  )
}