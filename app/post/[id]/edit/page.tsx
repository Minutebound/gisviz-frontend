'use client'
/** Edit a post: the shared PostForm, preloaded with the post (publisher, admins and editors only). */
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Edit2, Loader2 } from 'lucide-react'
import { useAuth } from '../../../../context/AuthContext'
import { gisvizApi } from '../../../../connector/api'
import { canPublish } from '../../../../lib/roles'
import NoPublishAccess from '../../../components/post/NoPublishAccess'
import PostForm, { type PostFormInitial } from '../../../components/post/PostForm'
import { choiceFromSpec } from '../../../../types/visuals'
import { toDesign } from '../../../../lib/poster'
import { DEFAULT_ACCENT } from '../../../../lib/referenceData'
import { mediaUrl } from '../../../components/feed/FeedCard'

export default function EditPostPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string
  const { user, isAuthenticated, isLoading } = useAuth() as any
  const [initial, setInitial] = useState<PostFormInitial | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) { router.push('/auth'); return }
    if (isLoading || !user || !canPublish(user)) return
    let live = true
    Promise.all([gisvizApi.fetchPost(postId), gisvizApi.fetchAccess('post', postId).catch(() => null)])
      .then(([p, access]) => {
        if (!live) return
        if (!p.can_manage) { router.push(`/post/${postId}`); return }
        const b: any = p.backdrop
        const spec = p.visual_spec
        setInitial({
          title: p.title, description: p.description || '', note: p.note || '',
          image: mediaUrl(p.visual_image_path),
          source: p.dataset?.source_name || p.source_name
            ? { label: p.dataset?.source_name || p.source_name, url: p.dataset?.source_url || p.source_url || null } : null,
          keywords: (p.keywords || []).map((k: any) => k.word),
          categoryIds: (p.categories || []).map((c: any) => c.category_id),
          region: p.region || '',
          backdrop: b?.mode === 'none' || b?.motif === 'none' ? 'none' : b?.mode === 'custom' ? toDesign(b)! : 'auto',
          themeColor: p.theme_color || spec?.accent || DEFAULT_ACCENT,
          visualChoice: p.dataset_id && spec ? choiceFromSpec(p.dataset_id, spec) : null,
          visibility: p.visibility || 'public',
          postType: p.post_type || 'standard',
          canBePublic: access ? access.can_be_public !== false : true,
        })
      })
      .catch(() => live && setError('This post could not be loaded.'))
    return () => { live = false }
  }, [postId, isAuthenticated, isLoading, user, router])

  if (!isLoading && user && !canPublish(user)) return <NoPublishAccess what="edit posts" />
  if (error) return <p className="mx-auto mt-24 max-w-md text-center text-[14px] text-gisviz-alert">{error}</p>
  if (!initial) return <div className="grid h-[calc(100vh-4rem)] place-items-center"><Loader2 size={30} className="animate-spin text-gisviz-accent" /></div>

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <h1 className="mb-3 flex items-center gap-2 font-display text-[20px] font-bold tracking-tight text-gisviz-ink">
        <Edit2 className="text-gisviz-accent" size={18} /> Edit post
        <span className="hidden text-[12.5px] font-normal text-gisviz-ink-soft sm:inline">· the poster image is redrawn when you save</span>
      </h1>
      <PostForm mode="edit" postId={postId} initial={initial} />
    </div>
  )
}