import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
})

axiosInstance.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('gisviz_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    const isDeleteMe =
      error.config?.method === 'delete' && error.config?.url?.endsWith('/users/me')
    if (error.response?.status === 401 && !isDeleteMe && typeof window !== 'undefined') {
      localStorage.removeItem('gisviz_token')
      localStorage.removeItem('gisviz_handle')
      window.location.href = '/auth'
    }
    return Promise.reject(error)
  }
)

// ─── Inline TTL cache ────────────────────────────────────────────────────────
// Self-contained so api.ts has zero extra imports. The cache is a module-level
// Map — it persists for the lifetime of the browser tab (cleared on reload).
interface CacheEntry { value: unknown; expiresAt: number }
const _store = new Map<string, CacheEntry>()

const _cache = {
  get<T>(key: string): T | null {
    const e = _store.get(key)
    if (!e) return null
    if (Date.now() > e.expiresAt) { _store.delete(key); return null }
    return e.value as T
  },
  set(key: string, value: unknown, ttlMs: number) {
    _store.set(key, { value, expiresAt: Date.now() + ttlMs })
  },
  del(key: string) { _store.delete(key) },
  delPrefix(prefix: string) {
    for (const k of _store.keys()) if (k.startsWith(prefix)) _store.delete(k)
  },
}

// TTLs in ms
const TTL = {
  CATEGORIES:   10 * 60 * 1000,  // 10 min — only changes on admin approval
  POPULAR:       5 * 60 * 1000,  //  5 min — follower counts shift slowly
  STREAM:       30 * 1000,        // 30 sec — new posts appear frequently
  POST:          2 * 60 * 1000,  //  2 min — like/comment counts
  TRENDING:      2 * 60 * 1000,  //  2 min
  SEARCH:       60 * 1000,        //  1 min
}

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _cache.get<T>(key)
  if (hit !== null) return hit
  const val = await fn()
  _cache.set(key, val, ttlMs)
  return val
}

// ─── Cookie helpers (lightweight JS-readable, same-origin) ───────────────────
export const cookies = {
  set(name: string, value: string, days?: number) {
    if (typeof document === 'undefined') return
    const exp = days
      ? `; expires=${new Date(Date.now() + days * 864e5).toUTCString()}`
      : ''
    document.cookie = `${name}=${encodeURIComponent(value)}${exp}; path=/; SameSite=Lax`
  },
  get(name: string): string | null {
    if (typeof document === 'undefined') return null
    const row = document.cookie.split('; ').find(r => r.startsWith(`${name}=`))
    return row ? decodeURIComponent(row.split('=')[1]) : null
  },
  remove(name: string) {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  },
}

// ════════════════════════════════════════════════════════════════════════════
export const gisvizApi = {

  // ── Identity ────────────────────────────────────────────────────────────
  fetchMe: async () => (await axiosInstance.get('/users/me')).data,

  updateSettings: async (payload: any) =>
    (await axiosInstance.put('/users/settings', payload)).data,

  updateHandle: async (newHandle: string) =>
    (await axiosInstance.put('/users/handle', { new_handle: newHandle })).data,

  requestEmailChange: async (newEmail: string, currentPassword: string) =>
    (await axiosInstance.post('/users/email/request', {
      new_email: newEmail, current_password: currentPassword,
    })).data,

  verifyEmailChange: async (newEmail: string, otp: string) =>
    (await axiosInstance.post('/users/email/verify', { new_email: newEmail, otp })).data,

  deleteAccount: async (currentPassword: string) =>
    (await axiosInstance.delete('/users/me', { data: { current_password: currentPassword } })).data,

  // ── Uploads ─────────────────────────────────────────────────────────────
  uploadAvatar: async (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return (await axiosInstance.post('/uploads/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data
  },

  uploadVisual: async (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return (await axiosInstance.post('/uploads/visual', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data
  },

  uploadBanner: async (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return (await axiosInstance.post('/uploads/banner', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data
  },

  changePassword: async (payload: { current_password: string; new_password: string }) =>
    (await axiosInstance.put('/auth/change-password', payload)).data,

  deactivateUser: async (userId: string, active: boolean) =>
    (await axiosInstance.put(`/users/${userId}/status`, null, { params: { is_active: active } })).data,

  // ── Users ────────────────────────────────────────────────────────────────
  fetchUserProfile: async (handle: string, currentUserId?: string) => {
    const params: any = {}
    if (currentUserId) params.current_user_id = currentUserId
    return (await axiosInstance.get(`/users/profile/${handle}`, { params })).data
  },

  fetchUserPosts: async (handle: string, skip = 0, limit = 50) =>
    (await axiosInstance.get(`/posts/user/${handle}`, { params: { skip, limit } })).data,

  getPopularPublishers: async (limit = 15, currentUserId?: string) => {
    const key = `popular:${limit}`
    return cached(key, TTL.POPULAR, async () => {
      const params: any = { limit }
      if (currentUserId) params.current_user_id = currentUserId
      return (await axiosInstance.get('/users/popular', { params })).data
    })
  },

  // ── Search ───────────────────────────────────────────────────────────────
  globalSearch: async (q: string) =>
    cached(`gsearch:${q}`, TTL.SEARCH, async () =>
      (await axiosInstance.get('/search/global', { params: { q } })).data
    ),

  // ── Posts ────────────────────────────────────────────────────────────────
  fetchPost: async (postId: string) =>
    cached(`post:${postId}`, TTL.POST, async () =>
      (await axiosInstance.get(`/posts/${postId}`)).data
    ),

  fetchGlobalStream: async (skip = 0, limit = 50) => {
    // Cache only page 0 — subsequent pages are too dynamic
    if (skip === 0) {
      return cached(`stream:0:${limit}`, TTL.STREAM, async () =>
        (await axiosInstance.get('/posts/stream', { params: { skip, limit } })).data
      )
    }
    return (await axiosInstance.get('/posts/stream', { params: { skip, limit } })).data
  },

  searchPosts: async (q: string, skip = 0, limit = 25) =>
    cached(`search:${q}`, TTL.SEARCH, async () =>
      (await axiosInstance.get('/posts/search', { params: { q, skip, limit } })).data
    ),

  fetchTrending: async (n = 50) =>
    cached(`trending:${n}`, TTL.TRENDING, async () =>
      (await axiosInstance.get('/posts/trending', { params: { n } })).data
    ),

  createPost: async (payload: {
    title: string; description: string | null; visual_image_path: string | null
    category_ids: number[]; keywords: string[]
    note?: string | null; source_name?: string | null; source_url?: string | null
  }) => {
    const res = (await axiosInstance.post('/posts', payload)).data
    _cache.delPrefix('stream:')       // new post → bust feed cache
    return res
  },

  updatePost: async (postId: string, payload: {
    title: string; description: string | null; visual_image_path: string | null
    category_ids: number[]; keywords: string[]
    note?: string | null; source_name?: string | null; source_url?: string | null
  }) => {
    const res = (await axiosInstance.put(`/posts/${postId}`, payload)).data
    _cache.del(`post:${postId}`)
    _cache.delPrefix('stream:')
    return res
  },

  deletePost: async (postId: string) => {
    const res = (await axiosInstance.delete(`/posts/${postId}`)).data
    _cache.del(`post:${postId}`)
    _cache.delPrefix('stream:')
    return res
  },

  reportPost: async (postId: string, reason: string, details: string) => {
    const fullReason = details ? `${reason}: ${details}` : reason
    return (await axiosInstance.post(`/posts/${postId}/report`, { reason: fullReason })).data
  },

  getReports: async () => (await axiosInstance.get('/posts/reports/all')).data,

  toggleLike: async (postId: string) => {
    const res = (await axiosInstance.post(`/posts/${postId}/like`)).data
    _cache.del(`post:${postId}`)      // like count changed
    return res
  },

  toggleBookmark: async (postId: string) => {
    const res = (await axiosInstance.post(`/posts/${postId}/bookmark`)).data
    _cache.del(`post:${postId}`)
    return res
  },

fetchUserBookmarks: async (handle: string, skip = 0, limit = 50) => {
  const res = await axiosInstance.get(`/posts/user/${handle}/bookmarks`, {
    params: { skip, limit },
  })
  return res.data
},
  // ── Comments ─────────────────────────────────────────────────────────────
  fetchComments: async (postId: string) =>
    (await axiosInstance.get(`/posts/${postId}/comments`)).data,

  addComment: async (postId: string, content: string, parentCommentId?: string) => {
    const res = (await axiosInstance.post(`/posts/${postId}/comments`, {
      content, parent_comment_id: parentCommentId ?? null,
    })).data
    _cache.del(`post:${postId}`)      // comment count changed
    return res
  },

  // ── Categories ───────────────────────────────────────────────────────────
  listCategories: async () =>
    cached('categories', TTL.CATEGORIES, async () =>
      (await axiosInstance.get('/categories')).data
    ),

  suggestCategory: async (label: string) =>
    (await axiosInstance.post('/categories/suggest', { label })).data,

  getPendingCategories: async () =>
    (await axiosInstance.get('/categories/pending')).data,

  approvePendingCategory: async (pendingId: string) => {
    const res = (await axiosInstance.post(`/categories/pending/${pendingId}/approve`)).data
    _cache.del('categories')          // new category available
    return res
  },

  rejectPendingCategory: async (pendingId: string) =>
    (await axiosInstance.post(`/categories/pending/${pendingId}/reject`)).data,

  // ── Social graph ─────────────────────────────────────────────────────────
  followUser: async (targetId: string) => {
    const res = (await axiosInstance.post(`/network/${targetId}/follow`)).data
    _cache.delPrefix('popular:')      // follower counts changed
    return res
  },

  unfollowUser: async (targetId: string) => {
    const res = (await axiosInstance.post(`/network/${targetId}/unfollow`)).data
    _cache.delPrefix('popular:')
    return res
  },

  // ── Auth ─────────────────────────────────────────────────────────────────
  registerUser: async (payload: any) =>
    (await axiosInstance.post('/auth/register', payload)).data,

  verifyEmail: async (email: string, otp: string) =>
    (await axiosInstance.post('/auth/verify', { email_address: email, otp })).data,

  resendOtp: async (payload: { email_address: string }) =>
    (await axiosInstance.post('/auth/resend-otp', payload)).data,

  loginUser: async (payload: URLSearchParams) =>
    (await axiosInstance.post('/auth/login', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })).data,

  forgotPassword: async (email: string) =>
    (await axiosInstance.post('/auth/forgot-password', { email_address: email })).data,

  resetPassword: async (token: string, newPassword: string) =>
    (await axiosInstance.post('/auth/reset-password', { token, new_password: newPassword })).data,
}