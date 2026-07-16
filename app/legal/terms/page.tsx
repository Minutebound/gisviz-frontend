import LegalPage from '../LegalPage'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Terms of Service | Gisviz' }
export default function Page() { return <LegalPage slug="terms" /> }