'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings, Save, Loader2, Image as ImageIcon, MapPin, Briefcase,
  Link as LinkIcon, AtSign, Shield, Edit2, X, Lock, Mail, Trash2,
  Eye, EyeOff, ShieldCheck, ExternalLink,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../services/api'

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const API_BASE_URL = RAW_API_URL.replace('/api/v1', '').replace(/\/$/, '')

// Known URL prefixes — only the username portion is editable
const LINKEDIN_PREFIX = 'https://linkedin.com/in/'
const MEDIUM_PREFIX   = 'https://medium.com/@'

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

/** Strip the known prefix and return just the username */
const toUsername = (fullUrl: string | null | undefined, prefix: string): string => {
  if (!fullUrl) return ''
  if (fullUrl.startsWith(prefix)) return fullUrl.slice(prefix.length)
  if (!fullUrl.startsWith('http')) return fullUrl   // already a bare username
  return fullUrl
}

/** Re-attach the prefix; returns '' if no username */
const toFullUrl = (username: string, prefix: string): string => {
  const u = username.trim()
  if (!u) return ''
  if (u.startsWith('http')) return u
  return prefix + u
}

// ─── PwdInput MUST live outside the page component ───────────────────────────
// Defining it inside causes React to see a new component type on every render,
// which unmounts+remounts the input on every keystroke → only 1 char ever sticks.
interface PwdInputProps {
  name: string
  label: string
  placeholder: string
  value: string
  showPwd: Record<string, boolean>
  onToggle: (name: string) => void
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}
function PwdInput({ name, label, placeholder, value, showPwd, onToggle, onChange }: PwdInputProps) {
  return (
    <div>
      <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-2">
        {label}
      </label>
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
          onClick={() => onToggle(name)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft hover:text-gisviz-ink"
        >
          {showPwd[name] ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, refreshProfile, logoutSession } = useAuth() as any

  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving]           = useState<Record<string, boolean>>({})
  const [msgs, setMsgs]               = useState<Record<string, { type: 'success' | 'error'; text: string } | null>>({})
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({})

  const setSave   = (s: string, v: boolean) => setSaving(p => ({ ...p, [s]: v }))
  const setMsg    = (s: string, m: { type: 'success' | 'error'; text: string } | null) => setMsgs(p => ({ ...p, [s]: m }))
  const toggleEdit = (f: string) => setEditingFields(p => ({ ...p, [f]: !p[f] }))

  // ---- Profile form ----
  const [formData, setFormData] = useState({
    title: '', website_url: '',
    place: '', state: '', country: '', formatted_string: '',
  })
  // LinkedIn & Medium stored as username-only; rebuilt to full URL on save
  const [linkedinUsername, setLinkedinUsername] = useState('')
  const [mediumUsername,   setMediumUsername]   = useState('')

  const [locationQuery, setLocationQuery]             = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([])
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [avatarFile, setAvatarFile]     = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- Handle — part of the profile form, no separate submit ----
  const [handleVal, setHandleVal] = useState('')

  // ---- Email — 3-step flow ----
  const [emailStep, setEmailStep] = useState<'idle' | 'form' | 'otp'>('idle')
  const [emailForm, setEmailForm] = useState({ new_email: '', current_password: '' })
  const [emailOtp,  setEmailOtp]  = useState('')
  const [devOtp,    setDevOtp]    = useState('')

  // ---- Password form ----
  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  })
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({})
  const togglePwd = (name: string) => setShowPwd(p => ({ ...p, [name]: !p[name] }))

  // ---- Delete account ----
  const [deletePassword,    setDeletePassword]    = useState('')
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
      title:       user.title       || '',
      website_url: user.website_url || '',
      place:   loc.place   || '',
      state:   loc.state   || '',
      country: loc.country || '',
      formatted_string: loc.formatted_string || '',
    })
    // Store only the username portion so the prefix input field shows correctly
    setLinkedinUsername(toUsername(user.linkedin_url, LINKEDIN_PREFIX))
    setMediumUsername(toUsername(user.medium_url,     MEDIUM_PREFIX))
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
    setFormData(p => ({
      ...p,
      place:   a.city || a.town || a.village || a.county || '',
      state:   a.state   || '',
      country: a.country || '',
    }))
    setLocationQuery(item.display_name)
    setLocationSuggestions([])
  }

  // ---------------------------------------------------------------
  // Sub-components (no inputs → safe to define inside)
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

  // Profile Save button shows if any profile field is editing OR avatar is staged OR handle is editing
  const hasActiveProfileEdits =
    Object.keys(editingFields).some(k => !['password', 'email', 'delete'].includes(k) && editingFields[k]) ||
    avatarFile !== null

  // ---------------------------------------------------------------
  // Submit handlers
  // ---------------------------------------------------------------

  /**
   * submitProfile — saves avatar, profile fields, AND handle (if being edited).
   * Handle no longer has a separate form; it's part of this profile section.
   */
  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSave('profile', true); setMsg('profile', null)
    try {
      // 1. Avatar
      if (avatarFile) await gisvizApi.uploadAvatar(avatarFile)

      // 2. Handle — update first so refreshProfile picks up the new handle
      if (editingFields.handle) {
        await gisvizApi.updateHandle(handleVal)
        localStorage.setItem('gisviz_handle', handleVal.replace(/^@/, ''))
      }

      // 3. Profile fields
      const profileFieldsEditing = Object.keys(editingFields).some(
        k => !['password', 'handle', 'email', 'delete'].includes(k) && editingFields[k]
      )
      if (profileFieldsEditing) {
        await gisvizApi.updateSettings({
          title:        formData.title,
          linkedin_url: toFullUrl(linkedinUsername, LINKEDIN_PREFIX),
          medium_url:   toFullUrl(mediumUsername,   MEDIUM_PREFIX),
          website_url:  formData.website_url,
          place:   formData.place,
          state:   formData.state,
          country: formData.country,
        })
      }

      await refreshProfile()
      setAvatarFile(null)
      // Clear all editing flags except security / delete
      setEditingFields(p => {
        const n = { ...p }
        Object.keys(n).forEach(k => { if (!['password', 'email', 'delete'].includes(k)) delete n[k] })
        return n
      })
      setMsg('profile', { type: 'success', text: 'Profile updated successfully.' })
    } catch (err: any) {
      setMsg('profile', { type: 'error', text: parseError(err, 'Failed to update profile.') })
    } finally { setSave('profile', false) }
  }

  const submitEmailRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setSave('email', true); setMsg('email', null)
    try {
      const res = await gisvizApi.requestEmailChange(emailForm.new_email, emailForm.current_password)
      setDevOtp(res.dev_otp || '')
      setEmailStep('otp')
      setMsg('email', { type: 'success', text: `Verification code sent to ${emailForm.new_email}` })
    } catch (err: any) {
      setMsg('email', { type: 'error', text: parseError(err, 'Failed to send verification code.') })
    } finally { setSave('email', false) }
  }

  const submitEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setSave('email', true); setMsg('email', null)
    try {
      await gisvizApi.verifyEmailChange(emailForm.new_email, emailOtp)
      await refreshProfile()
      setMsg('email', { type: 'success', text: 'Email updated successfully.' })
      setEmailStep('idle')
      setEmailForm({ new_email: '', current_password: '' })
      setEmailOtp(''); setDevOtp('')
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
        new_password:     passwordData.newPassword,
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
      logoutSession()
      await gisvizApi.deleteAccount(deletePassword)
      router.push('/')
    } catch (err: any) {
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

  // Pre-compute full URLs for display
  const linkedinFullUrl = toFullUrl(linkedinUsername, LINKEDIN_PREFIX)
  const mediumFullUrl   = toFullUrl(mediumUsername,   MEDIUM_PREFIX)

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

              {/* Avatar — full width */}
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

              {/* System Role — locked chip */}
              <div>
                <label className="flex items-center gap-1 text-[16px] font-mono text-gisviz-ink-soft mb-2 uppercase">
                  System Role <Lock size={12} className="text-gisviz-ink-soft opacity-70" />
                </label>
                <div className="w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-accent font-bold font-mono text-[16px] shadow-inner">
                  {user.role_name?.toUpperCase() || 'VIEWER'}
                </div>
              </div>

              {/* Handle — editable chip; saved with the profile form (no separate submit) */}
              <div>
                <SectionMsg section="handle" />
                <LabelWithEdit label="Username Handle" fieldName="handle" />
                {!editingFields.handle ? (
                  <div className="w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-ink font-bold font-mono text-[16px] shadow-inner">
                    @{user.user_handle}
                  </div>
                ) : (
                  <div className="space-y-2">
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
                  </div>
                )}
              </div>

              {/* Title — full width */}
              <div className="md:col-span-2">
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

              {/* ── LinkedIn — username-only edit, clickable link at rest ── */}
              <div>
                <LabelWithEdit label="LinkedIn" fieldName="linkedin" />
                {!editingFields.linkedin ? (
                  linkedinUsername ? (
                    <a
                      href={linkedinFullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 font-mono text-[16px] shadow-inner hover:border-gisviz-accent/50 transition-colors group"
                    >
                      <span className="text-gisviz-ink-soft text-[13px] shrink-0">linkedin.com/in/</span>
                      <span className="text-gisviz-accent font-bold truncate">{linkedinUsername}</span>
                      <ExternalLink size={12} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gisviz-ink-soft" />
                    </a>
                  ) : (
                    <div className="w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-ink-soft italic font-mono text-[16px] shadow-inner">
                      Not provided
                    </div>
                  )
                ) : (
                  /* Edit mode: prefix is decoration, only username is editable */
                  <div className="flex rounded-md overflow-hidden border border-gisviz-border focus-within:ring-2 focus-within:ring-gisviz-accent">
                    <span className="flex items-center px-3 bg-gisviz-canvas/80 text-gisviz-ink-soft font-mono text-[13px] border-r border-gisviz-border whitespace-nowrap shrink-0">
                      linkedin.com/in/
                    </span>
                    <input
                      type="text"
                      value={linkedinUsername}
                      onChange={e => setLinkedinUsername(e.target.value)}
                      placeholder="your-username"
                      className="flex-1 bg-gisviz-canvas px-3 py-2.5 text-gisviz-ink font-mono text-[16px] outline-none min-w-0"
                    />
                  </div>
                )}
              </div>

              {/* ── Medium — username-only edit, clickable link at rest ── */}
              <div>
                <LabelWithEdit label="Medium" fieldName="medium" />
                {!editingFields.medium ? (
                  mediumUsername ? (
                    <a
                      href={mediumFullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 font-mono text-[16px] shadow-inner hover:border-gisviz-accent/50 transition-colors group"
                    >
                      <span className="text-gisviz-ink-soft text-[13px] shrink-0">medium.com/@</span>
                      <span className="text-gisviz-accent font-bold truncate">{mediumUsername}</span>
                      <ExternalLink size={12} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gisviz-ink-soft" />
                    </a>
                  ) : (
                    <div className="w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-ink-soft italic font-mono text-[16px] shadow-inner">
                      Not provided
                    </div>
                  )
                ) : (
                  <div className="flex rounded-md overflow-hidden border border-gisviz-border focus-within:ring-2 focus-within:ring-gisviz-accent">
                    <span className="flex items-center px-3 bg-gisviz-canvas/80 text-gisviz-ink-soft font-mono text-[13px] border-r border-gisviz-border whitespace-nowrap shrink-0">
                      medium.com/@
                    </span>
                    <input
                      type="text"
                      value={mediumUsername}
                      onChange={e => setMediumUsername(e.target.value)}
                      placeholder="your-username"
                      className="flex-1 bg-gisviz-canvas px-3 py-2.5 text-gisviz-ink font-mono text-[16px] outline-none min-w-0"
                    />
                  </div>
                )}
              </div>

              {/* ── Personal Website — full width, clickable link at rest ── */}
              <div className="md:col-span-2">
                <LabelWithEdit label="Personal Website" fieldName="website_url" />
                {!editingFields.website_url ? (
                  formData.website_url ? (
                    <a
                      href={formData.website_url.startsWith('http') ? formData.website_url : `https://${formData.website_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 font-mono text-[16px] shadow-inner hover:border-gisviz-accent/50 transition-colors group"
                    >
                      <span className="text-gisviz-accent font-bold truncate">{formData.website_url}</span>
                      <ExternalLink size={12} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gisviz-ink-soft" />
                    </a>
                  ) : (
                    <div className="w-full bg-gisviz-canvas/50 border border-gisviz-border/50 rounded-md px-4 py-2.5 text-gisviz-ink-soft italic font-mono text-[16px] shadow-inner">
                      Not provided
                    </div>
                  )
                ) : (
                  <input
                    type="url"
                    name="website_url"
                    value={formData.website_url}
                    onChange={handleChange}
                    placeholder="https://yourwebsite.com"
                    className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink font-mono text-[16px] focus:ring-2 focus:ring-gisviz-accent outline-none"
                  />
                )}
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
                onChange={e => editingFields.location && searchLocation(e.target.value)}
                placeholder="Search city, state, country…"
                className={`w-full rounded-md px-4 py-2.5 text-[16px] outline-none font-mono transition-colors border ${
                  !editingFields.location
                    ? 'bg-gisviz-canvas/50 border-gisviz-border/50 text-gisviz-ink font-bold shadow-inner'
                    : 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent'
                } ${!locationQuery && !editingFields.location ? 'text-gisviz-ink-soft italic font-normal' : ''}`}
              />
              {isSearchingLocation && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gisviz-ink-soft" />
              )}
              {locationSuggestions.length > 0 && (
                <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-gisviz-card border border-gisviz-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {locationSuggestions.map((item, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => selectLocation(item)}
                        className="w-full text-left px-4 py-2 text-[12px] font-mono text-gisviz-ink hover:bg-gisviz-canvas transition-colors">
                        {item.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
      {/* SECURITY                                                       */}
      {/* ============================================================ */}
      <div className="bg-gisviz-card border border-gisviz-border shadow-md p-6 sm:p-8 rounded-sm mb-6">
        <h2 className="text-[16px] font-bold text-gisviz-ink border-b border-gisviz-border pb-2 uppercase tracking-wide font-mono flex items-center gap-2 mb-6">
          <Shield size={14} /> Security
        </h2>

        {/* Email — 3-step flow */}
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
                  setEmailStep('idle')
                  setEmailForm({ new_email: '', current_password: '' })
                  setEmailOtp(''); setDevOtp('')
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

          {editingFields.email && emailStep === 'idle' && (
            <button type="button" onClick={() => setEmailStep('form')}
              className="text-[16px] font-mono text-gisviz-accent hover:underline">
              → Start email change
            </button>
          )}

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
                showPwd={showPwd} onToggle={togglePwd}
                onChange={e => setEmailForm(p => ({ ...p, current_password: e.target.value }))}
              />
              <div className="flex justify-end">
                <button type="submit" disabled={!!saving.email}
                  className="flex items-center gap-2 bg-gisviz-accent text-white px-6 py-2.5 rounded-md text-[16px] font-mono font-bold hover:bg-gisviz-accent/90 disabled:opacity-60 transition-colors">
                  {saving.email ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {saving.email ? 'Sending…' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          )}

          {editingFields.email && emailStep === 'otp' && (
            <form onSubmit={submitEmailVerify} className="space-y-4">
              {devOtp && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-[11px] font-mono text-yellow-700">
                  DEV: OTP = {devOtp}
                </div>
              )}
              <div>
                <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-2">Verification Code</label>
                <input type="text" value={emailOtp} onChange={e => setEmailOtp(e.target.value)}
                  maxLength={6} placeholder="••••••"
                  className="w-full text-center tracking-[0.5em] bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-3 text-gisviz-ink text-[20px] font-bold focus:ring-2 focus:ring-gisviz-accent outline-none font-mono"
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={!!saving.email}
                  className="flex items-center gap-2 bg-gisviz-accent text-white px-6 py-2.5 rounded-md text-[16px] font-mono font-bold hover:bg-gisviz-accent/90 disabled:opacity-60 transition-colors">
                  {saving.email ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  {saving.email ? 'Verifying…' : 'Verify & Update Email'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[16px] font-mono font-bold text-gisviz-ink">Password</p>
              <p className="text-[16px] font-mono text-gisviz-ink-soft">••••••••••••</p>
            </div>
            <button type="button" onClick={() => toggleEdit('password')}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                editingFields.password
                  ? 'border-gisviz-alert/40 text-gisviz-alert bg-gisviz-alert/5'
                  : 'border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent'
              }`}
            >
              {editingFields.password ? <><X size={10} /> Cancel</> : <><Edit2 size={10} /> Change</>}
            </button>
          </div>

          {editingFields.password && (
            <form onSubmit={submitPassword} className="space-y-4">
              <SectionMsg section="password" />
              <PwdInput name="currentPassword" label="Current Password" placeholder="Enter current password"
                value={passwordData.currentPassword}
                showPwd={showPwd} onToggle={togglePwd}
                onChange={e => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))}
              />
              <PwdInput name="newPassword" label="New Password" placeholder="Enter new password"
                value={passwordData.newPassword}
                showPwd={showPwd} onToggle={togglePwd}
                onChange={e => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
              />
              <PwdInput name="confirmPassword" label="Confirm New Password" placeholder="Repeat new password"
                value={passwordData.confirmPassword}
                showPwd={showPwd} onToggle={togglePwd}
                onChange={e => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
              />
              <div className="flex justify-end">
                <SaveBtn section="password" label="Change Password" />
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* DANGER ZONE                                                    */}
      {/* ============================================================ */}
      <div className="bg-gisviz-card border border-gisviz-alert/30 shadow-md p-6 sm:p-8 rounded-sm mb-6">
        <h2 className="text-[16px] font-bold text-gisviz-alert border-b border-gisviz-alert/20 pb-2 uppercase tracking-wide font-mono flex items-center gap-2 mb-6">
          <Trash2 size={14} /> Danger Zone
        </h2>
        <SectionMsg section="delete" />
        <p className="text-[16px] font-mono text-gisviz-ink-soft mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-mono text-gisviz-ink font-bold">Delete Account</p>
          <button type="button" onClick={() => toggleEdit('delete')}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              editingFields.delete
                ? 'border-gisviz-alert/40 text-gisviz-alert bg-gisviz-alert/5'
                : 'border-gisviz-alert/30 text-gisviz-alert/70 hover:border-gisviz-alert hover:text-gisviz-alert'
            }`}
          >
            {editingFields.delete ? <><X size={10} /> Cancel</> : <><Trash2 size={10} /> Delete</>}
          </button>
        </div>
        {editingFields.delete && (
          <form onSubmit={submitDelete} className="space-y-4">
            <div>
              <label className="text-[16px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-2">
                Type your handle to confirm: <span className="text-gisviz-ink font-bold">{user.user_handle}</span>
              </label>
              <input type="text" value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={user.user_handle}
                className="w-full bg-gisviz-canvas border border-gisviz-alert/30 rounded-md px-4 py-2.5 text-gisviz-ink text-[16px] font-mono focus:ring-2 focus:ring-gisviz-alert outline-none"
              />
            </div>
            <PwdInput name="deletePassword" label="Current Password" placeholder="Enter your password"
              value={deletePassword}
              showPwd={showPwd} onToggle={togglePwd}
              onChange={e => setDeletePassword(e.target.value)}
            />
            <div className="flex justify-end">
              <button type="submit" disabled={!!saving.delete || deleteConfirmText !== user.user_handle}
                className="flex items-center gap-2 bg-gisviz-alert text-white px-6 py-2.5 rounded-md text-[16px] font-mono font-bold hover:bg-gisviz-alert/90 disabled:opacity-40 transition-colors">
                {saving.delete ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {saving.delete ? 'Deleting…' : 'Permanently Delete Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}