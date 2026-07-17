'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, MessageSquare, Shield } from 'lucide-react'
import { SupportPopup } from '../components/SupportPopup'

export default function ContactPage() {
  const [isPopupOpen, setIsPopupOpen] = useState(false)

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <p className="text-[12px]  font-mono text-gisviz-ink-soft uppercase tracking-widest mb-3">
        Get in touch
      </p>
      <h1 className="text-[28px] font-bold text-gisviz-ink mb-2 font-display">
        Contact
      </h1>
      <p className="text-[16px]  text-gisviz-ink-soft font-sans mb-12 leading-relaxed">
        Choose the right channel below. Most issues are resolved fastest through the support ticket system.
      </p>

      {/* Contact cards */}
      <div className="space-y-4">

        {/* Support ticket — primary CTA */}
        <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-sm bg-gisviz-accent/10 shrink-0">
            <MessageSquare size={18} className="text-gisviz-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px]  font-bold text-gisviz-ink mb-1">Support ticket</p>
            <p className="text-[12px]  font-mono text-gisviz-ink-soft leading-relaxed">
              Bugs, account issues, feature requests. Tracked, prioritised, and assigned directly to our team.
              <span className="text-gisviz-accent"> Fastest response.</span>
            </p>
          </div>
          <button
            onClick={() => setIsPopupOpen(true)}
            className="shrink-0 flex items-center gap-2 bg-gisviz-accent text-gisviz-white px-5 py-2.5 rounded-md font-mono text-[12px]  font-bold hover:bg-opacity-90 transition-all shadow-sm"
          >
            <MessageSquare size={14} />
            Open ticket
          </button>
        </div>

        {/* General email */}
        <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-sm bg-gisviz-canvas shrink-0">
            <Mail size={18} className="text-gisviz-ink-soft" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px]  font-bold text-gisviz-ink mb-1">General enquiries</p>
            <p className="text-[12px]  font-mono text-gisviz-ink-soft leading-relaxed">
              Partnerships, press, API access at scale, or anything that doesn&apos;t fit a ticket.
              We aim to respond within 2 business days.
            </p>
          </div>
          <a
            href="mailto:hello@gisviz.com"
            className="shrink-0 flex items-center gap-2 border border-gisviz-border text-gisviz-ink px-5 py-2.5 rounded-md font-mono text-[12px]  hover:border-gisviz-accent hover:text-gisviz-accent transition-colors"
          >
            <Mail size={14} />
            info@gisviz.com
          </a>
        </div>

        {/* Security */}
        <div className="bg-gisviz-card border border-gisviz-border rounded-sm p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-sm bg-gisviz-canvas shrink-0">
            <Shield size={18} className="text-gisviz-ink-soft" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px]  font-bold text-gisviz-ink mb-1">Security vulnerabilities</p>
            <p className="text-[12px]  font-mono text-gisviz-ink-soft leading-relaxed">
              Please report security issues privately. We follow responsible disclosure
              and ask for reasonable time to fix before public disclosure.
            </p>
          </div>
          <a
            href="mailto:security@gisviz.com"
            className="shrink-0 flex items-center gap-2 border border-gisviz-border text-gisviz-ink px-5 py-2.5 rounded-md font-mono text-[12px]  hover:border-gisviz-accent hover:text-gisviz-accent transition-colors"
          >
            <Shield size={14} />
            info@gisviz.com
          </a>
        </div>

      </div>

      {/* Note
      <p className="mt-10 text-[12px] font-mono text-gisviz-ink-soft leading-relaxed">
        Gisviz is operated remotely. All contact is handled digitally.
      </p> */}

      {/* SupportPopup — same component, same DB, same endpoint */}
      <SupportPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
      />

    </div>
  )
}