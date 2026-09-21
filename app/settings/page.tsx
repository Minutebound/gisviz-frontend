'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings, Save, Loader2, Image as ImageIcon, MapPin,
  AtSign, Shield, Edit2, X, Lock, Mail, Eye, EyeOff, 
  ShieldCheck, ExternalLink, Link as LinkIcon
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../services/api' // Fixed to standard import path

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://'
const API_BASE_URL = RAW_API_URL.replace('/api/v0', '').replace(/\/$/, '')

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
      <label className="text-[11.5px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={showPwd[name] ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-gisviz-canvas border border-gisviz-border rounded-[10px] px-4 py-2.5 text-gisviz-ink text-[13.5px] focus:ring-1 focus:ring-gisviz-accent focus:border-gisviz-accent outline-none shadow-sm transition-all pr-10"
        />
        <button
          type="button"
          onClick={() => onToggle(name)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft hover:text-gisviz-ink transition-colors"
        >
          {showPwd[name] ? <EyeOff size={15} /> : <Eye size={15} />}
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
  const [linkedinUsername, setLinkedinUsername] = useState('')
  const [mediumUsername,   setMediumUsername]   = useState('')

  const [locationQuery, setLocationQuery]             = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([])
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [avatarFile, setAvatarFile]     = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- Handle ----
  const [handleVal, setHandleVal] = useState('')

  // ---- Email ----
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
  const [deactivatePassword,    setDeactivatePassword]    = useState('')
  const [deactivateConfirmText, setDeactivateConfirmText] = useState('')

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
  // Sub-components
  // ---------------------------------------------------------------
  const LabelWithEdit = ({ label, fieldName }: { label: string; fieldName: string }) => (
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-[11.5px] font-mono text-gisviz-ink-soft uppercase tracking-wider">{label}</label>
      <button
        type="button"
        onClick={() => toggleEdit(fieldName)}
        className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-[6px] border transition-colors flex items-center gap-1.5 ${
          editingFields[fieldName]
            ? 'border-gisviz-alert/40 text-gisviz-alert bg-gisviz-alert/5'
            : 'border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent'
        }`}
      >
        {editingFields[fieldName] ? <><X size={12} /> Cancel</> : <><Edit2 size={12} /> Edit</>}
      </button>
    </div>
  )

  const SectionMsg = ({ section }: { section: string }) => {
    const m = msgs[section]
    if (!m) return null
    return (
      <div className={`p-4 mb-5 rounded-[10px] text-[13.5px] font-medium border ${
        m.type === 'success'
          ? 'bg-gisviz-safe/10 text-gisviz-safe border-gisviz-safe/20'
          : 'bg-gisviz-alert/10 text-gisviz-alert border-gisviz-alert/30'
      }`}>
        {m.text}
      </div>
    )
  }

  const SaveBtn = ({ section, label = 'Save Changes' }: { section: string; label?: string }) => (
    <button
      type="submit"
      disabled={!!saving[section]}
      className="flex items-center gap-2 bg-gisviz-accent text-[color:var(--accent-on)] px-5 py-2.5 rounded-[10px] text-[13.5px] font-semibold hover:brightness-110 disabled:opacity-50 transition-[filter] shadow-sm"
    >
      {saving[section] ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
      {saving[section] ? 'Saving...' : label}
    </button>
  )

  const hasActiveProfileEdits =
    Object.keys(editingFields).some(k => !['password', 'email', 'delete','deactivate'].includes(k) && editingFields[k]) ||
    avatarFile !== null

  // ---------------------------------------------------------------
  // Submit handlers
  // ---------------------------------------------------------------
  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSave('profile', true); setMsg('profile', null)
    try {
      if (avatarFile) await gisvizApi.uploadAvatar(avatarFile)
      if (editingFields.handle) {
        await gisvizApi.updateHandle(handleVal)
        localStorage.setItem('gisviz_handle', handleVal.replace(/^@/, ''))
      }

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
      setEditingFields(p => {
        const n = { ...p }
        Object.keys(n).forEach(k => { if (!['password', 'email', 'delete','deactivate'].includes(k)) delete n[k] })
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

  const submitDeactivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (deactivateConfirmText !== user?.user_handle) {
      setMsg('deactivate', { type: 'error', text: `Type your exact handle to confirm: ${user?.user_handle}` }); return
    }
    setSave('deactivate', true); setMsg('deactivate', null)
    try {
      await gisvizApi.deactivateAccount(deactivatePassword)
      logoutSession()
      router.push('/')
    } catch (err: any) {
      setSave('deactivate', false)
      setMsg('deactivate', { type: 'error', text: parseError(err, 'Deactivation failed. Please try again.') })
    }
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (authLoading || pageLoading) {
    return (
      <div className="py-20 flex justify-center items-center min-h-[50vh]">
        <Loader2 className="animate-spin text-gisviz-accent" size={32} />
      </div>
    )
  }
  if (!user) return null

  const linkedinFullUrl = toFullUrl(linkedinUsername, LINKEDIN_PREFIX)
  const mediumFullUrl   = toFullUrl(mediumUsername,   MEDIUM_PREFIX)

  return (
    <div className="py-8 max-w-4xl mx-auto px-4 md:px-0 flex flex-col gap-6 sm:gap-8">
      
      {/* ── Page Header ── */}
      <div className="mb-2">
        <h1 className="text-[28px] sm:text-[32px] font-display font-bold text-gisviz-ink tracking-tight flex items-center gap-3">
          <Settings className="text-gisviz-accent" size={28} />
          Settings
        </h1>
        <p className="text-[14.5px] text-gisviz-ink-soft mt-1.5 leading-relaxed">
          Manage your public identity, roles, and access credentials.
        </p>
      </div>

      {/* ============================================================ */}
      {/* PROFILE CARD                                                 */}
      {/* ============================================================ */}
      <div className="bg-gisviz-card border border-gisviz-border shadow-sm p-6 sm:p-8 rounded-2xl">
        <h2 className="text-[18px] font-display font-bold text-gisviz-ink border-b border-gisviz-border/60 pb-3 mb-6 flex items-center gap-2">
          <AtSign size={16} className="text-gisviz-accent" /> Identity & Profile
        </h2>
        
        <SectionMsg section="profile" />

        <form onSubmit={submitProfile} className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">

            {/* Avatar */}
            <div className="md:col-span-2 flex items-center gap-5">
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-[16px] bg-gisviz-paper border border-gisviz-border overflow-hidden flex items-center justify-center relative group cursor-pointer hover:border-gisviz-accent transition-colors shadow-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  : <ImageIcon className="text-gisviz-ink-soft" size={28} />
                }
                <div className="absolute inset-0 bg-gisviz-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-gisviz-white text-[12.5px] font-semibold backdrop-blur-[2px]">
                  Upload
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[11.5px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-1">Profile Avatar</label>
                <p className="text-[13px] text-gisviz-ink-soft mb-3">JPG, PNG or WebP. Max size 2MB.</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-[12.5px] font-semibold bg-gisviz-paper border border-gisviz-border px-4 py-2 rounded-[8px] hover:border-gisviz-border-strong text-gisviz-ink transition-colors shadow-sm">
                    Select File
                  </button>
                  {avatarFile && <span className="text-[12.5px] font-semibold text-gisviz-safe">✓ Ready to save</span>}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return
                    setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f))
                  }}
                />
              </div>
            </div>

            {/* System Role */}
            <div>
              <label className="flex items-center gap-1.5 text-[11.5px] font-mono text-gisviz-ink-soft mb-1.5 uppercase tracking-wider">
                System Role <Lock size={11} className="text-gisviz-ink-soft opacity-70" />
              </label>
              <div className="w-full bg-gisviz-paper/60 border border-gisviz-border/50 rounded-[10px] px-4 py-2.5 text-gisviz-accent font-semibold text-[13.5px] shadow-inner cursor-not-allowed">
                {user.role_name?.toUpperCase() || 'VIEWER'}
              </div>
            </div>

            {/* Handle */}
            <div>
              <LabelWithEdit label="User Handle" fieldName="handle" />
              {!editingFields.handle ? (
                <div className="w-full bg-gisviz-paper/60 border border-gisviz-border/50 rounded-[10px] px-4 py-2.5 text-gisviz-ink font-semibold text-[13.5px] shadow-inner">
                  @{user.user_handle}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative flex rounded-[10px] overflow-hidden border border-gisviz-border focus-within:ring-1 focus-within:ring-gisviz-accent focus-within:border-gisviz-accent shadow-sm">
                    <span className="flex items-center px-3 bg-gisviz-paper text-gisviz-ink-soft font-medium text-[13.5px] border-r border-gisviz-border shrink-0 select-none">
                      @
                    </span>
                    <input
                      type="text"
                      value={handleVal}
                      onChange={e => setHandleVal(e.target.value.replace(/^@/, ''))}
                      placeholder={user.user_handle}
                      minLength={3}
                      maxLength={16}
                      className="flex-1 bg-gisviz-canvas px-3 py-2.5 text-gisviz-ink text-[13.5px] outline-none min-w-0 transition-colors"
                    />
                  </div>
                  <p className="text-[11.5px] text-gisviz-ink-soft">
                    Letters, numbers, underscores · 3–16 characters
                  </p>
                </div>
              )}
            </div>

            {/* Title */}
            <div className="md:col-span-2">
              <LabelWithEdit label="Current Title / Position" fieldName="title" />
              <input type="text" name="title"
                value={getInputValue(formData.title, !!editingFields.title)}
                disabled={!editingFields.title}
                onChange={handleChange}
                placeholder="e.g. Senior Cartographer at MapBox"
                className={`w-full rounded-[10px] px-4 py-2.5 text-[13.5px] outline-none transition-all border ${
                  !editingFields.title
                    ? 'bg-gisviz-paper/60 border-gisviz-border/50 text-gisviz-ink font-semibold shadow-inner'
                    : 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent focus:border-gisviz-accent shadow-sm'
                } ${!formData.title && !editingFields.title ? 'text-gisviz-ink-soft font-medium' : ''}`}
              />
            </div>

            {/* LinkedIn */}
            <div>
              <LabelWithEdit label="LinkedIn Profile" fieldName="linkedin" />
              {!editingFields.linkedin ? (
                linkedinUsername ? (
                  <a href={linkedinFullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full bg-gisviz-paper/60 border border-gisviz-border/50 rounded-[10px] px-4 py-2.5 text-[13.5px] shadow-inner hover:border-gisviz-border-strong hover:bg-gisviz-paper transition-colors group">
                    <span className="text-gisviz-ink-soft shrink-0">linkedin.com/in/</span>
                    <span className="text-gisviz-accent font-semibold truncate">{linkedinUsername}</span>
                    <ExternalLink size={13} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gisviz-ink-soft" />
                  </a>
                ) : (
                  <div className="w-full bg-gisviz-paper/60 border border-gisviz-border/50 rounded-[10px] px-4 py-2.5 text-gisviz-ink-soft font-medium text-[13.5px] shadow-inner">
                    Not provided
                  </div>
                )
              ) : (
                <div className="flex rounded-[10px] overflow-hidden border border-gisviz-border focus-within:ring-1 focus-within:ring-gisviz-accent focus-within:border-gisviz-accent shadow-sm transition-all">
                  <span className="flex items-center px-3 bg-gisviz-paper text-gisviz-ink-soft font-mono text-[11.5px] border-r border-gisviz-border whitespace-nowrap shrink-0">
                    linkedin.com/in/
                  </span>
                  <input
                    type="text"
                    value={linkedinUsername}
                    onChange={e => setLinkedinUsername(e.target.value)}
                    placeholder="your-username"
                    className="flex-1 bg-gisviz-canvas px-3 py-2.5 text-gisviz-ink text-[13.5px] outline-none min-w-0"
                  />
                </div>
              )}
            </div>

            {/* Medium */}
            <div>
              <LabelWithEdit label="Medium Profile" fieldName="medium" />
              {!editingFields.medium ? (
                mediumUsername ? (
                  <a href={mediumFullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full bg-gisviz-paper/60 border border-gisviz-border/50 rounded-[10px] px-4 py-2.5 text-[13.5px] shadow-inner hover:border-gisviz-border-strong hover:bg-gisviz-paper transition-colors group">
                    <span className="text-gisviz-ink-soft shrink-0">medium.com/@</span>
                    <span className="text-gisviz-accent font-semibold truncate">{mediumUsername}</span>
                    <ExternalLink size={13} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gisviz-ink-soft" />
                  </a>
                ) : (
                  <div className="w-full bg-gisviz-paper/60 border border-gisviz-border/50 rounded-[10px] px-4 py-2.5 text-gisviz-ink-soft font-medium text-[13.5px] shadow-inner">
                    Not provided
                  </div>
                )
              ) : (
                <div className="flex rounded-[10px] overflow-hidden border border-gisviz-border focus-within:ring-1 focus-within:ring-gisviz-accent focus-within:border-gisviz-accent shadow-sm transition-all">
                  <span className="flex items-center px-3 bg-gisviz-paper text-gisviz-ink-soft font-mono text-[11.5px] border-r border-gisviz-border whitespace-nowrap shrink-0">
                    medium.com/@
                  </span>
                  <input
                    type="text"
                    value={mediumUsername}
                    onChange={e => setMediumUsername(e.target.value)}
                    placeholder="your-username"
                    className="flex-1 bg-gisviz-canvas px-3 py-2.5 text-gisviz-ink text-[13.5px] outline-none min-w-0"
                  />
                </div>
              )}
            </div>

            {/* Personal Website */}
            <div className="md:col-span-2">
              <LabelWithEdit label="Personal Website" fieldName="website_url" />
              {!editingFields.website_url ? (
                formData.website_url ? (
                  <a href={formData.website_url.startsWith('http') ? formData.website_url : `https://${formData.website_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full bg-gisviz-paper/60 border border-gisviz-border/50 rounded-[10px] px-4 py-2.5 text-[13.5px] shadow-inner hover:border-gisviz-border-strong hover:bg-gisviz-paper transition-colors group">
                    <span className="text-gisviz-accent font-semibold truncate">{formData.website_url}</span>
                    <ExternalLink size={13} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gisviz-ink-soft" />
                  </a>
                ) : (
                  <div className="w-full bg-gisviz-paper/60 border border-gisviz-border/50 rounded-[10px] px-4 py-2.5 text-gisviz-ink-soft font-medium text-[13.5px] shadow-inner">
                    Not provided
                  </div>
                )
              ) : (
                <div className="relative flex items-center">
                  <LinkIcon size={16} className="absolute left-3.5 text-gisviz-ink-soft" />
                  <input
                    type="url"
                    name="website_url"
                    value={formData.website_url}
                    onChange={handleChange}
                    placeholder="https://yourwebsite.com"
                    className="w-full bg-gisviz-canvas border border-gisviz-border rounded-[10px] pl-10 pr-4 py-2.5 text-gisviz-ink text-[13.5px] focus:ring-1 focus:ring-gisviz-accent focus:border-gisviz-accent outline-none shadow-sm transition-all"
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div className="md:col-span-2 pt-2">
              <div className="relative">
                <LabelWithEdit label="Base Location" fieldName="location" />
                <div className="relative flex items-center">
                  <MapPin size={16} className={`absolute left-3.5 ${!editingFields.location ? 'text-gisviz-ink-soft' : 'text-gisviz-accent'}`} />
                  <input
                    type="text"
                    value={getInputValue(locationQuery, !!editingFields.location)}
                    disabled={!editingFields.location}
                    onChange={e => editingFields.location && searchLocation(e.target.value)}
                    placeholder="Search city, state, country..."
                    className={`w-full rounded-[10px] pl-10 pr-4 py-2.5 text-[13.5px] outline-none transition-all border ${
                      !editingFields.location
                        ? 'bg-gisviz-paper/60 border-gisviz-border/50 text-gisviz-ink font-semibold shadow-inner'
                        : 'bg-gisviz-canvas border-gisviz-border text-gisviz-ink focus:ring-1 focus:ring-gisviz-accent focus:border-gisviz-accent shadow-sm'
                    } ${!locationQuery && !editingFields.location ? 'text-gisviz-ink-soft font-medium' : ''}`}
                  />
                  {isSearchingLocation && (
                    <Loader2 size={15} className="absolute right-3.5 animate-spin text-gisviz-ink-soft" />
                  )}
                </div>
                {locationSuggestions.length > 0 && (
                  <ul className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-gisviz-card border border-gisviz-border rounded-[10px] shadow-lg max-h-48 overflow-y-auto overflow-hidden">
                    {locationSuggestions.map((item, i) => (
                      <li key={i} className="border-b border-gisviz-border/40 last:border-0">
                        <button type="button" onClick={() => selectLocation(item)}
                          className="w-full text-left px-4 py-3 text-[13px] font-medium text-gisviz-ink hover:bg-gisviz-paper transition-colors">
                          {item.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

          </div>

          {hasActiveProfileEdits && (
            <div className="pt-6 mt-6 border-t border-gisviz-border/60 flex justify-end">
              <SaveBtn section="profile" />
            </div>
          )}
        </form>
      </div>

      {/* ============================================================ */}
      {/* SECURITY CARD                                                */}
      {/* ============================================================ */}
      <div className="bg-gisviz-card border border-gisviz-border shadow-sm p-6 sm:p-8 rounded-2xl">
        <h2 className="text-[18px] font-display font-bold text-gisviz-ink border-b border-gisviz-border/60 pb-3 mb-6 flex items-center gap-2">
          <Shield size={16} className="text-gisviz-accent" /> Security & Access
        </h2>

        {/* Email Flow */}
        <div className="mb-6 pb-6 border-b border-gisviz-border/60">
          <SectionMsg section="email" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11.5px] font-mono text-gisviz-ink-soft uppercase tracking-wider mb-1">Email Address</p>
              <p className="text-[14.5px] font-semibold text-gisviz-ink">{user.email_address}</p>
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
              className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-[6px] border transition-colors flex items-center gap-1.5 ${
                editingFields.email
                  ? 'border-gisviz-alert/40 text-gisviz-alert bg-gisviz-alert/5'
                  : 'border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent'
              }`}
            >
              {editingFields.email ? <><X size={12} /> Cancel</> : <><Edit2 size={12} /> Change</>}
            </button>
          </div>

          {editingFields.email && emailStep === 'idle' && (
            <button type="button" onClick={() => setEmailStep('form')}
              className="text-[13.5px] font-semibold text-gisviz-accent hover:underline flex items-center gap-1">
              Start email change procedure &rarr;
            </button>
          )}

          {editingFields.email && emailStep === 'form' && (
            <form onSubmit={submitEmailRequest} className="space-y-4 max-w-md">
              <div>
                <label className="text-[11.5px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-1.5">New Email Address</label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3.5 text-gisviz-ink-soft" />
                  <input type="email" value={emailForm.new_email}
                    onChange={e => setEmailForm(p => ({ ...p, new_email: e.target.value }))}
                    placeholder={user.email_address}
                    className="w-full bg-gisviz-canvas border border-gisviz-border rounded-[10px] pl-10 pr-4 py-2.5 text-gisviz-ink text-[13.5px] focus:ring-1 focus:ring-gisviz-accent focus:border-gisviz-accent outline-none shadow-sm transition-all"
                  />
                </div>
              </div>
              <PwdInput name="emailPwd" label="Current Password (to confirm)"
                placeholder="Enter your password"
                value={emailForm.current_password}
                showPwd={showPwd} onToggle={togglePwd}
                onChange={e => setEmailForm(p => ({ ...p, current_password: e.target.value }))}
              />
              <div className="flex justify-start pt-2">
                <button type="submit" disabled={!!saving.email}
                  className="flex items-center gap-2 bg-gisviz-accent text-[color:var(--accent-on)] px-5 py-2.5 rounded-[10px] text-[13.5px] font-semibold hover:brightness-110 disabled:opacity-50 transition-[filter] shadow-sm">
                  {saving.email ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  {saving.email ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          )}

          {editingFields.email && emailStep === 'otp' && (
            <form onSubmit={submitEmailVerify} className="space-y-4 max-w-md">
              {devOtp && (
                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-[10px] text-[12.5px] font-mono text-amber-700 font-medium">
                  DEV: OTP = {devOtp}
                </div>
              )}
              <div>
                <label className="text-[11.5px] font-mono text-gisviz-ink-soft uppercase tracking-wider block mb-1.5">Verification Code</label>
                <input type="text" value={emailOtp} onChange={e => setEmailOtp(e.target.value)}
                  maxLength={6} placeholder="••••••"
                  className="w-full text-center tracking-[0.5em] bg-gisviz-canvas border border-gisviz-border rounded-[10px] px-4 py-3.5 text-gisviz-ink text-[16px] font-bold focus:ring-1 focus:ring-gisviz-accent focus:border-gisviz-accent outline-none shadow-sm transition-all"
                />
              </div>
              <div className="flex justify-start pt-2">
                <button type="submit" disabled={!!saving.email}
                  className="flex items-center gap-2 bg-gisviz-safe text-white px-5 py-2.5 rounded-[10px] text-[13.5px] font-semibold hover:bg-gisviz-safe/90 disabled:opacity-50 transition-colors shadow-sm">
                  {saving.email ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  {saving.email ? 'Verifying...' : 'Verify & Update Email'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11.5px] font-mono text-gisviz-ink-soft uppercase tracking-wider mb-1">Password</p>
              <p className="text-[14.5px] font-bold text-gisviz-ink tracking-widest">••••••••••••</p>
            </div>
            <button type="button" onClick={() => toggleEdit('password')}
              className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-[6px] border transition-colors flex items-center gap-1.5 ${
                editingFields.password
                  ? 'border-gisviz-alert/40 text-gisviz-alert bg-gisviz-alert/5'
                  : 'border-gisviz-border text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent'
              }`}
            >
              {editingFields.password ? <><X size={12} /> Cancel</> : <><Edit2 size={12} /> Change</>}
            </button>
          </div>

          {editingFields.password && (
            <form onSubmit={submitPassword} className="space-y-4 max-w-md pt-2">
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
              <div className="flex justify-start pt-2">
                <SaveBtn section="password" label="Update Password" />
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* ACCOUNT STATUS (DANGER ZONE)                                 */}
      {/* ============================================================ */}
      <div className="bg-amber-50/20 border border-amber-500/30 shadow-sm p-6 sm:p-8 rounded-2xl mb-6">
        <h2 className="text-[18px] font-display font-bold text-amber-700 border-b border-amber-500/20 pb-3 mb-4 flex items-center gap-2">
          <Shield size={16} /> Account Deactivation
        </h2>
        
        <SectionMsg section="deactivate" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <p className="text-[14.5px] text-amber-800/80 leading-relaxed max-w-xl">
            Deactivating your account hides your profile and published maps from the public feed. You can reactivate at any time by logging back in.
          </p>
          <button type="button" onClick={() => toggleEdit('deactivate')}
            className={`text-[12.5px] font-semibold px-4 py-2 rounded-[8px] border transition-colors flex items-center justify-center gap-2 shrink-0 ${
              editingFields.deactivate
                ? 'border-amber-500/40 text-amber-700 bg-amber-50'
                : 'border-amber-500/30 text-amber-700 hover:border-amber-500 hover:bg-amber-50'
            }`}
          >
            {editingFields.deactivate ? <><X size={14} /> Cancel</> : 'Deactivate Account'}
          </button>
        </div>

        {editingFields.deactivate && (
          <form onSubmit={submitDeactivate} className="space-y-4 max-w-md mt-6 p-5 bg-gisviz-card rounded-[14px] border border-amber-200 shadow-sm">
            <div>
              <label className="text-[12.5px] font-medium text-gisviz-ink-soft block mb-2">
                Type your handle to confirm: <span className="text-gisviz-ink font-bold font-mono">@{user.user_handle}</span>
              </label>
              <input type="text" value={deactivateConfirmText}
                onChange={e => setDeactivateConfirmText(e.target.value)}
                placeholder={user.user_handle}
                className="w-full bg-gisviz-canvas border border-amber-500/30 rounded-[10px] px-4 py-2.5 text-gisviz-ink text-[13.5px] focus:ring-1 focus:ring-amber-500 outline-none shadow-sm transition-all"
              />
            </div>
            <PwdInput name="deactivatePassword" label="Current Password" placeholder="Enter your password"
              value={deactivatePassword}
              showPwd={showPwd} onToggle={togglePwd}
              onChange={e => setDeactivatePassword(e.target.value)}
            />
            <div className="flex justify-start pt-2">
              <button type="submit" disabled={!!saving.deactivate || deactivateConfirmText !== user.user_handle}
                className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-[10px] text-[13.5px] font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm">
                {saving.deactivate ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
                {saving.deactivate ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}