import axios from 'axios'

// ── Base URL ──────────────────────────────────────────────────────────────────
//
// Uses NEXT_PUBLIC_API_URL directly (e.g. http:// in dev,
// https://api.gisviz.com in prod). The browser hits the backend directly;
// Docker exposes port 8001 to the host so this works in every environment.
//
// Do NOT use a relative '/api/v0' base — that only works when the Next.js
// rewrite proxy can resolve the Docker-internal hostname (gisviz-api), which
// it cannot when the frontend dev server runs outside the Docker network.
//
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v0`,
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

// ─── Inline TTL cache ─────────────────────────────────────────────────────────
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

// Per-user cache key suffix — prevents one user's is_liked/is_bookmarked
// flags from being served to a different user from the same browser cache.
function _uid(): string {
  if (typeof window === 'undefined') return 'anon'
  return localStorage.getItem('gisviz_handle') || 'anon'
}

// TTLs in ms
const TTL = {
  CATEGORIES:   10 * 60 * 1000,  // 10 min
  POPULAR:       5 * 60 * 1000,  //  5 min
  STREAM:       30 * 1000,        // 30 sec
  POST:          60 * 1000,       //  1 min
  TRENDING:      2 * 60 * 1000,  //  2 min
  SEARCH:        60 * 1000,       //  1 min
}

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _cache.get<T>(key)
  if (hit !== null) return hit
  const val = await fn()
  _cache.set(key, val, ttlMs)
  return val
}

// ─── Cookie helpers ────────────────────────────────────────────────────────────
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

// ════════════════════════════════════════════════════════════════════════════════
export const gisvizApi = {

  // ── Identity ──────────────────────────────────────────────────────────────
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

  deactivateAccount: async (currentPassword: string) =>
    (await axiosInstance.delete('/users/me', { data: { current_password: currentPassword } })).data,

  // ── Uploads ───────────────────────────────────────────────────────────────
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

  // ── Users ─────────────────────────────────────────────────────────────────
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

  // ── Search ────────────────────────────────────────────────────────────────
  globalSearch: async (q: string) =>
    cached(`gsearch:${q}`, TTL.SEARCH, async () =>
      (await axiosInstance.get('/search/global', { params: { q } })).data
    ),

  // ── Posts ─────────────────────────────────────────────────────────────────
  // Cache keys include _uid() so different logged-in users each get their own
  // is_liked / is_bookmarked flags and don't share stale responses.
  fetchPost: async (postId: string) => {
    const key = `post:${postId}:${_uid()}`
    return cached(key, TTL.POST, async () =>
      (await axiosInstance.get(`/posts/${postId}`)).data
    )
  },

  fetchGlobalStream: async (skip = 0, limit = 50) => {
    if (skip === 0) {
      const key = `stream:0:${limit}:${_uid()}`
      return cached(key, TTL.STREAM, async () =>
        (await axiosInstance.get('/posts/stream', { params: { skip, limit } })).data
      )
    }
    return (await axiosInstance.get('/posts/stream', { params: { skip, limit } })).data
  },

  fetchTrending: async (n = 50) =>
  cached(`trending:${n}`, TTL.TRENDING, async () =>
    (await axiosInstance.get('/posts/trending', { params: { n } })).data
  ),

// Full PostResponse[] version — used by Feed.tsx trending tab
// Per-user cache key so is_liked/is_bookmarked don't leak between users
  fetchTrendingFull: async (n = 20) => {
    const key = `trending-full:${n}:${_uid()}`
    return cached(key, TTL.TRENDING, async () =>
      (await axiosInstance.get('/posts/trending-full', { params: { n } })).data
    )
  },

  searchPosts: async (q: string, skip = 0, limit = 25) =>
    cached(`search:${q}:${_uid()}`, TTL.SEARCH, async () =>
      (await axiosInstance.get('/posts/search', { params: { q, skip, limit } })).data
    ),

  createPost: async (payload) => {
  const res = (await axiosInstance.post('/posts', payload)).data
  _cache.delPrefix('stream:')
  _cache.delPrefix('trending')
  _cache.del('categories')      
  _cache.delPrefix('popular:')   
  return res
},

updatePost: async (postId, payload) => {
  const res = (await axiosInstance.put(`/posts/${postId}`, payload)).data
  _cache.del(`post:${postId}:${_uid()}`)
  _cache.delPrefix('stream:')
  _cache.del('categories')        
  return res
},

  deletePost: async (postId: string) => {
    const res = (await axiosInstance.delete(`/posts/${postId}`)).data
    _cache.del(`post:${postId}:${_uid()}`)
    _cache.delPrefix('stream:')
    return res
  },

  reportPost: async (postId: string, reason: string, details: string) => {
    const fullReason = details ? `${reason}: ${details}` : reason
    return (await axiosInstance.post(`/posts/${postId}/report`, { reason: fullReason })).data
  },

  getReports: async () => (await axiosInstance.get('/posts/reports/all')).data,

  // ── Likes ──────────────────────────────────────────────────────────────────
  toggleLike: async (postId: string) => {
    const res = (await axiosInstance.post(`/posts/${postId}/like`)).data
    _cache.del(`post:${postId}:${_uid()}`)
    _cache.delPrefix('stream:')
    return res
  },

  // ── Bookmarks ──────────────────────────────────────────────────────────────
  toggleBookmark: async (postId: string) => {
    const res = (await axiosInstance.post(`/posts/${postId}/bookmark`)).data
    _cache.del(`post:${postId}:${_uid()}`)
    _cache.delPrefix('stream:')
    return res
  },

  fetchUserBookmarks: async (handle: string, skip = 0, limit = 50) =>
    (await axiosInstance.get(`/posts/user/${handle}/bookmarks`, {
      params: { skip, limit },
    })).data,

  // ── Comments ──────────────────────────────────────────────────────────────
  fetchComments: async (postId: string) =>
    (await axiosInstance.get(`/posts/${postId}/comments`)).data,

  addComment: async (postId: string, content: string, parentCommentId?: string) => {
    const res = (await axiosInstance.post(`/posts/${postId}/comments`, {
      content, parent_comment_id: parentCommentId ?? null,
    })).data
    _cache.del(`post:${postId}:${_uid()}`)
    return res
  },

  // ── Categories ────────────────────────────────────────────────────────────
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
    _cache.del('categories')
    return res
  },

  rejectPendingCategory: async (pendingId: string) =>
    (await axiosInstance.post(`/categories/pending/${pendingId}/reject`)).data,

  // ── Social graph ──────────────────────────────────────────────────────────
  followUser: async (targetId: string) => {
    const res = (await axiosInstance.post(`/network/${targetId}/follow`)).data
    _cache.delPrefix('popular:')
    return res
  },

  unfollowUser: async (targetId: string) => {
    const res = (await axiosInstance.post(`/network/${targetId}/unfollow`)).data
    _cache.delPrefix('popular:')
    return res
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  registerUser: async (payload: any) =>
    (await axiosInstance.post('/auth/register', payload)).data,

  verifyEmail: async (email: string, otp: string) =>
    (await axiosInstance.post('/auth/verify', { email_address: email, otp })).data,

  resendOtp: async (email_address: string) =>
    (await axiosInstance.post('/auth/resend-otp', { email_address })).data,

  loginUser: async (payload: URLSearchParams) =>
    (await axiosInstance.post('/auth/login', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })).data,

  forgotPassword: async (email: string) =>
    (await axiosInstance.post('/auth/forgot-password', { email_address: email })).data,

  resetPassword: async (token: string, newPassword: string) =>
    (await axiosInstance.post('/auth/reset-password', { token, new_password: newPassword })).data,

   // ── Admin — Users ────────────────────────────────────────────────────────
  fetchAllUsers: async (skip = 0, limit = 50, q?: string) => {
    const params: any = { skip, limit }
    if (q) params.q = q
    return (await axiosInstance.get('/users/all', { params })).data
    // returns { total: number, users: User[] }
  },
 
  deleteUser: async (userId: string) =>
    (await axiosInstance.delete(`/users/${userId}`)).data,
 
  updateUserRole: async (userId: string, roleName: string) =>
    (await axiosInstance.put(`/users/${userId}/role`, { role_name: roleName })).data,
 
  setUserStatus: async (userId: string, isActive: boolean) =>
    (await axiosInstance.put(`/users/${userId}/status`, null, { params: { is_active: isActive } })).data,
 
  // ── Admin — Categories ───────────────────────────────────────────────────
  createCategory: async (label: string, slug: string) =>
    (await axiosInstance.post('/categories/', { label, slug })).data,
 
  updateCategory: async (categoryId: number, label: string, slug: string) =>
    (await axiosInstance.put(`/categories/${categoryId}`, { label, slug })).data,
 
  deleteCategory: async (categoryId: number) =>
    (await axiosInstance.delete(`/categories/${categoryId}`)).data,
 
  // ── Admin — Keywords ─────────────────────────────────────────────────────
  fetchAllKeywords: async (skip = 0, limit = 100) =>
    (await axiosInstance.get('/posts/keywords', { params: { skip, limit } })).data,
 
  deleteKeyword: async (keywordId: number) =>
    (await axiosInstance.delete(`/posts/keywords/${keywordId}`)).data,
 
  // ── Admin — Posts ────────────────────────────────────────────────────────
  fetchAllPosts: async (skip = 0, limit = 50, q?: string) => {
    const params: any = { skip, limit }
    if (q) params.q = q
    return (await axiosInstance.get('/admin/posts', { params })).data
  },
 
  adminDeletePost: async (postId) => {
  const res = (await axiosInstance.delete(`/posts/${postId}`)).data
  _cache.del(`post:${postId}:${_uid()}`)
  _cache.delPrefix('stream:')
  _cache.delPrefix('trending')
  _cache.del('categories')        
  _cache.delPrefix('popular:')    
  return res
},
 
  adminSetPostStatus: async (postId: string, isActive: boolean) => {
    const res = (await axiosInstance.put(`/posts/${postId}/status`, null, {
      params: { is_active: isActive },
    })).data
    _cache.del(`post:${postId}:${_uid()}`)
    _cache.delPrefix('stream:')
    _cache.delPrefix('trending')
    return res
  },

  // ── Admin — Reports ──────────────────────────────────────────────────────
  fetchReports: async () =>
    (await axiosInstance.get('/posts/reports/all')).data,
 
  updateReportStatus: async (reportId: string, status: 'resolved' | 'dismissed') =>
    (await axiosInstance.put(`/posts/reports/${reportId}/status`, { status })).data,

  // services/api.ts — admin analytics section only
// Replace the Admin Analytics block in your full api.ts with this.
// Everything else in api.ts stays exactly the same.

// ── Admin — Analytics (live OLTP — always fresh) ──────────────────────────
adminFetchOverview: async () =>
  (await axiosInstance.get('/admin/analytics/overview')).data,

adminFetchTopPosts: async (by: 'likes' | 'bookmarks' | 'comments' = 'likes', limit = 10) =>
  (await axiosInstance.get('/admin/analytics/top-posts', { params: { by, limit } })).data,

adminFetchTopUsers: async (by: 'followers' | 'posts' = 'followers', limit = 10) =>
  (await axiosInstance.get('/admin/analytics/top-users', { params: { by, limit } })).data,

adminFetchTopCommenters: async (limit = 10) =>
  (await axiosInstance.get('/admin/analytics/active-commenters', { params: { limit } })).data,

// ── Admin — Snapshot trigger ───────────────────────────────────────────────
// Called by the Refresh button. Runs run_daily_snapshot() on the backend,
// which writes today's data into analytics_db so trend charts update.
adminRunSnapshot: async () =>
  (await axiosInstance.post('/admin/run-snapshot')).data,

  // ── Admin — Roles ────────────────────────────────────────────────────────
  adminFetchRoles: async () =>
    (await axiosInstance.get('/admin/roles')).data,

  adminCreateRole: async (name: string, permissions: Record<string, boolean>) =>
    (await axiosInstance.post('/admin/roles', { name, permissions })).data,

  adminUpdateRole: async (roleId: number, name: string, permissions: Record<string, boolean>) =>
    (await axiosInstance.put(`/admin/roles/${roleId}`, { name, permissions })).data,

  adminDeleteRole: async (roleId: number) =>
    (await axiosInstance.delete(`/admin/roles/${roleId}`)).data,

  // ── Admin — Comments ─────────────────────────────────────────────────────
  adminFetchComments: async (skip = 0, limit = 30, q?: string) => {
    const params: any = { skip, limit }
    if (q) params.q = q
    return (await axiosInstance.get('/admin/comments', { params })).data
  },

  adminDeleteComment: async (commentId: string) =>
    (await axiosInstance.delete(`/admin/comments/${commentId}`)).data,

  // ── Admin — Unverified Users ─────────────────────────────────────────────
    adminFetchUnverified: async (olderThanDays?: number) => {
    const params: any = {}
    if (olderThanDays !== undefined) params.older_than_days = olderThanDays
    return (await axiosInstance.get('/admin/users/unverified', { params })).data
  },
 
  adminVerifyUser: async (userId: string) =>
    (await axiosInstance.put(`/admin/users/${userId}/verify`)).data,
 
  adminBulkDeleteUnverified: async (olderThanDays = 30) =>
    (await axiosInstance.delete('/admin/users/unverified/bulk', {
      params: { older_than_days: olderThanDays },
    })).data,
 
  adminExportUnverifiedCsv: (olderThanDays?: number): void => {
    const base = axiosInstance.defaults.baseURL || ''
    const params = olderThanDays ? `?older_than_days=${olderThanDays}` : ''
    // Build the full URL with auth header injected via a hidden anchor
    // (fetch approach below keeps the JWT in the request)
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('gisviz_token') || ''
      : ''
    fetch(`${base}/admin/users/unverified/export${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.blob())
      .then(blob => {
        const url  = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href  = url
        link.download = olderThanDays
          ? `unverified_users_older_than_${olderThanDays}d.csv`
          : 'unverified_users_all.csv'
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(console.error)
  },
 

  // ── Admin — Historical trends (analytics_db / snapshots) ──────────────
  adminFetchTrendsDaily: async (days = 90) =>
    (await axiosInstance.get('/admin/analytics/trends/daily', { params: { days } })).data,
 
  adminFetchCategoryTrends: async (days = 30) =>
    (await axiosInstance.get('/admin/analytics/trends/categories', { params: { days } })).data,
 
  adminFetchEtlStatus: async (limit = 10) =>
    (await axiosInstance.get('/admin/analytics/etl-status', { params: { limit } })).data,
 
 
  // ── Admin — Audit trail (admin_db, live/permanent) ────────────────────
  adminFetchAuditActions: async (opts: {
    skip?: number; limit?: number; action_type?: string;
    admin_user_id?: string; target_id?: string;
  } = {}) =>
    (await axiosInstance.get('/admin/audit/actions', { params: opts })).data,
 
 
  adminFetchAuditSummary: async (days = 30) =>
    (await axiosInstance.get('/admin/audit/actions/summary', { params: { days } })).data,
 
  adminFetchRoleChanges: async (skip = 0, limit = 50) =>
    (await axiosInstance.get('/admin/audit/role-changes', { params: { skip, limit } })).data,
 
  adminFetchReportResolutions: async (skip = 0, limit = 50) =>
    (await axiosInstance.get('/admin/audit/report-resolutions', { params: { skip, limit } })).data,

   // ── Admin — Access control (page registry + derived matrix) ───────────
  adminFetchAccessPages: async () =>
    (await axiosInstance.get('/admin/access/pages')).data,
 
  adminFetchAccessMatrix: async () =>
    (await axiosInstance.get('/admin/access/matrix')).data,

  // ── Support tickets (public submission) ───────────────────────────────────
  submitSupportTicket: async (payload: {
    contact_email?: string
    category: 'bug' | 'billing' | 'account' | 'feature' | 'other'
    subject: string
    description: string
  }) =>
    (await axiosInstance.post('/support/ticket', payload)).data,
 
  // ── Admin — Support Tickets ────────────────────────────────────────────────
  adminFetchTickets: async (opts: {
    skip?:     number
    limit?:    number
    status?:   string
    category?: string
    q?:        string
  } = {}) => {
    const params: any = { skip: opts.skip ?? 0, limit: opts.limit ?? 50 }
    if (opts.status)   params.status   = opts.status
    if (opts.category) params.category = opts.category
    if (opts.q)        params.q        = opts.q
    return (await axiosInstance.get('/admin/tickets', { params })).data
  },
 
  adminUpdateTicketStatus: async (
    ticketId: string,
    status: 'open' | 'in_progress' | 'resolved' | 'closed',
  ) =>
    (await axiosInstance.put(`/admin/tickets/${ticketId}/status`, { status })).data,
 
  adminDeleteTicket: async (ticketId: string) =>
    (await axiosInstance.delete(`/admin/tickets/${ticketId}`)).data,
 
 //-- SLUG --
 getPostBySlug: async (slug: string) =>
    (await axiosInstance.get(`/posts/slug/${slug}`)).data,
}