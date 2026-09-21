import './globals.css'
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
          <NavigationProgress />
          
          <AuthProvider>
            <TopNav />
            
            {/* 2. Global SubNav instantly available on all pages */}
            <GlobalSubNav />
            
            <div className="flex-1 flex flex-col">
              {children}
            </div>

            <ConditionalFooter />
          </AuthProvider>
        </ThemeProvider>

      </body>
    </html>
  )
}