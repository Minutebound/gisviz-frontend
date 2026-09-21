'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Footer from './Footer'

export default function ConditionalFooter() {
  const pathname = usePathname()

  // Define the base routes where the footer SHOULD appear.
  // We exclude '/' (Feed), '/post/[id]' (Map View), and '/auth'.
  const SHOW_FOOTER_ON = [
    '/datasets',
    '/services',
    '/settings',
    '/profile',
    '/admin',
    '/'
  ]

  const shouldShow = SHOW_FOOTER_ON.some(route => pathname.startsWith(route))

  if (!shouldShow) return null

  return <Footer />
}