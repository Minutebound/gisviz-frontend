'use client'
import React, { useEffect, useState } from 'react'
import { TrendingUp, Users, UserPlus, ShieldCheck, ExternalLink } from 'lucide-react'
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

    // Derive popular publishers from the current feed's publishers until a
    // dedicated /users/popular endpoint exists.
    gisvizApi
      .fetchGlobalStream(0, 50)
      .then((posts: { publisher_handle: string; publisher_avatar_url: string }[]) => {
        const seen = new Map<string, Publisher>()
        for (const p of posts) {
          if (p.publisher_handle && !seen.has(p.publisher_handle)) {
            seen.set(p.publisher_handle, { handle: p.publisher_handle, avatar: p.publisher_avatar_url })
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

      {/* MINI NATIVE ADVERTISEMENT */}
      <div className="flex-shrink-0 relative bg-gisviz-rail border border-gisviz-border p-5 overflow-hidden flex flex-col group cursor-pointer shadow-sm">
        <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent/50 z-10 top-0 left-0 border-r-0 border-b-0 " />
        <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent/50 z-10 bottom-0 right-0 border-l-0 border-t-0" />
        
        <div className="flex justify-between items-start mb-3 z-10">
          <span className="font-mono text-[9px] tracking-[0.2em] text-gisviz-ink-soft uppercase border border-gisviz-border px-1.5 py-0.5">
            PROMOTED
          </span>
          <ShieldCheck className="w-4 h-4 text-gisviz-accent" />
        </div>
        
        <div className="relative z-10">
          <h4 className="font-display font-semibold text-sm text-white mb-1.5 leading-snug group-hover:text-gisviz-accent transition-colors">
            Enterprise Spatial Analytics
          </h4>
          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed font-sans">
            Process millions of coordinates in milliseconds. Upgrade your vector pipeline today.
          </p>
          <button className="flex items-center gap-1.5 font-mono text-[10px] border border-gisviz-accent bg-transparent text-gisviz-accent px-2.5 py-1.5 rounded-md hover:bg-gisviz-accent hover:text-white transition-colors w-max">
            <span>Explore</span>
            <ExternalLink size={11} />
          </button>
        </div>
        
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&fit=crop')] bg-cover bg-center opacity-[0.08] mix-blend-overlay pointer-events-none"></div>
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