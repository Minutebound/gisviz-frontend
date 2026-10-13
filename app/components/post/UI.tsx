'use client'
/**
 * Small controls shared by the post editor's tabs (PostForm) and the visual designer (DataVisualPicker), so every
 * field looks and behaves the same: one label style, one input height, switches instead of bare checkboxes.
 */
import React from 'react'

export const inputCls =
  'h-9 w-full rounded-lg border border-gisviz-border bg-gisviz-canvas px-2.5 text-[13px] text-gisviz-ink outline-none transition-shadow ' +
  'placeholder:text-gisviz-ink-soft/60 focus:ring-2 focus:ring-gisviz-accent disabled:cursor-not-allowed disabled:opacity-50'
export const textareaCls = inputCls.replace('h-9 ', '') + ' resize-y py-2 leading-snug'

/** A labelled control. `hint` sits under the label in a quieter tone. */
export function Field({ label, hint, required, className = '', children }: {
  label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[11.5px] font-semibold text-gisviz-ink-soft">
        {label}{required && <span className="text-gisviz-alert"> *</span>}
        {hint && <span className="ml-1.5 font-normal opacity-80">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

/** A titled block of related controls inside a tab. */
export function Group({ title, hint, right, children }: {
  title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-[13.5px] font-bold text-gisviz-ink">{title}</h3>
          {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-gisviz-ink-soft">{hint}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  )
}

/** Two or more options, one chosen. */
export function Seg<T extends string>({ value, options, onChange, size = 'md', label }: {
  value: T; onChange: (v: T) => void; size?: 'sm' | 'md'; label?: string
  options: { value: T; label: string; icon?: React.ReactNode; disabled?: boolean; title?: string }[]
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[9px] border border-gisviz-border bg-gisviz-paper p-0.5">
      {options.map(o => (
        <button key={o.value} type="button" disabled={o.disabled} title={o.title} onClick={() => onChange(o.value)} aria-pressed={value === o.value}
                className={`inline-flex items-center gap-1 rounded-[7px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-2.5 text-[12px]'} ${
                  value === o.value ? 'bg-gisviz-card text-gisviz-ink shadow-sm' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}

/** An on / off switch with a label (and an optional line of help). */
export function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-0.5 py-1 text-left">
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-gisviz-ink">{label}</span>
        {hint && <span className="block text-[11.5px] leading-snug text-gisviz-ink-soft">{hint}</span>}
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-gisviz-accent' : 'bg-gisviz-border-strong/60'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

/** A small pill button (quick-add actions, palette presets). */
export function Pill({ onClick, children, active, title }: {
  onClick: () => void; children: React.ReactNode; active?: boolean; title?: string
}) {
  return (
    <button type="button" onClick={onClick} title={title}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-semibold transition-colors ${
              active ? 'border-gisviz-accent bg-gisviz-accent/10 text-gisviz-accent'
                : 'border-gisviz-border bg-gisviz-canvas text-gisviz-ink-soft hover:border-gisviz-accent hover:text-gisviz-accent'}`}>
      {children}
    </button>
  )
}