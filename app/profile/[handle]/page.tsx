'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Map as MapIcon, ExternalLink, ArrowUpDown,
  Loader2, UserCheck, UserPlus, UserMinus, MapPin, Edit2, Image as ImageIcon,
  Plus
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'

export default function ProfileHandlePage() {
  const params = useParams()
  const router = useRouter()
  const handle = params.handle as string
  const { user, isAuthenticated, refreshProfile } = useAuth() as any

  const [activeTab, setActiveTab]     = useState<'publications' | 'saved'>('publications')
  const [sortOption, setSortOption]   = useState<'latest' | 'alphabetical'>('latest')
  const [profile, setProfile]         = useState<any>(null)
  const [posts, setPosts]             = useState<any[]>([])

  // ── Bookmark state ─────────────────────────────────────────────────────
  const [bookmarks, setBookmarks]               = useState<any[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(false)
  const [bookmarksLoaded, setBookmarksLoaded]   = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg]   = useState('')

  const [isFollowing, setIsFollowing]     = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  // ── Banner state ───────────────────────────────────────────────────────
  const [bannerPreview, setBannerPreview]     = useState<string | null>(null)
  const [bannerUploading, setBannerUploading] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const isOwnProfile = isAuthenticated && user?.user_handle === handle

  const RAW_API_URL  = process.env.NEXT_PUBLIC_API_URL
  const API_BASE_URL = `${RAW_API_URL}`.replace('/api/v0', '')

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null
    if (path.startsWith('http')) return path
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL
    const safe = path.startsWith('/') ? path : `/${path}`
    return `${base}${safe}`
  }

  // ── Load profile + publications ──────────────────────────────────────────
  useEffect(() => {
    if (!handle) return
    setIsLoading(true)
    setBookmarks([])
    setBookmarksLoaded(false)
    setBannerPreview(null)

    const loadProfileData = async () => {
      try {
        const currentUserId = isAuthenticated && user ? user.user_id : undefined
        const [profileData, postsData] = await Promise.all([
          gisvizApi.fetchUserProfile(handle, currentUserId),
          gisvizApi.fetchUserPosts(handle),
        ])
        setProfile(profileData)
        setPosts(postsData)
        setIsFollowing(profileData.is_following || false)
      } catch (err: any) {
        if (err.response?.status === 404) {
          setErrorMsg('Profile deleted or deactivated')
        } else {
          setErrorMsg('Failed to load profile data.')
        }
      } finally {
        setIsLoading(false)
      }
    }
    loadProfileData()
  }, [handle, isAuthenticated, user])

  // ── Lazy-load bookmarks ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'saved' || !isOwnProfile || bookmarksLoaded || bookmarksLoading) return

    const loadBookmarks = async () => {
      setBookmarksLoading(true)
      try {
        const data = await gisvizApi.fetchUserBookmarks(handle)
        setBookmarks(data)
      } catch (err) {
        console.error('Failed to load bookmarks', err)
        setBookmarks([])
      } finally {
        setBookmarksLoading(false)
        setBookmarksLoaded(true)
      }
    }
    loadBookmarks()
  }, [activeTab, isOwnProfile, handle, bookmarksLoaded, bookmarksLoading])

  // ── Follow / unfollow ────────────────────────────────────────────────────
  const handleFollowToggle = async () => {
    if (!isAuthenticated) { router.push('/auth'); return }
    setFollowLoading(true)
    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    try {
      if (wasFollowing) {
        await gisvizApi.unfollowUser(profile.user_id)
      } else {
        await gisvizApi.followUser(profile.user_id)
      }
    } catch (err) {
      setIsFollowing(wasFollowing)
    } finally {
      setFollowLoading(false)
    }
  }

  // ── Banner upload ────────────────────────────────────────────────────────
  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return

    // Optimistic preview
    setBannerPreview(URL.createObjectURL(file))
    setBannerUploading(true)

    try {
      await gisvizApi.uploadBanner(file)
      // Refresh profile so banner_path is updated without a full page reload
      const currentUserId = isAuthenticated && user ? user.user_id : undefined
      const updated = await gisvizApi.fetchUserProfile(handle, currentUserId)
      setProfile(updated)
    } catch (err) {
      console.error('Banner upload failed', err)
      setBannerPreview(null)
    } finally {
      setBannerUploading(false)
      // Reset input so the same file can be re-selected if needed
      e.target.value = ''
    }
  }

  // ── Sort ─────────────────────────────────────────────────────────────────
  const activeList  = activeTab === 'publications' ? posts : bookmarks
  const sortedPosts = [...activeList].sort((a, b) => {
    if (sortOption === 'latest') {
      return new Date(b.created_timestamp).getTime() - new Date(a.created_timestamp).getTime()
    } else {
      return (a.title || '').localeCompare(b.title || '')
    }
  })

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
        <h2 className="text-[24px] font-display text-gisviz-ink mb-2">Error 404</h2>
        <p className="text-gisviz-ink-soft font-mono uppercase text-[16px] mb-6">{errorMsg}</p>
        <button onClick={() => router.push('/')} className="text-gisviz-accent hover:underline font-mono text-[16px] border border-gisviz-accent/20 px-4 py-2 rounded-md">
          Return to Global Feed
        </button>
      </div>
    )
  }

  const bannerSrc = bannerPreview ?? getAvatarUrl(profile.banner_path)

  return (
    <div className="py-6 mx-auto space-y-6 max-w-5xl px-4">

      {/* Identity Plate */}
      <div className="relative bg-gisviz-card border border-gisviz-border shadow-md rounded-sm plate-enter overflow-hidden">

        {/* ── Banner ──────────────────────────────────────────────────────── */}
        <div className="h-32 border-b border-gisviz-border relative overflow-hidden group">

          {/* Image or default gradient */}
          {bannerSrc ? (
            <img
              src={bannerSrc}
              alt="Profile banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full bg-gradient-to-r from-gisviz-canvas via-gisviz-canvas to-gisviz-accent-soft">
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: 'linear-gradient(var(--color-gisviz-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-gisviz-grid) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
            </div>
          )}

          {/* Upload overlay — own profile only */}
          {isOwnProfile && (
            <>
              <div
                onClick={() => !bannerUploading && bannerInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {bannerUploading ? (
                  <Loader2 size={24} className="text-white animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-white">
                    <ImageIcon size={22} />
                    <span className="font-mono text-[12px] uppercase tracking-wider">
                      {profile.banner_path ? 'Change Banner' : 'Upload Banner'}
                    </span>
                  </div>
                )}
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBannerChange}
              />
            </>
          )}
        </div>

        {/* ── Avatar + Info ────────────────────────────────────────────────── */}
        <div className="px-8 py-8 relative flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16">

          {/* Avatar */}
          <div className="w-24 h-24 rounded-xl border-gisviz-card bg-gisviz-canvas overflow-hidden shadow-sm shrink-0 z-10 relative flex items-center justify-center">
            {profile.avatar_path ? (
              <>
                <img
                  src={getAvatarUrl(profile.avatar_path) as string}
                  alt={profile.user_handle}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
                <div className="hidden w-full h-full bg-gradient-to-tr from-gisviz-accent to-gisviz-safe flex items-center justify-center text-gisviz-white text-[24px] font-bold uppercase font-mono shadow-inner">
                  {profile.user_handle.charAt(0)}
                </div>
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-gisviz-accent to-gisviz-safe flex items-center justify-center text-gisviz-white text-[24px] font-bold uppercase font-mono shadow-inner">
                {profile.user_handle.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1 z-10">
            <h1 className="text-[24px] font-display font-bold text-gisviz-ink">
              @{profile.user_handle}
            </h1>
            <p className="text-[16px] font-mono text-gisviz-ink-soft flex items-center flex-wrap gap-4">
              <span>{profile.title || 'GIS Lover'}</span>
              {profile.location?.formatted_string && (
                <span className="flex items-center gap-1.5 text-gisviz-ink">
                  <MapPin size={12} className="text-gisviz-accent" />
                  {profile.location.formatted_string}
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-4 font-mono text-[16px] z-10 w-full sm:w-auto mt-4 sm:mt-0 justify-between sm:justify-end border-t sm:border-t-0 border-gisviz-border pt-4 sm:pt-0">
            <div className="text-center sm:text-right">
              <p className="text-[24px] font-bold text-gisviz-ink">{profile.post_count || posts.length}</p>
              <p className="text-[12px] text-gisviz-ink-soft uppercase tracking-wider">Posts</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-[24px] font-bold text-gisviz-ink">{profile.follower_count || 0}</p>
              <p className="text-[12px] text-gisviz-ink-soft uppercase tracking-wider">Followers</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-[24px] font-bold text-gisviz-ink">{profile.following_count || 0}</p>
              <p className="text-[12px] text-gisviz-ink-soft uppercase tracking-wider">Following</p>
            </div>
          </div>
        </div>

        {/* ── Action Bar ───────────────────────────────────────────────────── */}
        <div className="bg-gisviz-canvas/50 border-t border-gisviz-border px-8 py-3 flex justify-between items-center">
          <div className="flex gap-6 font-mono text-[16px]">
            <button
              onClick={() => setActiveTab('publications')}
              className={`pb-1 border-b-2 transition-colors ${activeTab === 'publications' ? 'border-gisviz-accent text-gisviz-ink font-bold' : 'border-transparent text-gisviz-ink-soft hover:text-gisviz-ink'}`}
            >
              My Posts
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('saved')}
                className={`pb-1 border-b-2 transition-colors ${activeTab === 'saved' ? 'border-gisviz-accent text-gisviz-ink font-bold' : 'border-transparent text-gisviz-ink-soft hover:text-gisviz-ink'}`}
              >
                Bookmarked Posts
              </button>
            )}
          </div>

          {!isOwnProfile ? (
            <button
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`group/btn flex items-center justify-center gap-2 px-5 py-2 rounded-full transition-all font-mono text-[16px] font-bold shadow-sm disabled:opacity-50 border ${
                isFollowing
                  ? 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink hover:bg-gisviz-alert/10 hover:text-gisviz-alert/90 hover:border-gisviz-alert/60'
                  : 'bg-gisviz-accent border-transparent text-gisviz-white hover:bg-opacity-90'
              }`}
            >
              {followLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : isFollowing ? (
                <>
                  <UserCheck size={15} className="block group-hover/btn:hidden" />
                  <UserMinus size={15} className="hidden group-hover/btn:block text-gisviz-alert/80" />
                </>
              ) : (
                <UserPlus size={15} />
              )}
              {isFollowing ? (
                <>
                  <span className="block group-hover/btn:hidden">Following</span>
                  <span className="hidden group-hover/btn:block">Unfollow</span>
                </>
              ) : (
                <span>Follow</span>
              )}
            </button>
          ) : (
            <Link href="/settings" className="flex items-center gap-2 bg-gisviz-rail-soft border border-gisviz-border text-gisviz-ink px-5 py-2 rounded-full hover:border-gisviz-ink transition-all font-mono text-[16px] shadow-sm font-bold">
              Configure Profile
            </Link>
          )}
        </div>
      </div>
 
{/* ── Grid header ──────────────────────────────────────────────────────── */}
<div className="flex justify-between items-center mb-4 mt-8">
 
  {/* Sort — unchanged */}
  <button
    onClick={() => setSortOption(prev => prev === 'latest' ? 'alphabetical' : 'latest')}
    className="text-[16px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink flex items-center gap-1.5 border border-gisviz-border px-3 py-1.5 rounded-md bg-gisviz-card transition-colors select-none"
  >
    <ArrowUpDown size={14} />
    {sortOption === 'latest' ? 'Sort: Latest' : 'Sort: A-Z'}
  </button>
 
  {/* Publish — own profile only, matches feed page styling */}
  {isOwnProfile && (
    <Link
      href="/post/upload"
      className="flex items-center gap-2 bg-gisviz-accent text-gisviz-white px-4 py-2 rounded-full text-[12px] font-bold hover:bg-opacity-90 transition-all shadow-sm"
    >
      <Plus size={16} /> Publish
    </Link>
  )}
</div>

      {/* ── PUBLICATIONS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'publications' && (
        sortedPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPosts.map((post) => (
              <Link href={`/post/${post.post_id}`} key={post.post_id} className="bg-gisviz-card border border-gisviz-border p-5 rounded-sm hover:border-gisviz-accent transition-colors group cursor-pointer shadow-sm flex flex-col justify-between min-h-[192px] plate-enter relative">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <MapIcon className="text-gisviz-ink-soft group-hover:text-gisviz-accent transition-colors" size={20} />
                    {isOwnProfile ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          router.push(`/post/${post.post_id}/edit`)
                        }}
                        className="text-gisviz-ink-soft hover:text-gisviz-accent transition-colors z-10 p-1 bg-gisviz-canvas rounded-md border border-transparent hover:border-gisviz-accent/30"
                        title="Edit Publication"
                      >
                        <Edit2 size={16} />
                      </button>
                    ) : (
                      <ExternalLink className="text-gisviz-border group-hover:text-gisviz-ink-soft transition-colors opacity-0 group-hover:opacity-100" size={16} />
                    )}
                  </div>
                  <h3 className="font-bold text-[16px] camelcase text-gisviz-ink leading-tight line-clamp-2">{post.title}</h3>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {post.categories.map((cat: any) => (
                      <span key={cat.category_id} className="text-[12px] uppercase font-mono bg-gisviz-canvas border border-gisviz-border px-2 py-0.5 rounded-md text-gisviz-ink-soft">
                        {cat.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-gisviz-border pt-3 mt-4 text-[16px] font-mono text-gisviz-ink-soft">
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
            <p className="text-gisviz-ink-soft font-mono text-[16px] uppercase">No Posts published yet.</p>
          </div>
        )
      )}

      {/* ── BOOKMARKS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'saved' && (
        bookmarksLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 size={28} className="animate-spin text-gisviz-accent" />
          </div>
        ) : sortedPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPosts.map((post) => (
              <Link href={`/post/${post.post_id}`} key={post.post_id} className="bg-gisviz-card border border-gisviz-border p-5 rounded-sm hover:border-gisviz-accent transition-colors group cursor-pointer shadow-sm flex flex-col justify-between min-h-[192px] plate-enter relative">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <MapIcon className="text-gisviz-ink-soft group-hover:text-gisviz-accent transition-colors" size={20} />
                    <ExternalLink className="text-gisviz-border group-hover:text-gisviz-ink-soft transition-colors opacity-0 group-hover:opacity-100" size={16} />
                  </div>
                  <h3 className="font-bold text-[16px] camelcase text-gisviz-ink leading-tight line-clamp-2">{post.title}</h3>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {post.categories?.map((cat: any) => (
                      <span key={cat.category_id} className="text-[12px] uppercase font-mono bg-gisviz-canvas border border-gisviz-border px-2 py-0.5 rounded-md text-gisviz-ink-soft">
                        {cat.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-gisviz-border pt-3 mt-4 text-[16px] font-mono text-gisviz-ink-soft">
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
            <p className="text-gisviz-ink-soft font-mono text-[16px] uppercase">No Saved Posts.</p>
          </div>
        )
      )}

    </div>
  )
}