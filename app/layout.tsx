import type { Metadata } from 'next'
import { Inter, Sora, IBM_Plex_Mono, Barlow_Condensed } from 'next/font/google'
import { Suspense } from 'react'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '../context/AuthContext'
import { Providers } from './providers'
import Navbar from './components/Navbar'
import SubNavbar from './components/SubNavbar'
import NavigationProgress from './components/NavigationProgress'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' })
const plexMono = IBM_Plex_Mono({ weight: ['500'], subsets: ['latin'], variable: '--font-plex-mono', display: 'swap' })
const barlowCondensed = Barlow_Condensed({
  weight: ['400', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-barlow-condensed',
  display: 'swap',
})

// Only defined in production build — undefined in dev so scripts never load
const GA_ID = process.env.NODE_ENV === 'production'
  ? process.env.NEXT_PUBLIC_GA_ID
  : undefined

export const metadata: Metadata = {
  title: {
    template: '%s | GisViz',
    default: 'GisViz - geospatial data visualizations',
  },
  description: 'A platform for mapping and analytics.',
  verification: {
    google:'XaiPiIy38S31EcNs9g7IKqEflLpW1uorT1U3jlL9jL0',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${sora.variable} ${plexMono.variable} ${barlowCondensed.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {/* GA4 — production only, never loads in local dev */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  page_path: window.location.pathname,
                  send_page_view: true
                });
              `}
            </Script>
          </>
        )}

        <Providers>
          <AuthProvider>
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