'use client'

import React, { useState, useEffect } from 'react'
import { X, Flag, AlertTriangle, Loader2, Check } from 'lucide-react'
import { gisvizApi } from '../../services/api'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  publicationId: string
}

export default function ReportModal({ isOpen, onClose, publicationId }: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else {
      document.body.style.overflow = 'auto'
      // Reset state when closed
      setTimeout(() => {
        setReason('')
        setDetails('')
        setSubmitted(false)
      }, 300)
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return
    
    setIsSubmitting(true)
    
    try {
      // The real API call!
      await gisvizApi.reportPost(publicationId, reason, details)
      setSubmitted(true)
    } catch (err) {
      console.error("Failed to submit report:", err)
      // Optional: You could add a setCommentError state here to show UI errors
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Plate */}
      <div className="relative w-full max-w-md bg-gisviz-card border border-gisviz-border shadow-2xl rounded-sm p-6 plate-enter z-10">
        
     {/* Cartographic Marks
        <div className="reg-mark reg-tl"></div>
        <div className="reg-mark reg-tr"></div>
        <div className="reg-mark reg-bl"></div>
        <div className="reg-mark reg-br"></div> */}

        <div className="flex justify-between items-start mb-6">
          <h3 className="font-display font-bold text-[16px] text-gisviz-ink flex items-center gap-2">
            <Flag className="text-gisviz-alert/80" size={20} /> Report Quality Issue
          </h3>
          <button onClick={onClose} className="text-gisviz-ink-soft hover:text-gisviz-accent transition-colors">
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gisviz-safe/10   text-gisviz-safe/60      dark:bg-gisviz-safe/90       /30 dark:text-gisviz-safe/5  0mb-4">
              <Check size={24} />
            </div>
            <h4 className="font-bold text-gisviz-ink mb-2">Report Logged Successfully</h4>
            <p className="text-[12px] font-mono text-gisviz-ink-soft mb-6">
              Our team will review this Post #{publicationId.slice(0,8)} shortly.
            </p>
            <button onClick={onClose} className="bg-gisviz-canvas border border-gisviz-border hover:bg-gisviz-rail-soft text-gisviz-ink px-6 py-2 rounded-md font-mono text-[12px] transition-colors">
              Close Window
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 p-3 rounded-md flex items-start gap-3">
              <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
              <p className="text-[12px] font-mono text-orange-800 dark:text-orange-300">
                Reports are monitored by enterprise administrators. False reporting may result in restricted access.
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">
                Violation Classification
              </label>
              <select 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2.5 text-[12px] text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-mono appearance-none"
              >
                <option value="" disabled>Select a reason...</option>
                <option value="inaccurate_data">Inaccurate/Fabricated Data</option>
                <option value="spam">Spam / Commercial Solicitation</option>
                <option value="inappropriate">Inappropriate Visual Content</option>
                <option value="copyright">Copyright/IP Infringement</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-mono text-gisviz-ink-soft mb-2 uppercase tracking-wider">
                Additional Context (Optional)
              </label>
              <textarea 
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide specific details about the issue..."
                className="w-full bg-gisviz-canvas border border-gisviz-border rounded-md px-3 py-2 text-[12px] text-gisviz-ink focus:ring-2 focus:ring-gisviz-accent outline-none font-sans min-h-[100px] resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 font-mono text-[12px] text-gisviz-ink-soft hover:text-gisviz-ink transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSubmitting || !reason}
                className="flex items-center justify-center gap-2 bg-gisviz-alert text-white px-5 py-2 rounded-md hover:bg-gisviz-alert transition-all font-mono text-[12px] shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}