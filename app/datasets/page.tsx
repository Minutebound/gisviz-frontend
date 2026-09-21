'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  Search, 
  Lock,
  ChevronDown,
  Terminal,
  ArrowUpRight
} from 'lucide-react'
import { Dataset, FileFormat, ExternalConnectorType } from '../../types/dataset'

const DATASETS_MOCK: Dataset[] = [
  {
    id: 'ds-1',
    title: 'Global Urban Heat Islands (2024)',
    description: 'High-resolution surface temperature anomalies across 1,200 metropolitan regions worldwide with calibrated multi-sensor raster composites.',
    category: 'Climate',
    source_category: 'file',
    format: 'geojson',
    file_size_bytes: 42800000,
    feature_count: 12400,
    geometry_type: 'MultiPolygon',
    crs: 'EPSG:4326',
    resource_url: 'https://example.com/datasets/heat-islands',
    updated_at: '2026-08-15',
    publisher: { name: 'Earth Analytics Lab', handle: 'earthlab' },
    license: 'CC-BY 4.0',
    update_frequency: 'Annual',
    bbox: [-180, -60, 180, 75],
    schema: [
      { name: 'id', type: 'uuid', description: 'Unique regional identifier' },
      { name: 'city_name', type: 'varchar(120)', description: 'Metropolitan area name' },
      { name: 'temp_anomaly_c', type: 'float4', description: 'Average heat anomaly in Celsius' },
      { name: 'population_impacted', type: 'int8', description: 'Estimated population in zone' },
      { name: 'geom', type: 'geometry(MultiPolygon, 4326)', description: 'Spatial boundary' }
    ]
  },
  {
    id: 'ds-2',
    title: 'North America EV Fast Chargers',
    description: 'Quarterly updated geospatial catalog of Level 3 DC fast charging stations with connector classifications and power ratings.',
    category: 'Infrastructure',
    source_category: 'file',
    format: 'csv',
    file_size_bytes: 1840000,
    feature_count: 53200,
    geometry_type: 'Point',
    crs: 'EPSG:4326',
    resource_url: 'https://example.com/datasets/ev-chargers',
    updated_at: '2026-09-02',
    publisher: { name: 'Energy Grid Network', handle: 'egrid' },
    license: 'Open Data Commons (ODbL)',
    update_frequency: 'Quarterly',
    bbox: [-125.0, 24.5, -66.9, 49.3],
    schema: [
      { name: 'station_id', type: 'varchar(50)', description: 'NREL assigned identifier' },
      { name: 'latitude', type: 'float8', description: 'WGS84 Latitude' },
      { name: 'longitude', type: 'float8', description: 'WGS84 Longitude' },
      { name: 'connector_type', type: 'varchar(50)', description: 'e.g., CCS, CHAdeMO, Tesla' },
      { name: 'max_kw', type: 'int4', description: 'Maximum output in kilowatts' }
    ]
  },
  {
    id: 'ds-4',
    title: 'Global Port Logistics & Cargo Flow',
    description: 'Continuous AIS vessel telemetry stream and dwell-time boundary metrics synchronized from enterprise supply chain warehouses.',
    category: 'Transport',
    source_category: 'external',
    format: 'snowflake',
    crs: 'EPSG:4326',
    external_status: 'coming_soon',
    updated_at: '2026-09-10',
    publisher: { name: 'Maritime Data Co', handle: 'maritime' },
    license: 'Commercial / Proprietary',
    update_frequency: 'Live Stream',
    bbox: [-180, -90, 180, 90],
    schema: [
      { name: 'mmsi', type: 'number(9,0)', description: 'Maritime Mobile Service Identity' },
      { name: 'timestamp', type: 'timestamp_ltz', description: 'Ping received time' },
      { name: 'sog_knots', type: 'float', description: 'Speed over ground' },
      { name: 'nav_status', type: 'varchar', description: 'Moored, Underway, etc.' },
      { name: 'location', type: 'geography', description: 'Vessel coordinate' }
    ]
  }
]

function FormatBadge({ format, isExternal }: { format: FileFormat | ExternalConnectorType; isExternal: boolean }) {
  const formatLabels: Record<string, { label: string; bg: string; text: string }> = {
    geojson: { label: 'GeoJSON', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300' },
    csv: { label: 'CSV / Lat-Lon', bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300' },
    gpkg: { label: 'GeoPackage', bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300' },
    shapefile: { label: 'Shapefile ZIP', bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
    snowflake: { label: 'Snowflake Live', bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-700 dark:text-sky-300' },
    wms: { label: 'OGC WMS', bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300' },
  }

  const match = formatLabels[format] || { label: format.toUpperCase(), bg: 'bg-gisviz-rail-soft', text: 'text-gisviz-ink' }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono text-[11px] font-semibold ${match.bg} ${match.text}`}>
      {isExternal && <Lock size={10} />}
      {match.label}
    </span>
  )
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '--'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DatasetCard({ dataset }: { dataset: Dataset }) {
  const [expanded, setExpanded] = useState(false)
  const isExternal = dataset.source_category === 'external'

  return (
    <article className="w-full rounded-xl border border-gisviz-border bg-gisviz-card hover:border-gisviz-border-strong hover:shadow-sm transition-all flex flex-col overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <FormatBadge format={dataset.format} isExternal={isExternal} />
            <span className="text-[12px] font-mono text-gisviz-ink-soft">{dataset.crs}</span>
            <span className="text-[12px] text-gisviz-border-strong">·</span>
            <span className="text-[12px] font-medium text-gisviz-ink-soft">{dataset.category}</span>
          </div>

          <h2 className="font-display text-[18px] font-bold text-gisviz-ink tracking-tight mb-1.5">
            {dataset.title}
          </h2>
          <p className="text-[14px] text-gisviz-ink-soft leading-relaxed max-w-4xl line-clamp-2 lg:line-clamp-1">
            {dataset.description}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[12.5px] text-gisviz-ink-soft">
            <div>
              <span className="text-gisviz-ink-soft/80">Brought to you by: </span>
              <Link href={`/profile/${dataset.publisher.handle}`} className="font-semibold text-gisviz-ink hover:text-gisviz-accent transition-colors">
                @{dataset.publisher.handle}
              </Link>
            </div>
            <span className="hidden sm:inline text-gisviz-border-strong">·</span>
            <span>Updated {dataset.updated_at}</span>
            <span className="hidden sm:inline text-gisviz-border-strong">·</span>
            <button 
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 font-medium text-gisviz-ink hover:text-gisviz-accent transition-colors"
            >
              <Terminal size={14} />
              {expanded ? 'Hide Schema' : 'View Schema'}
              <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-6 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-gisviz-border/60">
          <div className="grid grid-cols-2 lg:flex items-center gap-6 text-left lg:text-right font-mono text-[12.5px]">
            <div>
              <span className="block text-[10.5px] uppercase tracking-wider text-gisviz-ink-soft/70">Features</span>
              <span className="font-semibold text-gisviz-ink">
                {dataset.feature_count ? dataset.feature_count.toLocaleString() : 'Streamed'}
              </span>
            </div>
            <div>
              <span className="block text-[10.5px] uppercase tracking-wider text-gisviz-ink-soft/70">Size</span>
              <span className="font-semibold text-gisviz-ink">
                {isExternal ? 'Live Query' : formatBytes(dataset.file_size_bytes)}
              </span>
            </div>
          </div>

          <div className="shrink-0 min-w-[140px] flex justify-end">
            {isExternal ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gisviz-ink-soft bg-gisviz-paper px-3 py-2 rounded-[8px] border border-gisviz-border">
                <Lock size={12} /> Enterprise
              </span>
            ) : (
              <a
                href={dataset.resource_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] bg-gisviz-accent text-[13px] font-semibold text-[color:var(--accent-on)] hover:brightness-105 transition-all shadow-sm"
              >
                Access Dataset <ArrowUpRight size={14} className="opacity-70" />
              </a>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gisviz-border/60 bg-gisviz-paper/40 p-5 sm:px-6 sm:py-6 text-[13px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3">
              <h4 className="font-semibold text-gisviz-ink mb-3 font-mono text-[11px] uppercase tracking-wider">
                Schema Definition
              </h4>
              <div className="rounded-lg border border-gisviz-border bg-gisviz-card overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gisviz-paper/60 text-[11.5px] text-gisviz-ink-soft border-b border-gisviz-border">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Field Name</th>
                      <th className="px-4 py-2.5 font-medium">Data Type</th>
                      <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gisviz-border/50 text-[12.5px]">
                    {dataset.schema ? dataset.schema.map(f => (
                      <tr key={f.name}>
                        <td className="px-4 py-2.5 font-mono text-gisviz-ink font-medium">{f.name}</td>
                        <td className="px-4 py-2.5 font-mono text-gisviz-accent">{f.type}</td>
                        <td className="px-4 py-2.5 text-gisviz-ink-soft hidden sm:table-cell">{f.description || '-'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-gisviz-ink-soft italic">
                          Schema definition not provided for this dataset.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-gisviz-border/60 pt-5 lg:pt-0 lg:pl-6">
              <h4 className="font-semibold text-gisviz-ink mb-3 font-mono text-[11px] uppercase tracking-wider">
                Metadata
              </h4>
              <dl className="flex flex-col gap-4">
                <div>
                  <dt className="text-[11.5px] text-gisviz-ink-soft mb-1">Bounding Box (BBox)</dt>
                  <dd className="font-mono text-[11.5px] text-gisviz-ink bg-gisviz-card border border-gisviz-border rounded-md px-2.5 py-1.5 break-all">
                    {dataset.bbox ? `[${dataset.bbox.join(', ')}]` : 'Global / Not Specified'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-gisviz-ink-soft mb-1">Update Frequency</dt>
                  <dd className="text-[13px] text-gisviz-ink font-medium">
                    {dataset.update_frequency || 'Static'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-gisviz-ink-soft mb-1">License & Terms</dt>
                  <dd className="text-[13px] text-gisviz-ink font-medium">
                    {dataset.license || 'Unknown'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export default function DatasetsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'file' | 'external'>('all')
  const [search, setSearch] = useState('')

  const filtered = DATASETS_MOCK.filter(d => {
    const matchesTab = activeTab === 'all' || d.source_category === activeTab
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || 
                          d.description.toLowerCase().includes(search.toLowerCase()) ||
                          d.format.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-[72px] pt-8 pb-16">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gisviz-border">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-[-0.03em] text-gisviz-ink mt-1">
            Datasets
          </h1>
          <p className="text-[14.5px] text-gisviz-ink-soft mt-1 max-w-xl">
            Access geospatial layers in standard formats.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-[280px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gisviz-ink-soft" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search format, layer, region..."
              className="w-full h-10 pl-9 pr-3 rounded-[10px] border border-gisviz-border bg-gisviz-card text-[13.5px] text-gisviz-ink placeholder:text-gisviz-ink-soft focus:outline-none focus:ring-1 focus:ring-gisviz-accent"
            />
          </div>

          <div className="inline-flex h-10 p-1 rounded-[10px] border border-gisviz-border bg-gisviz-paper/80">
            {(['all', 'file', 'external'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 rounded-[8px] text-[13px] font-semibold transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-gisviz-card text-gisviz-ink shadow-sm'
                    : 'text-gisviz-ink-soft hover:text-gisviz-ink'
                }`}
              >
                {tab === 'all' ? 'All Sources' : tab === 'file' ? 'Direct Files' : 'External'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-3">
        {filtered.map(dataset => (
          <DatasetCard key={dataset.id} dataset={dataset} />
        ))}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-gisviz-border bg-gisviz-card py-16 px-6 text-center">
            <p className="font-display text-[16px] font-bold text-gisviz-ink">
              No datasets found matching your criteria
            </p>
            <p className="text-[13.5px] text-gisviz-ink-soft mt-1">
              Try adjusting your search query or reset the filter tab.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}