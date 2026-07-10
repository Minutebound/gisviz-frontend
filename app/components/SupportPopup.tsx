'use client'

import React, { useState } from 'react'
import { X, LifeBuoy, Loader2, Send } from 'lucide-react'
import { gisvizApi } from '../../services/api'

type TicketCategory =
  | 'bug'
  | 'billing'
  | 'account'
  | 'feature'
  | 'other'

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'account', label: 'Account Issue' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'General Inquiry / Other' },
]

interface FormState {
  category: TicketCategory
  subject: string
  description: string
}

const DEFAULT_FORM: FormState = {
  category: 'other',
  subject: '',
  description: '',
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function SupportPopup({
  isOpen,
  onClose,
}: Props) {
  const [data, setData] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setSubmitting(true)

    try {
      await gisvizApi.submitSupportTicket({
        category: data.category,
        subject: data.subject,
        description: data.description,
      })

      setSuccess(true)

      setTimeout(() => {
        setSuccess(false)
        setData(DEFAULT_FORM)
        onClose()
      }, 2000)
    } catch {
      alert('Failed to send ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gisviz-black/10 backdrop-blur-sm p-4">

      <div
        className="
          w-full
          max-w-md
          bg-gisviz-card
          border
          border-gisviz-border
          rounded-xl
          shadow-2xl
          overflow-hidden
        "
      >

        {/* Header */}

        <div className="flex items-center justify-between border-b border-gisviz-border px-6 py-5">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gisviz-accent/10">
              <LifeBuoy
                size={18}
                className="text-gisviz-accent"
              />
            </div>

            <div className="flex flex-col">

              <h2 className="text-[16px] font-bold">
                Contact Support
              </h2>

              <span className="text-[11px] font-mono text-gisviz-ink-soft">
                Submit a support request
              </span>

            </div>

          </div>

          <button
            onClick={onClose}
            className="
              rounded-md
              p-2
              text-gisviz-ink-soft
              hover:bg-gisviz-border/40
              transition
            "
          >
            <X size={18} />
          </button>

        </div>

        {success ? (

          <div className="flex flex-col items-center justify-center py-16 px-6">

            <div className="text-lg font-bold text-gisviz-safe">
              ✓
            </div>

            <div className="mt-3 text-center font-mono text-gisviz-safe">
              Ticket submitted successfully!
            </div>

          </div>

        ) : (

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-5 p-6"
          >

            {/* Category */}

            <div className="flex flex-col gap-2">

              <label className="text-[11px] font-mono uppercase tracking-wide text-gisviz-ink-soft">
                Category
              </label>

              <select
                value={data.category}
                onChange={(e) =>
                  setData((p) => ({
                    ...p,
                    category: e.target.value as TicketCategory,
                  }))
                }
                className="
                  w-full
                  rounded-md
                  border
                  border-gisviz-border
                  bg-gisviz-canvas
                  p-3
                  text-[12px]
                  font-mono
                  outline-none
                  focus:border-gisviz-accent
                "
              >
                {CATEGORIES.map((c) => (
                  <option
                    key={c.value}
                    value={c.value}
                  >
                    {c.label}
                  </option>
                ))}
              </select>

            </div>

            {/* Subject */}

            <div className="flex flex-col gap-2">

              <label className="text-[11px] font-mono uppercase tracking-wide text-gisviz-ink-soft">
                Subject
              </label>

              <input
                required
                value={data.subject}
                placeholder="Brief summary"
                onChange={(e) =>
                  setData((p) => ({
                    ...p,
                    subject: e.target.value,
                  }))
                }
                className="
                  w-full
                  rounded-md
                  border
                  border-gisviz-border
                  bg-gisviz-canvas
                  p-3
                  text-[12px]
                  font-mono
                  outline-none
                  focus:border-gisviz-accent
                "
              />

            </div>

            {/* Description */}

            <div className="flex flex-col gap-2">

              <label className="text-[11px] font-mono uppercase tracking-wide text-gisviz-ink-soft">
                Description
              </label>

              <textarea
                required
                rows={6}
                value={data.description}
                placeholder="Describe your issue in detail..."
                onChange={(e) =>
                  setData((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                className="
                  w-full
                  resize-none
                  rounded-md
                  border
                  border-gisviz-border
                  bg-gisviz-canvas
                  p-3
                  text-[12px]
                  font-mono
                  outline-none
                  focus:border-gisviz-accent
                "
              />

            </div>

            {/* Submit */}

            <button
              type="submit"
              disabled={submitting}
              className="
                mt-2
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-md
                bg-gisviz-accent
                py-3
                font-mono
                text-[12px]
                font-bold
                text-white
                transition
                hover:opacity-90
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {submitting ? (
                <>
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={15} />
                  Send Ticket
                </>
              )}
            </button>

          </form>

        )}

      </div>

    </div>
  )
}