'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, Home, Compass, Map as MapIcon, Bookmark, Settings, LogOut, Sun, Moon, Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import Logo from './Logo'
import { useAuth } from '../../context/AuthContext'

export default function Navbar() {
  const { userHandle, isAuthenticated, logoutSession } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [isDarkMode, setIsDarkMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedTheme = localStorage.getItem('theme')
    if (storedTheme === 'dark') {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    } else {
      setIsDarkMode(false)
      document.documentElement.classList.remove('dark')
      if (!storedTheme) localStorage.setItem('theme', 'light')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDarkMode
    setIsDarkMode(newTheme)
    if (newTheme) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const displayHandle = userHandle ?? 'guest'

  return (
    <>
      <header className="sticky top-0 z-50 bg-gisviz-canvas/80 backdrop-blur-md border-b border-gisviz-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

          <button
            className="lg:hidden p-2 -ml-2 text-gisviz-ink-soft hover:text-gisviz-accent rounded-full transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <Logo className="min-w-max" textClassName="hidden sm:block text-xl" />

          <div className="flex items-center gap-3 relative ml-auto">

            <button
              onClick={toggleTheme}
              className="p-2 text-gisviz-ink-soft hover:text-gisviz-accent rounded-full transition-colors flex items-center justify-center w-9 h-9"
            >
              {mounted ? (
                isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
              ) : (
                <div className="w-5 h-5 opacity-0" />
              )}
            </button>

            <button className="p-2 text-gisviz-ink-soft hover:text-gisviz-accent rounded-full transition-colors">
              <Bell className="w-5 h-5" />
            </button>

            <div
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-gisviz-accent to-emerald-300 border border-gisviz-border cursor-pointer"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            ></div>

            {isProfileOpen && (
              <div className="absolute top-12 right-0 w-56 bg-gisviz-card border border-gisviz-border rounded-xl shadow-lg py-2 flex flex-col z-50">
                <div className="px-4 py-2 border-b border-gisviz-border mb-2">
                  <p className="text-sm font-bold text-gisviz-ink">@{displayHandle}</p>
                  <p className="text-xs text-gisviz-ink-soft">
                    {isAuthenticated ? 'Signed in' : 'Not signed in'}
                  </p>
                </div>
                <Link href="/" className="flex items-center gap-3 px-4 py-2 hover:bg-gisviz-canvas hover:text-gisviz-accent text-sm text-gisviz-ink"><Home size={16} /> Home</Link>
                <Link href="#" className="flex items-center gap-3 px-4 py-2 hover:bg-gisviz-canvas hover:text-gisviz-accent text-sm text-gisviz-ink"><Compass size={16} /> Explore</Link>
                <Link href="#" className="flex items-center gap-3 px-4 py-2 hover:bg-gisviz-canvas hover:text-gisviz-accent text-sm text-gisviz-ink"><MapIcon size={16} /> My Maps</Link>
                <Link href="#" className="flex items-center gap-3 px-4 py-2 hover:bg-gisviz-canvas hover:text-gisviz-accent text-sm text-gisviz-ink"><Bookmark size={16} /> Saved</Link>
                <div className="border-t border-gisviz-border my-2"></div>
                <Link href="#" className="flex items-center gap-3 px-4 py-2 hover:bg-gisviz-canvas hover:text-gisviz-accent text-sm text-gisviz-ink"><Settings size={16} /> Settings</Link>
                {isAuthenticated && (
                  <button
                    onClick={() => { logoutSession(); setIsProfileOpen(false) }}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gisviz-canvas hover:text-gisviz-accent text-sm text-gisviz-ink text-left"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-80 max-w-[85vw] bg-gisviz-canvas h-full border-r border-gisviz-border shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gisviz-border">
              <div className="font-display font-bold text-gisviz-ink text-lg flex items-center gap-2">
                <Logo scale={1.5} />
                <span>Discover</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gisviz-ink-soft hover:text-gisviz-accent rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <Sidebar />
            </div>
          </div>
        </div>
      )}
    </>
  )
}