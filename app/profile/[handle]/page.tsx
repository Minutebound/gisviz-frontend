'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Map as MapIcon, Users, Activity, ExternalLink, Filter, Loader2, Image as ImageIcon, Check } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export default function ProfileHandlePage() {
  const params = useParams()
  const router = useRouter()
  const handle = params.handle as string
  const { user, isAuthenticated } = useAuth()
  
  const [activeTab, setActiveTab] = useState<'publications' | 'saved'>('publications')
  const [profile, setProfile] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  
  // States
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  
  // Follow Action States
  const [isFollowing, setIsFollowing] = useState(false) 
  const [followLoading, setFollowLoading] = useState(false)
  
  const isOwnProfile = isAuthenticated && user?.user_handle === handle

  useEffect(() => {
    if (!handle) return

    const loadProfileData = async () => {
      setIsLoading(true)
      try {
        const [profileData, postsData] = await Promise.all([
          gisvizApi.fetchUserProfile(handle),
          gisvizApi.fetchUserPosts(handle)
        ])
        setProfile(profileData)
        setPosts(postsData)
        // Note: For a production app, the backend should return `is_following: true/false` 
        // inside `profileData` to accurately set this initial state based on the active user.
      } catch (err: any) {
        if (err.response?.status === 404) {
          setErrorMsg('Analyst profile not found in the database.')
        } else {
          setErrorMsg('Failed to load profile data.')
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadProfileData()
  }, [handle])

  // --- Follow / Unfollow Handler ---
  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      router.push('/auth')
      return
    }

    setFollowLoading(true)
    try {
      if (isFollowing) {
        await gisvizApi.unfollowUser(profile.user_id)
        setProfile((prev: any) => ({ ...prev, follower_count: Math.max(0, prev.follower_count - 1) }))
        setIsFollowing(false)
      } else {
        await gisvizApi.followUser(profile.user_id)
        setProfile((prev: any) => ({ ...prev, follower_count: prev.follower_count + 1 }))
        setIsFollowing(true)
      }
    } catch (err) {
      console.error("Follow interaction failed", err)
    } finally {
      setFollowLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <Loader2 size={32} className="animate-spin text-gisviz-accent" />
      </div>
    )
  }

  if (errorMsg || !profile) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-4rem)] text-center">
        <h2 className="text-2xl font-display text-gisviz-ink mb-2">Error 404</h2>
        <p className="text-gisviz-ink-soft font-mono uppercase text-sm mb-6">{errorMsg}</p>
        <button onClick={() => router.push('/')} className="text-gisviz-accent hover:underline font-mono text-sm border border-gisviz-accent/20 px-4 py-2 rounded-md">
          Return to Global Feed
        </button>
      </div>
    )
  }

  return (
    <div className="py-6 mx-auto space-y-6 max-w-5xl px-4">

      {/* Identity Plate */}
      <div className="relative bg-gisviz-card border border-gisviz-border shadow-md rounded-sm plate-enter overflow-hidden">
        
        {/* Ambient Topographic Header */}
        <div className="h-32 bg-gradient-to-r from-gisviz-canvas via-gisviz-canvas to-gisviz-accent-soft border-b border-gisviz-border relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(var(--color-gisviz-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-gisviz-grid) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        </div>

        <div className="px-8 pb-8 pt-4 relative flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16">
          <div className="w-24 h-24 rounded-xl border-4 border-gisviz-card bg-gisviz-canvas overflow-hidden shadow-sm shrink-0 z-10 relative">
            {profile.avatar_path ? (
              <img src={`${API_BASE_URL}${profile.avatar_path}`} alt={profile.user_handle} className="w-full h-full object-cover" />
            ) : (
               <div className="w-full h-full bg-gradient-to-tr from-gisviz-accent to-emerald-400 flex items-center justify-center text-white text-3xl font-bold uppercase font-mono shadow-inner">
                 {profile.user_handle.charAt(0)}
               </div>
            )}
          </div>

          <div className="flex-1 space-y-1 z-10">
            <h1 className="text-3xl font-display font-bold text-gisviz-ink">
              @{profile.user_handle}
            </h1>
            <p className="text-sm font-mono text-gisviz-ink-soft flex items-center gap-4">
              <span>{profile.title || 'Platform Analyst'}</span>
              <span className="w-1 h-1 rounded-full bg-gisviz-border"></span>
              <span>Enterprise Access</span>
            </p>
          </div>

          <div className="flex gap-4 font-mono text-sm z-10 w-full sm:w-auto mt-4 sm:mt-0 justify-between sm:justify-end border-t sm:border-t-0 border-gisviz-border pt-4 sm:pt-0">
            <div className="text-center sm:text-right">
              <p className="text-2xl font-bold text-gisviz-ink">{profile.post_count || posts.length}</p>
              <p className="text-xs text-gisviz-ink-soft uppercase tracking-wider">Publications</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-2xl font-bold text-gisviz-ink">{profile.follower_count || 0}</p>
              <p className="text-xs text-gisviz-ink-soft uppercase tracking-wider">Followers</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-2xl font-bold text-gisviz-ink">{profile.following_count || 0}</p>
              <p className="text-xs text-gisviz-ink-soft uppercase tracking-wider">Following</p>
            </div>
          </div>
        </div>

        {/* Profile Action Bar */}
        <div className="bg-gisviz-canvas/50 border-t border-gisviz-border px-8 py-3 flex justify-between items-center">
           <div className="flex gap-6 font-mono text-sm">
             <button 
               onClick={() => setActiveTab('publications')}
               className={`pb-1 border-b-2 transition-colors ${activeTab === 'publications' ? 'border-gisviz-accent text-gisviz-ink font-bold' : 'border-transparent text-gisviz-ink-soft hover:text-gisviz-ink'}`}
             >
               My Posts
             </button>
             <button 
               onClick={() => setActiveTab('saved')}
               className={`pb-1 border-b-2 transition-colors ${activeTab === 'saved' ? 'border-gisviz-accent text-gisviz-ink font-bold' : 'border-transparent text-gisviz-ink-soft hover:text-gisviz-ink'}`}
             >
               Saved Posts
             </button>
           </div>

           {!isOwnProfile ? (
             <button 
               onClick={handleFollowToggle}
               disabled={followLoading}
               className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all font-mono text-xs shadow-sm disabled:opacity-50 ${
                 isFollowing 
                  ? 'bg-gisviz-canvas border border-gisviz-border text-gisviz-ink hover:bg-red-50 hover:text-red-600 hover:border-red-200' 
                  : 'bg-gisviz-accent text-white hover:bg-opacity-90'
               }`}
             >
               {followLoading ? (
                 <Loader2 size={14} className="animate-spin" />
               ) : isFollowing ? (
                 <Check size={14} className="text-emerald-500" />
               ) : (
                 <Users size={14} />
               )}
               {isFollowing ? 'Following' : 'Follow Analyst'}
             </button>
           ) : (
             <Link href="/settings" className="flex items-center gap-2 bg-gisviz-rail-soft border border-gisviz-border text-gisviz-ink px-4 py-1.5 rounded-md hover:border-gisviz-ink transition-all font-mono text-xs shadow-sm">
               Configure Profile
             </Link>
           )}
        </div>
      </div>

      {/* Publications Grid */}
      <div className="flex justify-between items-center mb-4 mt-8">
        <h2 className="text-lg font-display font-bold text-gisviz-ink flex items-center gap-2">
          <Activity size={18} className="text-gisviz-accent" />
          {activeTab === 'publications' ? 'Recent Publications' : 'Saved Bookmarks'}
        </h2>
        <button className="text-xs font-mono text-gisviz-ink-soft hover:text-gisviz-ink flex items-center gap-1 border border-gisviz-border px-3 py-1.5 rounded-md bg-gisviz-card">
          <Filter size={14} /> Filter
        </button>
      </div>

      {activeTab === 'publications' ? (
        posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <Link href={`/post/${post.post_id}`} key={post.post_id} className="bg-gisviz-card border border-gisviz-border p-5 rounded-sm hover:border-gisviz-accent transition-colors group cursor-pointer shadow-sm flex flex-col justify-between min-h-[192px] plate-enter">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <MapIcon className="text-gisviz-ink-soft group-hover:text-gisviz-accent transition-colors" size={20} />
                    <ExternalLink className="text-gisviz-border group-hover:text-gisviz-ink-soft transition-colors opacity-0 group-hover:opacity-100" size={16} />
                  </div>
                  <h3 className="font-bold text-gisviz-ink leading-tight line-clamp-2">{post.title}</h3>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {post.categories.map((cat: any) => (
                      <span key={cat.category_id} className="text-[10px] font-mono bg-gisviz-canvas border border-gisviz-border px-2 py-0.5 rounded-full text-gisviz-ink-soft">
                        {cat.label}
                      </span>
                    ))}
                    {post.categories.length === 0 && (
                      <span className="text-[10px] font-mono bg-gisviz-canvas border border-gisviz-border px-2 py-0.5 rounded-full text-gisviz-ink-soft">
                        UNCLASSIFIED
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center border-t border-gisviz-border pt-3 mt-4 text-xs font-mono text-gisviz-ink-soft">
                  <span>{new Date(post.created_timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <div className="flex gap-3">
                    <span>{post.total_likes_count || 0} Likes</span>
                    <span>{post.total_comments_count || 0} Com</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gisviz-rail border border-gisviz-border border-dashed rounded-sm">
            <p className="text-gisviz-ink-soft font-mono text-sm uppercase">No Posts published yet.</p>
          </div>
        )
      ) : (
        <div className="text-center py-16 bg-gisviz-rail border border-gisviz-border border-dashed rounded-sm">
          <p className="text-gisviz-ink-soft font-mono text-sm uppercase">No Saved Posts.</p>
        </div>
      )}

    </div>
  )
}