'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Loader2, Save } from 'lucide-react'
import { gisvizApi } from '../../services/api'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (!token) {
      setErrorMsg("Invalid or missing security token.")
    }
  }, [token])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    
    setIsLoading(true)
    setErrorMsg('')
    try {
      await gisvizApi.resetPassword(token, newPassword)
      setSuccessMsg("Password successfully updated. You may now log in.")
      setTimeout(() => router.push('/auth'), 3000) // Redirect to login after 3 seconds
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to reset password. The token may be expired.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gisviz-canvas p-4">
      <div className="w-full max-w-md bg-gisviz-card border border-gisviz-border shadow-lg p-8 rounded-sm">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gisviz-alert/90 text-gisviz-white rounded-full mb-4">
            <Lock size={24} />
          </div>
          <h2 className="text-[24px] font-display font-bold text-gisviz-ink">Reconfigure Password</h2>
        </div>

        {errorMsg && <div className="p-3 mb-6 bg-gisviz-alert/10 border border-gisviz-alert/60 text-gisviz-alert/90 text-[12px] font-mono rounded-md">{errorMsg}</div>}
        {successMsg && <div className="p-3 mb-6 bg-gisviz-safe/5  border border-gisviz-safe/20    text-gisviz-safe/70       text-[12px] font-mono rounded-md">{successMsg}</div>}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-1 uppercase tracking-wider">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-gisviz-ink-soft" size={16} />
              <input 
                required 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} 
                minLength={8}
                disabled={!token || !!successMsg}
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md pl-10 pr-4 py-2 text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono text-[12px] disabled:opacity-50" 
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isLoading || !token || !!successMsg} 
            className="w-full flex items-center justify-center gap-2 bg-gisviz-ink text-gisviz-white py-2.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-[12px] font-bold mt-6 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Reset Password</>}
          </button>
          
          <div className="text-center mt-6">
              <button type="button" onClick={() => router.push('/auth')} className="text-[12px] font-mono text-gisviz-accent hover:underline">Abort and return to Login</button>
          </div>
        </form>

      </div>
    </div>
  )
}