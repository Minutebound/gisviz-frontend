import LegalPage from '../LegalPage'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Cookie Policy | Gisviz' }
export default function Page() { return <LegalPage slug="cookies" /> }