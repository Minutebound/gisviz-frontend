'use client'
import React, { useEffect, useState } from 'react'
import { TrendingUp, Users, UserPlus } from 'lucide-react'
import { gisvizApi } from '../../services/api'

interface Category { category_id: number; slug: string; label: string; usage_count: number }
interface Publisher { handle: string; avatar: string }

export default function Sidebar() {
  const [trending, setTrending] = useState<Category[]>([])
  const [publishers, setPublishers] = useState<Publisher[]>([])

  useEffect(() => {
    gisvizApi
      .listCategories()
      .then((data: Category[]) => setTrending(data.slice(0, 5)))
      .catch(() => setTrending([]))

    // Derive popular publishers from the current feed's authors until a
    // dedicated /users/popular endpoint exists.
    gisvizApi
      .fetchGlobalStream(0, 50)
      .then((posts: { author_handle: string; author_avatar_url: string }[]) => {
        const seen = new Map<string, Publisher>()
        for (const p of posts) {
          if (p.author_handle && !seen.has(p.author_handle)) {
            seen.set(p.author_handle, { handle: p.author_handle, avatar: p.author_avatar_url })
          }
        }
        setPublishers(Array.from(seen.values()).slice(0, 3))
      })
      .catch(() => setPublishers([]))
  }, [])

  return (
    <aside className="sticky top-24 h-[calc(100vh-8rem)] flex flex-col gap-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-6">

      {/* Trending categories */}
      <div className="flex-shrink-0 bg-gisviz-card border border-gisviz-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="flex items-center gap-2 p-5 pb-3 border-b border-gisviz-border/50 bg-gisviz-canvas/30">
          <TrendingUp className="w-5 h-5 text-gisviz-accent" />
          <h3 className="font-display font-bold text-gisviz-ink">Trending Categories</h3>
        </div>

        <div className="max-h-120 overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="space-y-1">
            {trending.length === 0 ? (
              <p className="text-xs text-gisviz-ink-soft p-3">No categories yet.</p>
            ) : (
              trending.map((cat) => (
                <div key={cat.category_id} className="flex justify-between items-center gap-2 p-3 rounded-xl group hover:bg-gisviz-canvas cursor-pointer transition-colors">
                  <p className="text-sm font-bold text-gisviz-ink group-hover:text-gisviz-accent transition-colors leading-tight">
                    {cat.label}
                  </p>
                  <p className="text-[10px] text-gisviz-ink-soft whitespace-nowrap font-mono">
                    {cat.usage_count} {cat.usage_count === 1 ? 'map' : 'maps'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Popular publishers */}
      <div className="flex-shrink-0 bg-gisviz-card border border-gisviz-border rounded-2xl shadow-sm flex flex-col">
        <div className="flex items-center gap-2 p-5 pb-3 border-b border-gisviz-border/50">
          <Users className="w-5 h-5 text-gisviz-accent" />
          <h3 className="font-display font-bold text-gisviz-ink">Popular Publishers</h3>
        </div>

        <div className="p-4 space-y-4">
          {publishers.length === 0 ? (
            <p className="text-xs text-gisviz-ink-soft">No publishers yet.</p>
          ) : (
            publishers.map((pub) => (
              <div key={pub.handle} className="flex items-center justify-between gap-3 group">
                <div className="flex items-center gap-3 min-w-0 cursor-pointer">
                  {pub.avatar ? (
                    <img src={pub.avatar} alt={pub.handle} className="w-10 h-10 rounded-full object-cover border border-gisviz-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full border border-gisviz-border bg-gisviz-rail-soft" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-mono text-gisviz-ink-soft truncate">@{pub.handle}</span>
                  </div>
                </div>

                <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-gisviz-ink border border-gisviz-border hover:border-gisviz-accent hover:text-gisviz-accent hover:bg-gisviz-rail-soft transition-all">
                  <UserPlus size={14} />
                  <span>Follow</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-3 gap-y-2 text-[11px] text-gisviz-ink-soft px-1">
          <a href="#" className="hover:text-gisviz-accent transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-gisviz-accent transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-gisviz-accent transition-colors">Cookie Policy</a>
          <a href="#" className="hover:text-gisviz-accent transition-colors">Accessibility</a>
          <span className="w-full mt-1">© 2026 gisviz Corp.</span>
        </div>
      </div>

    </aside>
  )
}