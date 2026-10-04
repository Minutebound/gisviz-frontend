'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, Loader2, X, Tag, Info, Link as LinkIcon, Send } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { canPublish } from '../../../lib/roles'
import NoPublishAccess from '../../components/post/NoPublishAccess'
import { gisvizApi } from '../../../connector/api'
import RegionField from '../../components/post/regionField'
import type { VisualSpec } from '../../components/InteractiveVisual'
import PosterEditor from '../../components/post/PosterEditor'
import { type PosterChoice } from '../../../lib/poster'
import DatasetVisualPicker from '../../components/post/DataVisualPicker'
import { toVisualParams, type DatasetCard, type VisualChoice } from '../../../types/visuals'
import { DEFAULT_ACCENT, categoryColor, useCategories } from '../../../lib/referenceData'

export default function UploadPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [note, setNote] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [region, setRegion] = useState('')                  // regions.code (misc DB), required
  const [backdrop, setBackdrop] = useState<PosterChoice>('auto')
  const [previewSpec, setPreviewSpec] = useState<VisualSpec | null>(null)   // the visual, for the poster preview          // background behind the visual: auto | none | motif
  
  const [customCategoryLabel, setCustomCategoryLabel] = useState('')
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false)
  
  const [availableCategories, setAvailableCategories] = useState<any[]>([])

  // Posts are built from a dataset (no image uploads): pick one, the visual type and the theme colour.
  const [visualChoice, setVisualChoice] = useState<VisualChoice | null>(null)
  // Post theme colour: follows the first category until the publisher picks one manually.
  const dbCategories = useCategories()        // colours come from the DB categories
  const [themeColor, setThemeColor] = useState<string>(DEFAULT_ACCENT)
  const [themeTouched, setThemeTouched] = useState(false)
  const [presetDataset, setPresetDataset] = useState<string | undefined>()
  useEffect(() => {
    setPresetDataset(new URLSearchParams(window.location.search).get('dataset') || undefined)
  }, [])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth?redirect=/post/upload')
    }
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    fetchCats()
  }, [])

  const fetchCats = async () => {
    try {
      const cats = await gisvizApi.listCategories()
      setAvailableCategories(cats)
    } catch (err) {
      console.error("Failed to fetch categories", err)
    }
  }

  // When a dataset is picked, pre-fill empty description/source fields from its catalog card.
  const handleVisualChange = (choice: VisualChoice | null, card?: DatasetCard) => {
    setVisualChoice(choice)
    if (!card) return
    // suggested theme colour: the dataset's category colour, until the publisher picks one
    if (!themeTouched && card.category) {
      const color = categoryColor(dbCategories, card.category)
      if (color) setThemeColor(color)
    }
    // the post title is the publisher's own; it is never taken from the dataset
    setDescription(d => d || card.description || '')
    setSourceName(s => s || card.source_name || '')
    setSourceUrl(u => u || card.source_url || '')
    setRegion(r => r || card.region || '')                    // the dataset's region, until the publisher picks one
  }

  const addCategory = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value)
    if (id && !selectedCategoryIds.includes(id)) {
      if (selectedCategoryIds.length >= 2) {
        e.target.value = ""
        return
      }
      if (selectedCategoryIds.length === 0 && !themeTouched) {
        const color = categoryColor(dbCategories, availableCategories.find(c => c.category_id === id)?.slug)
        if (color) setThemeColor(color)
      }
      setSelectedCategoryIds(prev => [...prev, id])
    }
    e.target.value = ""
  }

  const removeCategory = (id: number) => {
    setSelectedCategoryIds(prev => prev.filter(catId => catId !== id))
  }

  const handleSuggestCategory = async () => {
    if (!customCategoryLabel.trim()) return;
    setIsSubmittingCustom(true)
    try {
      await gisvizApi.suggestCategory(customCategoryLabel)
      setSuccessMsg(`"${customCategoryLabel}" proposed for review successfully.`)
      setCustomCategoryLabel('')
    } catch (error) {
      console.error(error)
      setErrorMsg("Failed to suggest category. It may already exist.")
    } finally {
      setIsSubmittingCustom(false)
    }
  }

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.includes(',')) {
      const newKws = val.split(',').map(k => k.trim()).filter(k => k.length > 0)
      let updatedKeywords = [...keywords]
      for (const kw of newKws) {
        if (updatedKeywords.length < 3 && !updatedKeywords.includes(kw)) {
          updatedKeywords.push(kw)
        }
      }
      setKeywords(updatedKeywords)
      setKeywordInput('')
    } else {
      setKeywordInput(val)
    }
  }

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const newKw = keywordInput.trim()
      if (newKw && keywords.length < 3 && !keywords.includes(newKw)) {
        setKeywords([...keywords, newKw])
      }
      setKeywordInput('')
    }
  }

  const removeKeyword = (kwToRemove: string) => {
    setKeywords(prev => prev.filter(kw => kw !== kwToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!visualChoice)                  { setErrorMsg('Please search for and select a dataset first.'); return }
    if (!title.trim())                  { setErrorMsg('A title is required.'); return }
    if (!sourceName.trim())             { setErrorMsg('Data Source Name is required.'); return }
    if (selectedCategoryIds.length < 1) { setErrorMsg('Please select at least one category.'); return }
    if (!region)                        { setErrorMsg('Please pick the region this post is about.'); return }
    if (keywords.length < 1)            { setErrorMsg('Please add at least one keyword.'); return }
    if (keywords.length > 3)            { setErrorMsg('You can only add up to 3 keywords.'); return }

    setIsLoading(true)
    setErrorMsg('')
    try {
      // The server validates the choice, saves the spec + theme colour, and renders the PNG for the feed/share.
      const postRes = await gisvizApi.createPost({
        title: title.trim(),
        description: description?.trim() || null,
        note: note?.trim() || null,
        source_name: sourceName.trim(),
        source_url: sourceUrl?.trim() || null,
        dataset_id: visualChoice.dataset_id,
        visual_params: toVisualParams(visualChoice),
        theme_color: themeColor,
        category_ids: selectedCategoryIds,
        region,
        keywords,
        backdrop,
      })
      router.push(`/post/${postRes.post_id}`)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setErrorMsg(typeof detail === 'string' ? detail : 'Failed to publish the post. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || !user) return <div className="flex justify-center items-center h-64"><Loader2 size={32} className="animate-spin text-gisviz-accent" /></div>
  if (!canPublish(user)) return <NoPublishAccess what="publish posts" />

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8 pb-24">
      
      <div className="mb-8">
        {/* ── Renamed from "Publish Spatial Data" to "Post a GISViz" ── */}
        <h1 className="text-[28px] sm:text-[32px] font-display font-bold text-gisviz-ink tracking-tight flex items-center gap-3">
          <UploadCloud className="text-gisviz-accent" size={28} />
          Post a gisviz
        </h1>
        <p className="text-[14.5px] text-gisviz-ink-soft mt-1.5 leading-relaxed">
          Pick a dataset, let the suggestion choose the chart or map (or override it), set a theme colour and publish. Readers get the interactive visual; the feed and social shares get a PNG.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 mb-6 rounded-md text-[12px] font-mono border bg-gisviz-alert/10 text-gisviz-alert/90 border-gisviz-alert/60 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')}><X size={16}/></button>
        </div>
      )}
      
      {successMsg && (
        <div className="p-4 mb-6 rounded-md text-[12px] font-mono border bg-gisviz-safe/5  text-gisviz-safe/70       border-gisviz-safe/20    flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')}><X size={16}/></button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Dataset search, suggested visual, theme colour, live preview */}
        {(
          <div className="lg:col-span-12 bg-gisviz-card border border-gisviz-border rounded-xl p-6 sm:p-8 shadow-sm">
            <DatasetVisualPicker
              value={visualChoice}
              onChange={handleVisualChange}
              initialDatasetId={presetDataset}
              accent={themeColor}
              onAccentChange={c => { setThemeTouched(true); setThemeColor(c) }}
              onSpec={setPreviewSpec}
            />
          </div>
        )}

        {/* RIGHT COLUMN - METADATA */}
        <div className="lg:col-span-12 bg-gisviz-card border border-gisviz-border rounded-xl p-6 sm:p-8 shadow-sm h-fit">
          <div className="space-y-6">
            
            {/* Title */}
            <div>
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">Post Title <span className="text-gisviz-alert">*</span></label>
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
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">Description & Context</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the data sources, methodology, or interesting findings..."
                className="w-full bg-gisviz-canvas border text-camelcase border-gisviz-border rounded-md px-4 py-3 text-gisviz-ink font-sans text-[12px] focus:ring-2 focus:ring-gisviz-accent outline-none min-h-[120px] resize-y"
              />
            </div>

            {/* Note & Source Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-y border-gisviz-border py-4">
              <div className="md:col-span-2">
                <label className="text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={14}/> Important Note / Limitation
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Data may contain copyright boundaries. Used with permission."
                  className="w-full bg-gisviz-canvas border text-camelcase border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-[12px] focus:ring-1 focus:ring-gisviz-accent outline-none"
                />
              </div>

              {/* ── Source Name — now required ── */}
              <div>
                <label className="text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider block">
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

              <div>
                <label className="text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <LinkIcon size={12}/> Data Source Link
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

            <RegionField value={region} onChange={setRegion} />

            {/* Categories — now requires at least 1 */}
            <div>
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">
                Categorization (Max 2) <span className="text-gisviz-alert">*</span>
              </label>
              
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {selectedCategoryIds.map(id => {
                    const cat = availableCategories.find(c => c.category_id === id)
                    return cat ? (
                      <span key={id} className="flex items-center gap-1.5 px-3 py-1 bg-gisviz-accent text-gisviz-white rounded-md font-mono text-xs shadow-sm text-camelcase tracking-wider">
                        {cat.label}
                        <button type="button" onClick={() => removeCategory(id)} className="hover:text-gisviz-alert/60"><X size={12}/></button>
                      </span>
                    ) : null
                  })}
                  {selectedCategoryIds.length === 0 && <span className="text-xs font-mono text-gisviz-ink-soft">No categories selected.</span>}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 w-full">
                    <select 
                      onChange={addCategory}
                      value=""
                      disabled={selectedCategoryIds.length >= 2}
                      className="w-full bg-gisviz-canvas border text-camelcase border-gisviz-border rounded-md px-3 py-2.5 text-gisviz-ink text-[12px] focus:ring-2 focus:ring-gisviz-accent outline-none font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>+ Add an existing Category...</option>
                      {availableCategories.map(cat => (
                        <option key={cat.category_id} value={cat.category_id} disabled={selectedCategoryIds.includes(cat.category_id)}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                   </div>
                  <div className="flex w-full sm:w-auto flex-1 gap-2">
                    <input
                      type="text"
                      value={customCategoryLabel}
                      onChange={e => setCustomCategoryLabel(e.target.value)}
                      placeholder="Propose new category for review"
                      className="w-full bg-gisviz-canvas border border-gisviz-border text-camelcase rounded-md px-3 py-2 text-gisviz-ink font-mono text-[12px] focus:ring-1 focus:ring-gisviz-accent outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSuggestCategory}
                      disabled={!customCategoryLabel || isSubmittingCustom}
                      className="px-3 py-2 bg-gisviz-rail-soft text-gisviz-ink text-camelcase border border-gisviz-border rounded-md hover:border-gisviz-accent hover:text-gisviz-accent transition-colors disabled:opacity-50"
                      title="Submit for Approval"
                    >
                      {isSubmittingCustom ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                 
                </div>

              </div>
            </div>

            {/* Keywords — now requires at least 1 */}
            <div>
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={14} /> Keywords (Max 3) <span className="text-gisviz-alert">*</span>
              </label>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {keywords.map(kw => (
                    <span key={kw} className="flex items-center gap-1.5 px-3 py-1 bg-gisviz-accent text-gisviz-white rounded-md font-mono text-xs shadow-sm text-camelcase tracking-wider">
                      {kw}
                      <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-gisviz-alert/60"><X size={12}/></button>
                    </span>
                  ))}
                  {keywords.length === 0 && <span className="text-xs font-mono text-gisviz-ink-soft">No keywords added.</span>}
                </div>
                
                <input
                  type="text"
                  value={keywordInput}
                  onChange={handleKeywordChange}
                  onKeyDown={handleKeywordKeyDown}
                  disabled={keywords.length >= 3}
                  placeholder={keywords.length >= 3 ? "Limit reached" : "Type a keyword and press comma or enter"}
                  className="w-full bg-gisviz-canvas border border-gisviz-border text-camelcase rounded-md px-4 py-2.5 text-gisviz-ink font-mono text-[12px] focus:ring-2 focus:ring-gisviz-accent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Submit */}
            <PosterEditor value={backdrop} onChange={setBackdrop} spec={previewSpec} sources={[...(sourceName.trim() ? [{ label: sourceName.trim(), url: sourceUrl.trim() || null }] : [])]}
                           inputs={{ title, description, category_ids: selectedCategoryIds, keywords, region, theme_color: themeColor, note }} />

            <div className="pt-6 border-t border-gisviz-border flex justify-end gap-4">
              <button type="button" onClick={() => router.back()} disabled={isLoading} className="px-6 py-2.5 rounded-md font-mono text-[12px] border border-gisviz-border text-gisviz-ink-soft hover:bg-gisviz-rail transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isLoading} className="flex items-center gap-2 bg-gisviz-accent text-gisviz-white py-2.5 px-8 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold shadow-md disabled:opacity-70">
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                {isLoading ? 'Publishing...' : 'Publish to Feed'}
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  )
}