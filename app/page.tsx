// app/page.tsx — Home
//
// Replaces the previous <Feed> + <Sidebar> + <FloatingSearch> arrangement.
// FeedStream now owns the categorisation bar, the filter state and the right
// rail, so the page itself is just chrome + a Suspense boundary.
//
// FeedStream calls useSearchParams(), which requires a Suspense boundary in the
// App Router — without it `next build` fails with a prerender error on /.

import React, { Suspense } from 'react'
import FeedStream from './components/feed/FeedStream'
import { FeedCardSkeleton } from './components/feed/FeedCard'

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<FeedBoot />}>
        <FeedStream />
      </Suspense>
    </>
  )
}

function FeedBoot() {
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-8 lg:px-[72px] pt-[136px] pb-14">
      <div className="flex flex-col gap-6 max-w-[784px]">
        {Array.from({ length: 3 }).map((_, i) => <FeedCardSkeleton key={i} />)}
      </div>
    </main>
  )
}
