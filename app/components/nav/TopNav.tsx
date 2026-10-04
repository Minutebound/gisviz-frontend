'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Menu, X, User, Settings, ShieldCheck, LogOut, LifeBuoy, LogIn } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import Logo from '../Logo'
import ThemeToggle from '../ThemeToggle'
import { SupportPopup } from '../SupportPopup'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

const NAV_LINKS = [
  { href: '/',          label: 'Feed' },
  { href: '/datasets',  label: 'Datasets' },
  { href: '/services',  label: 'Services' },
] as const

const LEGAL_LINKS = [
  { href: '/legal/about', label: 'About' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/cookies', label: 'Cookies' },
  { href: '/legal/accessibility', label: 'Accessibility' },
]

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, logoutSession, isLoading } = useAuth() as any
  
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isSupportOpen, setIsSupportOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  
  const [localHandle, setLocalHandle] = useState<string | null>(null)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLocalHandle(localStorage.getItem('gisviz_handle'))
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [mobileOpen])

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  const displayHandle = user?.user_handle ?? user?.handle ?? user?.username ?? localHandle ?? 'guest'
  const profileHref = displayHandle !== 'guest' ? `/profile/${displayHandle}` : '#'
  const profileInitials = displayHandle.charAt(0).toUpperCase()
  const avatarUrl = user?.avatar_path ? `${API_BASE_URL}${user.avatar_path}` : null

  const handleLogout = () => {
    setProfileOpen(false)
    setMobileOpen(false)
    if (logoutSession) {
      logoutSession()
    } else {
      localStorage.removeItem('gisviz_token')
      localStorage.removeItem('gisviz_handle')
      window.location.href = '/auth'
    }
  }

  const dropdownItemClass = "w-full text-left px-4 py-2.5 text-[14px] font-medium text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent transition-colors flex items-center gap-3"
  const mobileItemClass = "block w-full text-left py-3.5 px-6 text-[16px] font-medium text-gisviz-ink hover:bg-gisviz-canvas hover:text-gisviz-accent transition-colors"

  return (
    <>
      {/* ── Forced z-[100] to sit above ALL feed content and category bars ── */}
      <header className="w-full relative top-0 z-[100] bg-gisviz-card border-b border-gisviz-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-[72px] h-[72px] flex items-center gap-6 lg:gap-10">

          <Link href="/" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
            {NAV_LINKS.map(({ href, label }) => {
              const on = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className={`relative text-[14.5px] transition-colors ${
                    on ? 'font-semibold text-gisviz-ink' : 'font-medium text-gisviz-ink-soft hover:text-gisviz-ink'
                  }`}
                >
                  {label}
                  {on && <span className="absolute -bottom-[25px] left-0 right-0 h-[2px] bg-gisviz-accent" />}
                </Link>
              )
            })}
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />

            {isAuthenticated && (
              <button type="button" aria-label="Notifications" className="hidden sm:grid w-10 h-10 place-items-center rounded-[10px] border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-ink transition-colors">
                <Bell size={17} />
              </button>
            )}

            {isLoading ? (
              <div className="w-9 h-9 rounded-full bg-gisviz-border animate-pulse" />
            ) : isAuthenticated ? (
              <div className="relative hidden md:block" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  aria-label="Toggle Profile Menu"
                  aria-expanded={profileOpen}
                  className="w-9 h-9 shrink-0 rounded-full border border-gisviz-border bg-gisviz-rail-soft flex items-center justify-center text-[13px] font-semibold text-gisviz-ink hover:ring-2 hover:ring-gisviz-accent hover:ring-offset-2 hover:ring-offset-gisviz-card transition-all focus:outline-none overflow-hidden"
                >
                  {avatarUrl && !imageError ? (
                    <img src={avatarUrl} alt={displayHandle} className="w-full h-full object-cover" onError={() => setImageError(true)} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-gisviz-accent to-gisviz-safe flex items-center justify-center text-[color:var(--accent-on)] shadow-inner">
                      {profileInitials}
                    </div>
                  )}
                </button>

                {/* ── Dropdown forced to z-[110] ── */}
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gisviz-border bg-gisviz-card shadow-lg py-2 flex flex-col z-[110] animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 pb-3 pt-1 border-b border-gisviz-border">
                      <p className="text-[12px] font-medium text-gisviz-ink-soft">Signed in as</p>
                      <p className="font-bold text-[15px] text-gisviz-ink truncate">@{displayHandle}</p>
                    </div>

                    <div className="py-1 border-b border-gisviz-border">
                      <Link href={profileHref} onClick={() => setProfileOpen(false)} className={dropdownItemClass}>
                        <User size={16} className="text-gisviz-ink-soft" /> Profile
                      </Link>
                      <Link href="/settings" onClick={() => setProfileOpen(false)} className={dropdownItemClass}>
                        <Settings size={16} className="text-gisviz-ink-soft" /> Settings
                      </Link>
                      {(user?.role_name === 'admin' || user?.role === 'admin' || user?.is_admin || user?.is_superuser) && (
                        <Link href="/admin" onClick={() => setProfileOpen(false)} className={dropdownItemClass}>
                          <ShieldCheck size={16} className="text-gisviz-ink-soft" /> Admin Panel
                        </Link>
                      )}
                    </div>
                    
                    <div className="py-1">
                      <button type="button" onClick={() => { setProfileOpen(false); setIsSupportOpen(true); }} className={dropdownItemClass}>
                        <LifeBuoy size={16} className="text-gisviz-ink-soft" /> Support
                      </button>
                      <button type="button" onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-gisviz-alert hover:bg-gisviz-alert/10 transition-colors flex items-center gap-3">
                        <LogOut size={16} className="text-gisviz-alert" /> Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/auth" className="hidden md:flex items-center gap-2 h-10 px-5 rounded-[10px] bg-gisviz-accent text-[color:var(--accent-on)] text-[14.5px] font-semibold hover:brightness-110 transition-[filter] shadow-sm">
                <LogIn size={16} />
                <span>Log in / Sign up</span>
              </Link>
            )}

            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="md:hidden w-10 h-10 grid place-items-center rounded-[10px] border border-gisviz-border text-gisviz-ink">
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Side Drawer forced to z-[120] ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end md:hidden">
          <div className="absolute inset-0 bg-gisviz-black/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMobileOpen(false)} />
          
          <nav className="relative w-[80vw] max-w-[340px] h-full bg-gisviz-card border-l border-gisviz-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 h-[72px] shrink-0 border-b border-gisviz-border">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-full border border-gisviz-border bg-gisviz-rail-soft flex items-center justify-center text-[13px] font-semibold text-gisviz-ink overflow-hidden">
                    {avatarUrl && !imageError ? (
                      <img src={avatarUrl} alt={displayHandle} className="w-full h-full object-cover" onError={() => setImageError(true)} />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-gisviz-accent to-gisviz-safe flex items-center justify-center text-[color:var(--accent-on)] shadow-inner">{profileInitials}</div>
                    )}
                  </div>
                  <span className="font-bold text-[15px] text-gisviz-ink truncate">@{displayHandle}</span>
                </div>
              ) : (
                <span className="font-display font-bold text-[18px] text-gisviz-ink">Menu</span>
              )}
              
              <button type="button" onClick={() => setMobileOpen(false)} className="w-10 h-10 grid place-items-center rounded-[10px] border border-gisviz-border text-gisviz-ink hover:bg-gisviz-canvas transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              <div className="pb-2 border-b border-gisviz-border">
                {NAV_LINKS.map(({ href, label }) => (
                  <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`${mobileItemClass} ${isActive(href) ? 'text-gisviz-accent-text font-bold' : ''}`}>
                    {label}
                  </Link>
                ))}
              </div>
              <div className="py-2">
                {isAuthenticated ? (
                  <>
                    <Link href="/post/upload" onClick={() => setMobileOpen(false)} className={mobileItemClass}>Publish map</Link>
                    <Link href={profileHref} onClick={() => setMobileOpen(false)} className={mobileItemClass}>Profile</Link>
                    <Link href="/settings" onClick={() => setMobileOpen(false)} className={mobileItemClass}>Settings</Link>
                    {(user?.role_name === 'admin' || user?.role === 'admin' || user?.is_admin || user?.is_superuser) && (
                      <Link href="/admin" onClick={() => setMobileOpen(false)} className={mobileItemClass}>Admin panel</Link>
                    )}
                    <button type="button" onClick={() => { setMobileOpen(false); setIsSupportOpen(true); }} className={mobileItemClass}>Support</button>
                    <button type="button" onClick={handleLogout} className={`block w-full text-left py-3.5 px-6 text-[16px] font-medium text-gisviz-alert hover:bg-gisviz-alert/10 transition-colors`}>Log out</button>
                  </>
                ) : (
                  <Link href="/auth" onClick={() => setMobileOpen(false)} className={mobileItemClass}>Log in / Sign up</Link>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gisviz-border bg-gisviz-paper/50 shrink-0">
              <div className="flex flex-wrap gap-x-5 gap-y-3 text-[13.5px] font-medium text-gisviz-ink-soft">
                {LEGAL_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="hover:text-gisviz-ink transition-colors">
                    {link.label}
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-gisviz-ink-soft/70">
                &copy; {new Date().getFullYear()} GisViz LLC All rights reserved.
              </p>
            </div>
          </nav>
        </div>
      )}

      <SupportPopup isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </>
  )
}