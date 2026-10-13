'use client'
/**
 * PostForm — the one page behind "New post" and "Edit post".
 *
 *   left   the preview: the poster exactly as readers will see it, with the live visual on it
 *   right  one side panel with four tabs, one thing at a time:
 *            Data     Standard | Live, dataset, chart type, columns
 *            Design   text, class colours, axes (log), measures (mean / median / mode / threshold), reader filter
 *            Details  title, description, region, categories, keywords, note, theme colour
 *            Publish  audience (Public | Private) and a checklist of what is still missing
 *          with Cancel / Publish pinned at its bottom (on phones: at the bottom of the screen)
 * The post's source and source link are the dataset's (nothing to type). The poster's headline is the post title.
 * The server re-checks everything (dataset access, visibility rules, taxonomy) and draws the post's image.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, BarChart3, Check, Database, Globe2, Loader2, Lock, Palette, Plus, Radio, Rocket, Send, TextCursorInput, UploadCloud, X } from 'lucide-react'
import { gisvizApi } from '../../../connector/api'
import RegionField from './RegionField'
import PosterEditor from './PosterEditor'
import DatasetVisualPicker from './DataVisualPicker'
import { Field, Group, Seg, inputCls, textareaCls } from './UI'
import type { VisualSpec } from '../InteractiveVisual'
import { type PosterChoice } from '../../../lib/poster'
import { toVisualParams, type DatasetCard, type VisualChoice } from '../../../types/visuals'
import type { PostType, Visibility } from '../../../types/access'
import { DEFAULT_ACCENT, categoryColor, useCategories } from '../../../lib/referenceData'

export interface PostFormInitial {
  title?: string
  description?: string
  note?: string
  keywords?: string[]
  categoryIds?: number[]
  region?: string
  backdrop?: PosterChoice
  themeColor?: string
  visualChoice?: VisualChoice | null
  visibility?: Visibility
  postType?: PostType
  canBePublic?: boolean          // edit: false when the dataset is private and only shared with the publisher
  image?: string | null
  /** the dataset's source, shown on the poster (edit: until the dataset card is loaded) */
  source?: { label: string; url?: string | null } | null
}

type Tab = 'data' | 'design' | 'details' | 'publish'
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'data', label: 'Data', icon: <Database size={14} /> },
  { id: 'design', label: 'Design', icon: <Palette size={14} /> },
  { id: 'details', label: 'Details', icon: <TextCursorInput size={14} /> },
  { id: 'publish', label: 'Publish', icon: <Rocket size={14} /> },
]

export default function PostForm({ mode, postId, initial, presetDataset }: {
  mode: 'create' | 'edit'
  postId?: string
  initial?: PostFormInitial
  presetDataset?: string
}) {
  const router = useRouter()
  const dbCategories = useCategories()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<Tab>(mode === 'edit' ? 'details' : 'data')

  const [postType, setPostType] = useState<PostType>(initial?.postType ?? 'standard')
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? 'public')
  const [canBePublic, setCanBePublic] = useState<boolean>(initial?.canBePublic ?? true)
  const [visualChoice, setVisualChoice] = useState<VisualChoice | null>(initial?.visualChoice ?? null)
  const [previewSpec, setPreviewSpec] = useState<VisualSpec | null>(null)
  const [specLoading, setSpecLoading] = useState(false)
  const [themeColor, setThemeColor] = useState(initial?.themeColor ?? DEFAULT_ACCENT)
  const [themeTouched, setThemeTouched] = useState(mode === 'edit')
  const [source, setSource] = useState(initial?.source ?? null)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const [categoryIds, setCategoryIds] = useState<number[]>(initial?.categoryIds ?? [])
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? [])
  const [keywordInput, setKeywordInput] = useState('')
  const [proposing, setProposing] = useState<string | null>(null)       // null = closed, '' = open
  const [proposeBusy, setProposeBusy] = useState(false)
  const [backdrop, setBackdrop] = useState<PosterChoice>(initial?.backdrop ?? 'auto')
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => { gisvizApi.listCategories().then(setCategories).catch(() => setCategories([])) }, [])

  // a dataset that was only shared with me: posts on it must stay private
  useEffect(() => { if (!canBePublic && visibility === 'public') setVisibility('private') }, [canBePublic, visibility])

  const themePresets = useMemo(() => {
    const seen = new Set<string>()
    return [{ label: 'Default', color: DEFAULT_ACCENT }, ...dbCategories.map(c => ({ label: c.label, color: c.theme_color }))]
      .filter(p => { const k = p.color.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
  }, [dbCategories])

  const onVisual = (choice: VisualChoice | null, card?: DatasetCard) => {
    setVisualChoice(choice)
    if (!choice) { setSource(null); return }
    if (!card) return
    setSource(card.source_name ? { label: card.source_name, url: card.source_url || null } : null)
    if (card.pipeline) setPostType(card.pipeline === 'stream' ? 'live' : 'standard')
    if (card.can_publish_publicly !== undefined) setCanBePublic(card.can_publish_publicly !== false)
    if (mode === 'create') {
      if (!themeTouched && card.category) {
        const c = categoryColor(dbCategories, card.category)
        if (c) setThemeColor(c)
      }
      setDescription(d => d || card.description || '')
      setRegion(r => r || card.region || '')
    }
  }

  const switchType = (t: PostType) => {
    if (t === postType) return
    setPostType(t)
    setVisualChoice(null)                        // the picker lists the other pipeline's datasets
    setPreviewSpec(null)
    setSource(null)
    setCanBePublic(true)
  }

  const addCategory = (id: number) => {
    if (!id || categoryIds.includes(id) || categoryIds.length >= 2) return
    if (categoryIds.length === 0 && !themeTouched) {
      const c = categoryColor(dbCategories, categories.find(x => x.category_id === id)?.slug)
      if (c) setThemeColor(c)
    }
    setCategoryIds(ids => [...ids, id])
  }
  const addKeywords = (raw: string) => {
    const next = [...keywords]
    for (const k of raw.split(',').map(s => s.trim()).filter(Boolean)) if (next.length < 3 && !next.includes(k)) next.push(k)
    setKeywords(next)
    setKeywordInput('')
  }
  const propose = async () => {
    const name = (proposing || '').trim()
    if (!name) return
    setProposeBusy(true)
    try { await gisvizApi.suggestCategory(name); setNotice(`"${name}" was proposed for review.`); setProposing(null) }
    catch { setError('Could not propose the category (it may already exist).') }
    finally { setProposeBusy(false) }
  }

  // what a post needs before it can be published, and the tab where each is fixed
  const checks: { id: string; ok: boolean; label: string; message: string; tab: Tab }[] = [
    { id: 'data', ok: !!visualChoice || mode === 'edit', label: 'Dataset and visual', message: 'Pick a dataset first.', tab: 'data' },
    { id: 'title', ok: !!title.trim(), label: 'Title', message: 'A title is required.', tab: 'details' },
    { id: 'cat', ok: categoryIds.length >= 1, label: 'At least one category', message: 'Pick at least one category.', tab: 'details' },
    { id: 'region', ok: !!region, label: 'Region', message: 'Pick the region this post is about.', tab: 'details' },
    { id: 'kw', ok: keywords.length >= 1, label: 'At least one keyword', message: 'Add at least one keyword.', tab: 'details' },
  ]
  const tabDone: Record<Tab, boolean | null> = {
    data: !!visualChoice, design: null, details: checks.filter(c => c.tab === 'details').every(c => c.ok), publish: null,
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const first = checks.find(c => !c.ok)
    if (first) { setError(first.message); setTab(first.tab); return }
    setBusy(true); setError('')
    const choice = visualChoice ? { ...visualChoice, title: title.trim() } : null       // the poster headline = the post title
    const body = {
      title: title.trim(), description: description.trim() || null, note: note.trim() || null,
      dataset_id: choice?.dataset_id, visual_params: choice ? toVisualParams(choice) : undefined,
      theme_color: themeColor, category_ids: categoryIds, region, keywords, backdrop,
      visibility, post_type: postType,
    }
    try {
      const res = mode === 'create' ? await gisvizApi.createPost(body) : await gisvizApi.updatePost(postId, body)
      router.push(`/post/${res.post_id || postId}`)
    } catch (err: any) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: any) => x.msg).join('; ') : 'Could not save the post. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const sources = useMemo(() => (source ? [source] : []), [source])
  const previewInputs = { title, description, category_ids: categoryIds, keywords, region, theme_color: themeColor, note }

  const next = (to: Tab, label: string) => (
    <button type="button" onClick={() => setTab(to)}
            className="mt-1 inline-flex h-8 items-center gap-1.5 self-start rounded-lg px-2 text-[12.5px] font-semibold text-gisviz-accent hover:bg-gisviz-accent/10">
      {label} <ArrowRight size={14} />
    </button>
  )
  const missing = checks.filter(c => !c.ok)

  return (
    <form onSubmit={submit} className="grid items-start gap-5 pb-24 lg:grid-cols-[minmax(0,1fr)_420px] lg:pb-0">
      {/* ── the one preview ── */}
      <div className="order-2 min-w-0 lg:order-1">
        <PosterEditor value={backdrop} onChange={setBackdrop} spec={previewSpec} sources={sources} inputs={previewInputs}
                      datasetId={visualChoice?.dataset_id} loading={specLoading} />
      </div>

      {/* ── the side panel: four tabs, one thing at a time ── */}
      <aside className="order-1 flex flex-col overflow-hidden rounded-2xl border border-gisviz-border bg-gisviz-card shadow-sm lg:sticky lg:top-4 lg:order-2 lg:max-h-[calc(100vh-2rem)]">
        <div role="tablist" aria-label="Post editor" className="grid shrink-0 grid-cols-4 border-b border-gisviz-border bg-gisviz-paper/50">
          {TABS.map((t, i) => {
            const on = tab === t.id, done = tabDone[t.id]
            return (
              <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.id)}
                      className={`relative flex flex-col items-center gap-0.5 px-1 py-2.5 text-[12px] font-semibold transition-colors ${
                        on ? 'bg-gisviz-card text-gisviz-ink' : 'text-gisviz-ink-soft hover:text-gisviz-ink'}`}>
                <span className="flex items-center gap-1.5">
                  {done ? <Check size={14} className="text-gisviz-safe" /> : t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </span>
                <span className="text-[10px] font-normal uppercase tracking-wider opacity-70 sm:hidden">{t.label}</span>
                {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gisviz-accent" />}
              </button>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {(error || notice) && (
            <div className="space-y-2 px-4 pt-4">
              {error && <p className="flex items-start justify-between gap-2 rounded-lg bg-gisviz-alert/10 px-3 py-2 text-[12.5px] text-gisviz-alert">
                <span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button></p>}
              {notice && <p className="flex items-start justify-between gap-2 rounded-lg bg-gisviz-safe/10 px-3 py-2 text-[12.5px] text-gisviz-safe">
                <span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></p>}
            </div>
          )}

          {/* Data and Design are two views of one designer: it stays mounted so the preview keeps updating */}
          <div className={`flex flex-col gap-5 p-4 ${tab === 'data' || tab === 'design' ? '' : 'hidden'}`} role="tabpanel">
            {tab === 'data' && (
              <Group title="Kind of post" right={
                <Seg<PostType> value={postType} onChange={switchType} label="Kind of post" options={[
                  { value: 'standard', label: 'Standard', icon: <BarChart3 size={12} />, title: 'A batch dataset, refreshed now and then' },
                  { value: 'live', label: 'Live', icon: <Radio size={12} />, title: 'A stream dataset: the visual refreshes itself' },
                ]} />
              }>
                <p className="text-[11.5px] leading-snug text-gisviz-ink-soft">
                  {postType === 'live' ? 'Live posts refresh themselves from a stream dataset.' : 'Standard posts chart a batch dataset.'}
                </p>
              </Group>
            )}
            <DatasetVisualPicker key={postType} value={visualChoice} onChange={onVisual} initialDatasetId={presetDataset}
                                 pipeline={postType === 'live' ? 'stream' : 'batch'} accent={themeColor}
                                 section={tab === 'design' ? 'design' : 'data'} onGoData={() => setTab('data')}
                                 onSpec={setPreviewSpec} onLoading={setSpecLoading} />
            {tab === 'data' && visualChoice && (
              <div className="grid grid-cols-2 gap-2.5 border-t border-gisviz-border pt-4" title="From the dataset: change it on the dataset, not here">
                {([['Source', source?.label], ['Source link', source?.url]] as const).map(([k, v]) => (
                  <Field key={k} label={k} hint="from the dataset">
                    <div className="flex h-9 items-center gap-1.5 truncate rounded-lg border border-dashed border-gisviz-border bg-gisviz-paper/60 px-2.5 text-[12.5px] text-gisviz-ink-soft">
                      <Lock size={11} className="shrink-0" />
                      {k === 'Source link' && v
                        ? <a href={v} target="_blank" rel="noopener noreferrer" className="truncate text-gisviz-accent hover:underline">{v.replace(/^https?:\/\//, '')}</a>
                        : <span className="truncate">{v || '—'}</span>}
                    </div>
                  </Field>
                ))}
              </div>
            )}
            {tab === 'data' && visualChoice && next('design', 'Next: Design')}
            {tab === 'design' && visualChoice && next('details', 'Next: Details')}
          </div>

          {tab === 'details' && (
            <div className="flex flex-col gap-5 p-4" role="tabpanel">
              <Group title="Headline" hint="The title is the poster's headline.">
                <Field label="Title" required>
                  <input value={title} onChange={e => setTitle(e.target.value)} maxLength={255}
                         placeholder="e.g. Electricity use vs GDP per capita" className={`${inputCls} font-display text-[14.5px] font-semibold`} />
                </Field>
                <Field label="Description">
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                            placeholder="What does the visual show? Method, findings, caveats…" className={textareaCls} />
                </Field>
              </Group>

              <div className="border-t border-gisviz-border pt-5">
                <Group title="Where and what" hint="How readers find this post.">
                  <div className="grid grid-cols-2 gap-2.5">
                    <RegionField value={region} onChange={setRegion} />
                    <Field label="Categories" required>
                      <select value="" onChange={e => e.target.value === 'propose' ? setProposing('') : addCategory(parseInt(e.target.value))}
                              disabled={categoryIds.length >= 2} className={inputCls}>
                        <option value="" disabled>{categoryIds.length >= 2 ? 'Two chosen' : 'Add…'}</option>
                        {categories.map(c => <option key={c.category_id} value={c.category_id} disabled={categoryIds.includes(c.category_id)}>{c.label}</option>)}
                        <option value="propose">+ Propose a new one…</option>
                      </select>
                    </Field>
                  </div>
                  {proposing !== null && (
                    <div className="flex gap-1.5">
                      <input autoFocus value={proposing} onChange={e => setProposing(e.target.value)} placeholder="New category (reviewed by the team)" className={inputCls}
                             onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); propose() } if (e.key === 'Escape') setProposing(null) }} />
                      <button type="button" onClick={propose} disabled={!proposing.trim() || proposeBusy} aria-label="Propose"
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gisviz-border text-gisviz-ink-soft hover:text-gisviz-accent disabled:opacity-50">
                        {proposeBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      </button>
                      <button type="button" onClick={() => setProposing(null)} aria-label="Cancel" className="grid h-9 w-7 shrink-0 place-items-center text-gisviz-ink-soft"><X size={14} /></button>
                    </div>
                  )}
                  {categoryIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {categoryIds.map(id => {
                        const c = categories.find(x => x.category_id === id)
                        return c ? (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-gisviz-accent px-2.5 py-0.5 text-[12px] font-semibold text-[color:var(--accent-on)]">
                            {c.label}<button type="button" onClick={() => setCategoryIds(ids => ids.filter(i => i !== id))} aria-label={`Remove ${c.label}`}><X size={11} /></button>
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                  <Field label="Keywords" hint="up to 3" required>
                    <div className="flex min-h-[36px] flex-wrap items-center gap-1.5 rounded-lg border border-gisviz-border bg-gisviz-canvas px-2 py-1 focus-within:ring-2 focus-within:ring-gisviz-accent">
                      {keywords.map(k => (
                        <span key={k} className="inline-flex items-center gap-1 rounded-md bg-gisviz-paper px-1.5 py-0.5 text-[12px] text-gisviz-ink">
                          #{k}<button type="button" onClick={() => setKeywords(ks => ks.filter(x => x !== k))} aria-label={`Remove ${k}`}><X size={10} /></button>
                        </span>
                      ))}
                      {keywords.length < 3 && (
                        <input value={keywordInput}
                               onChange={e => (e.target.value.includes(',') ? addKeywords(e.target.value) : setKeywordInput(e.target.value))}
                               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeywords(keywordInput) } }}
                               onBlur={() => keywordInput.trim() && addKeywords(keywordInput)}
                               placeholder={keywords.length ? '' : 'Type, then Enter'} aria-label="Keywords"
                               className="min-w-[90px] flex-1 bg-transparent py-0.5 text-[13px] text-gisviz-ink outline-none" />
                      )}
                    </div>
                  </Field>
                </Group>
              </div>

              <div className="border-t border-gisviz-border pt-5">
                <Group title="Poster" hint="Small touches on the image readers see.">
                  <Field label="Note on the poster">
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Data as of Q4 2025" className={inputCls} />
                  </Field>
                  <Field label="Theme colour" hint="used when classes have no colours of their own">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {themePresets.map(p => (
                        <button key={p.label} type="button" title={p.label} aria-label={`Theme colour ${p.label}`}
                                aria-pressed={themeColor.toLowerCase() === p.color.toLowerCase()}
                                onClick={() => { setThemeTouched(true); setThemeColor(p.color) }} style={{ background: p.color }}
                                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${themeColor.toLowerCase() === p.color.toLowerCase() ? 'border-gisviz-ink' : 'border-transparent'}`} />
                      ))}
                      <label className="relative grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-dashed border-gisviz-border text-gisviz-ink-soft" title="Any colour">
                        <Plus size={12} />
                        <input type="color" value={themeColor} onChange={e => { setThemeTouched(true); setThemeColor(e.target.value) }}
                               className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom theme colour" />
                      </label>
                    </div>
                  </Field>
                </Group>
              </div>
              {next('publish', 'Next: Publish')}
            </div>
          )}

          {tab === 'publish' && (
            <div className="flex flex-col gap-5 p-4" role="tabpanel">
              <Group title="Audience" right={
                <Seg<Visibility> value={visibility} onChange={setVisibility} label="Audience" options={[
                  { value: 'public', label: 'Public', icon: <Globe2 size={12} />, disabled: !canBePublic,
                    title: canBePublic ? 'Feed, search and your profile' : 'Not possible: the dataset was only shared with you' },
                  { value: 'private', label: 'Private', icon: <Lock size={12} />, title: 'Only you and who you share it with' },
                ]} />
              }>
                <p className="text-[12px] leading-snug text-gisviz-ink-soft">
                  {visibility === 'public' ? 'Everyone can see it in the feed, search and your profile.'
                    : 'Only you and who you share it with (Access on the post, after publishing).'}
                  {!canBePublic && ' The dataset was only shared with you, so the post stays private.'}
                </p>
              </Group>

              <div className="border-t border-gisviz-border pt-5">
                <Group title={missing.length ? `${missing.length} thing${missing.length > 1 ? 's' : ''} left` : 'Ready to publish'}
                       hint={missing.length ? 'Tap one to jump to it.' : mode === 'create' ? 'Everything the post needs is filled in.' : 'Your changes are saved when you press Save.'}>
                  <ul className="divide-y divide-gisviz-border overflow-hidden rounded-xl border border-gisviz-border">
                    {checks.map(c => (
                      <li key={c.id}>
                        <button type="button" onClick={() => setTab(c.tab)} disabled={c.ok}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] enabled:hover:bg-gisviz-paper">
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.ok ? 'bg-gisviz-safe/15 text-gisviz-safe' : 'border border-gisviz-border text-transparent'}`}>
                            <Check size={12} />
                          </span>
                          <span className={c.ok ? 'text-gisviz-ink-soft' : 'font-semibold text-gisviz-ink'}>{c.label}</span>
                          {!c.ok && <ArrowRight size={13} className="ml-auto text-gisviz-accent" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Group>
              </div>
            </div>
          )}
        </div>

        {/* actions: bottom of the panel (desktop) / bottom of the screen (phones) */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-gisviz-border bg-gisviz-card/95 px-4 py-3 backdrop-blur lg:static lg:bg-gisviz-card">
          <span className="hidden min-w-0 items-center gap-1.5 truncate text-[12px] text-gisviz-ink-soft sm:flex">
            {visibility === 'private' ? <Lock size={12} /> : <Globe2 size={12} />}
            {visibility === 'private' ? 'Private' : 'Public'} · {postType === 'live' ? 'Live' : 'Standard'}
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => router.back()} disabled={busy}
                    className="h-9 rounded-[9px] border border-gisviz-border px-3.5 text-[13px] font-semibold text-gisviz-ink-soft hover:bg-gisviz-paper">Cancel</button>
            <button type="submit" disabled={busy}
                    className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-gisviz-accent px-4 text-[13px] font-bold text-[color:var(--accent-on)] shadow-sm disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              {busy ? 'Saving…' : mode === 'create' ? 'Publish' : 'Save changes'}
            </button>
          </div>
        </div>
      </aside>
    </form>
  )
}