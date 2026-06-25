'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Save, Loader2, Image as ImageIcon, Lock, AtSign, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function SettingsPage() {
  const router = useRouter()
  const auth = useAuth()
  const { token, isAuthenticated } = auth
  // `user` may not be declared on the AuthContextType, coerce via any
  const user = (auth as any).user
  
  const [isLoading, setIsLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    user_handle: '',
    email_address: '',
    avatar_storage_url: '',
    current_password: '',
    new_password: '',
  })

  // Pre-fill form data when user context is available
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth')
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        user_handle: user.user_handle || '',
        email_address: user.email_address || '',
        avatar_storage_url: user.avatar_storage_url || '',
      }))
    }
  }, [user, isAuthenticated, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      // NOTE: This endpoint (PUT /api/v1/auth/me) needs to be implemented in your FastAPI backend
      const res = await fetch('http://localhost:8001/api/v1/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_handle: formData.user_handle,
          email_address: formData.email_address,
          avatar_storage_url: formData.avatar_storage_url,
          current_password: formData.current_password ? formData.current_password : null,
          new_password: formData.new_password ? formData.new_password : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to update settings')
      }

      setSuccessMsg('Profile configuration updated successfully.')
      setFormData(prev => ({ ...prev, current_password: '', new_password: '' }))
      
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gisviz-ink flex items-center gap-3">
          <Settings className="text-gisviz-accent" size={32} />
          Settings
        </h1>
        <p className="text-gisviz-ink-soft font-mono mt-2">Manage your login details here.</p>
      </div>

      <div className="relative bg-gisviz-card border border-gisviz-border shadow-md p-6 sm:p-8 rounded-sm plate-enter">

        {/* Cartographic Registration Marks
        <div className="reg-mark reg-tl"></div>
        <div className="reg-mark reg-tr"></div>
        <div className="reg-mark reg-bl"></div>
        <div className="reg-mark reg-br"></div> */}

        {successMsg && (
          <div className="p-4 mb-6 rounded-md text-sm font-mono border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-4 mb-6 rounded-md text-sm font-mono border bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section: Identity */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono text-sm">
              Identity
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-xs font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
                  <AtSign size={14} /> User Handle
                </label>
                <input
                  type="text"
                  name="user_handle"
                  value={formData.user_handle}
                  onChange={handleChange}
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-sm"
                  placeholder="e.g. boulder_spatial_admin"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
                  <Mail size={14} /> Contact Array (Email)
                </label>
                <input
                  type="email"
                  name="email_address"
                  value={formData.email_address}
                  onChange={handleChange}
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-sm"
                  placeholder="analyst@geosphere.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-xs font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
                  <ImageIcon size={14} /> Avatar Storage URI
                </label>
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-gisviz-canvas border border-gisviz-border overflow-hidden">
                    {formData.avatar_storage_url ? (
                      <img src={formData.avatar_storage_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-gisviz-accent to-emerald-400" />
                    )}
                  </div>
                  <input
                    type="url"
                    name="avatar_storage_url"
                    value={formData.avatar_storage_url}
                    onChange={handleChange}
                    className="flex-1 bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-sm"
                    placeholder="https://images.unsplash.com/photo-..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Security */}
          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono text-sm flex items-center gap-2">
              <Lock size={16} /> Security
            </h2>
            <p className="text-xs text-gisviz-ink-soft font-mono">Leave blank if you do not wish to modify your current security key.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
                  Current Password
                </label>
                <input
                  type="password"
                  name="current_password"
                  value={formData.current_password}
                  onChange={handleChange}
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-sm"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
                  New Password
                </label>
                <input
                  type="password"
                  name="new_password"
                  value={formData.new_password}
                  onChange={handleChange}
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gisviz-border flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 bg-gisviz-accent text-white py-2.5 px-6 rounded-md hover:bg-opacity-90 transition-all font-mono text-sm shadow-md disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Save size={16} /> Update Configuration
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}