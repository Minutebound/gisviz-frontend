'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Key, UserPlus, Mail, Lock, AtSign, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { gisvizApi } from '../../services/api'

type AuthView = 'login' | 'register' | 'verify' | 'forgot'

// SAFE ERROR PARSER FOR FASTAPI
const parseError = (err: any, fallback: string): string => {
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && detail.error === 'unverified') return 'Account not verified. Please enter your verification code.';
  if (Array.isArray(detail) && detail.length > 0) {
    const loc = detail[0].loc ? detail[0].loc[detail[0].loc.length - 1] : 'Field';
    return `${loc}: ${detail[0].msg}`;
  }
  return err.message || fallback;
}

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loginSession, isAuthenticated, isLoading: authLoading } = useAuth()
  
  // Capture the page they came from, default to "/"
  const redirectUrl = searchParams.get('redirect') || '/'
  
  const [view, setView] = useState<AuthView>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [devNotice, setDevNotice] = useState('') 

  const [formData, setFormData] = useState({
    user_handle: '',
    email_address: '',
    password: '',
    otp: ''
  })

  // Auto-redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated, authLoading, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const clearMessages = () => {
    setErrorMsg('')
    setSuccessMsg('')
    setDevNotice('')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    setIsLoading(true)
    try {
      const res = await gisvizApi.registerUser({
        user_handle: formData.user_handle,
        email_address: formData.email_address,
        plaintext_password: formData.password
      })
      setSuccessMsg(res.message)
      if (res.dev_otp) setDevNotice(`DEV MODE: Your OTP is ${res.dev_otp}`) 
      setView('verify')
    } catch (err: any) {
      setErrorMsg(parseError(err, 'Registration failed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    setIsLoading(true)
    try {
      await gisvizApi.verifyEmail(formData.email_address, formData.otp)
      setSuccessMsg('Email verified! You can now log in.')
      setView('login')
    } catch (err: any) {
      setErrorMsg(parseError(err, 'Verification failed'))
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
      params.append('username', formData.user_handle || formData.email_address)
      params.append('password', formData.password)
      
      const res = await gisvizApi.loginUser(params)
      await loginSession(res.access_token, res.user_handle)
      
      // Send them back to where they came from
      router.push(redirectUrl) 
    } catch (err: any) {
      if (err.response?.status === 403) {
        setErrorMsg("Account not verified. Please enter your verification code.")
        
        const detail = err.response.data.detail;
        if (detail && detail.error === 'unverified') {
          setFormData(prev => ({ ...prev, email_address: detail.email }))
        } else if (formData.user_handle.includes('@')) {
          setFormData(prev => ({ ...prev, email_address: formData.user_handle }))
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
    e.preventDefault()
    clearMessages()
    setIsLoading(true)
    try {
      const res = await gisvizApi.forgotPassword(formData.email_address)
      setSuccessMsg('If the email exists, a reset link has been generated.')
      if (res.dev_token) {
         setDevNotice(`DEV MODE: Go to /reset-password?token=${res.dev_token}`)
      }
    } catch (err: any) {
      setErrorMsg(parseError(err, 'Failed to process request'))
    } finally {
      setIsLoading(false)
    }
  }

  // Prevent flashing the auth form if we are about to redirect an already-logged-in user
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
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gisviz-accent text-white rounded-full mb-4">
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
            {view === 'verify' && 'Verify Identity'}
            {view === 'forgot' && 'Recover Access'}
          </p>
        </div>

        {errorMsg && <div className="p-3 mb-6 bg-red-50 border border-gisviz-alert/60 text-gisviz-alert/90 text-[12px] font-mono rounded-md">{errorMsg}</div>}
        {successMsg && <div className="p-3 mb-6 bg-gisviz-safe/5  border border-gisviz-safe/20    text-gisviz-safe/70       text-[12px] font-mono rounded-md">{successMsg}</div>}
        {devNotice && <div className="p-3 mb-6 bg-yellow-50 border border-yellow-300 text-yellow-800 text-[12px] font-mono rounded-md break-all">{devNotice}</div>}

        {/* LOGIN VIEW */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Handle or Email</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="text" name="user_handle" onChange={handleChange} className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Security Key</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="password" name="password" onChange={handleChange} className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-gisviz-accent text-white py-2.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold mt-6">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Initialize Session'}
            </button>
            <div className="flex justify-between mt-4 text-[12px] font-mono text-gisviz-accent">
              <button type="button" onClick={() => { clearMessages(); setView('forgot') }} className="hover:underline">Forgot Key?</button>
              <button type="button" onClick={() => { clearMessages(); setView('register') }} className="hover:underline">Request Access</button>
            </div>
          </form>
        )}

        {/* REGISTER VIEW */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">User Handle</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="text" name="user_handle" onChange={handleChange} className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="email" name="email_address" onChange={handleChange} className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Security Key</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="password" name="password" onChange={handleChange} minLength={8} className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-gisviz-ink text-white py-2.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold mt-6">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><UserPlus size={16} /> Submit Credentials</>}
            </button>
            <div className="text-center mt-4">
              <button type="button" onClick={() => { clearMessages(); setView('login') }} className="text-[12px] font-mono text-gisviz-accent hover:underline">Return to Login</button>
            </div>
          </form>
        )}

        {/* VERIFY VIEW */}
        {view === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-[12px] font-mono text-gisviz-ink-soft text-center mb-6">
              Enter the 6-digit code sent to <br/>
              <span className="font-bold text-gisviz-ink">{formData.email_address || 'your email address'}</span>
            </p>
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider text-center">Verification Code</label>
              <input required type="text" maxLength={6} name="otp" onChange={handleChange} className="w-full text-center tracking-[0.5em] bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-4 text-gisviz-ink text-[24px] font-bold focus:ring-2 focus:ring-gisviz-accent outline-none font-mono" placeholder="••••••" />
            </div>
            <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-gisviz-safe/60      text-white py-2.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold mt-6">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Verify Identity'}
            </button>
            
            <div className="text-center mt-4 flex flex-col gap-2">
              <button 
                type="button" 
                onClick={async () => {
                  try {
                    await gisvizApi.resendOtp({ email_address: formData.email_address });
                    setSuccessMsg("New code dispatched.");
                  } catch (err: any) {
                    setErrorMsg(parseError(err, 'Failed to resend code.'));
                  }
                }}
                className="text-[12px] font-mono text-gisviz-accent hover:underline"
              >
                Resend Verification Code
              </button>
              <button type="button" onClick={() => { clearMessages(); setView('login') }} className="text-[12px] font-mono text-gisviz-ink-soft hover:underline">Return to Login</button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD VIEW */}
        {view === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-[12px] font-mono text-gisviz-ink-soft text-center mb-4">Submit your email to receive a recovery token.</p>
            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
                <input required type="email" name="email_address" onChange={handleChange} className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px]" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-gisviz-ink text-white py-2.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold mt-6">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><ArrowRight size={16} /> Dispatch Token</>}
            </button>
            <div className="text-center mt-4">
              <button type="button" onClick={() => { clearMessages(); setView('login') }} className="text-[12px] font-mono text-gisviz-accent hover:underline">Return to Login</button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

// Wrap in Suspense to safely use Next.js useSearchParams hook
export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gisviz-canvas">
        <Loader2 className="animate-spin text-gisviz-accent" size={32} />
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}