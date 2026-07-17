import LegalPage from '../LegalPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'About | GisViz' }

export default function Page() {
  return <LegalPage slug="about" />
}