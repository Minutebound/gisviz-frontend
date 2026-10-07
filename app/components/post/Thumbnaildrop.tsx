'use client'
/**
 * The post's image (feed cards, thumbnails, share previews), chosen by the publisher: drop a screenshot here,
 * paste one (Ctrl/⌘+V anywhere in the editor), or click to pick a file. Saved with the post
 * (PUT /posts/<id>/image), where it is centred on a 1080 x 1080 PNG.
 * Nothing chosen: the post keeps its current image (a new post gets the image the server draws).
 */
import React, { useEffect, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

const TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 15 * 1024 * 1024

export default function ThumbnailDrop({ file, onFile, current }: {
  file: File | null
  onFile: (f: File | null) => void
  current?: string | null          // the post's image now (edit)
}) {
  const [over, setOver] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const pick = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const take = (f?: File | null) => {
    if (!f) return
    if (!TYPES.includes(f.type)) { setError('Use a PNG, JPG or WebP image.'); return }
    if (f.size > MAX_BYTES) { setError('The image is larger than 15 MB.'); return }
    setError(''); onFile(f)
  }

  // a screenshot on the clipboard: paste it anywhere on the page (text pastes are left alone)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.kind === 'file' && i.type.startsWith('image/'))
      if (!item) return
      e.preventDefault()
      take(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const shown = preview || current || null
  return (
    <div>
      <div role="button" tabIndex={0} onClick={() => pick.current?.click()}
           onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick.current?.click() } }}
           onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
           onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]) }}
           className={`flex cursor-pointer items-center gap-3 rounded-[10px] border border-dashed p-2 transition-colors ${
             over ? 'border-gisviz-accent bg-gisviz-accent/10' : 'border-gisviz-border hover:border-gisviz-accent/60 hover:bg-gisviz-paper'}`}>
        <span className="relative grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-[8px] bg-gisviz-paper">
          {shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt="" className="h-full w-full object-cover" />
            : <ImagePlus size={20} className="text-gisviz-ink-soft" />}
        </span>
        <span className="min-w-0 text-[12px] leading-snug text-gisviz-ink-soft">
          <span className="block font-semibold text-gisviz-ink">{file ? file.name : shown ? 'Replace the image' : 'Add an image'}</span>
          Drop a screenshot of the poster, paste it (Ctrl/⌘+V) or click to choose.
        </span>
        {file && (
          <button type="button" aria-label="Remove the chosen image" onClick={e => { e.stopPropagation(); onFile(null) }}
                  className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full text-gisviz-ink-soft hover:bg-gisviz-paper hover:text-gisviz-ink">
            <X size={14} />
          </button>
        )}
      </div>
      <input ref={pick} type="file" accept={TYPES.join(',')} hidden onChange={e => { take(e.target.files?.[0]); e.target.value = '' }} />
      {error && <p className="mt-1 text-[12px] text-gisviz-alert">{error}</p>}
    </div>
  )
}