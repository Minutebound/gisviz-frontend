'use client'
/** The discussion under a post: comments with one level of replies (backend /posts/{id}/comments). */
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { CornerDownRight, Loader2, MessageSquare, Send, X } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'
import { mediaUrl } from '../feed/FeedCard'

interface CommentData {
  comment_id: string
  publisher_handle: string
  publisher_avatar_path: string | null
  content: string
  created_timestamp: string
  replies: CommentData[]
}

export default function PostComments({ postId, count, signedIn, onAdded }: {
  postId: string
  count: number
  signedIn: boolean
  onAdded?: () => void
}) {
  const [comments, setComments] = useState<CommentData[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; handle: string } | null>(null)

  useEffect(() => { gisvizApi.fetchComments(postId).then(c => setComments(c || [])).catch(() => setComments([])) }, [postId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true); setError('')
    try {
      await gisvizApi.addComment(postId, text, replyTo?.id)
      setComments((await gisvizApi.fetchComments(postId)) || [])
      setText(''); setReplyTo(null); onAdded?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to post comment.')
    } finally {
      setBusy(false)
    }
  }

  const render = (c: CommentData, reply = false): React.ReactNode => {
    const avatar = mediaUrl(c.publisher_avatar_path)
    return (
      <div key={c.comment_id} className={`flex gap-3 ${reply ? 'mt-3 border-l-2 border-gisviz-border/50 pl-4' : 'pt-4 first:pt-0'}`}>
        {avatar
          ? <img src={avatar} alt="" className="h-8 w-8 shrink-0 rounded-full border border-gisviz-border object-cover" />
          : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gisviz-accent/15 text-[12px] font-bold uppercase text-gisviz-accent">{c.publisher_handle.charAt(0)}</span>}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <Link href={`/profile/${c.publisher_handle}`} className="text-[13px] font-semibold text-gisviz-ink hover:text-gisviz-accent">@{c.publisher_handle}</Link>
            <span className="text-[11.5px] text-gisviz-ink-soft">{new Date(c.created_timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
          <p className="break-words text-[13.5px] leading-relaxed text-gisviz-ink">{c.content}</p>
          {!reply && signedIn && (
            <button onClick={() => setReplyTo({ id: c.comment_id, handle: c.publisher_handle })}
                    className="mt-1 inline-flex items-center gap-1 text-[12px] text-gisviz-ink-soft hover:text-gisviz-accent">
              <CornerDownRight size={13} /> Reply
            </button>
          )}
          {!reply && c.replies?.map(r => render(r, true))}
        </div>
      </div>
    )
  }

  return (
    <section id="discussion" className="overflow-hidden rounded-[14px] border border-gisviz-border bg-gisviz-card">
      <h2 className="flex items-center gap-2 border-b border-gisviz-border px-4 py-3 font-display text-[15px] font-bold text-gisviz-ink">
        <MessageSquare size={15} className="text-gisviz-accent" /> Discussion ({count})
      </h2>
      <div className="max-h-[560px] divide-y divide-gisviz-border/50 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: 'thin' }}>
        {comments.length === 0
          ? <p className="py-6 text-center text-[13px] text-gisviz-ink-soft">No comments yet.</p>
          : comments.map(c => render(c))}
      </div>
      {signedIn ? (
        <div className="border-t border-gisviz-border bg-gisviz-paper/30 p-3">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-md border border-gisviz-border bg-gisviz-paper px-3 py-1 text-[12px] text-gisviz-ink-soft">
              <span>Replying to <b className="text-gisviz-ink">@{replyTo.handle}</b></span>
              <button onClick={() => setReplyTo(null)}><X size={13} /></button>
            </div>
          )}
          {error && <p className="mb-2 text-[12px] text-gisviz-alert">{error}</p>}
          <form onSubmit={submit} className="flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Write a comment…"
                   className="h-9 flex-1 rounded-[8px] border border-gisviz-border bg-gisviz-card px-3 text-[13px] text-gisviz-ink outline-none focus:ring-1 focus:ring-gisviz-accent" />
            <button type="submit" disabled={busy || !text.trim()}
                    className="grid h-9 w-10 place-items-center rounded-[8px] bg-gisviz-accent text-[color:var(--accent-on)] disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
        </div>
      ) : (
        <p className="border-t border-gisviz-border p-3 text-center">
          <Link href="/auth" className="text-[13px] font-semibold text-gisviz-accent hover:underline">Log in to join the conversation</Link>
        </p>
      )}
    </section>
  )
}