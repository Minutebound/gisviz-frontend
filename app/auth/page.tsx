'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Key, UserPlus, Mail, Lock, AtSign, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../services/api'

type AuthView = 'login' | 'register' | 'verify' | 'forgot'

const parseError = (err: any, fallback: string): string => {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && detail.error === 'unverified') return 'Account not verified. Please enter your verification code.'
  if (detail && detail.error === 'deactivated') return 'This account was deactivated. Enter the code we just sent to reactivate it.'
  if (Array.isArray(detail) && detail.length > 0) {
    const loc = detail[0].loc ? detail[0].loc[detail[0].loc.length - 1] : 'Field'
    return `${loc}: ${detail[0].msg}`
  }
  return err.message || fallback
}

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loginSession, isAuthenticated, isLoading: authLoading } = useAuth()
  const redirectUrl = searchParams.get('redirect') || '/'

  const [view, setView] = useState<AuthView>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [devNotice, setDevNotice] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const [formData, setFormData] = useState({
    user_handle: '',
    email_address: '',
    password: '',
    otp: '',
  })

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace('/')
  }, [isAuthenticated, authLoading, router])

  // Countdown timer effect for resend OTP
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value })

  const clearMessages = () => { setErrorMsg(''); setSuccessMsg(''); setDevNotice('') }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); clearMessages(); setIsLoading(true)
    try {
      const res = await gisvizApi.registerUser({
        user_handle: formData.user_handle,
        email_address: formData.email_address,
        plaintext_password: formData.password,
      })
      setSuccessMsg(res.message)
      if (res.dev_otp) setDevNotice(`DEV MODE: Your OTP is ${res.dev_otp}`)
      setView('verify')
    } catch (err: any) {
      setErrorMsg(parseError(err, 'Registration failed'))
    } finally { setIsLoading(false) }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault(); clearMessages(); setIsLoading(true)
    try {
      const res = await gisvizApi.verifyEmail(formData.email_address, formData.otp)
      // res.reactivated is true when a deactivated account was restored
      if (res.reactivated) {
        setSuccessMsg('Account reactivated! You can now log in.')
      } else {
        setSuccessMsg('Email verified! You can now log in.')
      }
      setView('login')
    } catch (err: any) {
      setErrorMsg(parseError(err, 'Verification failed'))
    } finally { setIsLoading(false) }
  }

  const handleResendOtp = async () => {
    if (!formData.email_address) {
      setErrorMsg('Please enter your email address to receive a new code.')
      return
    }
    clearMessages()
    setIsLoading(true)
    try {
      const res = await gisvizApi.resendOtp(formData.email_address)
      setSuccessMsg('A new verification code has been sent.')
      if (res.dev_otp) setDevNotice(`DEV MODE: Your new OTP is ${res.dev_otp}`)
      setResendCooldown(60) // Start 60 second cooldown
    } catch (err: any) {
      setErrorMsg(parseError(err, 'Failed to resend code'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', formData.email_address)
      params.append('password', formData.password)
        
      const res = await gisvizApi.loginUser(params)
      await loginSession(res.access_token, res.user_handle)
      
      // Send them back to where they came from
      router.push(redirectUrl) 
    } catch (err: any) {
      if (err.response?.status === 403) {
        setErrorMsg("Account not verified. Please enter your verification code.")
        
        const detail = err.response.data?.detail;
        
        // Check if the backend sent our custom detail object (unverified or deactivated)
        if (detail && (detail.error === 'unverified' || detail.error === 'deactivated')) {
          setFormData(prev => ({ ...prev, email_address: detail.email }))
          
          // SET THE DEV NOTICE IF OTP IS PRESENT
          if (detail.dev_otp) {
            setDevNotice(`DEV MODE: Your OTP is ${detail.dev_otp}`)
          }
        }
        
        setView('verify') 
      } else {
        setErrorMsg(parseError(err, 'Invalid credentials'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); clearMessages(); setIsLoading(true)
    try {
      const res = await gisvizApi.forgotPassword(formData.email_address)
      setSuccessMsg('If the email exists, a reset link has been generated.')
      if (res.dev_token) setDevNotice(`DEV MODE: Go to /reset-password?token=${res.dev_token}`)
    } catch (err: any) {
      setErrorMsg(parseError(err, 'Failed to process request'))
    } finally { setIsLoading(false) }
  }

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gisviz-canvas p-4">
        <Loader2 className="animate-spin text-gisviz-accent" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gisviz-canvas p-4">
      <div className="w-full max-w-md bg-gisviz-card border border-gisviz-border shadow-lg p-8 rounded-sm">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gisviz-accent text-gisviz-white rounded-full mb-4">
            {view === 'verify' ? <ShieldCheck size={24} /> : <Key size={24} />}
          </div>
          <h1 className="text-[24px] font-display font-bold text-gisviz-ink">
            {view === 'login' && 'Login Access'}
            {view === 'register' && 'Platform Registration'}
            {view === 'verify' && 'Verify Identity'}
            {view === 'forgot' && 'Recover Access'}
          </h1>
          <p className="text-[12px] font-mono text-gisviz-ink-soft mt-2 uppercase tracking-wider">
            {view === 'login' && 'System Access'}
            {view === 'register' && 'Platform Registration'}
            {view === 'verify' && 'Identity Verification'}
            {view === 'forgot' && 'Recover Access'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 mb-6 bg-gisviz-alert/10 border border-gisviz-alert/60 text-gisviz-alert/90 text-[12px] font-mono rounded-md">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 mb-6 bg-gisviz-safe/5 border border-gisviz-safe/20 text-gisviz-safe/70 text-[12px] font-mono rounded-md">
            {successMsg}
          </div>
        )}
        {devNotice && (
          <div className="p-3 mb-6 bg-yellow-50 border border-yellow-300 text-yellow-800 text-[12px] font-mono rounded-md break-all">
            {devNotice}
          </div>
        )}

        {/* ── LOGIN ── */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="email" name="email_address" onChange={handleChange}
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Security Key</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="password" name="password" onChange={handleChange}
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <button type="submit" disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gisviz-accent text-gisviz-white py-2.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold mt-6">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {isLoading ? 'Authenticating...' : 'Access Platform'}
            </button>
            <div className="flex justify-between text-[11px] font-mono text-gisviz-ink-soft mt-4">
              <button type="button" onClick={() => { clearMessages(); setView('register') }}
                className="hover:text-gisviz-accent transition-colors flex items-center gap-1">
                <UserPlus size={12} /> Register
              </button>
              <button type="button" onClick={() => { clearMessages(); setView('forgot') }}
                className="hover:text-gisviz-accent transition-colors flex items-center gap-1">
                <Mail size={12} /> Forgot password
              </button>
            </div>
          </form>
        )}

        {/* ── REGISTER ── */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* ── User Handle (NEW — registration only) ── */}
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
                User Handle
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input
                  required
                  type="text"
                  name="user_handle"
                  value={formData.user_handle}
                  onChange={handleChange}
                  placeholder="e.g. mapmaker_jane"
                  minLength={3}
                  maxLength={15}
                  pattern="[a-zA-Z0-9_]+"
                  title="3–15 characters. Letters, numbers, and underscores only."
                  autoComplete="username"
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]"
                />
              </div>
              <p className="text-[12px] font-mono text-gisviz-ink-soft mt-1">
                3–15 characters · letters, numbers, underscores
              </p>
            </div>

            {/* ── Email + Password ── */}
            {[
              { name: 'email_address', label: 'Email Address', icon: Mail, type: 'email' },
              { name: 'password',      label: 'Security Key',  icon: Lock, type: 'password' },
            ].map(({ name, label, icon: Icon, type }) => (
              <div key={name}>
                <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
                  {label}
                </label>
                <div className="relative">
                  <Icon className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                  <input
                    required
                    type={type}
                    name={name}
                    value={(formData as any)[name]}
                    onChange={handleChange}
                    className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]"
                  />
                </div>
              </div>
            ))}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gisviz-accent text-gisviz-white py-2.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold mt-6"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {isLoading ? 'Registering...' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={() => { clearMessages(); setView('login') }}
              className="w-full text-center text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-accent mt-2"
            >
              Already have an account?
            </button>
          </form>
        )}

        {/* ── VERIFY ── */}
        {view === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="email" name="email_address"
                  value={formData.email_address} onChange={handleChange}
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Verification Code</label>
              <input required type="text" name="otp" maxLength={6}
                value={formData.otp} onChange={handleChange}
                placeholder="••••••"
                className="w-full text-center tracking-[0.5em] bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-3 text-gisviz-ink text-[16px] font-bold focus:ring-2 focus:ring-gisviz-accent outline-none font-mono" />
            </div>
            
            <button type="submit" disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gisviz-accent text-gisviz-white py-2.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {isLoading ? 'Verifying...' : 'Confirm Identity'}
            </button>

            {/* ── Resend Block ── */}
            <div className="flex flex-col gap-2 mt-4">
              <button 
                type="button" 
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className="w-full text-center text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-ink disabled:opacity-50 disabled:hover:text-gisviz-ink-soft transition-colors"
              >
                {resendCooldown > 0 
                  ? `Resend code in ${resendCooldown}s` 
                  : 'Didn\'t receive a code? Resend'}
              </button>

              <button type="button" onClick={() => { clearMessages(); setView('login') }}
                className="w-full text-center text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-accent">
                ← Back to login
              </button>
            </div>
          </form>
        )}

        {/* ── FORGOT ── */}
        {view === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Registered Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="email" name="email_address" onChange={handleChange}
                  className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <button type="submit" disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gisviz-accent text-gisviz-white py-2.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button type="button" onClick={() => { clearMessages(); setView('login') }}
              className="w-full text-center text-[11px] font-mono text-gisviz-ink-soft hover:text-gisviz-accent mt-2">
              ← Back to login
            </button>
          </form>
        )}

      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gisviz-accent" size={32} />
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}