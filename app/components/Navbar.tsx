'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Home, User, LogOut, Sun, Moon, Menu, X, LogIn, Settings } from 'lucide-react'
import Sidebar from './Sidebar'
import Logo from './Logo'
import { useAuth } from '../../context/AuthContext'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export default function Navbar() {
  // Added isLoading to safely check hydration state
  const { user, isAuthenticated, logoutSession, isLoading } = useAuth()
  
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Wait until mounted to avoid hydration mismatch
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }

    if (isProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isProfileOpen])

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

  const displayHandle = user?.user_handle ?? 'guest'
  const avatarUrl = user?.avatar_path ? `${API_BASE_URL}${user.avatar_path}` : null

  return (
    <>
      <header className="sticky top-0 z-50 bg-gisviz-canvas/80 backdrop-blur-md border-b border-gisviz-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

          <button
            className="lg:hidden p-2 -ml-2 text-gisviz-ink-soft hover:text-gisviz-accent rounded-full transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open Mobile Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity min-w-max">
            <Logo scale={1.7} className="min-w-max" textClassName="hidden sm:block text-xl" />
          </Link>

          <div className="flex items-center gap-4 relative ml-auto">

            <button
              onClick={toggleTheme}
              className="p-2 text-gisviz-ink-soft hover:text-gisviz-accent rounded-full transition-colors flex items-center justify-center w-9 h-9"
              aria-label="Toggle Theme"
            >
              {mounted ? (
                isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
              ) : (
                <div className="w-5 h-5 opacity-0" />
              )}
            </button>

            {/* HYDRATION FIX: Wait for mount and AuthContext to finish loading */}
            {!mounted || isLoading ? (
              <div className="w-8 h-8 rounded-full bg-gisviz-border animate-pulse" />
            ) : isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <div
                  className="w-8 h-8 rounded-full border border-gisviz-border cursor-pointer shadow-sm overflow-hidden flex items-center justify-center bg-gisviz-canvas hover:ring-2 hover:ring-gisviz-accent hover:ring-offset-2 hover:ring-offset-gisviz-canvas transition-all relative"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  aria-label="Toggle Profile Menu"
                >
                  {avatarUrl && !imageError ? (
                    <img 
                      src={avatarUrl} 
                      alt={displayHandle} 
                      className="w-full h-full object-cover" 
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-gisviz-accent to-emerald-400 flex items-center justify-center text-white text-xs font-bold uppercase font-mono shadow-inner">
                      {displayHandle.charAt(0)}
                    </div>
                  )}
                </div>

                {isProfileOpen && (
                  <div className="absolute top-12 right-0 w-52 bg-gisviz-card border border-gisviz-border rounded-xl shadow-lg py-2 flex flex-col z-50 plate-enter">
                    <div className=" text-sm px-4 py-2 border-b border-gisviz-border mb-2">
                     User handle <p className="font-bold text-gisviz-accent/80">@{displayHandle}</p>
                    </div>
                    
                    <Link 
                      href="/" 
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gisviz-canvas hover:text-gisviz-accent text-sm text-gisviz-ink transition-colors"
                    >
                      <Home size={16} /> Home
                    </Link>
                    
                    <Link 
                      href={`/profile/${displayHandle}`} 
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gisviz-canvas hover:text-gisviz-accent text-sm text-gisviz-ink transition-colors"
                    >
                      <User size={16} /> Profile
                    </Link>

                    <div className="border-t border-gisviz-border my-2"></div>
                    
                    <Link 
                      href="/settings" 
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gisviz-canvas hover:text-gisviz-accent text-sm text-gisviz-ink transition-colors"
                    >
                      <Settings size={16} /> Settings
                    </Link>

                    <button
                      onClick={() => { logoutSession(); setIsProfileOpen(false) }}
                      className="flex items-center w-full gap-3 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 text-sm text-gisviz-ink text-left transition-colors"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth"
                className="flex items-center gap-2 px-5 py-2 bg-gisviz-accent text-white rounded-md hover:bg-opacity-90 transition-all font-mono text-sm shadow-sm"
              >
                <LogIn size={16} />
                <span className="hidden sm:inline">Log in / Sign up</span>
                <span className="sm:hidden">Log in</span>
              </Link>
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
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="font-display font-bold text-gisviz-ink text-lg flex items-center gap-2">
                <Logo scale={1.5} />
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gisviz-ink-soft hover:text-gisviz-accent rounded-full">
                <X className="w-5 h-5" />
              </button>
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