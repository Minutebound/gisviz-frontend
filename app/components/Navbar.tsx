'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { Bell, Home, Compass, Map as MapIcon, Bookmark, Settings, Sun, Moon, Menu, X, Search } from 'lucide-react'
import Sidebar from './Sidebar'
import Logo from './Logo'

interface UserProfile {
  handle: string;
  avatar: string;
}

export default function Navbar() {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    handle: 'sujith_dev',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=sujith_dev`
  })

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

  useEffect(() => {
    axios.get('http://localhost:8001/api/v1/publications')
      .then(res => {
        const userPost = res.data.find((p: any) => p.author_handle === 'sujith_dev');
        if (userPost) {
          setCurrentUser({
            handle: userPost.author_handle,
            avatar: userPost.author_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userPost.author_handle}`
          })
        }
      })
      .catch(err => console.error("Error fetching user data:", err))
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
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

  return (
    <>
      <header className="sticky top-0 z-50 bg-[color-mix(in_srgb,var(--color-paper)_86%,transparent)] backdrop-blur-[10px] border-b border-gisviz-border transition-colors">
        <div className="max-w-[1280px] mx-auto px-[20px] h-[60px] flex items-center gap-[16px]">
          
          <button 
            className="lg:hidden flex items-center justify-center w-[38px] h-[38px] border border-gisviz-border bg-gisviz-surface rounded-md text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent transition-colors shrink-0"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={18} />
          </button>

          <Link href="/" className="flex items-center shrink-0">
             <Logo scale={2.5} className="min-w-max ml-2 sm:ml-6 mb-2" textClassName="hidden sm:block" />
          </Link>

          <div className="flex items-center gap-[10px] relative ml-auto shrink-0">
            
            <button 
              onClick={toggleTheme} 
              className="flex items-center justify-center w-[38px] h-[38px] border border-gisviz-border bg-gisviz-surface rounded-md text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent transition-colors"
            >
              {mounted ? (
                isDarkMode ? <Sun size={17} /> : <Moon size={17} />
              ) : (
                <div className="w-[17px] h-[17px] opacity-0" /> 
              )}
            </button>
            
            <button className="flex items-center justify-center w-[38px] h-[38px] border border-gisviz-border bg-gisviz-surface rounded-md text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent transition-colors">
              <Bell size={17} />
            </button>
            
            <div ref={dropdownRef} className="relative ml-[2px]">
              <img 
                src={currentUser.avatar}
                alt="Profile"
                className="w-[34px] h-[34px] rounded-full object-cover border border-gisviz-border cursor-pointer hover:border-gisviz-accent transition-colors bg-gisviz-surface"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              />

              {isProfileOpen && (
                <div className="absolute top-[46px] right-0 w-[220px] bg-gisviz-surface border border-gisviz-border rounded-md shadow-xl py-[6px] flex flex-col z-50">
                  <div className="px-[16px] py-[8px] border-b border-dashed border-gisviz-border mb-[4px] bg-gisviz-card/50">
                    <p className="text-[13px] font-semibold text-gisviz-ink leading-tight">Sujith</p>
                    <p className="font-mono text-[10.5px] text-gisviz-ink-soft mt-[2px]">@{currentUser.handle}</p>
                  </div>
                  <Link href="/" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-[10px] px-[16px] py-[8px] text-[13px] text-gisviz-ink hover:bg-gisviz-paper hover:text-gisviz-accent transition-colors">
                    <Home size={15}/> Home
                  </Link>
                  <Link href="#" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-[10px] px-[16px] py-[8px] text-[13px] text-gisviz-ink hover:bg-gisviz-paper hover:text-gisviz-accent transition-colors">
                    <Compass size={15}/> Explore
                  </Link>
                  <Link href={`/profile/${currentUser.handle}`} onClick={() => setIsProfileOpen(false)} className="flex items-center gap-[10px] px-[16px] py-[8px] text-[13px] text-gisviz-ink hover:bg-gisviz-paper hover:text-gisviz-accent transition-colors">
                    <MapIcon size={15}/> My Plates
                  </Link>
                  <Link href="#" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-[10px] px-[16px] py-[8px] text-[13px] text-gisviz-ink hover:bg-gisviz-paper hover:text-gisviz-accent transition-colors">
                    <Bookmark size={15}/> Saved
                  </Link>
                  <div className="border-t border-dashed border-gisviz-border my-[4px]"></div>
                  <Link href="#" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-[10px] px-[16px] py-[8px] text-[13px] text-gisviz-ink hover:bg-gisviz-paper hover:text-gisviz-accent transition-colors">
                    <Settings size={15}/> Settings
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-[320px] max-w-[86vw] bg-gisviz-paper h-full border-r border-gisviz-border shadow-2xl flex flex-col overflow-y-auto animate-[slide_0.18s_ease]">
            <div className="flex items-center justify-between p-[16px] mb-[18px]">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                 <Logo scale={1.8} className="min-w-max ml-2" /> 
              </Link>
              <button 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="flex items-center justify-center w-[38px] h-[38px] border border-gisviz-border bg-gisviz-surface rounded-md text-gisviz-ink hover:text-gisviz-accent hover:border-gisviz-accent transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-[16px] flex-1">
              <Sidebar />
            </div>
          </div>
          
          {/* Add the required slide animation for the drawer via standard Tailwind arbitrary values or global CSS if preferred, but doing inline injection here for safety: */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slide { from { transform: translateX(-12px); opacity: 0.6; } to { transform: none; opacity: 1; } }
          `}} />
        </div>
      )}
    </>
  )
}