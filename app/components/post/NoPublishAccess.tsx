'use client'
import React from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'

export default function NoPublishAccess({ what = 'publish or edit posts' }: { what?: string }) {
  return (
    <div className="max-w-md mx-auto mt-24 px-6 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-gisviz-border grid place-items-center text-gisviz-ink-soft">
        <Lock size={20} />
      </div>
      <h1 className="text-[18px] font-semibold text-gisviz-ink mb-2">You don&apos;t have access</h1>
      <p className="text-[13.5px] text-gisviz-ink-soft mb-6">
        Contact Support to requestAccess to {what}.
      </p>
      <Link href="/" className="inline-flex items-center h-9 px-4 rounded-[8px] bg-gisviz-accent text-[13.5px] font-semibold text-[color:var(--accent-on)]">
        Back to feed
      </Link>
    </div>
  )
}