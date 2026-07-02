'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2, MapPin } from 'lucide-react'
import { gisvizApi } from '@/services/api'

interface SearchResult {
  post_id: string;
  title: string;
  description: string;
  publisher_handle: string;
  categories: { label: string }[];
  share_slug: string;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
      setQuery('')
      setResults([])
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    const delayDebounceFn = setTimeout(async () => {
      try {
        // Updated API call using your new instance
        const data = await gisvizApi.searchPosts(query)
        setResults(data)
      } catch (error) {
        console.error("Search failed:", error)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  const handleResultClick = (slug: string) => {
    onClose()
    router.push(`/p/${slug}`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-32 px-4 backdrop-blur-sm bg-black/40">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <Search className="w-5 h-5 text-zinc-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search posts, maps, and categories..."
            className="flex-1 bg-transparent outline-none text-[16px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          ) : (
            <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {query.trim() && results.length === 0 && !isLoading && (
            <div className="py-14 text-center text-zinc-500">
              No results found for "{query}"
            </div>
          )}

          {results.length > 0 && (
            <ul className="p-2 space-y-1">
              {results.map((post) => (
                <li key={post.post_id}>
                  <button
                    onClick={() => handleResultClick(post.share_slug)}
                    className="w-full flex items-start text-left px-4 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-zinc-900 dark:text-white truncate">
                          {post.title}
                        </span>
                        <span className="text-xs text-zinc-500">@{post.publisher_handle}</span>
                      </div>
                      <p className="text-[12px] text-zinc-500 truncate">
                        {post.description}
                      </p>
                      
                      {post.categories.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {post.categories.slice(0, 3).map((cat, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-gisviz-safe/5  text-gisviz-safe/70       dark:bg-gisviz-safe/90       /30 dark:text-gisviz-safe-400">
                              <MapPin className="w-3 h-3 mr-1" />
                              {cat.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}