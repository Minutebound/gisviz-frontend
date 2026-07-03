'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings, Save, Loader2, Image as ImageIcon, MapPin, Briefcase,
  Link as LinkIcon, AtSign, Shield, Edit2, X, Lock, Mail, Trash2,
  Eye, EyeOff, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../services/api'

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const API_BASE_URL = RAW_API_URL.replace('/api/v1', '').replace(/\/$/, '')

const parseError = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const loc = detail[0].loc ? detail[0].loc[detail[0].loc.length - 1] : 'Field'
    return `${loc}: ${detail[0].msg}`
  }
  return err?.message || fallback
}

const getAvatarUrl = (path: string | null | undefined): string | null => {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, refreshProfile, logoutSession } = useAuth() as any

  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [msgs, setMsgs] = useState<Record<string, { type: 'success' | 'error'; text: string } | null>>({})
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({})

  const setSave = (s: string, v: boolean) => setSaving(p => ({ ...p, [s]: v }))
  const setMsg = (s: string, m: { type: 'success' | 'error'; text: string } | null) => setMsgs(p => ({ ...p, [s]: m }))
  const toggleEdit = (f: string) => setEditingFields(p => ({ ...p, [f]: !p[f] }))

  // ---- Profile form ----
  const [formData, setFormData] = useState({
    title: '', linkedin_url: '', medium_url: '', website_url: '',
    place: '', state: '', country: '', formatted_string: '',
  })
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([])
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- Handle form ----
  const [handleVal, setHandleVal] = useState('')

  // ---- Email — 3-step flow ----
  // step: 'idle' | 'form' | 'otp'
  const [emailStep, setEmailStep] = useState<'idle' | 'form' | 'otp'>('idle')
  const [emailForm, setEmailForm] = useState({ new_email: '', current_password: '' })
  const [emailOtp, setEmailOtp] = useState('')
  const [devOtp, setDevOtp] = useState('')   // shown in dev mode

  // ---- Password form ----
  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  })
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({})

  // ---- Delete account ----
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // ---------------------------------------------------------------
  // Hydrate
  // ---------------------------------------------------------------
  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { router.push('/auth'); return }
    if (!user) return

    const loc = user.location || {}
    setFormData({
      title: user.title || '',
      linkedin_url: user.linkedin_url || '',
      medium_url: user.medium_url || '',
      website_url: user.website_url || '',
      place: loc.place || '',
      state: loc.state || '',
      country: loc.country || '',
      formatted_string: loc.formatted_string || '',
    })
    setHandleVal(user.user_handle || '')
    setLocationQuery(loc.formatted_string || '')
    setAvatarPreview(getAvatarUrl(user.avatar_path))
    setPageLoading(false)
  }, [authLoading, isAuthenticated, user, router])

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }))

  const getInputValue = (value: string, isEditing: boolean) =>
    isEditing ? value : (value || 'Not provided')

  const searchLocation = async (query: string) => {
    setLocationQuery(query)
    if (query.length < 3) { setLocationSuggestions([]); return }
    setIsSearchingLocation(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`
      )
      setLocationSuggestions(await res.json())
    } catch { /* swallow */ }
    finally { setIsSearchingLocation(false) }
  }

  const selectLocation = (item: any) => {
    const a = item.address
    const place = a.city || a.town || a.village || a.county || ''
    const state = a.state || ''
    const country = a.country || ''
    setFormData(p => ({ ...p, place, state, country }))
    setLocationQuery(item.display_name)
    setLocationSuggestions([])
  }

  // ---------------------------------------------------------------
  // Sub-components — matching original style exactly
  // ---------------------------------------------------------------
  const LabelWithEdit = ({ label, fieldName }: { label: string; fieldName: string }) => (
    <div className="flex items-center justify-between mb-2">
      <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider">{label}</label>
      <button
        type="button"
        onClick={() => toggleEdit(fieldName)}
        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
          editingFields[fieldName]
            ? 'border-gisviz-alert/40 text-gisviz-alert bg-gisviz-alert/5'
            : 'border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent'
        }`}
      >
        {editingFields[fieldName] ? <><X size={10} /> Cancel</> : <><Edit2 size={10} /> Edit</>}
      </button>
    </div>
  )

  const SectionMsg = ({ section }: { section: string }) => {
    const m = msgs[section]
    if (!m) return null
    return (
      <div className={`p-4 mb-4 rounded-md text-[16px] font-mono border ${
        m.type === 'success'
          ? 'bg-gisviz-safe/5 text-gisviz-safe/70 border-gisviz-safe/20'
          : 'bg-red-50 text-gisviz-alert/90 border-gisviz-alert/60'
      }`}>
        {m.text}
      </div>
    )
  }

  const PwdInput = ({ name, label, placeholder, value, onChange }: {
    name: string; label: string; placeholder: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  }) => (
    <div>
      <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-2">{label}</label>
      <div className="relative">
        <input
          type={showPwd[name] ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink text-[16px] font-mono focus:ring-2 focus:ring-gisviz-accent outline-none pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPwd(p => ({ ...p, [name]: !p[name] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft hover:text-gisviz-ink"
        >
          {showPwd[name] ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  )

  const SaveBtn = ({ section, label = 'Save Changes' }: { section: string; label?: string }) => (
    <button
      type="submit"
      disabled={!!saving[section]}
      className="flex items-center gap-2 bg-gisviz-accent text-white px-6 py-2.5 rounded-md text-[16px] font-mono font-bold hover:bg-gisviz-accent/90 disabled:opacity-60 transition-colors"
    >
      {saving[section] ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      {saving[section] ? 'Saving…' : label}
    </button>
  )

  const hasActiveProfileEdits =
    Object.keys(editingFields).some(k => !['password', 'handle', 'email', 'delete'].includes(k) && editingFields[k]) ||
    avatarFile !== null

  // ---------------------------------------------------------------
  // Submit handlers
  // ---------------------------------------------------------------

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSave('profile', true); setMsg('profile', null)
    try {
      if (avatarFile) await gisvizApi.uploadAvatar(avatarFile)
      if (Object.keys(editingFields).some(k => !['password', 'handle', 'email', 'delete'].includes(k) && editingFields[k])) {
        await gisvizApi.updateSettings({
          title: formData.title,
          linkedin_url: formData.linkedin_url,
          medium_url: formData.medium_url,
          website_url: formData.website_url,
          place: formData.place,
          state: formData.state,
          country: formData.country,
        })
      }
      await refreshProfile()
      setAvatarFile(null)
      setEditingFields(p => {
        const n = { ...p }
        Object.keys(n).forEach(k => { if (!['password', 'handle', 'email', 'delete'].includes(k)) delete n[k] })
        return n
      })
      setMsg('profile', { type: 'success', text: 'Profile updated successfully.' })
    } catch (err: any) {
      setMsg('profile', { type: 'error', text: parseError(err, 'Failed to update profile.') })
    } finally { setSave('profile', false) }
  }

  const submitHandle = async (e: React.FormEvent) => {
    e.preventDefault()
    setSave('handle', true); setMsg('handle', null)
    try {
      await gisvizApi.updateHandle(handleVal)
      localStorage.setItem('gisviz_handle', handleVal.replace(/^@/, ''))
      await refreshProfile()
      setMsg('handle', { type: 'success', text: 'Handle updated successfully.' })
      toggleEdit('handle')
    } catch (err: any) {
      // 409 = taken, 400 = same as current / invalid
      setMsg('handle', { type: 'error', text: parseError(err, 'Failed to update handle.') })
    } finally { setSave('handle', false) }
  }

  // Email step 1 — request OTP
  const submitEmailRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setSave('email', true); setMsg('email', null)
    try {
      const res = await gisvizApi.requestEmailChange(emailForm.new_email, emailForm.current_password)
      setDevOtp(res.dev_otp || '')   // remove in production
      setEmailStep('otp')
      setMsg('email', { type: 'success', text: `Verification code sent to ${emailForm.new_email}` })
    } catch (err: any) {
      setMsg('email', { type: 'error', text: parseError(err, 'Failed to send verification code.') })
    } finally { setSave('email', false) }
  }

  // Email step 2 — verify OTP
  const submitEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setSave('email', true); setMsg('email', null)
    try {
      await gisvizApi.verifyEmailChange(emailForm.new_email, emailOtp)
      await refreshProfile()
      setMsg('email', { type: 'success', text: 'Email updated successfully.' })
      // Reset entire email flow
      setEmailStep('idle')
      setEmailForm({ new_email: '', current_password: '' })
      setEmailOtp('')
      setDevOtp('')
      toggleEdit('email')
    } catch (err: any) {
      setMsg('email', { type: 'error', text: parseError(err, 'Invalid or expired code.') })
    } finally { setSave('email', false) }
  }

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMsg('password', { type: 'error', text: 'New passwords do not match.' }); return
    }
    setSave('password', true); setMsg('password', null)
    try {
      await gisvizApi.changePassword({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setMsg('password', { type: 'success', text: 'Password changed successfully.' })
      toggleEdit('password')
    } catch (err: any) {
      setMsg('password', { type: 'error', text: parseError(err, 'Password change failed.') })
    } finally { setSave('password', false) }
  }

  const submitDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (deleteConfirmText !== user?.user_handle) {
      setMsg('delete', { type: 'error', text: `Type your exact handle to confirm: ${user?.user_handle}` }); return
    }
    setSave('delete', true); setMsg('delete', null)
    try {
      // Clear auth BEFORE the API call so the 401 interceptor doesn't
      // race with our own cleanup when the account ceases to exist
      logoutSession()
      await gisvizApi.deleteAccount(deletePassword)
      router.push('/')
    } catch (err: any) {
      // If we get here the deletion failed — restore state so they can try again
      setSave('delete', false)
      setMsg('delete', { type: 'error', text: parseError(err, 'Deletion failed. Please try again.') })
    }
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (authLoading || pageLoading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="animate-spin mx-auto text-gisviz-accent" size={32} />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="py-8 max-w-4xl mx-auto px-4 md:px-0">
      <div className="mb-8">
        <h1 className="text-[24px] font-display font-bold text-gisviz-ink flex items-center gap-3">
          <Settings className="text-gisviz-accent" size={32} />
          Profile Settings
        </h1>
        <p className="text-gisviz-ink-soft font-mono mt-2">
          Manage your public identity, roles, and access credentials.
        </p>
      </div>

      {/* ============================================================ */}
      {/* PROFILE                                                        */}
      {/* ============================================================ */}
      <div className="bg-gisviz-card border border-gisviz-border shadow-md p-6 sm:p-8 rounded-sm mb-6">
        <SectionMsg section="profile" />

        <form onSubmit={submitProfile} className="space-y-8">

          {/* Identity & Avatar */}
          <div className="space-y-4">
            <h2 className="text-[16px] font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono flex items-center gap-2">
              <AtSign size={14} /> Identity & Avatar
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Avatar */}
              <div className="md:col-span-2 flex items-center gap-6">
                <div
                  className="w-24 h-24 shrink-0 rounded-full bg-gisviz-canvas border-2 border-dashed border-gisviz-border overflow-hidden flex items-center justify-center relative group cursor-pointer hover:border-gisviz-accent transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview
                    ? <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    : <ImageIcon className="text-gisviz-ink-soft" size={32} />
                  }
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[16px] font-mono">
                    Upload
                  </div>
                </div>
                <div>
                  <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-1">Profile Avatar</label>
                  <p className="text-[16px] text-gisviz-ink-soft font-mono mb-3">JPG, PNG or WebP. Max size 2MB.</p>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-[16px] font-mono bg-gisviz-canvas border border-gisviz-border px-3 py-1.5 rounded hover:bg-gray-50 transition-colors">
                    Select File
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*"
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return
                      setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f))
                    }}
                  />
                  {avatarFile && <p className="text-[11px] font-mono text-gisviz-accent mt-2">✓ New avatar selected</p>}
                </div>
              </div>

              {/* Role — locked */}
              <div>
                <label className="flex items-center gap-1 text-[16px] font-mono text-gisviz-ink-soft mb-2 uppercase">
                  System Role <Lock size={12} className="text-gisviz-ink-soft opacity-70" />
                </label>
                <div className="w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-accent font-bold font-mono text-[16px] shadow-inner">
                  {user.role_name?.toUpperCase() || 'VIEWER'}
                </div>
              </div>

              {/* Title */}
              <div>
                <LabelWithEdit label="Current Title / Position" fieldName="title" />
                <input type="text" name="title"
                  value={getInputValue(formData.title, !!editingFields.title)}
                  disabled={!editingFields.title}
                  onChange={handleChange}
                  placeholder="e.g. Senior Cartographer at MapBox"
                  className={`w-full rounded-md px-4 py-2.5 text-[16px] outline-none font-mono transition-colors border ${
                    !editingFields.title
                      ? 'bg-gisviz-canvas/50 border-gisviz-border/50 text-gisviz-ink font-bold shadow-inner'
                      : 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent'
                  } ${!formData.title && !editingFields.title ? 'text-gisviz-ink-soft italic font-normal' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4 pt-4">
            <h2 className="text-[16px] font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono flex items-center gap-2">
              <MapPin size={14} /> Base Location
            </h2>
            <div className="relative">
              <LabelWithEdit label="Location" fieldName="location" />
              <input
                type="text"
                value={getInputValue(locationQuery, !!editingFields.location)}
                disabled={!editingFields.location}
                onChange={e => searchLocation(e.target.value)}
                placeholder="e.g. Nairobi, Kenya"
                className={`w-full rounded-md px-4 py-2.5 text-[16px] outline-none font-mono transition-colors border ${
                  !editingFields.location
                    ? 'bg-gisviz-canvas/50 border-gisviz-border/50 text-gisviz-ink font-bold shadow-inner'
                    : 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent'
                } ${!locationQuery && !editingFields.location ? 'text-gisviz-ink-soft italic font-normal' : ''}`}
              />
              {isSearchingLocation && (
                <div className="absolute right-3 top-9"><Loader2 size={14} className="animate-spin text-gisviz-accent" /></div>
              )}
              {locationSuggestions.length > 0 && editingFields.location && (
                <div className="absolute z-10 w-full mt-1 bg-gisviz-card border border-gisviz-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {locationSuggestions.map((item, i) => (
                    <button key={i} type="button" onClick={() => selectLocation(item)}
                      className="w-full text-left px-4 py-2.5 text-[16px] font-mono hover:bg-gisviz-canvas transition-colors border-b border-gisviz-border/50 last:border-0 flex items-start gap-2">
                      <MapPin size={12} className="text-gisviz-accent shrink-0 mt-0.5" />
                      <span className="truncate">{item.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {editingFields.location && (formData.place || formData.state || formData.country) && (
                <div className="flex gap-4 mt-3">
                  {[['City', formData.place], ['State', formData.state], ['Country', formData.country]].map(([l, v]) =>
                    v ? (
                      <div key={l} className="bg-gisviz-canvas border border-gisviz-border/50 rounded px-3 py-1.5">
                        <p className="text-[10px] font-mono text-gisviz-ink-soft uppercase mb-0.5">{l}</p>
                        <p className="text-[11px] font-mono font-bold text-gisviz-ink">{v}</p>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Online Presence */}
          <div className="space-y-4 pt-4">
            <h2 className="text-[16px] font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono flex items-center gap-2">
              <LinkIcon size={14} /> Online Presence
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { name: 'linkedin_url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
                { name: 'medium_url', label: 'Medium URL', placeholder: 'https://medium.com/@...' },
                { name: 'website_url', label: 'Personal Website', placeholder: 'https://yoursite.com' },
              ].map(field => (
                <div key={field.name}>
                  <LabelWithEdit label={field.label} fieldName={field.name} />
                  <input type="url" name={field.name}
                    value={getInputValue(formData[field.name as keyof typeof formData], !!editingFields[field.name])}
                    disabled={!editingFields[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    className={`w-full rounded-md px-4 py-2.5 text-[16px] outline-none font-mono transition-colors border ${
                      !editingFields[field.name]
                        ? 'bg-gisviz-canvas/50 border-gisviz-border/50 text-gisviz-ink font-bold shadow-inner'
                        : 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent'
                    } ${!formData[field.name as keyof typeof formData] && !editingFields[field.name] ? 'text-gisviz-ink-soft italic font-normal' : ''}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {hasActiveProfileEdits && (
            <div className="pt-4 flex justify-end">
              <SaveBtn section="profile" />
            </div>
          )}
        </form>
      </div>

      {/* ============================================================ */}
      {/* HANDLE                                                         */}
      {/* ============================================================ */}
      <div className="bg-gisviz-card border border-gisviz-border shadow-md p-6 sm:p-8 rounded-sm mb-6">
        <h2 className="text-[16px] font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono flex items-center gap-2 mb-6">
          <AtSign size={14} /> Username Handle
        </h2>
        <SectionMsg section="handle" />
        <LabelWithEdit label="Handle (@ prefix required)" fieldName="handle" />

        {!editingFields.handle ? (
          <div className="w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-ink font-bold font-mono text-[16px] shadow-inner">
            @{user.user_handle}
          </div>
        ) : (
          <form onSubmit={submitHandle} className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-mono text-gisviz-ink-soft select-none">@</span>
              <input
                type="text"
                value={handleVal}
                onChange={e => setHandleVal(e.target.value.replace(/^@/, ''))}
                placeholder={user.user_handle}
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-8 pr-4 py-2.5 text-gisviz-ink text-[16px] font-mono focus:ring-2 focus:ring-gisviz-accent outline-none"
              />
            </div>
            <p className="text-[11px] font-mono text-gisviz-ink-soft">
              Letters, numbers and underscores only · 3–30 characters · must be unique
            </p>
            <div className="flex justify-end">
              <SaveBtn section="handle" label="Update Handle" />
            </div>
          </form>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECURITY                                                       */}
      {/* ============================================================ */}
      <div className="bg-gisviz-card border border-gisviz-border shadow-md p-6 sm:p-8 rounded-sm mb-6">
        <h2 className="text-[16px] font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono flex items-center gap-2 mb-6">
          <Shield size={14} /> Security
        </h2>

        {/* ---- Email — 3-step flow ---- */}
        <div className="mb-6 pb-6 border-b border-gisviz-border">
          <SectionMsg section="email" />

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[16px] font-mono font-bold text-gisviz-ink">Email Address</p>
              <p className="text-[16px] font-mono text-gisviz-ink-soft">{user.email_address}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (editingFields.email) {
                  // Cancel — reset everything
                  setEmailStep('idle')
                  setEmailForm({ new_email: '', current_password: '' })
                  setEmailOtp('')
                  setDevOtp('')
                  setMsg('email', null)
                }
                toggleEdit('email')
              }}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                editingFields.email
                  ? 'border-gisviz-alert/40 text-gisviz-alert bg-gisviz-alert/5'
                  : 'border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent'
              }`}
            >
              {editingFields.email ? <><X size={10} /> Cancel</> : <><Edit2 size={10} /> Change</>}
            </button>
          </div>

          {editingFields.email && emailStep === 'form' && (
            <form onSubmit={submitEmailRequest} className="space-y-4">
              <div>
                <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-2">New Email Address</label>
                <input type="email" value={emailForm.new_email}
                  onChange={e => setEmailForm(p => ({ ...p, new_email: e.target.value }))}
                  placeholder={user.email_address}
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink text-[16px] font-mono focus:ring-2 focus:ring-gisviz-accent outline-none"
                />
              </div>
              <PwdInput name="emailPwd" label="Current Password (to confirm)"
                placeholder="Enter your password"
                value={emailForm.current_password}
                onChange={e => setEmailForm(p => ({ ...p, current_password: e.target.value }))}
              />
              <div className="flex justify-end">
                <button type="submit" disabled={!!saving.email}
                  className="flex items-center gap-2 bg-gisviz-accent text-white px-6 py-2.5 rounded-md text-[16px] font-mono font-bold hover:bg-gisviz-accent/90 disabled:opacity-60 transition-colors">
                  {saving.email ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {saving.email ? 'Sending Code…' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          )}

          {editingFields.email && emailStep === 'idle' && !editingFields.email && null}

          {/* Show form by default when editing is toggled on */}
          {editingFields.email && emailStep === 'idle' && (
            <form onSubmit={submitEmailRequest} className="space-y-4">
              <div>
                <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-2">New Email Address</label>
                <input type="email" value={emailForm.new_email}
                  onChange={e => setEmailForm(p => ({ ...p, new_email: e.target.value }))}
                  placeholder="new@example.com"
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink text-[16px] font-mono focus:ring-2 focus:ring-gisviz-accent outline-none"
                />
              </div>
              <PwdInput name="emailPwd" label="Current Password (to confirm)"
                placeholder="Enter your password"
                value={emailForm.current_password}
                onChange={e => setEmailForm(p => ({ ...p, current_password: e.target.value }))}
              />
              <div className="flex justify-end">
                <button type="submit" disabled={!!saving.email}
                  className="flex items-center gap-2 bg-gisviz-accent text-white px-6 py-2.5 rounded-md text-[16px] font-mono font-bold hover:bg-gisviz-accent/90 disabled:opacity-60 transition-colors">
                  {saving.email ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {saving.email ? 'Sending Code…' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          )}

          {/* OTP step */}
          {editingFields.email && emailStep === 'otp' && (
            <form onSubmit={submitEmailVerify} className="space-y-4">
              <p className="text-[16px] font-mono text-gisviz-ink-soft">
                A 6-digit code was sent to <span className="font-bold text-gisviz-ink">{emailForm.new_email}</span>. Enter it below to confirm the change.
              </p>
              {devOtp && (
                <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-md text-[11px] font-mono text-yellow-800">
                  DEV MODE — OTP: <span className="font-bold tracking-widest">{devOtp}</span>
                </div>
              )}
              <div>
                <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-2">Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={emailOtp}
                  onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full text-center tracking-[0.5em] bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-3 text-gisviz-ink text-[20px] font-bold focus:ring-2 focus:ring-gisviz-accent outline-none font-mono"
                />
              </div>
              <div className="flex items-center justify-between">
                <button type="button"
                  onClick={() => { setEmailStep('idle'); setEmailOtp(''); setDevOtp(''); setMsg('email', null) }}
                  className="text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-accent underline">
                  ← Back / resend code
                </button>
                <button type="submit" disabled={!!saving.email || emailOtp.length < 6}
                  className="flex items-center gap-2 bg-gisviz-accent text-white px-6 py-2.5 rounded-md text-[16px] font-mono font-bold hover:bg-gisviz-accent/90 disabled:opacity-60 transition-colors">
                  {saving.email ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  {saving.email ? 'Verifying…' : 'Confirm Email Change'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ---- Password ---- */}
        <div>
          <SectionMsg section="password" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[16px] font-mono font-bold text-gisviz-ink">Password</p>
              <p className="text-[16px] font-mono text-gisviz-ink-soft">Change your account password</p>
            </div>
            <button type="button" onClick={() => toggleEdit('password')}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                editingFields.password
                  ? 'border-gisviz-alert/40 text-gisviz-alert bg-gisviz-alert/5'
                  : 'border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent'
              }`}>
              {editingFields.password ? <><X size={10} /> Cancel</> : <><Edit2 size={10} /> Change</>}
            </button>
          </div>

          {editingFields.password && (
            <form onSubmit={submitPassword} className="space-y-4">
              <PwdInput name="currentPassword" label="Current Password"
                placeholder="Enter current password"
                value={passwordData.currentPassword}
                onChange={e => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))}
              />
              <PwdInput name="newPassword" label="New Password"
                placeholder="Min 8 characters"
                value={passwordData.newPassword}
                onChange={e => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
              />
              <PwdInput name="confirmPassword" label="Confirm New Password"
                placeholder="Repeat new password"
                value={passwordData.confirmPassword}
                onChange={e => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
              />
              <div className="flex justify-end">
                <button type="submit" disabled={!!saving.password}
                  className="flex items-center gap-2 bg-gisviz-accent text-white px-6 py-2.5 rounded-md text-[16px] font-mono font-bold hover:bg-gisviz-accent/90 disabled:opacity-60 transition-colors">
                  {saving.password ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                  Update Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* DELETION                                                    */}
      {/* ============================================================ */}
      <div className="bg-gisviz-card border border-gisviz-alert/30 shadow-md p-6 sm:p-8 rounded-sm">
        <h2 className="text-[16px] font-bold text-gisviz-alert border-b border-gisviz-alert/20 pb-2 uppercase tracking-wide font-mono flex items-center gap-2 mb-6">
          <Trash2 size={14} /> DELETION
        </h2>
        <SectionMsg section="delete" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[16px] font-mono font-bold text-gisviz-ink">Delete Account</p>
            <p className="text-[16px] font-mono text-gisviz-ink-soft">
              Permanently erase your account, posts, and all data. Irreversible.
            </p>
          </div>
          <button type="button" onClick={() => toggleEdit('delete')}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              editingFields.delete
                ? 'border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent'
                : 'border-gisviz-alert/40 text-gisviz-alert bg-gisviz-alert/5 hover:bg-gisviz-alert/10'
            }`}>
            {editingFields.delete ? <><X size={10} /> Cancel</> : <><Trash2 size={10} /> Delete</>}
          </button>
        </div>

        {editingFields.delete && (
          <form onSubmit={submitDelete} className="space-y-4">
            <div className="p-4 bg-gisviz-alert/5 border border-gisviz-alert/20 rounded-md text-[16px] font-mono text-gisviz-alert/80">
              All your posts, comments, likes, and profile data will be permanently deleted. This cannot be undone.
            </div>
            <PwdInput name="deletePassword" label="Current Password"
              placeholder="Enter your password to confirm"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
            />
            <div>
              <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-2">
                Type your handle to confirm:{' '}
                <span className="text-gisviz-alert font-bold">@{user.user_handle}</span>
              </label>
              <input type="text" value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={user.user_handle}
                className="w-full bg-gisviz-canvas border border-gisviz-alert/30 rounded-md px-4 py-2.5 text-gisviz-ink text-[16px] font-mono focus:ring-2 focus:ring-gisviz-alert outline-none"
              />
            </div>
            <div className="flex justify-end">
              <button type="submit"
                disabled={!!saving.delete || deleteConfirmText !== user.user_handle || !deletePassword}
                className="flex items-center gap-2 bg-gisviz-alert text-white px-6 py-2.5 rounded-md text-[16px] font-mono font-bold hover:bg-gisviz-alert/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {saving.delete ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Permanently Delete Account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}