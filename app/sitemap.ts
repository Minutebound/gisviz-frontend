import { MetadataRoute } from 'next'

const BASE_URL = 'https://gisviz.com'

// Use internal Docker network URL at build time, public URL at runtime
// During docker build the backend isn't reachable so we catch and return static only
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // re-generate every hour at runtime

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  // Static pages — always included
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/auth`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/cookies`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/accessibility`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ]

  // Dynamic pages — fetched from backend at runtime
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v0/seo/sitemap-data`,
      {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000), // 5s timeout — don't block sitemap
      }
    )

    if (!res.ok) throw new Error(`SEO endpoint returned ${res.status}`)

    const { posts, users } = await res.json()

    const postUrls: MetadataRoute.Sitemap = (posts || []).map((post: any) => ({
      url: `${BASE_URL}/post/${post.share_slug}`,
      lastModified: new Date(post.last_modified),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    const userUrls: MetadataRoute.Sitemap = (users || []).map((user: any) => ({
      url: `${BASE_URL}/profile/${user.user_handle}`,
      lastModified: new Date(user.last_modified),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

    return [...staticPages, ...postUrls, ...userUrls]

  } catch (err) {
    // Backend unreachable — return static pages only, never crash the build
    console.warn('[sitemap] Could not fetch dynamic URLs:', err)
    return staticPages
  }
}