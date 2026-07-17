'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Edit2, Image as ImageIcon, Loader2, Map as MapIcon, X, Tag, Info, Link as LinkIcon, Send, Bookmark } from 'lucide-react'
import { useAuth } from '../../../../context/AuthContext'
import { API_ORIGIN, gisvizApi } from '../../../../services/api'

export default function EditPostPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any

  const [isLoading, setIsLoading]   = useState(true)
  const [isSaving, setIsSaving]     = useState(false)
  const [errorMsg, setErrorMsg]     = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)

  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [note, setNote]             = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl]   = useState('')

  const [keywords, setKeywords]         = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])

  const [customCategoryLabel, setCustomCategoryLabel]   = useState('')
  const [isSubmittingCustom, setIsSubmittingCustom]     = useState(false)

  const [availableCategories, setAvailableCategories] = useState<any[]>([])

  const [file, setFile]                       = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]           = useState<string | null>(null)
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/auth'); return }

    const initData = async () => {
      try {
        const [cats, postData] = await Promise.all([
          gisvizApi.listCategories(),
          gisvizApi.fetchPost(postId),
        ])

        setAvailableCategories(cats)

        if (
          postData.publisher_user_id !== user?.user_id &&
          user?.role_name !== 'admin' &&
          user?.role_name !== 'editor'
        ) {
          router.push(`/post/${postId}`)
          return
        }

        setTitle(postData.title)
        setDescription(postData.description || '')
        setNote(postData.note || '')
        setSourceName(postData.source_name || '')
        setSourceUrl(postData.source_url || '')
        setKeywords(postData.keywords.map((k: any) => k.word))
        setSelectedCategoryIds(postData.categories.map((c: any) => c.category_id))

        setExistingImagePath(postData.visual_image_path)
        if (postData.visual_image_path) {
          setPreviewUrl(`${API_ORIGIN}${postData.visual_image_path}`)
        }
      } catch {
        setErrorMsg('Failed to load post data.')
      } finally {
        setIsLoading(false)
      }
    }

    if (postId && user) initData()
  }, [postId, isAuthenticated, authLoading, user, router])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      if (!f.type.startsWith('image/')) { setErrorMsg('Only image files are allowed.'); return }
      setFile(f)
      setPreviewUrl(URL.createObjectURL(f))
      setErrorMsg('')
    }
  }

  const addCategory = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value)
    if (id && !selectedCategoryIds.includes(id)) {
      if (selectedCategoryIds.length >= 2) { e.target.value = ''; return }
      setSelectedCategoryIds(prev => [...prev, id])
    }
    e.target.value = ''
  }

  const removeCategory = (id: number) =>
    setSelectedCategoryIds(prev => prev.filter(c => c !== id))

  const handleSuggestCategory = async () => {
    if (!customCategoryLabel.trim()) return
    setIsSubmittingCustom(true)
    try {
      await gisvizApi.suggestCategory(customCategoryLabel)
      setSuccessMsg(`"${customCategoryLabel}" proposed for review successfully.`)
      setCustomCategoryLabel('')
    } catch {
      setErrorMsg('Failed to suggest category. It may already exist.')
    } finally {
      setIsSubmittingCustom(false)
    }
  }

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.includes(',')) {
      const newKws = val.split(',').map(k => k.trim()).filter(k => k.length > 0)
      let updated = [...keywords]
      for (const kw of newKws) {
        if (updated.length < 3 && !updated.includes(kw)) updated.push(kw)
      }
      setKeywords(updated)
      setKeywordInput('')
    } else {
      setKeywordInput(val)
    }
  }

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const kw = keywordInput.trim()
      if (kw && keywords.length < 3 && !keywords.includes(kw)) setKeywords([...keywords, kw])
      setKeywordInput('')
    }
  }

  const removeKeyword = (kw: string) =>
    setKeywords(prev => prev.filter(k => k !== kw))

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  // ── 1. Strict Pre-flight Validation ──────────────────────────────────────
  if (!title.trim())                  { setErrorMsg('A title is required.'); return }
  if (!sourceName.trim())             { setErrorMsg('Data Source Name is required.'); return }
  if (selectedCategoryIds.length < 1) { setErrorMsg('Please select at least one category.'); return }
  if (keywords.length < 1)            { setErrorMsg('Please add at least one keyword.'); return }
  if (keywords.length > 3)            { setErrorMsg('You can only add up to 3 keywords.'); return }

  setIsSaving(true)
  setErrorMsg('')

  // Track the newly uploaded file specifically for rollbacks
  let uploadedVisualPath: string | null = null

  try {
    let finalImagePath = existingImagePath

    // ── 2. Upload the New Visual (Only if the user selected one) ───────────
    if (file) {
      const uploadRes = await gisvizApi.uploadVisual(file)
      uploadedVisualPath = uploadRes.visual_path
      finalImagePath = uploadedVisualPath
    }

    // ── 3. Update the Post ─────────────────────────────────────────────────
    await gisvizApi.updatePost(postId, {
      title: title.trim(),
      description: description?.trim() || null,
      note: note?.trim() || null,
      source_name: sourceName.trim(),
      source_url: sourceUrl?.trim() || null,
      visual_image_path: finalImagePath,
      category_ids: selectedCategoryIds,
      keywords,
    })

    // ── 4. Cleanup Old Visual (Success Scenario) ───────────────────────────
    // If a new file was uploaded AND the update succeeded, delete the old file.
    // We use .catch(console.error) so a deletion failure doesn't block the redirect.
    if (file && existingImagePath && existingImagePath !== finalImagePath) {
      gisvizApi.deleteVisual(existingImagePath).catch(console.error)
    }

    // ── 5. Success Redirect ────────────────────────────────────────────────
    router.push(`/post/${postId}`)

  } catch (err: any) {
    // ── 6. Rollback Orphaned New Visual (Failure Scenario) ─────────────────
    // If the post update failed, but we already uploaded a NEW image, delete it.
    if (uploadedVisualPath) {
      gisvizApi.deleteVisual(uploadedVisualPath).catch(console.error)
    }

    const detail = err.response?.data?.detail
    setErrorMsg(typeof detail === 'string' ? detail : 'Failed to update the post. Please try again.')
  } finally {
    setIsSaving(false)
  }
}

  if (isLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24 relative">

      <div className="mb-8">
        <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
          <Edit2 className="text-gisviz-accent" size={32} />
          Edit gisviz
        </h1>
        <p className="text-gisviz-ink-soft font-mono mt-2 text-[12px]">Update your visual map, dataset metadata, or sources.</p>
      </div>

      {errorMsg && (
        <div className="p-4 mb-6 rounded-md text-[12px] font-mono border bg-gisviz-alert/10 text-gisviz-alert border-gisviz-border flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')}><X size={16} /></button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 mb-6 rounded-md text-[12px] font-mono border bg-gisviz-safe/5 text-gisviz-accent border-gisviz-border flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')}><X size={16} /></button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── LEFT COLUMN — image + guidelines only (same as upload page) ── */}
        <div className="lg:col-span-5 space-y-4">

          {/* Image drop zone */}
          <div
            className={`w-full aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${
              previewUrl ? 'border-gisviz-accent bg-gisviz-canvas' : 'border-gisviz-border bg-gisviz-card hover:border-gisviz-accent'
            }`}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gisviz-black/10 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-gisviz-white gap-3 z-10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="p-2.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                    title="Enlarge Visual"
                  >
                    <ImageIcon size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                    title="Change Visual"
                  >
                    <Edit2 size={24} />
                  </button>
                </div>
              </>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="text-center p-6 text-gisviz-ink-soft group-hover:text-gisviz-accent transition-colors z-10 w-full h-full flex flex-col items-center justify-center"
              >
                <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold text-[12px] mb-1">Click to browse or drag & drop</p>
                <p className="font-mono text-[12px] uppercase opacity-75">JPG, PNG, WebP • Max 10MB</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          {/* Guidelines */}
          <div className="bg-gisviz-rail border border-gisviz-border rounded-xl p-4 text-[12px] font-mono text-gisviz-ink-soft">
            <h4 className="font-bold text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-2 text-[12px]">
              <MapIcon size={14} /> Post Guidelines
            </h4>
            <ul className="space-y-1.5 list-inside list-disc opacity-80 text-[12px]">
              <li>Ensure maps have appropriate legends or scale bars.</li>
              <li>Always credit your data sources accurately below.</li>
              <li>Do not upload sensitive or proprietary coordinates.</li>
            </ul>
          </div>
        </div>

        {/* ── RIGHT COLUMN — metadata (identical structure to upload page) ── */}
        <div className="lg:col-span-7 bg-gisviz-card border border-gisviz-border rounded-xl p-6 sm:p-8 shadow-sm h-fit">
          <div className="space-y-6">

            {/* Title */}
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">
                Post Title <span className="text-gisviz-alert">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Boulder County LiDAR Elevation Model"
                className="w-full bg-gisviz-canvas text-camelcase border border-gisviz-border rounded-md px-4 py-3 text-gisviz-ink font-display font-medium text-[16px] focus:ring-2 focus:ring-gisviz-accent outline-none"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">Description & Context</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the data sources, methodology, or interesting findings..."
                className="w-full bg-gisviz-canvas border text-camelcase border-gisviz-border rounded-md px-4 py-3 text-gisviz-ink font-sans text-[12px] focus:ring-2 focus:ring-gisviz-accent outline-none min-h-[120px] resize-y"
              />
            </div>

            {/* ── Note & Source — same grid/border-y layout as upload page ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-y border-gisviz-border py-4">

              {/* Note — full width */}
              <div className="md:col-span-2">
                <label className="text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={14} /> Important Note / Limitation
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Data may contain copyright boundaries. Used with permission."
                  className="w-full bg-gisviz-canvas border text-camelcase border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-[12px] focus:ring-1 focus:ring-gisviz-accent outline-none"
                />
              </div>

              {/* Source Name */}
              <div>
                <label className="text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider block">
                  Data Source Name <span className="text-gisviz-alert">*</span>
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={e => setSourceName(e.target.value)}
                  placeholder="e.g. OpenStreetMap / USGS"
                  className="w-full bg-gisviz-canvas border text-camelcase border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-[12px] focus:ring-1 focus:ring-gisviz-accent outline-none"
                />
              </div>

              {/* Source URL */}
              <div>
                <label className="text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <LinkIcon size={12} /> Data Source Link
                </label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-[12px] focus:ring-1 focus:ring-gisviz-accent outline-none"
                />
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-[12px] uppercase font-mono text-gisviz-ink-soft mb-2 tracking-wider">
                Categorization (Max 2) <span className="text-gisviz-alert">*</span>
              </label>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {selectedCategoryIds.map(id => {
                    const cat = availableCategories.find(c => c.category_id === id)
                    return cat ? (
                      <span key={id} className="flex items-center gap-1.5 px-3 py-1 bg-gisviz-accent text-gisviz-white rounded-md font-mono text-[12px] shadow-sm text-camelcase tracking-wider">
                        {cat.label}
                        <button type="button" onClick={() => removeCategory(id)} className="hover:text-gisviz-alert/60"><X size={12} /></button>
                      </span>
                    ) : null
                  })}
                  {selectedCategoryIds.length === 0 && (
                    <span className="text-[12px] font-mono text-gisviz-ink-soft">No categories selected.</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 w-full">
                    <select
                      onChange={addCategory}
                      value=""
                      disabled={selectedCategoryIds.length >= 2}
                      className="w-full bg-gisviz-canvas text-camelcase border border-gisviz-border rounded-md px-3 py-2.5 text-gisviz-ink text-[12px] focus:ring-2 focus:ring-gisviz-accent outline-none font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>+ Add an existing Category...</option>
                      {availableCategories.map(cat => (
                        <option key={cat.category_id} value={cat.category_id} disabled={selectedCategoryIds.includes(cat.category_id)}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex w-full sm:w-auto flex-1 gap-2">
                    <input
                      type="text"
                      value={customCategoryLabel}
                      onChange={e => setCustomCategoryLabel(e.target.value)}
                      placeholder="Propose custom..."
                      className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink font-mono text-[12px] focus:ring-1 focus:ring-gisviz-accent outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSuggestCategory}
                      disabled={!customCategoryLabel || isSubmittingCustom}
                      className="px-3 py-2 bg-gisviz-rail-soft text-gisviz-ink border border-gisviz-border rounded-md hover:border-gisviz-accent hover:text-gisviz-accent transition-colors disabled:opacity-50"
                      title="Submit for Approval"
                    >
                      {isSubmittingCustom ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={14} /> Keywords (Max 3 Comma-Separated) <span className="text-gisviz-alert">*</span>
              </label>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {keywords.map(kw => (
                    <span key={kw} className="flex items-center gap-1.5 px-3 py-1 bg-gisviz-accent text-gisviz-white rounded-md font-mono text-[12px] shadow-sm text-camelcase tracking-wider">
                      {kw}
                      <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-gisviz-alert/60"><X size={12} /></button>
                    </span>
                  ))}
                  {keywords.length === 0 && (
                    <span className="text-[12px] font-mono text-gisviz-ink-soft">No keywords added.</span>
                  )}
                </div>

                <input
                  type="text"
                  value={keywordInput}
                  onChange={handleKeywordChange}
                  onKeyDown={handleKeywordKeyDown}
                  disabled={keywords.length >= 3}
                  placeholder={keywords.length >= 3 ? 'Limit reached' : 'Type a keyword and press comma or enter'}
                  className="w-full bg-gisviz-canvas border border-gisviz-border text-camelcase rounded-md px-4 py-2.5 text-gisviz-ink font-mono text-[12px] focus:ring-2 focus:ring-gisviz-accent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-6 border-t border-gisviz-border flex justify-end gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-md font-mono text-[12px] border border-gisviz-border text-gisviz-ink-soft hover:bg-gisviz-rail transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-gisviz-accent text-gisviz-white py-2.5 px-8 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold shadow-md disabled:opacity-70 uppercase tracking-wide"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Bookmark size={18} />}
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      </form>

      {/* Image Enlargement Modal */}
      {isModalOpen && previewUrl && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-xl bg-gisviz-black/10 flex items-center justify-center p-4 md:p-8"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative bg-gisviz-card border border-gisviz-border rounded-2xl shadow-2xl p-2 max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 bg-white/30 backdrop-blur-md rounded-full text-gisviz-white hover:bg-white/40 transition-colors shadow-lg"
            >
              <X size={24} className="text-gisviz-ink" />
            </button>
            <img src={previewUrl} alt="Enlarged Post Visual" className="w-full h-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}