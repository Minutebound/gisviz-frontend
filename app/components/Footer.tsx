import React from 'react'
import Link from 'next/link'
import Logo from './Logo'

const FOOTER_LINKS = [
  { href: '/legal/about', label: 'About Us' },
  { href: '/services', label: 'Our Services' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/cookies', label: 'Cookies' },
]

export default function Footer() {
  return (
    <footer className="w-full border-t border-gisviz-border bg-gisviz-card mt-auto shrink-0">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-[72px] py-8 sm:py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Brand & Copyright */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-4 text-center sm:text-left">

          <span className="text-[13px] text-gisviz-ink-soft mb-0.5">
            &copy; {new Date().getFullYear()} GisViz LLC All rights reserved.
          </span>
        </div>

        {/* Minimal Navigation */}
        <nav className="flex flex-wrap items-center justify-center md:justify-end gap-x-6 gap-y-3 text-[13.5px] font-medium text-gisviz-ink-soft">
          {FOOTER_LINKS.map(link => (
            <Link 
              key={link.href} 
              href={link.href}
              className="hover:text-gisviz-ink transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        
      </div>
    </footer>
  )
}