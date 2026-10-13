'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowUpDown, Loader2, UserCheck, UserPlus, UserMinus, 
  MapPin, Edit2, Image as ImageIcon, Plus, Grid, Inbox, 
  Link as LinkIcon, Share2, MessageSquare, Bookmark, BarChart2, Heart, Database, Lock, Radio, Users, Building2, BadgeCheck, Globe2
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { canPublish } from '../../../lib/roles'
import { gisvizApi, POSTS_CHANGED } from '../../../connector/api'
import { Post } from '../../../types/gisviz'
import ShareModal from '../../components/SharePost'
import type { SharedWithMe } from '../../../types/access'

// ── Profile post card, horizontal: on the left the category, title, date, who can see it (access level) and the
//    numbers; on the right a small square of the poster image (zoomed to the poster's edge).
function ProfilePostCard({ post, onLike, onBookmark, onShare, busy, isOwnProfile, onEdit }: any) {
  const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api/v0', '').replace(/\/$/, '')
  const getMediaUrl = (path: string | null | undefined) => {
    if (!path) return null
    if (/^https?:\/\//.test(path)) return path
    const safe = path.startsWith('/') ? path : `/${path}`
    return `${API_BASE_URL}${safe}`
  }
  const isInactive = post.is_active === 0
  const imgPath = getMediaUrl(post.thumbnail_url || post.map_preview?.thumbnail_path || post.visual_image_path)
  const [broken, setBroken] = useState(false)               // the file is missing (404): show "No visual"
  useEffect(() => setBroken(false), [imgPath])
  const thumbUrl = broken ? null : imgPath
  const cat = post.categories?.[0]
  const when = post.created_timestamp || post.created_at
  const access = post.shared_by
    ? { icon: <Users size={11} />, text: post.shared_by.via === 'you' ? `Shared by ${post.shared_by.handle ? '@' + post.shared_by.handle : post.shared_by.label ?? 'someone'}` : `Shared via ${post.shared_by.via}`, cls: 'bg-gisviz-accent/10 text-gisviz-accent' }
    : post.visibility === 'private'
      ? { icon: <Lock size={11} />, text: 'Private', cls: 'bg-gisviz-ink text-gisviz-card' }
      : { icon: <Globe2 size={11} />, text: 'Public', cls: 'bg-gisviz-paper text-gisviz-ink-soft' }
  const chip = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold'

  return (
    <article className={`group flex h-full items-stretch gap-3 overflow-hidden rounded-[14px] border bg-gisviz-card p-3 shadow-sm transition-all hover:shadow-md sm:gap-4 ${
      isInactive ? 'border-dashed border-amber-300/80' : 'border-gisviz-border hover:border-gisviz-accent/40'}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {cat && <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: cat.theme_color || undefined }}>{cat.label}</span>}
          <span className={`${chip} ${access.cls}`} title="Who can see it">{access.icon} {access.text}</span>
          {post.post_type === 'live' && <span className={`${chip} bg-gisviz-alert/10 text-gisviz-alert`}><Radio size={11} /> Live</span>}
          {isInactive && <span className={`${chip} bg-amber-100 text-amber-800`}>Inactive</span>}
        </div>
        <Link href={`/post/${post.post_id}`}>
          <h3 className="font-display text-[15px] font-bold leading-snug text-gisviz-ink line-clamp-2 transition-colors group-hover:text-gisviz-accent sm:text-[16.5px]">{post.title}</h3>
        </Link>
        {when && <span className="text-[11.5px] text-gisviz-ink-soft">{new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
        <div className="mt-auto flex items-center gap-3 pt-1 text-[12px] font-medium text-gisviz-ink-soft">
          <span className="inline-flex items-center gap-1" title="Views"><BarChart2 size={12} /> {post.views_count || 0}</span>
          <button disabled={busy} onClick={() => onLike(post)} title="Likes"
                  className={`inline-flex items-center gap-1 transition-colors ${post.is_liked ? 'text-gisviz-accent' : 'hover:text-gisviz-ink'}`}>
            <Heart size={12} className={post.is_liked ? 'fill-current' : ''} /> {post.total_likes_count || 0}
          </button>
          <span className="inline-flex items-center gap-1" title="Comments"><MessageSquare size={12} /> {post.total_comments_count || 0}</span>
          <span className="ml-auto flex items-center gap-0.5">
            {isOwnProfile && onEdit && (
              <button onClick={onEdit} title="Edit post" className="p-1 transition-colors hover:text-gisviz-accent"><Edit2 size={13} /></button>
            )}
            {!isOwnProfile && (
              <button disabled={busy} onClick={() => onBookmark(post)} title="Save"
                      className={`p-1 transition-colors ${post.is_bookmarked ? 'text-gisviz-accent' : 'hover:text-gisviz-ink'}`}>
                <Bookmark size={13} className={post.is_bookmarked ? 'fill-current' : ''} />
              </button>
            )}
            <button onClick={() => onShare(post)} title="Share" className="p-1 transition-colors hover:text-gisviz-ink"><Share2 size={13} /></button>
          </span>
        </div>
      </div>
      <Link href={`/post/${post.post_id}`} className="relative block aspect-square w-[104px] shrink-0 self-center overflow-hidden rounded-[10px] bg-gisviz-paper sm:w-[128px]" aria-label={post.title}>
        {thumbUrl
          ? <img src={thumbUrl} alt="" loading="lazy" onError={() => setBroken(true)} className={`h-full w-full scale-[1.1] object-cover transition-transform duration-500 group-hover:scale-[1.2] ${isInactive ? 'grayscale' : ''}`} />
          : <span className="grid h-full w-full place-items-center font-mono text-[10px] text-gisviz-ink-soft">No visual</span>}
      </Link>
    </article>
  )
}

export default function ProfileHandlePage() {
  const params = useParams()
  const router = useRouter()
  const handle = params.handle as string
  const { user, isAuthenticated } = useAuth() as any

  const [activeTab, setActiveTab] = useState<'publications' | 'saved' | 'shared'>('publications')
  const [shared, setShared] = useState<SharedWithMe | null>(null)
  const [sharedLoading, setSharedLoading] = useState(false)
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

  // a post was published / edited / deleted (here, in another page or another tab), or the page is shown again:
  // load the cards again so they carry the newest poster images
  useEffect(() => {
    if (!handle) return
    const reload = () => {
      gisvizApi.fetchUserPosts(handle).then(p => setPosts(p || [])).catch(() => {})
      setBookmarksLoaded(false)
      setShared(null)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    const onStorage = (e: StorageEvent) => { if (e.key === POSTS_CHANGED) reload() }
    window.addEventListener(POSTS_CHANGED, reload)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(POSTS_CHANGED, reload)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [handle])

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

  // the Shared tab: what people and organisations shared with me (own profile only)
  useEffect(() => {
    if (activeTab !== 'shared' || !isOwnProfile || shared || sharedLoading) return
    setSharedLoading(true)
    gisvizApi.fetchSharedWithMe().then(setShared).catch(() => setShared({ posts: [], datasets: [] }))
      .finally(() => setSharedLoading(false))
  }, [activeTab, isOwnProfile, shared, sharedLoading])

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
    if (activeTab === 'publications') setPosts(ps => ps.map(p => (p.post_id === id ? fn(p) : p)))
    else if (activeTab === 'shared') setShared(sh => sh ? { ...sh, posts: sh.posts.map(p => (p.post_id === id ? fn(p) : p)) } : sh)
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

  const activeList = activeTab === 'publications' ? posts : activeTab === 'shared' ? (shared?.posts ?? []) : bookmarks
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
        <div className="w-full h-[110px] sm:h-[150px] relative group border-b border-gisviz-border">
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

        {/* details, compact: avatar · name, handle, organisation · title · place, website · numbers · action */}
        <div className="relative flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pb-5">
          <div className="relative z-10 -mt-10 grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[18px] border-4 border-gisviz-card bg-gisviz-paper text-[26px] font-bold text-gisviz-ink-soft shadow-sm sm:-mt-12 sm:h-24 sm:w-24">
            {avatarSrc && !imageError ? (
              <img src={avatarSrc} alt={profile.user_handle} className="h-full w-full object-cover" onError={() => setImageError(true)} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-gisviz-accent to-gisviz-safe text-[color:var(--accent-on)]">{profileInitials}</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h1 className="truncate font-display text-[22px] font-bold leading-tight tracking-tight text-gisviz-ink sm:text-[24px]">
                {profile.name || profile.user_handle.replace(/_/g, ' ')}
              </h1>
              <span className="text-[13.5px] text-gisviz-ink-soft">@{profile.user_handle}</span>
              {profile.organization && (
                <span className="inline-flex items-center gap-1 rounded-md bg-gisviz-accent/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-gisviz-accent" title={`Verified organisation · members @${profile.organization.email_domain}`}>
                  <Building2 size={11} /> {profile.organization.name} <BadgeCheck size={11} />
                </span>
              )}
            </div>
            {profile.title && <p className="mt-0.5 line-clamp-1 text-[13.5px] text-gisviz-ink">{profile.title}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-gisviz-ink-soft">
              {profile.location?.formatted_string && (
                <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-gisviz-accent" /><span className="max-w-[220px] truncate">{profile.location.formatted_string}</span></span>
              )}
              {profile.website_url && (
                <a href={profile.website_url.startsWith('http') ? profile.website_url : `https://${profile.website_url}`} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1 hover:text-gisviz-accent hover:underline"><LinkIcon size={12} /> Website</a>
              )}
              <span><b className="font-semibold text-gisviz-ink">{profile.post_count || posts.length}</b> posts</span>
              <span><b className="font-semibold text-gisviz-ink">{profile.follower_count || 0}</b> followers</span>
              <span><b className="font-semibold text-gisviz-ink">{profile.following_count || 0}</b> following</span>
            </div>
          </div>

          <div className="shrink-0">
            {isOwnProfile ? (
              <Link href="/settings" className="flex h-9 items-center justify-center gap-2 rounded-[10px] border border-gisviz-border bg-gisviz-paper px-4 text-[13px] font-semibold text-gisviz-ink shadow-sm transition-all hover:border-gisviz-border-strong">
                <Edit2 size={13} className="text-gisviz-ink-soft" /> Edit profile
              </Link>
            ) : (
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`group flex h-9 min-w-[120px] items-center justify-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold shadow-sm transition-all disabled:opacity-50 ${
                  isFollowing
                    ? 'border border-gisviz-border bg-gisviz-paper text-gisviz-ink hover:border-gisviz-alert/50 hover:bg-gisviz-alert/10 hover:text-gisviz-alert'
                    : 'bg-gisviz-ink text-gisviz-card hover:bg-gisviz-ink-soft'
                }`}
              >
                {followLoading ? <Loader2 size={14} className="animate-spin" /> : isFollowing ? (
                  <>
                    <UserCheck size={14} className="block text-gisviz-ink-soft group-hover:hidden" />
                    <UserMinus size={14} className="hidden text-gisviz-alert group-hover:block" />
                    <span className="block group-hover:hidden">Following</span>
                    <span className="hidden group-hover:block">Unfollow</span>
                  </>
                ) : (
                  <><UserPlus size={14} /> Follow</>
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
              onClick={() => setActiveTab('publications')}
              className={`flex-1 h-9 flex items-center justify-center gap-2 rounded-[8px] text-[13.5px] font-semibold transition-all ${
                activeTab === 'publications' 
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
                <Bookmark size={15} className={activeTab === 'saved' ? 'fill-current' : ''} /> Saved
              </button>
            )}
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('shared')}
                className={`flex-1 h-9 flex items-center justify-center gap-2 rounded-[8px] text-[13.5px] font-semibold transition-all ${
                  activeTab === 'shared'
                    ? 'bg-gisviz-card text-gisviz-ink shadow-sm border border-gisviz-border/50'
                    : 'text-gisviz-ink-soft hover:text-gisviz-ink'
                }`}
              >
                <Users size={15} /> Shared
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
            
            {isOwnProfile && activeTab === 'publications' && (
              <Link href="/post/upload" className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-[8px] bg-gisviz-accent text-[13.5px] font-semibold text-[color:var(--accent-on)] hover:brightness-110 transition-[filter] shadow-sm">
                <Plus size={15} /> Publish
              </Link>
            )}
          </div>
        </div>

        {/* Feed List Grid */}
        <div className="w-full">
          {activeTab === 'shared' && (shared?.datasets?.length ?? 0) > 0 && (
            <div className="mb-5 rounded-[14px] border border-gisviz-border bg-gisviz-card overflow-hidden">
              <h3 className="flex items-center gap-2 border-b border-gisviz-border px-4 py-2.5 text-[13.5px] font-bold text-gisviz-ink">
                <Database size={14} className="text-gisviz-accent" /> Datasets shared with you ({shared!.datasets.length})
              </h3>
              <ul className="divide-y divide-gisviz-border/60">
                {shared!.datasets.map(d => (
                  <li key={d.dataset_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold text-gisviz-ink">
                        {d.title}
                        {d.pipeline === 'stream' && <span className="inline-flex items-center gap-0.5 rounded bg-gisviz-alert/10 px-1.5 text-[10px] font-bold uppercase text-gisviz-alert"><Radio size={9} /> Live</span>}
                      </span>
                      <span className="block font-mono text-[11px] text-gisviz-ink-soft">
                        {d.dataset_id} · {Number(d.row_count || 0).toLocaleString()} rows · {d.shared_by.via === 'you'
                          ? `from ${d.shared_by.handle ? '@' + d.shared_by.handle : d.shared_by.label ?? 'an admin'}` : `via ${d.shared_by.via}`}
                        {d.shared_by.at ? ` · ${new Date(d.shared_by.at).toLocaleDateString()}` : ''}
                      </span>
                    </span>
                    {canPublish(user) && (
                      <Link href={`/post/upload?dataset=${encodeURIComponent(d.dataset_id)}`} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-gisviz-border px-3 text-[12.5px] font-semibold text-gisviz-ink hover:border-gisviz-accent hover:text-gisviz-accent">
                        <Plus size={13} /> Build a post
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {((activeTab === 'saved' && bookmarksLoading) || (activeTab === 'shared' && sharedLoading)) ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[154px] animate-pulse rounded-[14px] border border-gisviz-border bg-gisviz-paper" />)}
            </div>
          ) : sortedPosts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {sortedPosts.map((post: any) => (
                <div key={post.post_id}>
                  <ProfilePostCard
                    post={post}
                    isOwnProfile={isOwnProfile && activeTab === 'publications'}
                    onLike={onLike}
                    onBookmark={onBookmark}
                    onShare={setSharing}
                    busy={busyId === post.post_id}
                    onEdit={canPublish(user) && activeTab === 'publications' ? () => router.push(`/post/${post.post_id}/edit`) : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[16px] border border-gisviz-border bg-gisviz-card p-14 flex flex-col items-center gap-4 text-center w-full mt-2 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-gisviz-paper border border-gisviz-border flex items-center justify-center">
                 <Inbox size={28} className="text-gisviz-ink-soft" />
              </div>
              <div>
                <p className="font-display text-[20px] font-bold text-gisviz-ink mb-1">
                  {activeTab === 'publications' ? 'No posts published yet' : activeTab === 'shared' ? 'Nothing shared with you yet' : 'No saved posts'}
                </p>
                <p className="text-[14.5px] text-gisviz-ink-soft">
                  {activeTab === 'publications' 
                    ? (isOwnProfile ? "You haven't shared any visual posts with the community." : `@${handle} hasn't published anything yet.`) 
                    : activeTab === 'shared'
                      ? 'Private posts and datasets that people or your organisation share with you appear here, with who shared them.'
                      : 'Posts you bookmark will appear here.'}
                </p>
              </div>
              {isOwnProfile && activeTab === 'publications' && (
                 <Link href="/post/upload" className="mt-2 text-[13.5px] font-semibold text-gisviz-accent hover:underline">
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