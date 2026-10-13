// Copies MapLibre's web-worker files into public/maplibre/ (runs before `next dev` and `next build`).
// MapLibre v6 looks for its worker next to its own module URL; once Next bundles it into /_next/static/chunks
// that file is not there, the worker never starts and no map data is drawn. InteractiveVisual points
// MapLibre at /maplibre/maplibre-gl-worker.mjs instead (setWorkerUrl).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let dist
try {
  dist = dirname(require.resolve('maplibre-gl/package.json'))
} catch {
  console.warn('[maplibre] maplibre-gl is not installed; skipping worker copy')
  process.exit(0)
}
const out = join(process.cwd(), 'public', 'maplibre')
mkdirSync(out, { recursive: true })
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  const src = join(dist, 'dist', f)
  if (existsSync(src)) copyFileSync(src, join(out, f))
  else console.warn(`[maplibre] ${f} not found in maplibre-gl/dist`)
}
console.log('[maplibre] worker copied to public/maplibre/')
