import type { Metadata } from 'next'
import { Search } from 'lucide-react'
import Feed from './components/Feed'
import Sidebar from './components/Sidebar'

export const metadata: Metadata = {
  title: 'Feed',  // → renders as "Feed | gisviz" in the tab
}

export default function Home() {
  return (
    <div className="min-h-screen bg-geomap-canvas/50 font-sans relative">

      {/* Page content — no max-w-* here anymore; the layout owns that */}
      <main className="py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          <div className="hidden lg:block lg:col-span-4 xl:col-span-3 rounded-xl">
            <Sidebar />
          </div>

          <div className="lg:col-span-8 xl:col-span-9">
            <div className="grid h-full relative">

              <div className="col-start-1 row-start-1 min-w-0">
                <Feed />
              </div>

              <div className="col-start-1 row-start-1 self-end sticky bottom-6 z-50 pointer-events-none w-full md:pb-0 pb-6">
                <div className="pointer-events-auto relative shadow-2xl rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-geomap-ink-soft" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search datasets, locations, or authors..."
                    className="block w-full pl-12 pr-6 py-4 bg-geomap-card/80 backdrop-blur-xl border border-geomap-border rounded-2xl text-geomap-ink placeholder-geomap-ink-soft focus:outline-none focus:border-geomap-accent focus:ring-2 focus:ring-geomap-accent shadow-lg transition-all"
                  />
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

    </div>
  )
}