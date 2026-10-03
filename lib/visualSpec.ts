// lib/visualSpec.ts
// The backend returns data URLs like "/api/v0/visuals/datasets/<id>/data?...".
// <InteractiveVisual> fetches strings as-is, so point them at the API origin.

import { API_ORIGIN } from '../connector/api'
import type { VisualSpec } from '../app/components/InteractiveVisual'

export function resolveSpec<T extends VisualSpec | null | undefined>(spec: T): T {
  if (!spec || typeof spec.data !== 'string' || !spec.data.startsWith('/api/')) return spec
  return { ...spec, data: `${API_ORIGIN}${spec.data}` }
}