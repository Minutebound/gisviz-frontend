'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Edit2, Image as ImageIcon, Loader2, Map as MapIcon, X, Tag, Info, Link as LinkIcon, Send, Save, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../../../context/AuthContext'
import { gisvizApi } from '../../../../services/api'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export default function EditPostPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string
  const { user, isAuthenticated, isLoading: authLoading } = useAuth() as any
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  
  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [note, setNote] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  
  const [keywordString, setKeywordString] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  
  const [customCategoryLabel, setCustomCategoryLabel] = useState('')
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false)
  
  // Data State
  const [availableCategories, setAvailableCategories] = useState<any[]>([])

  // File State
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialization
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth')
      return
    }

    const initData = async () => {
      try {
        const [cats, postData] = await Promise.all([
          gisvizApi.listCategories(),
          gisvizApi.fetchPost(postId)
        ])
        
        setAvailableCategories(cats)

        // Security check: only the publisher (or an admin) can edit
        if (postData.publisher_user_id !== user?.user_id && user?.role_name !== 'admin' && user?.role_name !== 'editor') {
            router.push(`/post/${postId}`)
            return
        }

        setTitle(postData.title)
        setDescription(postData.description || '')
        setNote(postData.note || '')
        setSourceName(postData.source_name || '')
        setSourceUrl(postData.source_url || '')
        setKeywordString(postData.keywords.map((k: any) => k.word).join(', '))
        setSelectedCategoryIds(postData.categories.map((c: any) => c.category_id))
        
        setExistingImagePath(postData.visual_image_path)
        if (postData.visual_image_path) {
          setPreviewUrl(`${API_BASE_URL}${postData.visual_image_path}`)
        }

      } catch (err) {
        setErrorMsg("Failed to load publication data.")
      } finally {
        setIsLoading(false)
      }
    }

    if (postId && user) initData()
  }, [postId, isAuthenticated, authLoading, user, router])

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
      setSelectedCategoryIds(prev => [...prev, id])
    }
    e.target.value = "" // reset select
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setErrorMsg('A title is required.'); return }

    setIsSaving(true)
    setErrorMsg('')

    try {
      let finalImagePath = existingImagePath;

      // Only upload a new image if the user actually selected one
      if (file) {
        const uploadRes = await gisvizApi.uploadVisual(file)
        finalImagePath = uploadRes.visual_path
      }

      const keywords = keywordString.split(',').map(k => k.trim()).filter(k => k.length > 0)

      await gisvizApi.updatePost(postId, {
        title,
        description: description || null,
        note: note || null,
        source_name: sourceName || null,
        source_url: sourceUrl || null,
        visual_image_path: finalImagePath,
        category_ids: selectedCategoryIds,
        keywords
      })

      // Redirect back to the post view upon successful save
      router.push(`/post/${postId}`)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setErrorMsg(typeof detail === 'string' ? detail : 'Failed to update the post. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="flex justify-center items-center h-[calc(100vh-4rem)]"><Loader2 size={32} className="animate-spin text-gisviz-accent" /></div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gisviz-ink-soft hover:text-gisviz-accent font-mono text-xs uppercase tracking-wider mb-6 transition-colors">
        <ArrowLeft size={14} /> Cancel Editing
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gisviz-ink flex items-center gap-3">
          <Edit2 className="text-gisviz-accent" size={32} />
          Edit Publication
        </h1>
        <p className="text-gisviz-ink-soft font-mono mt-2">Update your visual map, dataset metadata, or sources.</p>
      </div>

      {errorMsg && (
        <div className="p-4 mb-6 rounded-md text-sm font-mono border bg-red-50 text-red-600 border-red-200 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')}><X size={16}/></button>
        </div>
      )}
      
      {successMsg && (
        <div className="p-4 mb-6 rounded-md text-sm font-mono border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center justify-between">
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
                  <Edit2 size={32} className="mb-2" />
                  <span className="font-mono text-sm font-bold uppercase tracking-wider">Change Visual</span>
                </div>
              </>
            ) : (
              <div className="text-center p-6 text-gisviz-ink-soft group-hover:text-gisviz-accent transition-colors">
                <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold text-sm mb-1">Click to browse or drag & drop</p>
                <p className="font-mono text-xs uppercase opacity-75">JPG, PNG, WebP • Max 10MB</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          <div className="bg-gisviz-rail border border-gisviz-border rounded-xl p-4 text-xs font-mono text-gisviz-ink-soft">
            <h4 className="font-bold text-gisviz-ink mb-2 uppercase tracking-wider flex items-center gap-2">
              <MapIcon size={14} /> Publication Guidelines
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
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">Publication Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Boulder County LiDAR Elevation Model"
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-3 text-gisviz-ink font-display font-medium text-lg focus:ring-2 focus:ring-gisviz-accent outline-none"
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
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-3 text-gisviz-ink font-sans text-sm focus:ring-2 focus:ring-gisviz-accent outline-none min-h-[120px] resize-y"
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
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-sm focus:ring-1 focus:ring-gisviz-accent outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">Data Source Name</label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={e => setSourceName(e.target.value)}
                  placeholder="e.g. OpenStreetMap / USGS"
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-sm focus:ring-1 focus:ring-gisviz-accent outline-none"
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
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink text-sm focus:ring-1 focus:ring-gisviz-accent outline-none"
                />
              </div>
            </div>

            {/* Categories & Pending Selection */}
            <div>
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">Categorization</label>
              
              <div className="flex flex-col gap-3">
                {/* Active Selection Display */}
                <div className="flex flex-wrap gap-2">
                  {selectedCategoryIds.map(id => {
                    const cat = availableCategories.find(c => c.category_id === id)
                    return cat ? (
                      <span key={id} className="flex items-center gap-1.5 px-3 py-1 bg-gisviz-accent text-white rounded-md font-mono text-xs shadow-sm uppercase tracking-wider">
                        {cat.label}
                        <button type="button" onClick={() => removeCategory(id)} className="hover:text-red-200"><X size={12}/></button>
                      </span>
                    ) : null
                  })}
                  {selectedCategoryIds.length === 0 && <span className="text-xs font-mono text-gisviz-ink-soft">No categories selected.</span>}
                </div>
                
                {/* Inputs Row */}
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* Select Dropdown */}
                  <div className="flex-1 w-full">
                    <select 
                      onChange={addCategory}
                      value=""
                      className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2.5 text-gisviz-ink text-sm focus:ring-2 focus:ring-gisviz-accent outline-none font-mono"
                    >
                      <option value="" disabled>+ Add an existing Category...</option>
                      {availableCategories.map(cat => (
                        <option key={cat.category_id} value={cat.category_id} disabled={selectedCategoryIds.includes(cat.category_id)}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Suggest Custom Category */}
                  <div className="flex w-full sm:w-auto flex-1 gap-2">
                    <input
                      type="text"
                      value={customCategoryLabel}
                      onChange={e => setCustomCategoryLabel(e.target.value)}
                      placeholder="Propose custom..."
                      className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-gisviz-ink font-mono text-sm focus:ring-1 focus:ring-gisviz-accent outline-none"
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
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={14} /> Custom Metadata Tags (Comma Separated)
              </label>
              <input
                type="text"
                value={keywordString}
                onChange={e => setKeywordString(e.target.value)}
                placeholder="e.g. lidar, topography, urban-planning"
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink font-mono text-sm focus:ring-2 focus:ring-gisviz-accent outline-none"
              />
            </div>

            {/* Submit */}
            <div className="pt-6 border-t border-gisviz-border flex justify-end gap-4">
              <button type="button" onClick={() => router.back()} disabled={isSaving} className="px-6 py-2.5 rounded-md font-mono text-sm border border-gisviz-border text-gisviz-ink-soft hover:bg-gisviz-rail transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="flex items-center gap-2 bg-gisviz-accent text-white py-2.5 px-8 rounded-md hover:bg-opacity-90 transition-all font-mono text-sm font-bold shadow-md disabled:opacity-70">
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  )
}