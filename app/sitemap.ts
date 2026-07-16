import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://gisviz.com'

  // Fetch all public post slugs and user handles from FastAPI
  // You will need to create a lightweight endpoint like GET /api/v0/seo/sitemap-data
  const req = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/seo/sitemap-data`)
  const { posts, users } = await req.json()

  const postUrls = posts.map((post: any) => ({
    url: `${baseUrl}/p/${post.share_slug}`,
    lastModified: new Date(post.updated_timestamp),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const userUrls = users.map((user: any) => ({
    url: `${baseUrl}/profile/${user.user_handle}`,
    lastModified: new Date(user.updated_timestamp),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...postUrls,
    ...userUrls,
  ]
}