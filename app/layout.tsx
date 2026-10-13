import './globals.css'
import { Suspense } from 'react'
import { AuthProvider } from '../context/AuthContext'
import TopNav from './components/nav/TopNav'
import GlobalSubNav from './components/nav/BreadCrumbs' // <-- 1. Import SubNav
import NavigationProgress from './components/NavigationProgress'
import ConditionalFooter from './components/ConditionalFooter'
import { ThemeProvider } from 'next-themes'

export const metadata = {
  title: 'GisViz',
  description: 'Geospatial visualization and publishing platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="flex flex-col min-h-screen font-sans antialiased bg-gisviz-canvas text-gisviz-ink selection:bg-gisviz-accent/20">
        
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {/* useSearchParams inside: needs a Suspense boundary for static pages (next build) */}
          <Suspense fallback={null}><NavigationProgress /></Suspense>
          
          <AuthProvider>
            <TopNav />
            
            {/* 2. Global SubNav instantly available on all pages */}
            <GlobalSubNav />
            
            {/* at least a full screen tall: the footer always starts below the first screen */}
            <div className="flex-1 flex flex-col min-h-[100svh]">
              {children}
            </div>

            <ConditionalFooter />
          </AuthProvider>
        </ThemeProvider>

      </body>
    </html>
  )
}