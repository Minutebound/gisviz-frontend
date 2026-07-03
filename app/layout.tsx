import type { Metadata } from 'next'
import { Inter, Sora, IBM_Plex_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { AuthProvider } from '../context/AuthContext'
import { Providers } from './providers'
import Navbar from './components/Navbar'
import SubNavbar from './components/SubNavbar'
import NavigationProgress from './components/NavigationProgress'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' })
const plexMono = IBM_Plex_Mono({ weight: ['500'], subsets: ['latin'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: 'gisviz',
    template: '%s | gisviz',
  },
  description: 'Spatial Information and maps.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${sora.variable} ${plexMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <AuthProvider>
            {/*
              NavigationProgress uses useSearchParams() which requires Suspense.
              It renders a 2px accent bar at the very top of the viewport that
              fires on any link click, giving instant feedback before the new
              page loads. The Suspense fallback is null — the bar itself is the
              loading indicator so no fallback is needed.
            */}
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>

            <div className="min-h-screen bg-gisviz-canvas/50 font-sans flex flex-col">
              <Navbar />
              <SubNavbar />
              <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex-1">
                {children}
              </main>
            </div>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}