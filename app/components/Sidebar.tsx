'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Users, UserPlus, ShieldCheck, ExternalLink, UserCheck, UserMinus, LucideUserCheck } from 'lucide-react'
import { gisvizApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface Category { category_id: number; slug: string; label: string; usage_count: number }
interface Publisher { user_id: string; user_handle: string; avatar_path: string | null; follower_count: number; is_followed: boolean }

export default function Sidebar() {
  const [trending, setTrending] = useState<Category[]>([])
  const [publishers, setPublishers] = useState<Publisher[]>([])
  
  // Destructure from auth context so we don't have to do a redundant API call
  const { user, isAuthenticated } = useAuth() as any;

  const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL ;
  // Strip '/api/v0' explicitly to target the base mount where '/post/uploads' lives
  const API_BASE_URL = `${RAW_API_URL}`.replace('/api/v0', '');

useEffect(() => {
  gisvizApi
    .listCategories()
    .then((data: Category[]) => {
      const sorted = data
        .filter((c) => c.usage_count > 0)
        .sort((a, b) => b.usage_count - a.usage_count)
      setTrending(sorted.slice(0, 5))
    })
    .catch(() => setTrending([]))
}, [])

useEffect(() => {
  const loadPublishers = async () => {
    try {
      const currentUserId = isAuthenticated && user ? user.user_id : undefined
      const popularData = await gisvizApi.getPopularPublishers(50, currentUserId)
      setPublishers(popularData.filter((p: any) => p.follower_count >= 1))
    } catch (err) {
      console.error('Failed to load publishers', err)
      setPublishers([])
    }
  }

  loadPublishers()
}, [isAuthenticated, user])

  // Handle follow/unfollow with instant UI update + DB Sync
  const handleFollowToggle = async (e: React.MouseEvent, targetUserId: string, currentlyFollowing: boolean) => {
    e.preventDefault(); // Stop click from bubbling up if wrapped improperly

    if (!isAuthenticated) {
      alert("Please log in to follow publishers.");
      return;
    }
    
    // Optimistic UI Update: Flip it immediately so it feels fast
    setPublishers((prev) => prev.map(p => {
      if (p.user_id === targetUserId) {
        return { 
          ...p, 
          is_followed: !currentlyFollowing, 
          follower_count: p.follower_count + (currentlyFollowing ? -1 : 1) 
        };
      }
      return p;
    }));

    // Real Database Sync
    try {
      if (currentlyFollowing) {
        await gisvizApi.unfollowUser(targetUserId);
      } else {
        await gisvizApi.followUser(targetUserId);
      }
    } catch (error) {
      console.error("Failed to toggle follow", error);
      // Revert UI on failure so they aren't out of sync with DB
      setPublishers((prev) => prev.map(p => {
        if (p.user_id === targetUserId) {
          return { 
            ...p, 
            is_followed: currentlyFollowing, 
            follower_count: p.follower_count + (currentlyFollowing ? 1 : -1) 
          };
        }
        return p;
      }));
    }
  };

  // Ensure robust formatting to prevent 404 double slashes (http://url.com//post/uploads/...)
  const getAvatarUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path; // Already full external URL
    
    const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const safePath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${safePath}`;
  };

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
              <p className="text-[12px] text-gisviz-ink-soft p-3">No categories yet.</p>
            ) : (
              trending.map((cat) => (
                <div key={cat.category_id} className="flex justify-between items-center gap-2 p-3 rounded-xl group hover:bg-gisviz-canvas cursor-pointer transition-colors">
                  <p className="text-[16px] font-bold text-gisviz-ink group-hover:text-gisviz-accent transition-colors leading-tight">
                    {cat.label}
                  </p>
                  <p className="text-[12px] text-gisviz-ink-soft whitespace-nowrap font-mono">
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
        <div className="flex items-center justify-between p-5 pb-3 border-b border-gisviz-border/50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gisviz-accent" />
            <h3 className="font-display font-bold text-gisviz-ink">Top Publishers</h3>
          </div>
        </div>

        {/* This div applies the max-height and custom scrollbar for up to 50 users */}
        <div className="p-4 space-y-4 max-h-[350px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gisviz-border [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
          {publishers.length === 0 ? (
            <p className="text-[12px] text-gisviz-ink-soft">Popular publishers coming soon.</p>
          ) : (
            publishers.map((pub) => {
              // Check if the current publisher is the logged-in user
              const isSelf = isAuthenticated && user && user.user_id === pub.user_id;

              return (
                <div key={pub.user_id} className="flex items-center justify-between gap-3 group">
                  
                  {/* Wrap only the Avatar/Name in the Link to prevent mis-clicks */}
                  <Link href={`/profile/${pub.user_handle}`} className="flex items-center gap-3 min-w-0 cursor-pointer flex-1">
                    {pub.avatar_path ? (
                      <>
                        <img 
                          src={getAvatarUrl(pub.avatar_path) as string} 
                          alt={pub.user_handle} 
                          className="w-10 h-10 rounded-full object-cover border border-gisviz-border flex-shrink-0" 
                          onError={(e) => {
                            // Fallback gracefully if image still fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            e.currentTarget.nextElementSibling?.classList.add('flex');
                          }}
                        />
                      </>
                    ) : (
                      <div className="w-10 h-10 rounded-full border border-gisviz-border bg-gradient-to-tr from-gisviz-accent to-gisviz-safe 0 flex items-center justify-center text-gisviz-white text-[16px] font-bold uppercase font-mono shadow-inner flex-shrink-0">
                        {pub.user_handle.charAt(0)}
                      </div>
                    )}
                    
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12px] font-mono font-bold text-gisviz-ink hover:text-gisviz-accent transition-colors truncate">
                        @{pub.user_handle}
                      </span>
                      <span className="text-[12px] text-gisviz-ink-soft">
                        {pub.follower_count} {pub.follower_count === 1 ? 'follower' : 'followers'}
                      </span>
                    </div>
                  </Link>

                  {/* Follow / Unfollow Button (Hidden if isSelf is true) */}
                  {!isSelf && (
                    <button 
                      onClick={(e) => handleFollowToggle(e, pub.user_id, pub.is_followed)}
                      title={pub.is_followed ? "Unfollow" : "Follow"}
                      className={`group/btn flex items-center justify-center w-10 h-8 rounded-full transition-all flex-shrink-0 border shadow-sm ${
                        pub.is_followed 
                          ? 'bg-gisviz-rail-soft text-gisviz-ink border-transparent hover:border-gisviz-alert/60 hover:text-gisviz-alert hover:bg-gisviz-alert/10' 
                          : 'bg-transparent text-gisviz-ink border-gisviz-border hover:border-gisviz-accent hover:text-gisviz-accent hover:bg-gisviz-rail-soft'
                      }`}
                    >
                      {pub.is_followed ? (
                        <>
                          <LucideUserCheck size={18} className="block group-hover/btn:hidden" />
                          <UserMinus size={18} className="hidden group-hover/btn:block" />
                        </>
                      ) : (
                        <UserPlus size={18} />
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MINI NATIVE ADVERTISEMENT
      <div className="flex-shrink-0 relative bg-gisviz-rail border border-gisviz-border p-5 overflow-hidden flex flex-col group cursor-pointer shadow-sm mt-4">
        <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent/50 z-10 top-0 left-0 border-r-0 border-b-0 " />
        <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent/50 z-10 bottom-0 right-0 border-l-0 border-t-0" />
        
        <div className="flex justify-between items-start mb-3 z-10">
          <span className="font-mono text-[12px] tracking-[0.2em] text-gisviz-ink-soft uppercase border border-gisviz-border px-1.5 py-0.5">
            PROMOTED
          </span>
          <ShieldCheck className="w-4 h-4 text-gisviz-accent" />
        </div>
        
        <div className="relative z-10">
          <h4 className="font-display font-semibold text-[12px] text-gisviz-white mb-1.5 leading-snug group-hover:text-gisviz-accent transition-colors">
            Enterprise Spatial Analytics
          </h4>
          <p className="text-[12px] text-slate-400 mb-3 leading-relaxed font-sans">
            Process millions of coordinates in milliseconds. Upgrade your vector pipeline today.
          </p>
          <button className="flex items-center gap-1.5 font-mono text-[12px] border border-gisviz-accent bg-transparent text-gisviz-accent px-2.5 py-1.5 rounded-md hover:bg-gisviz-accent hover:text-white transition-colors w-max">
            <span>Explore</span>
            <ExternalLink size={11} />
          </button>
        </div>
        
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&fit=crop')] bg-cover bg-center opacity-[0.08] mix-blend-overlay pointer-events-none"></div>
      </div> */}

     {/* Footer */}
      <div className="mt-auto flex flex-col gap-4 pt-4">
        <div className="flex flex-wrap gap-x-3 gap-y-2 text-[12px] text-gisviz-ink-soft px-1">
          <Link href="/legal/about"         className="hover:text-gisviz-accent transition-colors">About</Link>
          <Link href="/legal/terms"         className="hover:text-gisviz-accent transition-colors">Terms</Link>
          <Link href="/legal/privacy"       className="hover:text-gisviz-accent transition-colors">Privacy</Link>
          <Link href="/legal/cookies"       className="hover:text-gisviz-accent transition-colors">Cookies</Link>
          <Link href="/legal/accessibility" className="hover:text-gisviz-accent transition-colors">Accessibility</Link>
          <Link href="/contact"       className="hover:text-gisviz-accent transition-colors">Contact</Link>
          <span className="w-full mt-1 font-mono">© {new Date().getFullYear()} gisviz(Beta RUN)</span>
        </div>
      </div>

    </aside>
  )
}