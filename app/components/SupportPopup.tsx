'use client'

import React, { useState } from 'react'
import { X, LifeBuoy, Loader2, Send } from 'lucide-react'
import { gisvizApi } from '../../services/api'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function SupportPopup({ isOpen, onClose }: Props) {
  const [data, setData] = useState({ category: 'general_inquiry', subject: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await gisvizApi.submitSupportTicket(data)
      setSuccess(true)
      setTimeout(() => { setSuccess(false); onClose(); setData({ category: 'general_inquiry', subject: '', description: '' }) }, 2000)
    } catch (e) {
      alert('Failed to send ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-gisviz-card border border-gisviz-border p-6 rounded-md w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-[16px] font-bold flex items-center gap-2"><LifeBuoy size={16} /> Contact Support</h2>
          <button onClick={onClose}><X size={16} className="text-gisviz-ink-soft" /></button>
        </div>

        {success ? (
          <div className="text-center py-8 text-gisviz-safe font-mono">Ticket submitted successfully!</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <select className="w-full bg-gisviz-canvas border border-gisviz-border p-2 rounded text-[12px] font-mono"
              value={data.category} onChange={e => setData(p => ({...p, category: e.target.value}))}>
              <option value="general_inquiry">General Inquiry</option>
              <option value="bug_report">Bug Report</option>
              <option value="feature_request">Feature Request</option>
              <option value="account_issue">Account Issue</option>
              <option value="billing">Billing</option>
              <option value="content_policy">Content Policy</option>
            </select>
            <input required placeholder="Subject" className="w-full bg-gisviz-canvas border border-gisviz-border p-2 rounded text-[12px] font-mono"
              value={data.subject} onChange={e => setData(p => ({...p, subject: e.target.value}))} />
            <textarea required placeholder="Describe your issue..." className="w-full bg-gisviz-canvas border border-gisviz-border p-2 rounded text-[12px] font-mono h-24"
              value={data.description} onChange={e => setData(p => ({...p, description: e.target.value}))} />
            <button type="submit" disabled={submitting} className="w-full bg-gisviz-accent text-white py-2 rounded text-[12px] font-bold font-mono flex items-center justify-center gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Ticket
            </button>
          </form>
        )}
      </div>
    </div>
  )
}