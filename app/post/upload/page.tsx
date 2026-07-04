'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, Image as ImageIcon, Loader2, Map as MapIcon, X, Tag, Info, Link as LinkIcon, Send } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { gisvizApi } from '../../../services/api'

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
  
  const [customCategoryLabel, setCustomCategoryLabel] = useState('')
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false)
  
  const [availableCategories, setAvailableCategories] = useState<any[]>([])

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (!selectedFile.type.startsWith('image/')) {
        setErrorMsg('Only image files are allowed.')
        return
      }
      setFile(selectedFile)
      setPreviewUrl(URL.createObjectURL(selectedFile))
      setErrorMsg('')
    }
  }

  const addCategory = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value)
    if (id && !selectedCategoryIds.includes(id)) {
      if (selectedCategoryIds.length >= 2) {
        e.target.value = ""
        return
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
    if (!file)          { setErrorMsg('Please upload a visual file before publishing.'); return }
    if (!title.trim())  { setErrorMsg('A title is required.'); return }
    // ── New required field validations ───────────────────────────────────────
    if (!sourceName.trim())          { setErrorMsg('Data Source Name is required.'); return }
    if (selectedCategoryIds.length < 1) { setErrorMsg('Please select at least one category.'); return }
    if (keywords.length < 1)            { setErrorMsg('Please add at least one keyword.'); return }
    // ────────────────────────────────────────────────────────────────────────
    if (keywords.length > 3)        { setErrorMsg('You can only add up to 3 keywords.'); return }

    setIsLoading(true)
    setErrorMsg('')

    try {
      const uploadRes = await gisvizApi.uploadVisual(file)

      const postRes = await gisvizApi.createPost({
        title,
        description: description || null,
        note: note || null,
        source_name: sourceName || null,
        source_url: sourceUrl || null,
        visual_image_path: uploadRes.visual_path,
        category_ids: selectedCategoryIds,
        keywords
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      
      <div className="mb-8">
        {/* ── Renamed from "Publish Spatial Data" to "Post a GISViz" ── */}
        <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
          <UploadCloud className="text-gisviz-accent" size={32} />
          Post a gisviz
        </h1>
        <p className="text-gisviz-ink-soft font-mono mt-2">Upload a new visual map, dataset rendering, or dashboard to the global feed.</p>
      </div>

      {errorMsg && (
        <div className="p-4 mb-6 rounded-md text-[12px] font-mono border bg-red-50 text-gisviz-alert/90 border-gisviz-alert/60 flex items-center justify-between">
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
        
        {/* LEFT COLUMN - IMAGE UPLOAD */}
        <div className="lg:col-span-5 space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`w-full aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${
              previewUrl ? 'border-gisviz-accent bg-gisviz-canvas' : 'border-gisviz-border bg-gisviz-card hover:border-gisviz-accent'
            }`}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <UploadCloud size={32} className="mb-2" />
                  <span className="font-mono text-[12px] font-bold text-sentence-camelcase tracking-wider">Change Visual</span>
                </div>
              </>
            ) : (
              <div className="text-center p-6 text-gisviz-ink-soft group-hover:text-gisviz-accent transition-colors">
                <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold text-[12px] mb-1">Click to browse or drag & drop</p>
                <p className="font-mono text-xs text-sentence-camelcase opacity-75">JPG, PNG, WebP • Max 10MB</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          <div className="bg-gisviz-rail border border-gisviz-border rounded-xl p-4 text-xs font-mono text-gisviz-ink-soft">
            <h4 className="font-bold text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-2">
              <MapIcon size={14} /> Post Guidelines
            </h4>
            <ul className="space-y-1.5 list-inside list-disc opacity-80">
              <li>Ensure maps have appropriate legends or scale bars.</li>
              <li>Always credit your data sources accurately below.</li>
              <li>Do not upload sensitive or proprietary coordinates.</li>
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN - METADATA */}
        <div className="lg:col-span-7 bg-gisviz-card border border-gisviz-border rounded-xl p-6 sm:p-8 shadow-sm h-fit">
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
                      <span key={id} className="flex items-center gap-1.5 px-3 py-1 bg-gisviz-accent text-white rounded-md font-mono text-xs shadow-sm text-camelcase tracking-wider">
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
                    <span key={kw} className="flex items-center gap-1.5 px-3 py-1 bg-gisviz-accent text-white rounded-md font-mono text-xs shadow-sm text-camelcase tracking-wider">
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
            <div className="pt-6 border-t border-gisviz-border flex justify-end gap-4">
              <button type="button" onClick={() => router.back()} disabled={isLoading} className="px-6 py-2.5 rounded-md font-mono text-[12px] border border-gisviz-border text-gisviz-ink-soft hover:bg-gisviz-rail transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isLoading} className="flex items-center gap-2 bg-gisviz-accent text-white py-2.5 px-8 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold shadow-md disabled:opacity-70">
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