'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LegalContent {
  title: string
  last_updated: string
  content: string
}

const LEGAL_PAGES = [
  { slug: 'privacy',       label: 'Privacy Policy' },
  { slug: 'terms',         label: 'Terms of Service' },
  { slug: 'cookies',       label: 'Cookie Policy' },
  { slug: 'accessibility', label: 'Accessibility' },
]

export default function LegalPage({ slug }: { slug: string }) {
  const [data, setData]       = useState<LegalContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    
    // UPDATED: Appended /legal/${slug} to match the backend FastAPI route
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v0/legal/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [slug])

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">

      <nav className="mb-10 flex flex-wrap gap-x-6 gap-y-2 border-b border-gisviz-border pb-6">
       {LEGAL_PAGES.map(p => (
          <Link
            key={p.slug}
            // Add /legal/ right here 👇
            href={`/legal/${p.slug}`}
            className={`text-[12px] font-mono transition-colors ${
              p.slug === slug
                ? 'text-gisviz-accent font-bold'
                : 'text-gisviz-ink-soft hover:text-gisviz-ink'
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {loading && (
        <div className="text-gisviz-ink-soft text-[14px] font-mono animate-pulse">Loading…</div>
      )}

      {error && (
        <p className="text-gisviz-alert text-[14px] font-mono">Failed to load. Please try again.</p>
      )}

      {data && !loading && (
        <>
          <p className="text-[11px] font-mono text-gisviz-ink-soft uppercase tracking-widest mb-3">
            Last updated {data.last_updated}
          </p>
          <h1 className="text-[28px] font-bold text-gisviz-ink mb-8 font-display">
            {data.title}
          </h1>
          <div className="prose prose-sm max-w-none text-gisviz-ink leading-relaxed whitespace-pre-wrap font-sans text-[15px]">
            {data.content}
          </div>
        </>
      )}
    </div>
  )
}