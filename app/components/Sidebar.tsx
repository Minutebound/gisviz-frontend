'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { Layers, Crosshair, ExternalLink, ShieldCheck, ChevronRight } from 'lucide-react'

// Map to your backend schema
interface GeographicPublication {
  id: string;
  title: string;
  author_handle: string;
  author_avatar_url: string;
  view_count: number;
  likes_count: number;
}

interface PublisherProfile {
  handle: string;
  avatar: string;
  engagementScore: number;
}

// Kept helper for future use if thumbnails are re-introduced
const getPlaceholderThumbnail = (id: string) => {
  const placeholders = [
    "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=200&fit=crop",
    "https://images.unsplash.com/photo-1518182170546-076616fd4625?w=400&h=200&fit=crop",
    "https://images.unsplash.com/photo-1542051812-ba32e154622b?w=400&h=200&fit=crop",
    "https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=400&h=200&fit=crop",
    "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400&h=200&fit=crop"
  ];
  const index = id.charCodeAt(0) % placeholders.length;
  return placeholders[index];
}

export default function Sidebar() {
  const [trendingPosts, setTrendingPosts] = useState<GeographicPublication[]>([])
  const [popularPublishers, setPopularPublishers] = useState<PublisherProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Fetch the global stream to derive sidebar metrics without changing logic
    axios.get('http://localhost:8001/api/v1/publications')
      .then(res => {
        const posts: GeographicPublication[] = res.data;

        // 1. Calculate Trending Maps (Weighting views and likes)
        const sortedTrending = [...posts].sort((a, b) => {
          const scoreA = (a.view_count || 0) + ((a.likes_count || 0) * 10);
          const scoreB = (b.view_count || 0) + ((b.likes_count || 0) * 10);
          return scoreB - scoreA;
        }).slice(0, 5); 

        setTrendingPosts(sortedTrending);

        // 2. Aggregate Publisher Engagement
        const publisherMap: Record<string, PublisherProfile> = {};
        posts.forEach(post => {
          if (!publisherMap[post.author_handle]) {
            publisherMap[post.author_handle] = {
              handle: post.author_handle,
              avatar: post.author_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_handle}`,
              engagementScore: 0
            };
          }
          publisherMap[post.author_handle].engagementScore += (post.view_count || 0) + ((post.likes_count || 0) * 10);
        });

        // Sort publishers by their total aggregate score
        const sortedPublishers = Object.values(publisherMap)
          .sort((a, b) => b.engagementScore - a.engagementScore)
          .slice(0, 4); 

        setPopularPublishers(sortedPublishers);
      })
      .catch(err => console.error("Error fetching sidebar data:", err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <aside className="sticky top-24 h-[calc(100vh-8rem)] flex flex-col gap-[26px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-1 pb-6">

      {/* PART 1: Trending Visualizations (Mapped to .rail-block & .coll-list) */}
      <div className="flex-shrink-0 bg-gisviz-card border border-gisviz-border rounded-none flex flex-col">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-gisviz-ink-soft flex items-center gap-[8px] px-[14px] py-[13px] border-b border-gisviz-border">
          <Layers size={14} className="text-gisviz-accent" />
          Collections
        </div>

        <div className="p-[4px]">
          <div className="flex flex-col">
            {isLoading ? (
              <div className="p-4 text-center text-xs font-mono text-gisviz-ink-soft">Computing trends...</div>
            ) : (
              trendingPosts.map((post, idx) => (
                <Link 
                  href={`/post/${post.id}`} 
                  key={post.id} 
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-[10px] p-[9px_10px] rounded-md hover:bg-gisviz-paper transition-colors group cursor-pointer"
                >
                  <span className="font-mono text-[11px] font-semibold text-gisviz-accent">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13px] font-medium text-gisviz-ink group-hover:text-gisviz-accent transition-colors truncate">
                    {post.title}
                  </span>
                  <span className="font-mono text-[11px] text-gisviz-ink-soft">
                    {post.likes_count + post.view_count || '1.2k'}
                  </span>
                  <ChevronRight size={13} className="text-gisviz-ink-soft" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PART 2: Popular Publishers (Mapped to .pub-list) */}
      <div className="flex-shrink-0 bg-gisviz-card border border-gisviz-border rounded-none flex flex-col">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-gisviz-ink-soft flex items-center gap-[8px] px-[14px] py-[13px] border-b border-gisviz-border">
          <Crosshair size={14} className="text-gisviz-accent" strokeWidth={1.5} />
          Surveyors
        </div>

        <div className="p-[8px] flex flex-col gap-[4px]">
          {isLoading ? (
            <div className="text-center text-xs font-mono text-gisviz-ink-soft py-4">Ranking publishers...</div>
          ) : (
            popularPublishers.map((publisher, idx) => (
              <div key={idx} className="flex items-center gap-[10px] p-[7px_8px] rounded-md hover:bg-gisviz-paper transition-colors group">
                <Link href={`/profile/${publisher.handle}`} className="flex items-center gap-[10px] flex-1 min-w-0 cursor-pointer">
                  <img
                    src={publisher.avatar}
                    alt={publisher.handle}
                    className="w-[34px] h-[34px] rounded-full object-cover border border-gisviz-border bg-gisviz-paper"
                  />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-[13px] font-semibold text-gisviz-ink truncate group-hover:text-gisviz-accent transition-colors">
                      {publisher.handle}
                    </span>
                    <span className="font-mono text-[10.5px] text-gisviz-ink-soft truncate">
                      @{publisher.handle}
                    </span>
                  </div>
                </Link>

                <button className="font-display text-[11px] font-semibold border border-gisviz-border bg-transparent text-gisviz-ink px-[11px] py-[5px] rounded-md cursor-pointer transition-colors hover:border-gisviz-accent hover:text-gisviz-accent shrink-0">
                  Follow
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PART 3: Native Ad (Mapped to Atlas Plate Theme) */}
      <div className="mt-auto flex flex-col gap-4">
        <article className="relative bg-gisviz-rail border border-gisviz-border rounded-none p-[16px] overflow-hidden flex flex-col group cursor-pointer mt-4">
          <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent/50 z-10 top-0 left-0 border-r-0 border-b-0" />
          <i className="absolute w-[8px] h-[8px] border-[1.5px] border-gisviz-accent/50 z-10 bottom-0 right-0 border-l-0 border-t-0" />
          
          <div className="flex justify-between items-start mb-3 z-10">
            <span className="font-mono text-[9px] tracking-[0.22em] text-gisviz-ink-soft uppercase border border-gisviz-border px-[5px] py-[2px]">
              PROMOTED
            </span>
            <ShieldCheck className="w-4 h-4 text-gisviz-accent" />
          </div>
          <div className="relative z-10">
            <h4 className="font-display font-semibold text-[15px] text-white mb-1.5 leading-[1.2] group-hover:text-gisviz-accent transition-colors">
              Enterprise Analytics
            </h4>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed font-sans">
              Process millions of geographic coordinates in milliseconds with cloud-native PostGIS.
            </p>
            <span className="flex items-center gap-[6px] font-mono text-[10px] text-gisviz-accent tracking-[0.06em] uppercase">
              Learn more <ExternalLink size={11} />
            </span>
          </div>
          <div className="absolute top-0 right-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&fit=crop')] bg-cover bg-center opacity-[0.08] mix-blend-overlay pointer-events-none"></div>
        </article>

        {/* PART 4: Footer (Mapped to .rail-foot) */}
        <footer className="flex flex-wrap gap-x-[14px] gap-y-[10px] p-[4px_2px]">
          <Link href="#" className="font-mono text-[10px] tracking-[0.12em] uppercase text-gisviz-ink-soft hover:text-gisviz-accent transition-colors">Terms</Link>
          <Link href="#" className="font-mono text-[10px] tracking-[0.12em] uppercase text-gisviz-ink-soft hover:text-gisviz-accent transition-colors">Privacy</Link>
          <Link href="#" className="font-mono text-[10px] tracking-[0.12em] uppercase text-gisviz-ink-soft hover:text-gisviz-accent transition-colors">API</Link>
          <Link href="#" className="font-mono text-[10px] tracking-[0.12em] uppercase text-gisviz-ink-soft hover:text-gisviz-accent transition-colors">Attribution</Link>
          <p className="basis-full text-[11px] text-gisviz-ink-soft mt-[2px]">© 2026 gisviz — spatial publishing</p>
        </footer>
      </div>

    </aside>
  )
}