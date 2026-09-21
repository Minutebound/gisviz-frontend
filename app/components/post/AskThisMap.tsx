'use client'

// app/components/post/AskThisMap.tsx
//
// The grounded chat panel under a post's analysis.
//
// Design contract, in order of importance:
//   1. Scope is never ambiguous. The grounding chip states exactly what the
//      model can see — layers, features, attributes — and it is always visible.
//   2. Answers return structure, not just prose: an optional result table, the
//      features highlighted back on the map above (via onHighlight), and dashed
//      citation chips naming the fields actually read.
//   3. Every answer is actionable — add as a layer, export CSV, copy the query.
//
// Desktop renders inline at the end of the article. Mobile renders as a bottom
// sheet (`variant="sheet"`), with the composer docked.

import React, { useEffect, useRef, useState } from 'react'
import {
  Sparkles, Send, Layers, Download, Code2, X, ThumbsUp, ThumbsDown,
  Crosshair, Loader2, AlertTriangle,
} from 'lucide-react'
import { gisvizApi } from '../../../services/api'
import { AskMessage, AskGrounding, AskCitation, AskResult } from '../../../types/gisviz'
import { layerColor } from '../../../lib/designTokens'

const SUGGESTIONS = [
  'Compare the top two regions',
  'What changed since 2021?',
  'Show only areas above the median',
  'Explain the methodology',
]

interface AskThisMapProps {
  postId: string
  grounding: AskGrounding
  /** Called with feature ids an answer wants highlighted on the map above. */
  onHighlight?: (featureIds: string[]) => void
  /** Called when the reader promotes an answer into a new map layer. */
  onAddLayer?: (message: AskMessage) => void
  variant?: 'inline' | 'sheet'
  onClose?: () => void
}

export default function AskThisMap({
  postId, grounding, onHighlight, onAddLayer, variant = 'inline', onClose,
}: AskThisMapProps) {
  const [messages, setMessages] = useState<AskMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return

    const userMsg: AskMessage = { id: `u-${Date.now()}`, role: 'user', content: q }
    const placeholder: AskMessage = {
      id: `a-${Date.now()}`, role: 'assistant', content: '', pending: true,
    }
    setMessages(m => [...m, userMsg, placeholder])
    setDraft('')
    setBusy(true)

    try {
      const res = await gisvizApi.askPost(postId, q)
      const answer: AskMessage = {
        id: placeholder.id,
        role: 'assistant',
        content: res.content ?? '',
        result: res.result ?? undefined,
        citations: res.citations ?? [],
      }
      setMessages(m => m.map(x => (x.id === placeholder.id ? answer : x)))
      if (res.result?.highlightFeatureIds?.length) {
        onHighlight?.(res.result.highlightFeatureIds)
      }
    } catch (e: any) {
      setMessages(m => m.map(x => x.id === placeholder.id
        ? {
            ...x,
            pending: false,
            error: e?.response?.status === 429
              ? 'Rate limit reached — try again in a moment.'
              : 'That question could not be answered against this dataset.',
          }
        : x))
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(draft) }
  }

  const isSheet = variant === 'sheet'

  return (
    <section
      id="ask"
      aria-label="Ask this map"
      className={
        isSheet
          ? `rounded-t-[20px] bg-gisviz-card border-t border-gisviz-border
             px-4 pt-2.5 pb-3.5 flex flex-col gap-3 shadow-[0_-8px_28px_rgba(0,0,0,0.10)]`
          : `rounded-2xl bg-gisviz-card border border-gisviz-border p-5
             flex flex-col gap-4`
      }
    >
      {isSheet && (
        <span className="self-center w-9 h-1 rounded-full bg-gisviz-border" aria-hidden />
      )}

      {/* ── header ── */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 w-8 h-8 rounded-[9px] bg-gisviz-accent
                         grid place-items-center text-[color:var(--accent-on)]">
          <Sparkles size={17} />
        </span>
        <div className="min-w-0 flex flex-col gap-px">
          <h2 className="font-display text-[16.5px] font-bold tracking-[-0.01em] text-gisviz-ink">
            Ask this map
          </h2>
          <p className="text-[12px] text-gisviz-ink-soft">
            Answered against this post&rsquo;s data only
          </p>
        </div>
        <div className="flex-1" />
        <GroundingChip grounding={grounding} />
        {(onClose || messages.length > 0) && (
          <button
            type="button"
            onClick={onClose ?? (() => setMessages([]))}
            aria-label={onClose ? 'Close the chat' : 'Clear conversation'}
            className="shrink-0 w-[30px] h-[30px] grid place-items-center rounded-lg
                       border border-gisviz-border text-gisviz-ink-soft
                       hover:text-gisviz-ink transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="h-px bg-gisviz-border" />

      {/* ── transcript ── */}
      {messages.length > 0 && (
        <div
          ref={listRef}
          className={`flex flex-col gap-4 overflow-y-auto ${isSheet ? 'max-h-[42vh]' : 'max-h-[560px]'}`}
        >
          {messages.map(m =>
            m.role === 'user'
              ? <UserBubble key={m.id} message={m} />
              : <AssistantBlock
                  key={m.id} message={m}
                  onAddLayer={onAddLayer}
                  onHighlight={onHighlight}
                />,
          )}
        </div>
      )}

      {/* ── suggestions ── */}
      {messages.length === 0 && (
        <div className="flex items-center gap-2 overflow-x-auto
                        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.13em]
                           text-gisviz-ink-soft">Try</span>
          {SUGGESTIONS.map(s => (
            <button
              key={s} type="button" onClick={() => ask(s)}
              className="shrink-0 h-8 px-3 rounded-full border border-gisviz-border
                         bg-gisviz-card text-[12.5px] font-medium text-gisviz-ink
                         hover:border-gisviz-accent transition-colors whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── composer ── */}
      <div className="h-[54px] pl-3.5 pr-2 flex items-center gap-2.5 rounded-[13px]
                      bg-gisviz-card border-[1.5px] border-gisviz-accent
                      focus-within:ring-4 focus-within:ring-gisviz-accent/15">
        <label htmlFor="ask-input" className="sr-only">
          Ask a question about this dataset
        </label>
        <input
          id="ask-input"
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          placeholder="Ask about this data — filter it, compare regions, or export a slice"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none
                     text-[14px] text-gisviz-ink placeholder:text-gisviz-ink-soft
                     disabled:opacity-60"
        />
        <kbd className="hidden sm:block shrink-0 rounded border border-gisviz-border
                        px-1.5 py-[3px] font-mono text-[10.5px] text-gisviz-ink-soft">
          ⌘ ↵
        </kbd>
        <button
          type="button"
          onClick={() => ask(draft)}
          disabled={busy || !draft.trim()}
          aria-label="Send question"
          className="shrink-0 w-[38px] h-[38px] grid place-items-center rounded-[10px]
                     bg-gisviz-accent text-[color:var(--accent-on)]
                     disabled:opacity-40 transition-opacity"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>

      <p className="text-[11.5px] leading-[1.5] text-gisviz-ink-soft">
        Answers are computed from this post&rsquo;s published layers and cite the fields they
        used. They are not a substitute for the author&rsquo;s methodology — check the notes
        before you cite a figure.
      </p>
    </section>
  )
}

// ── pieces ───────────────────────────────────────────────────────────────────

function GroundingChip({ grounding }: { grounding: AskGrounding }) {
  const { layerCount, featureCount, attributeCount } = grounding
  return (
    <span
      className="hidden md:inline-flex items-center gap-2 h-[26px] px-2.5 rounded-full
                 bg-gisviz-paper border border-gisviz-border
                 font-mono text-[10.5px] text-gisviz-ink-soft"
      title="What this chat can see"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-gisviz-safe" aria-hidden />
      Grounded · {layerCount} layers · {featureCount.toLocaleString()} features ·{' '}
      {attributeCount} attributes
    </span>
  )
}

function UserBubble({ message }: { message: AskMessage }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[460px] px-4 py-2.5 rounded-[14px_14px_4px_14px]
                    bg-gisviz-accent-soft border border-gisviz-border
                    text-[14px] leading-[1.5] text-gisviz-ink">
        {message.content}
      </p>
    </div>
  )
}

function AssistantBlock({
  message, onAddLayer, onHighlight,
}: {
  message: AskMessage
  onAddLayer?: (m: AskMessage) => void
  onHighlight?: (ids: string[]) => void
}) {
  return (
    <div className="flex gap-3 items-start">
      <span className="shrink-0 w-7 h-7 rounded-lg bg-gisviz-accent-soft
                       grid place-items-center text-gisviz-accent-text">
        <Sparkles size={14} />
      </span>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {message.pending && (
          <span className="inline-flex items-center gap-2 text-[14px] text-gisviz-ink-soft">
            <Loader2 size={14} className="animate-spin" />
            Reading {`{layers}`} …
          </span>
        )}

        {message.error && (
          <span className="inline-flex items-start gap-2 rounded-[10px] border
                           border-gisviz-alert/40 bg-gisviz-alert/5 px-3 py-2
                           text-[13px] text-gisviz-ink">
            <AlertTriangle size={15} className="shrink-0 mt-px text-gisviz-alert" />
            {message.error}
          </span>
        )}

        {!message.pending && !message.error && message.content && (
          <p className="text-[14px] leading-[1.6] text-gisviz-ink whitespace-pre-line">
            {message.content}
          </p>
        )}

        {message.result && (
          <ResultTable result={message.result} onHighlight={onHighlight} />
        )}

        {!!message.citations?.length && (
          <div className="flex items-center gap-2 flex-wrap">
            {message.citations.map((c, i) => <CitationChip key={i} cite={c} index={i} />)}
          </div>
        )}

        {!message.pending && !message.error && (
          <div className="flex items-center gap-2">
            <AnswerAction icon={<Layers size={13} />} label="Add as map layer"
                          onClick={() => onAddLayer?.(message)} />
            <AnswerAction icon={<Download size={13} />} label="Export CSV" />
            <AnswerAction icon={<Code2 size={13} />} label="Copy query" />
            <div className="flex-1" />
            <FeedbackButton label="Helpful"><ThumbsUp size={13} /></FeedbackButton>
            <FeedbackButton label="Not helpful"><ThumbsDown size={13} /></FeedbackButton>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultTable({
  result, onHighlight,
}: { result: AskResult; onHighlight?: (ids: string[]) => void }) {
  return (
    <div className="rounded-[11px] border border-gisviz-border bg-gisviz-paper px-4 py-3">
      <div className="flex items-center gap-3 h-6">
        <span className="flex-1 min-w-0 font-mono text-[9.5px] uppercase tracking-[0.1em]
                         text-gisviz-ink-soft">
          {result.columns[0]}
        </span>
        {result.columns.slice(1).map(c => (
          <span key={c} className="w-14 shrink-0 font-mono text-[9.5px] uppercase
                                   tracking-[0.1em] text-gisviz-ink-soft">
            {c}
          </span>
        ))}
      </div>

      {result.rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 h-[30px] border-t border-gisviz-border">
          <span className="flex-1 min-w-0 truncate text-[12.5px] font-medium text-gisviz-ink">
            {r.label}
          </span>
          {r.values.map((v, j) => (
            <span key={j} className="w-14 shrink-0 font-mono text-[12px] text-gisviz-ink-soft">
              {v}
            </span>
          ))}
          {typeof r.weight === 'number' && (
            <span className="hidden sm:flex w-24 h-[7px] rounded overflow-hidden
                             bg-gisviz-rail-soft/60" aria-hidden>
              <span
                className="h-full"
                style={{
                  width: `${Math.round(r.weight * 100)}%`,
                  background: layerColor(0),
                }}
              />
            </span>
          )}
        </div>
      ))}

      {result.footnote && (
        <button
          type="button"
          onClick={() => onHighlight?.(result.highlightFeatureIds ?? [])}
          className="mt-3 inline-flex items-center gap-2 text-[12px]
                     text-gisviz-ink-soft hover:text-gisviz-accent-text transition-colors"
        >
          <Crosshair size={14} className="text-gisviz-accent-text" />
          {result.footnote}
        </button>
      )}
    </div>
  )
}

function CitationChip({ cite, index }: { cite: AskCitation; index: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md
                     border border-dashed border-gisviz-border
                     font-mono text-[10px] text-gisviz-ink-soft">
      <span
        className="w-[7px] h-[7px] rounded-[2px]"
        style={{ background: cite.color ?? layerColor(index) }}
        aria-hidden
      />
      {cite.kind}: {cite.name}
    </span>
  )
}

function AnswerAction({
  icon, label, onClick,
}: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-lg
                 border border-gisviz-border bg-gisviz-card text-[12.5px]
                 font-semibold text-gisviz-ink hover:border-gisviz-accent transition-colors"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function FeedbackButton({
  children, label,
}: { children: React.ReactNode; label: string }) {
  return (
    <button
      type="button" aria-label={label}
      className="w-7 h-7 grid place-items-center rounded-md border border-gisviz-border
                 text-gisviz-ink-soft hover:text-gisviz-ink transition-colors"
    >
      {children}
    </button>
  )
}
