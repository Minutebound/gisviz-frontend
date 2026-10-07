'use client'
/** New post: the shared PostForm in create mode (/post/upload?dataset=<id> opens on a dataset). */
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UploadCloud } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { canPublish } from '../../../lib/roles'
import NoPublishAccess from '../../components/post/NoPublishAccess'
import PostForm from '../../components/post/PostForm'

export default function UploadPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [preset, setPreset] = useState<string | undefined>()
  useEffect(() => { setPreset(new URLSearchParams(window.location.search).get('dataset') || undefined) }, [])
  useEffect(() => { if (!isLoading && !isAuthenticated) router.push('/auth?redirect=/post/upload') }, [isAuthenticated, isLoading, router])

  if (isLoading || !user) return <div className="grid h-64 place-items-center"><Loader2 size={30} className="animate-spin text-gisviz-accent" /></div>
  if (!canPublish(user)) return <NoPublishAccess what="publish posts" />

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <h1 className="mb-3 flex items-center gap-2 font-display text-[20px] font-bold tracking-tight text-gisviz-ink">
        <UploadCloud className="text-gisviz-accent" size={20} /> New post
        <span className="hidden text-[12.5px] font-normal text-gisviz-ink-soft sm:inline">· pick a dataset, tell its story, publish</span>
      </h1>
      <PostForm mode="create" presetDataset={preset} />
    </div>
  )
}