/**
 * app/loading.tsx
 *
 * Next.js App Router automatically renders this file as a React Suspense
 * fallback whenever any page in the app is loading. It replaces the "stuck
 * on the old page" behaviour — Next.js now instantly swaps to this UI while
 * the new page fetches its data.
 *
 * This is a SERVER component (no 'use client') so it renders immediately
 * without waiting for any JS to hydrate.
 */

import PageLoader from './components/PageLoader'

export default function Loading() {
  return <PageLoader variant="spinner" />
}