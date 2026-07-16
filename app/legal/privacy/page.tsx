import LegalPage from '../LegalPage'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Privacy Policy | Gisviz' }
export default function Page() { return <LegalPage slug="privacy" /> }