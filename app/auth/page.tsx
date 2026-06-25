'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, MapPin, ArrowRight, Loader2, CornerLeftUpIcon, CornerRightUp } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function AuthPage() {
  const router = useRouter()
  const { loginSession } = useAuth() // Assuming your context has a method to set the user/token
  
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    user_handle: '',
    email_address: '',
    password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    try {
      if (isLogin) {
        // FastAPI OAuth2PasswordRequestForm expects form-urlencoded 'username' and 'password'
        const formParams = new URLSearchParams()
        formParams.append('username', formData.user_handle)
        formParams.append('password', formData.password)

        const res = await fetch('http://localhost:8001/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formParams,
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail || 'Authentication failed')
        }

        const data = await res.json()
        
        // Pass token to AuthContext
        if (loginSession) {
          loginSession(data.access_token, data.user_handle)
        }
        router.push('/')

      } else {
        // Registration expects JSON payload defined in UserRegistrationPayload schema
        const res = await fetch('http://localhost:8001/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_handle: formData.user_handle,
            email_address: formData.email_address,
            plaintext_password: formData.password,
          }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail || 'Registration failed')
        }

        // Auto-login after successful registration
        setIsLogin(true)
        setErrorMsg('Registration successful. Please log in.')
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      
      {/* Enterprise Plate Container */}
      <div className="relative w-full max-w-md bg-gisviz-card border border-gisviz-border shadow-xl p-8 rounded-sm plate-enter">
        
        {/* Cartographic Registration Marks from globals.css */}
        <div className="reg-mark reg-tl"></div>
        <div className="reg-mark reg-tr"></div>
        <div className="reg-mark reg-bl"></div>
        <div className="reg-mark reg-br"></div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gisviz-canvas rounded-lg border border-gisviz-border mb-4 text-gisviz-accent">
            {isLogin ? <ShieldCheck size={24} /> : <CornerRightUp size={24} />}
          </div>
          <h1 className="font-display text-2xl font-bold text-gisviz-ink">
            {isLogin ? 'Login' : 'SignUp'}
          </h1>
          <p className="text-sm text-gisviz-ink-soft mt-2 font-mono">
            {isLogin ? 'Authenticate to access spatial datasets.' : 'Register for global coordinate mapping.'}
          </p>
        </div>

        {errorMsg && (
          <div className={`p-3 mb-6 rounded-md text-sm font-mono border ${errorMsg.includes('successful') ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400'}`}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
              User Handle
            </label>
            <input
              type="text"
              name="user_handle"
              required
              value={formData.user_handle}
              onChange={handleChange}
              className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent focus:border-transparent outline-none transition-all font-mono text-sm"
              placeholder="e.g. geo_analyst"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                name="email_address"
                required={!isLogin}
                value={formData.email_address}
                onChange={handleChange}
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent focus:border-transparent outline-none transition-all font-mono text-sm"
                placeholder="analyst@enterprise.com"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-4 py-2.5 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent focus:border-transparent outline-none transition-all font-mono text-sm"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gisviz-accent text-white py-2.5 px-4 rounded-md hover:bg-opacity-90 transition-all font-mono text-sm mt-4 shadow-md disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {isLogin ? 'Establish Connection' : 'Deploy Account'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gisviz-border pt-6">
          <p className="text-sm text-gisviz-ink-soft">
            {isLogin ? "Don't have clearance yet?" : "Already hold clearance?"}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setErrorMsg('')
              }}
              className="ml-2 text-gisviz-accent hover:underline font-mono"
            >
              {isLogin ? 'Request Access' : 'Authenticate Here'}
            </button>
          </p>
        </div>

      </div>
    </div>
  )
}