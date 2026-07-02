'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Save, Loader2, Image as ImageIcon, MapPin, Briefcase, Link as LinkIcon, AtSign, Mail, Shield, Edit2, X, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../services/api'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

const parseError = (err: any, fallback: string): string => {
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const loc = detail[0].loc ? detail[0].loc[detail[0].loc.length - 1] : 'Field';
    return `${loc}: ${detail[0].msg}`;
  }
  return err.message || fallback;
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, refreshProfile } = useAuth()
  
  const [isLoading, setIsLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Inline Edit State tracking
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({})

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    linkedin_url: '',
    medium_url: '',
    website_url: '',
    place: '',
    state: '',
    country: '',
    formatted_string: ''
  })

  // Location State
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([])
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)

  // Avatar State
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Security State
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth')
    } else if (user) {
      const loc = (user as any).location || {};
      
      setFormData({
        title: user.title || '',
        linkedin_url: user.linkedin_url || '',
        medium_url: (user as any).medium_url || '',
        website_url: user.website_url || '',
        place: loc.place || '',
        state: loc.state || '',
        country: loc.country || '',
        formatted_string: loc.formatted_string || ''
      })
      setLocationQuery(loc.formatted_string || '')
      setAvatarPreview(user.avatar_path ? `${API_BASE_URL}${user.avatar_path}` : null)
    }
  }, [user, isAuthenticated, authLoading, router])

  // --- Handlers ---
  const toggleEdit = (field: string) => {
    setEditingFields(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const searchLocation = async (query: string) => {
    setLocationQuery(query)
    if (query.length < 3) {
      setLocationSuggestions([])
      return
    }
    setIsSearchingLocation(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`)
      const data = await res.json()
      setLocationSuggestions(data)
    } catch (err) {
      console.error("Location search failed", err)
    } finally {
      setIsSearchingLocation(false)
    }
  }

  const selectLocation = (item: any) => {
    const address = item.address
    const place = address.city || address.town || address.village || address.county || ''
    const state = address.state || ''
    const country = address.country || ''
    
    setFormData(prev => ({ ...prev, place, state, country }))
    setLocationQuery(item.display_name)
    setLocationSuggestions([])
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      if (avatarFile) await gisvizApi.uploadAvatar(avatarFile)

      // Only fire settings update if something was actually being edited
      if (Object.keys(editingFields).some(k => k !== 'password' && editingFields[k])) {
        await gisvizApi.updateSettings({
          title: formData.title,
          linkedin_url: formData.linkedin_url,
          medium_url: formData.medium_url,
          website_url: formData.website_url,
          place: formData.place,
          state: formData.state,
          country: formData.country
        })
      }

      await refreshProfile()
      setSuccessMsg('Profile configuration updated successfully.')
      setAvatarFile(null)
      setEditingFields({}) // Lock all fields again after saving
    } catch (err: any) {
      setErrorMsg(parseError(err, 'Failed to update settings'))
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }

    setIsPasswordLoading(true)
    setPwdMsg({ type: '', text: '' })

    try {
      await gisvizApi.changePassword({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      })
      
      setPwdMsg({ type: 'success', text: 'Password changed successfully.' })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setEditingFields(prev => ({ ...prev, password: false }))
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: parseError(err, 'Failed to change password') })
    } finally {
      setIsPasswordLoading(false)
    }
  }

  // --- UI Helpers ---
  const LabelWithEdit = ({ label, fieldName }: { label: string, fieldName: string }) => (
    <div className="flex items-center justify-between mb-2">
      <label className="text-[12px] font-mono text-gisviz-ink-soft uppercase tracking-wider">{label}</label>
      <button 
        type="button" 
        onClick={() => toggleEdit(fieldName)}
        className="text-[12px] font-mono text-gisviz-accent hover:underline flex items-center gap-1 uppercase"
      >
        {editingFields[fieldName] ? <><X size={10}/> Cancel</> : <><Edit2 size={10}/> Edit</>}
      </button>
    </div>
  )

  const getInputValue = (value: string, isEditing: boolean) => {
    if (isEditing) return value;
    return value || 'Not provided';
  }

  // Determine if Save button should be visible
  const hasActiveProfileEdits = Object.keys(editingFields).some(k => k !== 'password' && editingFields[k]) || avatarFile !== null;

  if (authLoading || !user) return <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-gisviz-accent" size={32} /></div>

  return (
    <div className="py-8 max-w-4xl mx-auto px-4 md:px-0">
      <div className="mb-8">
        <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
          <Settings className="text-gisviz-accent" size={32} />
          Profile Settings
        </h1>
        <p className="text-gisviz-ink-soft font-mono mt-2">Manage your public identity, roles, and access credentials.</p>
      </div>

      {/* --- PROFILE CONFIGURATION --- */}
      <div className="bg-gisviz-card border border-gisviz-border shadow-md p-6 sm:p-8 rounded-sm mb-8 relative">
        {successMsg && (
          <div className="p-4 mb-6 rounded-md text-[12px] font-mono border bg-gisviz-safe/5  text-gisviz-safe/70       border-gisviz-safe-200">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-4 mb-6 rounded-md text-[12px] font-mono border bg-red-50 text-gisviz-alert/90 border-gisviz-alert/60">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-8">
          
          {/* Section: Base Identity */}
          <div className="space-y-4">
            <h2 className="text-[16px] font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono text-[12px] flex items-center gap-2">
              <AtSign size={16} /> Identity & Avatar
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Avatar Upload - Always Active */}
              <div className="md:col-span-2 flex items-center gap-6">
                <div 
                  className="w-24 h-24 shrink-0 rounded-full bg-gisviz-canvas border-2 border-dashed border-gisviz-border overflow-hidden flex items-center justify-center relative group cursor-pointer hover:border-gisviz-accent transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-gisviz-ink-soft" size={32} />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[12px] font-mono">
                    Upload
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-1">Profile Avatar</label>
                  <p className="text-[12px] text-gisviz-ink-soft font-mono mb-3">JPG, PNG or WebP. Max size 2MB.</p>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[12px] font-mono bg-gisviz-canvas border border-gisviz-border px-3 py-1.5 rounded hover:bg-gray-50 transition-colors"
                  >
                    Select File
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                </div>
              </div>

              {/* System Locked Identity Stats */}
              <div>
                <label className="flex items-center gap-1 text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase">
                   User Handle <Lock size={12} className="text-gisviz-ink-soft opacity-70"/>
                </label>
                <div className="w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-ink font-bold font-mono text-[12px] shadow-inner">
                  @{user.user_handle}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1 text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase">
                   System Role <Lock size={12} className="text-gisviz-ink-soft opacity-70"/>
                </label>
                <div className="w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-accent font-bold font-mono text-[12px] shadow-inner">
                  {user.role_name?.toUpperCase() || 'VIEWER'}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Professional Info & Location */}
          <div className="space-y-4 pt-4">
            <h2 className="text-[16px] font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono text-[12px] flex items-center gap-2">
              <Briefcase size={16} /> Professional Background
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <LabelWithEdit label="Current Title / Position" fieldName="title" />
                <input
                  type="text"
                  name="title"
                  value={getInputValue(formData.title, !!editingFields.title)}
                  disabled={!editingFields.title}
                  onChange={handleChange}
                  className={`w-full rounded-md px-4 py-2.5 text-[12px] outline-none font-mono transition-colors border ${!editingFields.title ? 'bg-gisviz-canvas/50 border-gisviz-border/50 text-gisviz-ink font-bold shadow-inner' : 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent'} ${!formData.title && !editingFields.title ? 'text-gisviz-ink-soft italic font-normal' : ''}`}
                  placeholder="e.g. Senior Cartographer at MapBox"
                />
              </div>

              <div className="relative">
                <LabelWithEdit label="Base Location" fieldName="location" />
                <input
                  type="text"
                  value={getInputValue(locationQuery, !!editingFields.location)}
                  disabled={!editingFields.location}
                  onChange={(e) => searchLocation(e.target.value)}
                  className={`w-full rounded-md px-4 py-2.5 text-[12px] outline-none font-mono transition-colors border ${!editingFields.location ? 'bg-gisviz-canvas/50 border-gisviz-border/50 text-gisviz-ink font-bold shadow-inner' : 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent'} ${!locationQuery && !editingFields.location ? 'text-gisviz-ink-soft italic font-normal' : ''}`}
                  placeholder="e.g. Boulder, Colorado..."
                />
                {isSearchingLocation && <Loader2 className="absolute right-3 top-9 animate-spin text-gisviz-ink-soft" size={16} />}
                
                {editingFields.location && locationSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-gisviz-card border border-gisviz-border shadow-lg rounded-md overflow-hidden font-mono text-[12px] max-h-48 overflow-y-auto">
                    {locationSuggestions.map((item, i) => (
                      <li key={i} onClick={() => selectLocation(item)} className="px-4 py-2 hover:bg-gisviz-accent hover:text-white cursor-pointer border-b border-gisviz-border last:border-0 truncate transition-colors text-gisviz-ink">
                        {item.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Section: Social Graph */}
          <div className="space-y-4 pt-4">
            <h2 className="text-[16px] font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono text-[12px] flex items-center gap-2">
              <LinkIcon size={16} /> Network Links
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <LabelWithEdit label="LinkedIn URL" fieldName="linkedin" />
                <input type="url" name="linkedin_url" value={getInputValue(formData.linkedin_url, !!editingFields.linkedin)} disabled={!editingFields.linkedin} onChange={handleChange} className={`w-full rounded-md px-4 py-2.5 text-[12px] outline-none font-mono border ${!editingFields.linkedin ? 'bg-gisviz-canvas/50 border-gisviz-border/50 text-gisviz-ink font-bold shadow-inner' : 'bg-gisviz-canvas border-gisviz-border focus:ring-2 focus:ring-gisviz-accent'} ${!formData.linkedin_url && !editingFields.linkedin ? 'text-gisviz-ink-soft italic font-normal' : ''}`} placeholder="https://linkedin.com/in/..." />
              </div>

              <div>
                <LabelWithEdit label="Medium URL" fieldName="medium" />
                <input type="url" name="medium_url" value={getInputValue(formData.medium_url, !!editingFields.medium)} disabled={!editingFields.medium} onChange={handleChange} className={`w-full rounded-md px-4 py-2.5 text-[12px] outline-none font-mono border ${!editingFields.medium ? 'bg-gisviz-canvas/50 border-gisviz-border/50 text-gisviz-ink font-bold shadow-inner' : 'bg-gisviz-canvas border-gisviz-border focus:ring-2 focus:ring-gisviz-accent'} ${!formData.medium_url && !editingFields.medium ? 'text-gisviz-ink-soft italic font-normal' : ''}`} placeholder="https://medium.com/@..." />
              </div>

              <div className="md:col-span-2">
                <LabelWithEdit label="Personal Website / Portfolio" fieldName="website" />
                <input type="url" name="website_url" value={getInputValue(formData.website_url, !!editingFields.website)} disabled={!editingFields.website} onChange={handleChange} className={`w-full rounded-md px-4 py-2.5 text-[12px] outline-none font-mono border ${!editingFields.website ? 'bg-gisviz-canvas/50 border-gisviz-border/50 text-gisviz-ink font-bold shadow-inner' : 'bg-gisviz-canvas border-gisviz-border focus:ring-2 focus:ring-gisviz-accent'} ${!formData.website_url && !editingFields.website ? 'text-gisviz-ink-soft italic font-normal' : ''}`} placeholder="https://yourdomain.com" />
              </div>
            </div>
          </div>

          {/* Floating Save Button */}
          {hasActiveProfileEdits && (
            <div className="sticky bottom-4 z-50 pt-4 flex justify-end plate-enter">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 bg-gisviz-accent text-white py-3 px-8 rounded-full hover:bg-opacity-90 transition-all font-mono text-[12px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] disabled:opacity-70"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Save Active Changes</>}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* --- NEW SECTION: ACCESS & SECURITY --- */}
      <div className="bg-gisviz-card border-2 border-gisviz-border shadow-sm p-6 sm:p-8 rounded-sm overflow-hidden relative">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Shield size={120} />
        </div>

        <div className="relative z-10">
          <h2 className="text-[16px] font-display font-bold text-gisviz-ink mb-1 flex items-center gap-2">
            Access & Security
          </h2>
          <p className="text-[12px] font-mono text-gisviz-ink-soft mb-8">Protect your account credentials and system access.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Email Display Card */}
            <div className="bg-gisviz-canvas/50 border border-gisviz-border rounded-md p-5 shadow-inner flex flex-col justify-center">
              <label className="flex items-center gap-2 text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wide">
                <Mail size={14}/> Registered Email <Lock size={12} className="ml-1 opacity-50"/>
              </label>
              <div className="text-gisviz-ink font-bold font-mono text-base truncate">
                {(user as any).email_address || (user as any).email || 'No email registered'}
              </div>
              <p className="text-[12px] font-mono text-gisviz-ink-soft mt-2">Email addresses are managed via system administrators.</p>
            </div>

            {/* Password Management */}
            <div className="bg-gisviz-canvas/30 border border-gisviz-border rounded-md p-5">
              <div className="flex items-center justify-between mb-4">
                <label className="text-[12px] font-mono text-gisviz-ink-soft uppercase tracking-wider flex items-center gap-2">
                  <Shield size={14}/> Account Password
                </label>
                <button 
                  type="button" 
                  onClick={() => {
                    toggleEdit('password')
                    setPwdMsg({ type: '', text: '' })
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                  }}
                  className={`text-[12px] font-mono hover:underline flex items-center gap-1 uppercase px-2 py-1 rounded transition-colors ${editingFields.password ? 'bg-red-50 text-gisviz-alert/90' : 'bg-gisviz-accent/10 text-gisviz-accent'}`}
                >
                  {editingFields.password ? <><X size={10}/> Cancel</> : <><Edit2 size={10}/> Change Password</>}
                </button>
              </div>

              {!editingFields.password ? (
                <div className="w-full bg-gisviz-canvas border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-ink-soft font-mono text-[12px] cursor-not-allowed shadow-inner tracking-[0.3em]">
                  ••••••••••••
                </div>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4 plate-enter">
                  {pwdMsg.text && (
                    <div className={`p-3 rounded-md text-[12px] font-mono border ${pwdMsg.type === 'error' ? 'bg-red-50 text-gisviz-alert/90 border-gisviz-alert/60' : 'bg-gisviz-safe/5  text-gisviz-safe/70       border-gisviz-safe-200'}`}>
                      {pwdMsg.text}
                    </div>
                  )}
                  <div>
                    <input type="password" name="currentPassword" required value={passwordData.currentPassword} onChange={handlePasswordChange} placeholder="Current Password" className="w-full bg-white dark:bg-black border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
                  </div>
                  <div>
                    <input type="password" name="newPassword" required value={passwordData.newPassword} onChange={handlePasswordChange} placeholder="New Password" className="w-full bg-white dark:bg-black border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
                  </div>
                  <div>
                    <input type="password" name="confirmPassword" required value={passwordData.confirmPassword} onChange={handlePasswordChange} placeholder="Confirm New Password" className="w-full bg-white dark:bg-black border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
                  </div>
                  <button type="submit" disabled={isPasswordLoading} className="w-full bg-gisviz-ink text-gisviz-canvas py-2.5 px-4 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] shadow-md disabled:opacity-70 flex items-center justify-center gap-2">
                    {isPasswordLoading && <Loader2 size={14} className="animate-spin" />} Update Secure Password
                  </button>
                </form>
              )}
            </div>
            
          </div>
        </div>
      </div>

    </div>
  )
}