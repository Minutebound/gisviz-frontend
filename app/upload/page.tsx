'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, Image as ImageIcon, Loader2, Map as MapIcon, X, Tag } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../services/api'

export default function UploadPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [keywordString, setKeywordString] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  
  // Data State
  const [availableCategories, setAvailableCategories] = useState<any[]>([])

  // File State
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth?redirect=/upload')
    }
  }, [isAuthenticated, authLoading, router])

  // Fetch Categories on Mount
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const cats = await gisvizApi.listCategories()
        setAvailableCategories(cats)
      } catch (err) {
        console.error("Failed to fetch categories", err)
      }
    }
    fetchCats()
  }, [])

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

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds(prev => 
      prev.includes(id) ? prev.filter(catId => catId !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMsg('Please upload a visual file before publishing.')
      return
    }
    if (!title.trim()) {
      setErrorMsg('A title is required.')
      return
    }

    setIsLoading(true)
    setErrorMsg('')

    try {
      // 1. Upload the Image
      const uploadRes = await gisvizApi.uploadVisual(file)
      const visualPath = uploadRes.visual_path

      // 2. Parse Keywords (comma separated)
      const keywords = keywordString
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)

      // 3. Create the Post in the DB
      const postRes = await gisvizApi.createPost({
        title,
        description: description || null,
        visual_image_path: visualPath,
        category_ids: selectedCategoryIds,
        keywords
      })

      // 4. Redirect to the newly created post
      router.push(`/post/${postRes.post_id}`)

    } catch (err: any) {
      console.error(err)
      const detail = err.response?.data?.detail
      setErrorMsg(typeof detail === 'string' ? detail : 'Failed to publish the post. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <Loader2 size={32} className="animate-spin text-gisviz-accent" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gisviz-ink flex items-center gap-3">
          <UploadCloud className="text-gisviz-accent" size={32} />
          Publish Spatial Data
        </h1>
        <p className="text-gisviz-ink-soft font-mono mt-2">Upload a new visual map, dataset rendering, or dashboard to the global feed.</p>
      </div>

      {errorMsg && (
        <div className="p-4 mb-6 rounded-md text-sm font-mono border bg-red-50 text-red-600 border-red-200 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')}><X size={16}/></button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN - IMAGE UPLOAD */}
        <div className="lg:col-span-5 space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`w-full aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${
              previewUrl 
                ? 'border-gisviz-accent bg-gisviz-canvas' 
                : 'border-gisviz-border bg-gisviz-card hover:border-gisviz-accent hover:bg-gisviz-canvas'
            }`}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <UploadCloud size={32} className="mb-2" />
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
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>

          {/* Quick Stats / Guidelines */}
          <div className="bg-gisviz-rail border border-gisviz-border rounded-xl p-4 text-xs font-mono text-gisviz-ink-soft">
            <h4 className="font-bold text-gisviz-ink mb-2 uppercase tracking-wider flex items-center gap-2">
              <MapIcon size={14} /> Publication Guidelines
            </h4>
            <ul className="space-y-1.5 list-inside list-disc opacity-80">
              <li>Ensure maps have appropriate legends or scale bars.</li>
              <li>Do not upload sensitive or proprietary coordinates.</li>
              <li>High-contrast visuals perform best in the feed.</li>
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN - METADATA */}
        <div className="lg:col-span-7 bg-gisviz-card border border-gisviz-border rounded-xl p-6 sm:p-8 shadow-sm h-fit">
          <div className="space-y-6">
            
            {/* Title */}
            <div>
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">
                Publication Title <span className="text-red-500">*</span>
              </label>
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
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">
                Description & Context
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the data sources, methodology, or interesting findings..."
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-3 text-gisviz-ink font-sans text-sm focus:ring-2 focus:ring-gisviz-accent outline-none min-h-[120px] resize-y"
              />
            </div>

            {/* Categories */}
            <div>
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">
                Platform Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {availableCategories.length === 0 ? (
                  <span className="text-xs font-mono text-gisviz-ink-soft italic">Loading categories...</span>
                ) : (
                  availableCategories.map(cat => (
                    <button
                      key={cat.category_id}
                      type="button"
                      onClick={() => toggleCategory(cat.category_id)}
                      className={`px-3 py-1.5 rounded-md border text-xs font-mono uppercase tracking-wider transition-all ${
                        selectedCategoryIds.includes(cat.category_id)
                          ? 'bg-gisviz-accent border-gisviz-accent text-white shadow-sm'
                          : 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-ink hover:text-gisviz-ink'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={14} /> Custom Tags (Comma Separated)
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
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2.5 rounded-md font-mono text-sm border border-gisviz-border text-gisviz-ink-soft hover:bg-gisviz-rail transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 bg-gisviz-accent text-white py-2.5 px-8 rounded-md hover:bg-opacity-90 transition-all font-mono text-sm font-bold shadow-md disabled:opacity-70"
              >
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