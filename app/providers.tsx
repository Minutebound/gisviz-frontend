'use client'
import { useEffect } from 'react'
import { ThemeProvider } from 'next-themes'
import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'

export function Providers({ children }: { children: React.ReactNode }) {
  // Register the pmtiles:// protocol ONCE for the whole app.
  // Doing this here (not inside MapComponent) avoids re-registering and
  // dropping the tile cache every time a map mounts/unmounts.
  useEffect(() => {
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
    return () => {
      maplibregl.removeProtocol('pmtiles')
    }
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  )
}