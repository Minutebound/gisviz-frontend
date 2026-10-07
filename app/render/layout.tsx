import type { Metadata } from 'next'

/** /render/...: pages photographed by the backend (poster images). Never indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function RenderLayout({ children }: { children: React.ReactNode }) {
  return children
}