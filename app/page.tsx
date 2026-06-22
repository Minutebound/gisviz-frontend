import { Search } from 'lucide-react'
import Feed from './components/Feed'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'

export default function Home() {
  return (
    <div className="min-h-screen bg-gisviz-canvas/50 font-sans relative">

      {/* 1. TOP NAV */}
      <Navbar />

      {/* 2. RESPONSIVE GRID */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          {/* LEFT COLUMN: Sidebar */}
          <div className="hidden lg:block lg:col-span-4 xl:col-span-3 rounded-xl">
            <Sidebar />
          </div>

          {/* RIGHT COLUMN: Feed + Floating Search Bar */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="grid h-full relative">

              {/* Layer 1: The Scrollable Feed */}
              <div className="col-start-1 row-start-1 min-w-0">
                <Feed />
              </div>

              {/* Layer 2: The Sticky Search Bar */}
              <div className="col-start-1 row-start-1 self-end sticky bottom-6 z-50 pointer-events-none w-full md:pb-0 pb-6">
                <div className="pointer-events-auto relative shadow-2xl">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gisviz-gray" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search datasets, locations, or authors..."
                    className="block w-full pl-12 pr-6 py-4 bg-gisviz-card/80 backdrop-blur-xl border border-gisviz-border text-gisviz-ink placeholder-gisviz-ink-soft focus:outline-none focus:border-gisviz-accent focus:ring-2 focus:ring-gisviz-accent shadow-lg transition-all"
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