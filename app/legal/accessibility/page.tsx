import LegalPage from '../LegalPage'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Accessibility Policy | Gisviz' }
export default function Page() { return <LegalPage slug="accessibility" /> }