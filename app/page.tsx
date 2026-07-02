import type { Metadata } from 'next'
import Feed from './components/Feed'
import Sidebar from './components/Sidebar'
import FloatingSearch from './components/FloatingSearch'

export const metadata: Metadata = {
  title: 'Feed',
}

export default function Home() {
  return (
    <div className="min-h-screen bg-geomap-canvas/50 font-sans relative">

      <main className="py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="hidden lg:block lg:col-span-4 xl:col-span-3 rounded-xl">
            <Sidebar />
          </div>

          <div className="lg:col-span-8 xl:col-span-9">
            <div className="grid h-full relative">

              <div className="col-start-1 row-start-1 min-w-0 pb-24">
                <Feed />
              </div>

              {/* The Unified Search Component sticky at the bottom */}
              <div className="col-start-1 row-start-1 self-end sticky bottom-6 z-50 pointer-events-none w-full max-w-3xl mx-auto">
                <FloatingSearch />
              </div>

            </div>
          </div>

        </div>
      </main>

    </div>
  )
}