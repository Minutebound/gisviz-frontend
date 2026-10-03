// app/services/page.tsx
//
// Analytics services — hero, six service cards, gallery, use cases, engagement
// tiers, CTA. Server component: it is static marketing content, so there is no
// reason to ship it as client JS.
//
// Bracketed values ([$X], [240]) are deliberate placeholders — swap them for
// real figures before this goes public. Nothing here invents a client result.

import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Target, Shield, Route, Users, Gauge, Database,
  ArrowRight, Check, LayoutGrid,
} from 'lucide-react'
import TopNav from '../components/nav/TopNav'

export const metadata: Metadata = {
  title: 'Analytics services — GISVIZ',
  description:
    'Spatial analysis delivered as a live, queryable map: site selection, risk '
    + 'modelling, network optimisation, segmentation, dashboards and pipelines.',
}

const SERVICES = [
  {
    icon: Target, title: 'Site selection & market sizing',
    body: 'Catchment modelling, competitive overlap and drive-time isochrones scored '
        + 'against your own revenue data.',
    scope: 'Typical scope: 3–5 weeks',
  },
  {
    icon: Shield, title: 'Risk & climate exposure',
    body: 'Hazard reclassification, asset-level exposure and portfolio roll-ups that '
        + 'survive an underwriting review.',
    scope: 'Typical scope: 4–8 weeks',
  },
  {
    icon: Route, title: 'Network & route optimisation',
    body: 'Depot siting, lane consolidation and service-territory redraws, with the '
        + 'cost surface exposed as a layer.',
    scope: 'Typical scope: 4–6 weeks',
  },
  {
    icon: Users, title: 'Demographic segmentation',
    body: 'Small-area estimates joined to your customer file, with uncertainty carried '
        + 'through instead of hidden.',
    scope: 'Typical scope: 2–4 weeks',
  },
  {
    icon: Gauge, title: 'Live operational dashboards',
    body: 'Streaming vehicle, sensor or transaction data on a map that stays responsive '
        + 'at national scale.',
    scope: 'Typical scope: 6–10 weeks',
  },
  {
    icon: Database, title: 'Data engineering & pipelines',
    body: 'GDAL normalisation, Tippecanoe tiling and scheduled refresh — so the map '
        + 'never goes stale on you.',
    scope: 'Typical scope: ongoing',
  },
]

const GALLERY = [
  { sector: 'Energy', title: 'County-level reserve margin for a 12-state footprint',
    client: 'Gridline Research', outcome: '[12] counties flagged that the aggregate missed' },
  { sector: 'Retail', title: 'Catchment overlap across existing and candidate stores',
    client: 'National grocery chain', outcome: 'Shortlist cut from [240] sites to [11]' },
  { sector: 'Logistics', title: 'Lane-level freight reassignment after a corridor closure',
    client: 'Northbound Index', outcome: '[8] lanes rerouted, cost surface published as a layer' },
  { sector: 'Climate & Risk', title: 'Parcel-level flood exposure joined to assessed value',
    client: 'Regional lender', outcome: '[$X]M of collateral reclassified' },
  { sector: 'Public Health', title: 'Service-desert mapping for a statewide provider network',
    client: 'State health agency', outcome: '[38] tracts identified for mobile coverage' },
  { sector: 'Real Estate', title: 'Transit access scored against median rent',
    client: 'Civic Signals', outcome: 'Published as an open, citable dataset' },
]

const USE_CASES = [
  {
    sector: 'Retail & franchise',
    title: 'Choosing the next stores without guessing at the catchment',
    challenge: 'Siting ran on a spreadsheet of drive-time rings that ignored competitor '
             + 'overlap and treated every trade area as a circle.',
    approach: 'We joined transaction data to small-area demographics, modelled real '
            + 'isochrones off the road network, and scored every candidate parcel '
            + 'against cannibalisation risk.',
    outcome: 'A ranked, queryable shortlist the real-estate committee opens in the '
           + 'browser — and re-runs themselves when the assumptions change.',
  },
  {
    sector: 'Lending & insurance',
    title: 'Re-underwriting a portfolio after a hazard-map revision',
    challenge: 'A reclassification cycle moved thousands of parcels between hazard '
             + 'classes with no parcel-level view of what it meant for the book.',
    approach: 'Every affected parcel was matched to its loan, rolled up by branch and '
            + 'product, and exposed as a layer with the uncertainty preserved.',
    outcome: 'Exposure is now a map the credit committee reads directly, with the '
           + 'features downloadable for the model-risk team.',
  },
  {
    sector: 'Freight & logistics',
    title: 'Redrawing service territories around a corridor closure',
    challenge: 'Lane-level cost was modelled centrally and never reconciled with what '
             + 'dispatch actually did on the ground.',
    approach: 'We reconstructed origin–destination flows from manifests, built a cost '
            + 'surface over the live network, and published both as toggleable layers.',
    outcome: 'Planners and dispatch argue from the same map, and the cost surface '
           + 'refreshes on a schedule instead of on request.',
  },
]

const TIERS = [
  {
    name: 'Diagnostic sprint', price: '[$X],000', terms: 'Two weeks, fixed scope',
    features: [
      'One question, scoped and answered',
      'A published map and its dataset',
      'Recommendation on whether the fuller build is worth it',
    ],
    featured: false,
  },
  {
    name: 'Managed analysis', price: '[$X],000 / mo', terms: 'Rolling, three-month minimum',
    features: [
      'Everything in the sprint, continuously',
      'Scheduled data refresh and tile rebuilds',
      'Named analyst and a shared workspace',
      'Ask-this-map enabled on every published map',
    ],
    featured: true,
  },
  {
    name: 'Embedded team', price: 'Custom', terms: 'Quarterly commitment',
    features: [
      'Analysts and engineers inside your workflow',
      'Private tile hosting on your own domain',
      'SSO, audit trails and data residency',
      'Direct line to the platform roadmap',
    ],
    featured: false,
  },
]

const SHELL = 'mx-auto max-w-5xl px-4 sm:px-8 lg:px-[72px]'

export default function ServicesPage() {
  return (
    <>

      {/* ══ Hero ══════════════════════════════════════════════════════════ */}
      <section className="bg-gisviz-card border-b border-gisviz-border">
        <div className={`${SHELL} py-16 lg:py-[72px] flex flex-col lg:flex-row gap-12 lg:gap-16 items-center`}>
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            <span className="font-mono text-[12px] uppercase tracking-[0.13em] text-gisviz-ink-soft">
              Analytics services
            </span>
            <h1 className="font-display text-[40px] sm:text-[52px] lg:text-[60px] font-bold
                           leading-[1.02] tracking-[-0.04em] text-gisviz-ink max-w-[700px]">
              Spatial analysis your team can open, question and act on
            </h1>
            <p className="max-w-[560px] text-[17px] sm:text-[18px] leading-[1.6] text-gisviz-ink-soft">
              We scope the question, build the pipeline and hand back a live GISVIZ map —
              not a PDF. Your analysts query it in plain language; your engineers get the
              tiles and the code.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/contact"
                className="inline-flex items-center h-12 px-6 rounded-[10px] bg-gisviz-accent
                           text-[15px] font-semibold text-[color:var(--accent-on)]
                           hover:brightness-110 transition-[filter]">
                Book a scoping call
              </Link>
              <a href="#gallery"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-[10px]
                           border border-gisviz-border text-[15px] font-semibold
                           text-gisviz-ink hover:border-gisviz-accent transition-colors">
                <LayoutGrid size={16} />
                Browse the gallery
              </a>
            </div>
            <dl className="flex flex-wrap gap-10 pt-3">
              {[
                ['3,142', 'counties covered in the base library'],
                ['48 hrs', 'typical turnaround on a scoping map'],
                ['PMTiles', 'every deliverable, self-hosted or embedded'],
              ].map(([v, l]) => (
                <div key={v} className="flex flex-col gap-1.5">
                  <dt className="font-display text-[26px] font-bold tracking-[-0.02em] text-gisviz-ink">
                    {v}
                  </dt>
                  <dd className="max-w-[190px] text-[12.5px] leading-[1.45] text-gisviz-ink-soft">
                    {l}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="w-full lg:w-[520px] shrink-0 aspect-[13/10] rounded-[18px]
                          border border-gisviz-border bg-gisviz-paper
                          grid place-items-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.13em] text-gisviz-ink-soft">
              [ hero map embed ]
            </span>
          </div>
        </div>
      </section>

      {/* ══ Services ══════════════════════════════════════════════════════ */}
      <section className={`${SHELL} py-16 lg:py-[76px] flex flex-col gap-10`}>
        <SectionHead
          eyebrow="What we build"
          title="Six engagements, one delivery format"
          dek="Every engagement ends the same way: a published GISVIZ map, the dataset
               behind it, and the pipeline that keeps it current."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(({ icon: Icon, title, body, scope }) => (
            <article key={title}
              className="flex flex-col gap-4 p-6 rounded-2xl bg-gisviz-card
                         border border-gisviz-border hover:border-gisviz-accent/50
                         transition-colors">
              <span className="w-11 h-11 rounded-xl bg-gisviz-accent-soft
                               grid place-items-center text-gisviz-accent-text">
                <Icon size={21} />
              </span>
              <div className="flex-1 flex flex-col gap-2">
                <h3 className="font-display text-[19px] font-bold tracking-[-0.015em] text-gisviz-ink">
                  {title}
                </h3>
                <p className="text-[14px] leading-[1.6] text-gisviz-ink-soft">{body}</p>
              </div>
              <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-gisviz-border">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-gisviz-ink-soft">
                  {scope}
                </span>
                <ArrowRight size={16} className="text-gisviz-accent-text" />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ══ Gallery ═══════════════════════════════════════════════════════ */}
      <section id="gallery"
        className="bg-gisviz-paper border-y border-gisviz-border">
        <div className={`${SHELL} py-16 lg:py-[76px] flex flex-col gap-10`}>
          <SectionHead
            eyebrow="Gallery"
            title="Work we have shipped"
            dek="A sample of published engagements. Each one is a live map — open it,
                 toggle the layers, and ask the data a question."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GALLERY.map(g => (
              <Link key={g.title} href="/"
                className="group flex flex-col rounded-2xl bg-gisviz-card
                           border border-gisviz-border overflow-hidden
                           hover:border-gisviz-accent/50 transition-colors">
                <div className="relative h-[192px] bg-gisviz-paper grid place-items-center">
                  <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gisviz-ink-soft">
                    [ map preview ]
                  </span>
                  <span className="absolute left-3 top-3 inline-flex items-center h-6 px-2.5
                                   rounded-full bg-gisviz-card border border-gisviz-border
                                   text-[11.5px] font-semibold text-gisviz-ink">
                    {g.sector}
                  </span>
                </div>
                <div className="flex-1 p-[18px] flex flex-col gap-2.5">
                  <h3 className="font-display text-[17.5px] font-bold leading-[1.25]
                                 tracking-[-0.015em] text-gisviz-ink
                                 group-hover:text-gisviz-accent-text transition-colors">
                    {g.title}
                  </h3>
                  <span className="text-[12.5px] text-gisviz-ink-soft">{g.client}</span>
                  <div className="flex-1" />
                  <div className="flex items-start gap-2 pt-3 border-t border-gisviz-border">
                    <Check size={14} className="shrink-0 mt-0.5 text-gisviz-accent-text" />
                    <span className="text-[12.5px] leading-[1.45] text-gisviz-ink">
                      {g.outcome}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Use cases ═════════════════════════════════════════════════════ */}
      <section className={`${SHELL} py-16 lg:py-[76px] flex flex-col gap-9`}>
        <SectionHead
          eyebrow="Use cases"
          title="How the engagements actually run"
          dek="Three patterns cover most of what clients bring us. The shape is the same
               each time: scope the question, build the pipeline, hand back a live map."
        />
        <div className="flex flex-col gap-5">
          {USE_CASES.map((u, i) => (
            <article key={u.title}
              className={`flex flex-col ${i % 2 ? 'lg:flex-row-reverse' : 'lg:flex-row'}
                          gap-8 p-7 rounded-[18px] bg-gisviz-card border border-gisviz-border`}>
              <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-3">
                <div className="h-[200px] rounded-xl bg-gisviz-paper border border-gisviz-border
                                grid place-items-center">
                  <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gisviz-ink-soft">
                    [ map preview ]
                  </span>
                </div>
                <Link href="/"
                  className="inline-flex items-center justify-center gap-2 h-10 rounded-[10px]
                             border border-gisviz-border text-[14px] font-semibold
                             text-gisviz-ink hover:border-gisviz-accent transition-colors">
                  Read the write-up
                  <ArrowRight size={15} />
                </Link>
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-5">
                <div className="flex flex-col gap-2.5">
                  <span className="self-start inline-flex items-center h-[26px] px-2.5
                                   rounded-full bg-gisviz-accent-soft text-gisviz-accent-text
                                   text-[12px] font-medium">
                    {u.sector}
                  </span>
                  <h3 className="font-display text-[24px] sm:text-[27px] font-bold leading-[1.16]
                                 tracking-[-0.025em] text-gisviz-ink max-w-[620px]">
                    {u.title}
                  </h3>
                </div>
                <div className="grid gap-6 sm:grid-cols-3">
                  {([['Challenge', u.challenge], ['Approach', u.approach], ['Outcome', u.outcome]] as const)
                    .map(([label, text]) => (
                      <div key={label} className="flex flex-col gap-2">
                        <span className={`font-mono text-[10px] uppercase tracking-[0.13em] ${
                          label === 'Outcome' ? 'text-gisviz-accent-text' : 'text-gisviz-ink-soft'
                        }`}>
                          {label}
                        </span>
                        <p className={`text-[14px] leading-[1.62] ${
                          label === 'Outcome' ? 'text-gisviz-ink' : 'text-gisviz-ink-soft'
                        }`}>
                          {text}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ══ Engagement tiers ══════════════════════════════════════════════ */}
      <section className="bg-gisviz-paper border-t border-gisviz-border">
        <div className={`${SHELL} py-16 lg:py-[76px] flex flex-col gap-10`}>
          <SectionHead
            eyebrow="Engagement"
            title="Three ways to start"
            dek="Replace the bracketed figures with your own rates — the structure is
                 what most clients respond to."
          />
          <div className="grid gap-5 lg:grid-cols-3 items-stretch">
            {TIERS.map(t => (
              <article key={t.name}
                className={`flex flex-col gap-[18px] p-[26px] rounded-2xl border ${
                  t.featured
                    ? 'bg-gisviz-accent-soft border-gisviz-accent'
                    : 'bg-gisviz-card border-gisviz-border'
                }`}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-display text-[20px] font-bold tracking-[-0.02em] text-gisviz-ink">
                    {t.name}
                  </h3>
                  {t.featured && (
                    <span className="inline-flex items-center h-6 px-2.5 rounded-full
                                     bg-gisviz-accent text-[11.5px] font-semibold
                                     text-[color:var(--accent-on)]">
                      Most chosen
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[34px] font-bold tracking-[-0.03em] text-gisviz-ink">
                    {t.price}
                  </span>
                  <span className="text-[12.5px] text-gisviz-ink-soft">{t.terms}</span>
                </div>
                <ul className="flex-1 flex flex-col gap-2.5">
                  {t.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px]
                                           leading-[1.5] text-gisviz-ink">
                      <Check size={15} className="shrink-0 mt-0.5 text-gisviz-accent-text" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/contact"
                  className={`inline-flex items-center justify-center h-11 rounded-[10px]
                              text-[14.5px] font-semibold transition-colors ${
                    t.featured
                      ? 'bg-gisviz-accent text-[color:var(--accent-on)] hover:brightness-110'
                      : 'border border-gisviz-border text-gisviz-ink hover:border-gisviz-accent'
                  }`}>
                  {t.featured ? 'Start here' : 'Talk to us'}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ═══════════════════════════════════════════════════════════ */}
      <section className="bg-gisviz-card border-t border-gisviz-border">
        <div className={`${SHELL} py-16 flex flex-col lg:flex-row gap-10 lg:gap-14 items-start lg:items-center`}>
          <div className="flex-1 flex flex-col gap-3.5">
            <h2 className="font-display text-[30px] sm:text-[38px] font-bold leading-[1.08]
                           tracking-[-0.03em] text-gisviz-ink max-w-[620px]">
              Bring us the question. We will tell you whether the data can answer it.
            </h2>
            <p className="max-w-[540px] text-[15.5px] leading-[1.6] text-gisviz-ink-soft">
              A scoping call is 30 minutes and ends with a written answer either way —
              including when the honest answer is that the data does not support it.
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0 w-full sm:w-auto">
            <Link href="/contact"
              className="inline-flex items-center justify-center h-[50px] px-7 rounded-[10px]
                         bg-gisviz-accent text-[15px] font-semibold
                         text-[color:var(--accent-on)] hover:brightness-110 transition-[filter]">
              Book a scoping call
            </Link>
            <Link href="/contact"
              className="inline-flex items-center justify-center h-[50px] px-7 rounded-[10px]
                         border border-gisviz-border text-[15px] font-semibold
                         text-gisviz-ink hover:border-gisviz-accent transition-colors">
              Email the team
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function SectionHead({
  eyebrow, title, dek,
}: { eyebrow: string; title: string; dek: string }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-12">
      <div className="flex flex-col gap-3 max-w-[700px]">
        <span className="font-mono text-[11px] uppercase tracking-[0.13em] text-gisviz-ink-soft">
          {eyebrow}
        </span>
        <h2 className="font-display text-[32px] sm:text-[42px] font-bold leading-[1.06]
                       tracking-[-0.032em] text-gisviz-ink">
          {title}
        </h2>
      </div>
      <p className="max-w-[400px] text-[15.5px] leading-[1.6] text-gisviz-ink-soft">
        {dek}
      </p>
    </div>
  )
}
