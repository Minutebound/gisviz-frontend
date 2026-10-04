'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Edit2, Loader2, X, Tag, Info, Link as LinkIcon, Send, Bookmark } from 'lucide-react'
import { useAuth } from '../../../../context/AuthContext'
import { gisvizApi } from '../../../../connector/api'
import { canPublish } from '../../../../lib/roles'
import NoPublishAccess from '../../../components/post/NoPublishAccess'
import DatasetVisualPicker from '../../../components/post/DataVisualPicker'
import type { VisualChoice, DatasetCard } from '../../../../types/visuals'
import { DEFAULT_ACCENT } from '../../../../lib/referenceData'

export default function EditPostPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any

  const [isLoading, setIsLoading]   = useState(true)
  const [isSaving, setIsSaving]     = useState(false)
  const [errorMsg, setErrorMsg]     = useState('')
  const [successMsg, setSuccessMsg] = useState('')

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

  // The visual comes from a dataset: the picker is preloaded with the post's current choice.
  const [visualChoice, setVisualChoice] = useState<VisualChoice | null>(null)
  const [themeColor, setThemeColor]     = useState<string>(DEFAULT_ACCENT)

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/auth'); return }
    if (authLoading || !user || !canPublish(user)) { if (!authLoading) setIsLoading(false); return }   // no fetch for roles without edit access

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

        // Rebuild the picker choice from the saved spec.
        const spec = postData.visual_spec
        if (postData.dataset_id && spec) {
          const isMap = spec.kind === 'map'
          setVisualChoice({
            dataset_id: postData.dataset_id,
            viz: isMap ? (spec.map_style === 'heat' ? 'map_heat' : 'map') : spec.chart_type,
            x: isMap ? null : spec.x ?? null,
            y: isMap ? spec.value_field ?? null : spec.y ?? null,
            z: spec.z ?? null,
            size: spec.size ?? null,
            label_field: isMap ? spec.label_field ?? null : null,
          } as VisualChoice)
        }
        setThemeColor(postData.theme_color || spec?.accent || DEFAULT_ACCENT)
      } catch {
        setErrorMsg('Failed to load post data.')
      } finally {
        setIsLoading(false)
      }
    }

    if (postId && user) initData()
  }, [postId, isAuthenticated, authLoading, user, router])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleVisualChange = (choice: VisualChoice | null, _card?: DatasetCard) => setVisualChoice(choice)

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

  try {
    // The server re-validates the choice, rebuilds the spec + PNG and removes the old preview.
    await gisvizApi.updatePost(postId, {
      title: title.trim(),
      description: description?.trim() || null,
      note: note?.trim() || null,
      source_name: sourceName.trim(),
      source_url: sourceUrl?.trim() || null,
      dataset_id: visualChoice?.dataset_id,
      visual_params: visualChoice ? {
        viz: visualChoice.viz,
        x: visualChoice.x ?? null,
        y: visualChoice.y ?? null,
        z: visualChoice.z ?? null,
        size: visualChoice.size ?? null,
        label_field: visualChoice.label_field ?? null,
      } : undefined,
      theme_color: themeColor,
      category_ids: selectedCategoryIds,
      keywords,
    })
    router.push(`/post/${postId}`)
  } catch (err: any) {
    const detail = err.response?.data?.detail
    setErrorMsg(typeof detail === 'string' ? detail : 'Failed to update the post. Please try again.')
  } finally {
    setIsSaving(false)
  }
}

  if (!authLoading && user && !canPublish(user)) return <NoPublishAccess what="edit posts" />

  if (isLoading) return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <Loader2 size={32} className="animate-spin text-gisviz-accent" />
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8 pb-24 relative">

      <div className="mb-8">
        <h1 className="text-[28px] sm:text-[32px] font-display font-bold text-gisviz-ink tracking-tight flex items-center gap-3">
          <Edit2 className="text-gisviz-accent" size={28} />
          Edit gisviz
        </h1>
        <p className="text-[14.5px] text-gisviz-ink-soft mt-1.5 leading-relaxed">
          Change the dataset, chart or map type, theme colour and details. Saving re-renders the feed/share PNG.
        </p>
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

        {/* Dataset, visual type, theme colour, live preview */}
        <div className="lg:col-span-12 bg-gisviz-card border border-gisviz-border rounded-xl p-6 sm:p-8 shadow-sm">
          <DatasetVisualPicker
            value={visualChoice}
            onChange={handleVisualChange}
            accent={themeColor}
            onAccentChange={setThemeColor}
          />
        </div>

        {/* ── RIGHT COLUMN — metadata (identical structure to upload page) ── */}
        <div className="lg:col-span-12 bg-gisviz-card border border-gisviz-border rounded-xl p-6 sm:p-8 shadow-sm h-fit">
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

    </div>
  )
}