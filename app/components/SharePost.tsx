'use client'

import React, { useState, useEffect } from 'react'
import { X, Link as LinkIcon, Check, Mail } from 'lucide-react'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  url: string
  title: string
}

// Custom lightweight SVG for X / Twitter
const TwitterIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
)

// Custom lightweight SVG for LinkedIn
const LinkedinIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
)

export default function SharePost({ isOpen, onClose, url, title }: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = 'auto' }
  }, [isOpen])

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Plate */}
      <div className="relative w-full max-w-md bg-gisviz-card border border-gisviz-border shadow-2xl rounded-sm p-6 plate-enter z-10">
        
        {/* Cartographic Marks
        <div className="reg-mark reg-tl"></div>
        <div className="reg-mark reg-tr"></div>
        <div className="reg-mark reg-bl"></div>
        <div className="reg-mark reg-br"></div> */}

        <div className="flex justify-between items-start mb-6">
          <h3 className="font-display font-bold text-xl text-gisviz-ink">Share Publication</h3>
          <button onClick={onClose} className="text-gisviz-ink-soft hover:text-gisviz-accent transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Direct Link Copy */}
          <div>
            <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">
              Direct Link
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 flex items-center overflow-hidden">
                <span className="text-sm font-mono text-gisviz-ink truncate">{url}</span>
              </div>
              <button 
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 bg-gisviz-accent text-white px-4 py-2 rounded-md hover:bg-opacity-90 transition-all font-mono text-sm shrink-0 shadow-sm w-28"
              >
                {copied ? <><Check size={16} /> Copied</> : <><LinkIcon size={16} /> Copy</>}
              </button>
            </div>
          </div>

          <div className="border-t border-gisviz-border"></div>

          {/* Social Routing */}
          <div>
            <label className="block text-xs font-mono text-gisviz-ink-soft mb-3 uppercase tracking-wider">
              Distribute Externally
            </label>
            <div className="grid grid-cols-3 gap-3">
              <a 
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-3 bg-gisviz-canvas border border-gisviz-border rounded-md hover:border-gisviz-accent hover:text-gisviz-accent text-gisviz-ink-soft transition-all"
              >
                <TwitterIcon size={20} />
                <span className="text-xs font-mono font-bold">X / Twitter</span>
              </a>
              <a 
                href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-3 bg-gisviz-canvas border border-gisviz-border rounded-md hover:border-gisviz-accent hover:text-gisviz-accent text-gisviz-ink-soft transition-all"
              >
                <LinkedinIcon size={20} />
                <span className="text-xs font-mono font-bold">LinkedIn</span>
              </a>
              <a 
                href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent("Check out this spatial dataset on gisviz: " + url)}`}
                className="flex flex-col items-center justify-center gap-2 p-3 bg-gisviz-canvas border border-gisviz-border rounded-md hover:border-gisviz-accent hover:text-gisviz-accent text-gisviz-ink-soft transition-all"
              >
                <Mail size={20} />
                <span className="text-xs font-mono font-bold">Email</span>
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}