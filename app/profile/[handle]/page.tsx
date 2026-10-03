'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowUpDown, Loader2, UserCheck, UserPlus, UserMinus, 
  MapPin, Edit2, Image as ImageIcon, Plus, Grid, Inbox, 
  Link as LinkIcon, Share2, MessageSquare, Bookmark, BarChart2, Heart, Database
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../connector/api'
import { Post } from '../../../types/gisviz'
import FeedCard, { FeedCardSkeleton } from '../../components/feed/FeedCard'
import ShareModal from '../../components/SharePost'

// ── Compact Analytical Post Card (For Published Posts) ──
function ProfilePostCard({ post, onLike, onBookmark, onShare, busy, isOwnProfile, isBookmarkView, onEdit }: any) {
  const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api/v0', '').replace(/\/$/, '')
  const getMediaUrl = (path: string | null | undefined) => {
    if (!path) return null
    if (/^https?:\/\//.test(path)) return path
    const safe = path.startsWith('/') ? path : `/${path}`
    return `${API_BASE_URL}${safe}`
  }

  const isInactive = post.is_active === 0
  const thumbPath = post.thumbnail_url || post.map_preview?.thumbnail_path || post.visual_image_path
  const thumbUrl = getMediaUrl(thumbPath)

  return (
    <div className={`group flex flex-col h-full bg-gisviz-card border rounded-[14px] overflow-hidden shadow-sm hover:shadow-md transition-all ${isInactive ? 'opacity-75 grayscale-[20%] border-amber-200/80 border-dashed' : 'border-gisviz-border hover:border-gisviz-accent/40'}`}>
       
       {/* 1. Visual Header with Overlays */}
       <div className="relative w-full h-[150px] sm:h-[180px] bg-gisviz-canvas shrink-0 overflow-hidden border-b border-gisviz-border/50">
         {thumbUrl ? (
           <img src={thumbUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
         ) : (
           <div className="w-full h-full flex items-center justify-center bg-gisviz-rail-soft text-gisviz-ink-soft font-mono text-[11px]">No visual</div>
         )}
         
         {/* Top Left Badges */}
         <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
           {isInactive && (
             <span className="bg-amber-100/95 backdrop-blur-sm border border-amber-200 text-amber-800 px-2 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider shadow-sm">
               Draft
             </span>
           )}
           {post.categories?.[0] && (
             <span className="bg-gisviz-card/95 backdrop-blur-sm border border-gisviz-border/50 text-gisviz-ink px-2 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider shadow-sm">
               {post.categories[0].label}
             </span>
           )}
         </div>

         {/* Top Right Actions */}
         {!isBookmarkView && isOwnProfile && onEdit && (
           <button onClick={onEdit} className="absolute top-2.5 right-2.5 w-8 h-8 rounded-[8px] bg-gisviz-card/90 backdrop-blur-sm border border-gisviz-border/50 flex items-center justify-center text-gisviz-ink hover:text-gisviz-accent shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-105" title="Edit Post">
             <Edit2 size={14} />
           </button>
         )}
       </div>

       {/* 2. Content Body */}
       <div className="p-4 sm:p-5 flex flex-col flex-1">
         <Link href={`/post/${post.post_id}`} className="mb-2 block">
           <h3 className="font-display text-[16px] sm:text-[18px] font-bold text-gisviz-ink leading-tight line-clamp-2 group-hover:text-gisviz-accent transition-colors">
             {post.title}
           </h3>
         </Link>

         {/* Keywords & Technical Data */}
         <div className="flex flex-wrap items-center gap-1.5 mt-auto mb-4">
           {post.keywords?.slice(0, 3).map((kw: any) => (
             <span key={kw.keyword_id || kw} className="px-1.5 py-0.5 bg-gisviz-paper border border-gisviz-border rounded-[6px] text-[10.5px] font-mono text-gisviz-ink-soft">
               #{typeof kw === 'string' ? kw.replace(/\s+/g, '') : kw.word.replace(/\s+/g, '')}
             </span>
           ))}
           {(post.map_preview?.layer_count > 0 || post.chart_type) && (
             <span className="px-1.5 py-0.5 bg-gisviz-accent/10 border border-gisviz-accent/20 rounded-[6px] text-[10.5px] font-mono font-medium text-gisviz-accent flex items-center gap-1">
               <Database size={10} /> {post.map_preview?.layer_count ? `${post.map_preview.layer_count} Layers` : post.chart_type}
             </span>
           )}
         </div>

         {/* 3. Performance Analytics Footer */}
         <div className="flex items-center justify-between pt-3 border-t border-gisviz-border/60 mt-auto">
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 text-gisviz-ink-soft text-[12px] font-medium" title="Views">
                 <BarChart2 size={13} /> 
                 <span>{post.views_count || 0}</span>
               </div>
               <button disabled={busy} onClick={() => onLike(post)} className={`flex items-center gap-1.5 text-[12px] font-medium transition-colors ${post.is_liked ? 'text-gisviz-accent' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`} title="Likes">
                 <Heart size={13} className={post.is_liked ? 'fill-current' : ''} /> 
                 <span>{post.total_likes_count || 0}</span>
               </button>
               <div className="flex items-center gap-1.5 text-gisviz-ink-soft text-[12px] font-medium" title="Comments">
                 <MessageSquare size={13} /> 
                 <span>{(post as any).total_comments_count || 0}</span>
               </div>
            </div>
            
            <div className="flex items-center gap-2">
              {!isOwnProfile && (
                <button disabled={busy} onClick={() => onBookmark(post)} className={`p-1 transition-colors ${post.is_bookmarked ? 'text-gisviz-accent' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`} title="Bookmark">
                  <Bookmark size={14} className={post.is_bookmarked ? 'fill-current' : ''} />
                </button>
              )}
              <button onClick={() => onShare(post)} className="text-gisviz-ink-soft hover:text-gisviz-ink transition-colors p-1" title="Share">
                 <Share2 size={14} />
              </button>
            </div>
         </div>
       </div>
    </div>
  )
}

export default function ProfileHandlePage() {
  const params = useParams()
  const router = useRouter()
  const handle = params.handle as string
  const { user, isAuthenticated } = useAuth() as any

  const [activeTab, setActiveTab] = useState<'Posts' | 'saved'>('Posts')
  const [sortOption, setSortOption] = useState<'latest' | 'alphabetical'>('latest')
  const [profile, setProfile] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])

  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(false)
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sharing, setSharing] = useState<Post | null>(null)

  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [bannerUploading, setBannerUploading] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const [imageError, setImageError] = useState(false)

  const isOwnProfile = isAuthenticated && (user?.user_handle === handle || user?.handle === handle)

  const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || ''
  const API_BASE_URL = RAW_API_URL.replace('/api/v0', '').replace(/\/$/, '')

  const getMediaUrl = (path: string | null | undefined) => {
    if (!path) return null
    if (/^https?:\/\//.test(path)) return path
    const safe = path.startsWith('/') ? path : `/${path}`
    return `${API_BASE_URL}${safe}`
  }

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
        setPosts(postsData || [])
        setIsFollowing(profileData.is_following || false)
      } catch (err: any) {
        if (err.response?.status === 404) setErrorMsg('Profile deleted or deactivated')
        else setErrorMsg('Failed to load profile data.')
      } finally {
        setIsLoading(false)
      }
    }
    loadProfileData()
  }, [handle, isAuthenticated, user])

  useEffect(() => {
    if (activeTab !== 'saved' || !isOwnProfile || bookmarksLoaded || bookmarksLoading) return

    const loadBookmarks = async () => {
      setBookmarksLoading(true)
      try {
        const data = await gisvizApi.fetchUserBookmarks(handle)
        setBookmarks(data || [])
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

  const handleFollowToggle = async () => {
    if (!isAuthenticated) { router.push('/auth'); return }
    setFollowLoading(true)
    const wasFollowing = isFollowing
 
    setIsFollowing(!wasFollowing)
    setProfile((prev: any) => ({ ...prev, follower_count: (prev.follower_count || 0) + (wasFollowing ? -1 : 1) }))
 
    try {
      if (wasFollowing) await gisvizApi.unfollowUser(profile.user_id)
      else await gisvizApi.followUser(profile.user_id)
    } catch (err) {
      setIsFollowing(wasFollowing)
      setProfile((prev: any) => ({ ...prev, follower_count: (prev.follower_count || 0) + (wasFollowing ? 1 : -1) }))
    } finally {
      setFollowLoading(false)
    }
  }

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return

    setBannerPreview(URL.createObjectURL(file))
    setBannerUploading(true)

    try {
      await gisvizApi.uploadBanner(file)
      const currentUserId = isAuthenticated && user ? user.user_id : undefined
      const updated = await gisvizApi.fetchUserProfile(handle, currentUserId)
      setProfile(updated)
    } catch (err) {
      console.error('Banner upload failed', err)
      setBannerPreview(null)
    } finally {
      setBannerUploading(false)
      e.target.value = ''
    }
  }

  const patch = (id: string, fn: (p: Post) => Post) => {
    if (activeTab === 'Posts') setPosts(ps => ps.map(p => (p.post_id === id ? fn(p) : p)))
    else setBookmarks(ps => ps.map(p => (p.post_id === id ? fn(p) : p)))
  }

  const onLike = async (post: Post) => {
    if (!isAuthenticated) { router.push('/auth'); return }
    const was = !!post.is_liked
    setBusyId(post.post_id)
    patch(post.post_id, p => ({ ...p, is_liked: !was, total_likes_count: (p.total_likes_count || 0) + (was ? -1 : 1) }))
    try { await gisvizApi.toggleLike(post.post_id) } 
    catch { patch(post.post_id, p => ({ ...p, is_liked: was, total_likes_count: (p.total_likes_count || 0) + (was ? 1 : -1) })) } 
    finally { setBusyId(null) }
  }

  const onBookmark = async (post: Post) => {
    if (!isAuthenticated) { router.push('/auth'); return }
    const was = !!post.is_bookmarked
    setBusyId(post.post_id)
    patch(post.post_id, p => ({ ...p, is_bookmarked: !was }))
    try { await gisvizApi.toggleBookmark(post.post_id) } 
    catch { patch(post.post_id, p => ({ ...p, is_bookmarked: was })) } 
    finally { setBusyId(null) }
  }

  const activeList = activeTab === 'Posts' ? posts : bookmarks
  const sortedPosts = [...activeList].sort((a, b) => {
    if (sortOption === 'latest') {
      const timeA = new Date(a.created_at || (a as any).created_timestamp).getTime()
      const timeB = new Date(b.created_at || (b as any).created_timestamp).getTime()
      return timeB - timeA
    }
    return (a.title || '').localeCompare(b.title || '')
  })

  if (isLoading) {
    return <div className="flex justify-center items-center h-[calc(100vh-4rem)]"><Loader2 size={32} className="animate-spin text-gisviz-accent" /></div>
  }

  if (errorMsg || !profile) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-4rem)] text-center">
        <h2 className="text-[24px] font-display text-gisviz-ink mb-2">Error 404</h2>
        <p className="text-gisviz-ink-soft font-mono uppercase text-[16px] mb-6">{errorMsg}</p>
        <button onClick={() => router.push('/')} className="text-[14px] font-semibold bg-gisviz-accent text-[color:var(--accent-on)] px-6 py-2.5 rounded-[10px] shadow-sm">Return to Global Feed</button>
      </div>
    )
  }

  const bannerSrc = bannerPreview ?? getMediaUrl(profile.banner_path)
  const avatarSrc = getMediaUrl(profile.avatar_path)
  const profileInitials = profile.user_handle.slice(0, 2).toUpperCase()

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-14 flex flex-col gap-6 sm:gap-8">
      
      {/* ── 1. Profile Header Card ── */}
      <div className="bg-gisviz-card rounded-[20px] border border-gisviz-border shadow-sm overflow-hidden flex flex-col">
        
        {/* Banner Section */}
        <div className="w-full h-[140px] sm:h-[180px] relative group border-b border-gisviz-border">
          {bannerSrc ? (
    <img src={bannerSrc} alt="Profile banner" className="w-full h-full object-cover" />
  ) : (
    <div className="absolute inset-0 bg-gradient-to-r from-gisviz-accent/10 to-gisviz-safe/10" />
  )}

          {isOwnProfile && (
            <>
              <div
                onClick={() => !bannerUploading && bannerInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
              >
                {bannerUploading ? (
                  <Loader2 size={28} className="text-white animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-white bg-black/40 px-6 py-3 rounded-xl backdrop-blur-sm">
                    <ImageIcon size={22} />
                    <span className="font-mono text-[12.5px] font-semibold uppercase tracking-wider">
                      {profile.banner_path ? 'Change Cover Photo' : 'Upload Cover Photo'}
                    </span>
                  </div>
                )}
              </div>
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
            </>
          )}
        </div>

        {/* Horizontal Details Section */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          
          {/* Left: Avatar & Bio */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-6 flex-1 min-w-0">
            {/* Avatar overlapping banner */}
            <div className="-mt-12 sm:-mt-16 w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-[20px] bg-gisviz-paper border-4 border-gisviz-card shadow-sm flex items-center justify-center text-[30px] sm:text-[40px] font-bold text-gisviz-ink-soft overflow-hidden relative z-10">
              {avatarSrc && !imageError ? (
                <img src={avatarSrc} alt={profile.user_handle} className="w-full h-full object-cover" onError={() => setImageError(true)} />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-gisviz-accent to-gisviz-safe flex items-center justify-center text-[color:var(--accent-on)] shadow-inner">
                  {profileInitials}
                </div>
              )}
            </div>
            
            <div className="flex flex-col min-w-0 pb-1">
              <h1 className="font-display text-[26px] sm:text-[30px] font-bold text-gisviz-ink leading-tight tracking-tight truncate">
                {profile.name || profile.user_handle.replace(/_/g, ' ')}
              </h1>
              <p className="text-[14.5px] font-medium text-gisviz-ink-soft mb-1.5">
                @{profile.user_handle}
              </p>
              {profile.title && (
                <p className="text-[14px] text-gisviz-ink leading-relaxed mb-2 line-clamp-2 max-w-xl">
                  {profile.title}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-[13px] text-gisviz-ink-soft">
                {profile.location?.formatted_string && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-gisviz-accent" /> <span className="truncate max-w-[200px]">{profile.location.formatted_string}</span>
                  </div>
                )}
                {profile.website_url && (
                  <div className="flex items-center gap-1.5">
                    <LinkIcon size={14} /> 
                    <a href={profile.website_url.startsWith('http') ? profile.website_url : `https://${profile.website_url}`} target="_blank" rel="noreferrer" className="hover:text-gisviz-accent hover:underline truncate max-w-[150px]">
                      Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Stats & Action */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-5 shrink-0 pt-2 lg:pt-0 pb-1">
            <div className="flex items-center gap-6 text-center">
              <div className="flex flex-col items-center">
                <span className="text-[20px] font-bold text-gisviz-ink">{profile.post_count || posts.length}</span>
                <span className="text-[11px] font-mono uppercase tracking-wider text-gisviz-ink-soft">Posts</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[20px] font-bold text-gisviz-ink">{profile.follower_count || 0}</span>
                <span className="text-[11px] font-mono uppercase tracking-wider text-gisviz-ink-soft">Followers</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[20px] font-bold text-gisviz-ink">{profile.following_count || 0}</span>
                <span className="text-[11px] font-mono uppercase tracking-wider text-gisviz-ink-soft">Following</span>
              </div>
            </div>

            {isOwnProfile ? (
              <Link href="/settings" className="w-full sm:w-auto lg:w-full h-10 px-6 rounded-[10px] border border-gisviz-border bg-gisviz-paper flex items-center justify-center gap-2 text-[13.5px] font-semibold text-gisviz-ink hover:border-gisviz-border-strong transition-all shadow-sm">
                <Edit2 size={14} className="text-gisviz-ink-soft" /> Edit Profile
              </Link>
            ) : (
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`group w-full sm:w-auto lg:w-full min-w-[140px] h-10 px-6 rounded-[10px] flex items-center justify-center gap-2 text-[13.5px] font-semibold transition-all shadow-sm disabled:opacity-50 ${
                  isFollowing
                    ? 'border border-gisviz-border bg-gisviz-paper text-gisviz-ink hover:bg-gisviz-alert/10 hover:text-gisviz-alert hover:border-gisviz-alert/50'
                    : 'bg-gisviz-ink text-gisviz-card hover:bg-gisviz-ink-soft'
                }`}
              >
                {followLoading ? <Loader2 size={15} className="animate-spin" /> : isFollowing ? (
                  <>
                    <UserCheck size={15} className="block group-hover:hidden text-gisviz-ink-soft" />
                    <UserMinus size={15} className="hidden group-hover:block text-gisviz-alert" />
                    <span className="block group-hover:hidden">Following</span>
                    <span className="hidden group-hover:block">Unfollow</span>
                  </>
                ) : (
                  <><UserPlus size={15} /> Follow</>
                )}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ── 2. Content Section ── */}
      <div className="flex flex-col w-full gap-6">
        
        {/* Tabs & Controls Row */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
          
          {/* 50/50 Split Segmented Tabs */}
          <div className="flex items-center w-full md:w-auto md:min-w-[360px] bg-gisviz-paper/60 p-1.5 rounded-[12px] border border-gisviz-border shadow-sm">
            <button
              onClick={() => setActiveTab('Posts')}
              className={`flex-1 h-9 flex items-center justify-center gap-2 rounded-[8px] text-[13.5px] font-semibold transition-all ${
                activeTab === 'Posts' 
                  ? 'bg-gisviz-card text-gisviz-ink shadow-sm border border-gisviz-border/50' 
                  : 'text-gisviz-ink-soft hover:text-gisviz-ink'
              }`}
            >
              <Grid size={15} /> Published
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('saved')}
                className={`flex-1 h-9 flex items-center justify-center gap-2 rounded-[8px] text-[13.5px] font-semibold transition-all ${
                  activeTab === 'saved' 
                    ? 'bg-gisviz-card text-gisviz-ink shadow-sm border border-gisviz-border/50' 
                    : 'text-gisviz-ink-soft hover:text-gisviz-ink'
                }`}
              >
                <Bookmark size={15} className={activeTab === 'saved' ? 'fill-current' : ''} /> Bookmarks
              </button>
            )}
          </div>

          {/* Action Bar (Sort & Publish) */}
          <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            <button
              onClick={() => setSortOption(prev => prev === 'latest' ? 'alphabetical' : 'latest')}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] border border-gisviz-border bg-gisviz-paper text-[13px] font-medium text-gisviz-ink hover:border-gisviz-border-strong transition-all select-none shadow-sm"
            >
              <ArrowUpDown size={14} className="text-gisviz-ink-soft" />
              {sortOption === 'latest' ? 'Sort: Latest First' : 'Sort: Alphabetical'}
            </button>
            
            {isOwnProfile && activeTab === 'Posts' && (
              <Link href="/publish" className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-[8px] bg-gisviz-accent text-[13.5px] font-semibold text-[color:var(--accent-on)] hover:brightness-110 transition-[filter] shadow-sm">
                <Plus size={15} /> Publish
              </Link>
            )}
          </div>
        </div>

        {/* Feed List Grid */}
        <div className="w-full">
          {(activeTab === 'saved' && bookmarksLoading) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {Array.from({ length: 4 }).map((_, i) => <FeedCardSkeleton key={i} />)}
            </div>
          ) : sortedPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {sortedPosts.map((post: any) => (
                activeTab === 'Posts' ? (
                  <ProfilePostCard 
                    key={post.post_id} 
                    post={post} 
                    isOwnProfile={isOwnProfile}
                    isBookmarkView={false}
                    onLike={onLike}
                    onBookmark={onBookmark}
                    onShare={setSharing}
                    busy={busyId === post.post_id}
                    onEdit={() => router.push(`/post/${post.post_id}/edit`)}
                  />
                ) : (
                  <FeedCard
                    key={post.post_id}
                    post={post}
                    onLike={onLike}
                    onBookmark={onBookmark}
                    onShare={setSharing}
                    busy={busyId === post.post_id}
                  />
                )
              ))}
            </div>
          ) : (
            <div className="rounded-[16px] border border-gisviz-border bg-gisviz-card p-14 flex flex-col items-center gap-4 text-center w-full mt-2 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-gisviz-paper border border-gisviz-border flex items-center justify-center">
                 <Inbox size={28} className="text-gisviz-ink-soft" />
              </div>
              <div>
                <p className="font-display text-[20px] font-bold text-gisviz-ink mb-1">
                  {activeTab === 'Posts' ? 'No posts published yet' : 'No saved posts'}
                </p>
                <p className="text-[14.5px] text-gisviz-ink-soft">
                  {activeTab === 'Posts' 
                    ? (isOwnProfile ? "You haven't shared any visual posts with the community." : `@${handle} hasn't published anything yet.`) 
                    : "Posts you bookmark will appear here."}
                </p>
              </div>
              {isOwnProfile && activeTab === 'Posts' && (
                 <Link href="/publish" className="mt-2 text-[13.5px] font-semibold text-gisviz-accent hover:underline">
                   Create your first post &rarr;
                 </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {sharing && (
        <ShareModal
          isOpen={!!sharing}
          onClose={() => setSharing(null)}
          url={`/post/${sharing.post_id}`}
          title={sharing.title}
        />
      )}
    </main>
  )
}