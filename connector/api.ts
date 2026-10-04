import axios from 'axios'
import { FeedFilters, filtersToParams, Post } from '../types/gisviz'
import type { DatasetSyncReport, ManagedDatasetMetadata, PublicDatasetRows, Region, VisualCatalog } from '../types/visuals'

export type FeaturedPost = {
  post_id: string; title: string; visual_image_path?: string | null; theme_color?: string | null
  views_count: number; total_likes_count: number; share_slug: string; publisher_handle?: string | null
}
export type CategoryExtra = { description?: string; theme_color?: string; sort_order?: number }

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
// ── URL helpers — defensive stripping of accidental /api/v0 suffix ──────────
// CORRECT env: NEXT_PUBLIC_API_URL=https://api.gisviz.com
// If someone sets it to https://api.gisviz.com/api/v0 by mistake,
// these helpers strip the suffix so all URLs are still correct.
function _apiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? ''
  return raw.replace(/\/api\/v0\/?$/, '').replace(/\/$/, '')
}

// Bare backend origin — used for image URLs served by StaticFiles
// (avatars, banners, visuals live at /uploads/... NOT under /api/v0)
export const UPLOAD_BASE = _apiOrigin()

// Same bare origin — used for Swagger / admin doc links
export const API_ORIGIN = _apiOrigin()

const API_BASE_URL = _apiOrigin()

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v0`,
})

axiosInstance.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('gisviz_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`

  //Globally defeat browser caching for ALL GET requests ──
  if (config.method?.toLowerCase() === 'get') {
    config.params = { ...config.params, _t: Date.now() }
  }

  return config
})

axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    const isDeleteMe =
      error.config?.method === 'delete' && error.config?.url?.endsWith('/users/me')
    const isLogout = error.config?.url?.endsWith('/auth/logout')
    if (error.response?.status === 401 && !isDeleteMe && !isLogout && typeof window !== 'undefined') {
      localStorage.removeItem('gisviz_token')
      localStorage.removeItem('gisviz_handle')
      window.location.href = '/auth'
    }
    return Promise.reject(error)
  }
)

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

// ─── Caching Helpers ───────────────────────────────────────────────────────────
const FEED_TTL = 30_000   // matches the existing 30s stream cache
const _cache = new Map<string, { data: any; expiry: number }>()

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = _cache.get(key)
  if (hit && hit.expiry > now) {
    return hit.data
  }
  const data = await fn()
  _cache.set(key, { data, expiry: now + ttlMs })
  return data
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

  // ── Visuals: charts/maps built from a dataset (backend endpoints/visuals.py) ──
  // dataset picker search (publishers) — backend endpoints/datasets.py
  searchDatasets: async (q: string, limit = 12) =>
    (await axiosInstance.get('/datasets/search', { params: { q, limit } })).data,

  suggestVisual: async (datasetId: string) =>
    (await axiosInstance.get(`/visuals/datasets/${encodeURIComponent(datasetId)}/suggest`)).data,

  buildVisualSpec: async (
    datasetId: string,
    p: { viz?: string; x?: string | null; y?: string | null; z?: string | null; size?: string | null; label_field?: string | null },
  ) =>
    (await axiosInstance.get(`/visuals/datasets/${encodeURIComponent(datasetId)}/spec`, {
      params: Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== '')),
    })).data,

  // ── Datasets: public catalog (the /datasets page) — backend endpoints/datasets.py ──
  listCatalog: async (p: { q?: string; category?: string; kind?: 'spatial' | 'tabular' | ''; skip?: number; limit?: number }) =>
    (await axiosInstance.get('/datasets/', {
      params: Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== '')),
    })).data,

  fetchCatalogDataset: async (datasetId: string) =>
    (await axiosInstance.get(`/datasets/${encodeURIComponent(datasetId)}`)).data,

  // first rows of a dataset for the post page's "View data" (403 unless the dataset's show_data is on)
  fetchDatasetRows: async (datasetId: string, limit = 50): Promise<PublicDatasetRows> =>
    (await axiosInstance.get(`/datasets/${encodeURIComponent(datasetId)}/rows`, { params: { limit } })).data,

  // ── Uploads ───────────────────────────────────────────────────────────────
  uploadAvatar: async (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return (await axiosInstance.post('/uploads/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data
  },

  // ── Dataset management (admin, /admin/datasets) ─────────────────────────
  listManagedDatasets: async (q = '', status = '') =>
    (await axiosInstance.get('/datasets/manage', {
      params: Object.fromEntries(Object.entries({ q, status }).filter(([, v]) => v)),
    })).data,

  createDataset: async (meta: Record<string, any>) =>
    (await axiosInstance.post('/datasets/manage', meta)).data,

  saveDatasetMeta: async (datasetId: string, meta: Record<string, any>) =>
    (await axiosInstance.put(`/datasets/manage/${encodeURIComponent(datasetId)}`, meta)).data,

  setDatasetShowData: async (datasetId: string, show: boolean) =>
    (await axiosInstance.put(`/datasets/manage/${encodeURIComponent(datasetId)}/show-data`, { show })).data,

  datasetMetadata: async (datasetId: string): Promise<ManagedDatasetMetadata> =>
    (await axiosInstance.get(`/datasets/manage/${encodeURIComponent(datasetId)}/metadata`)).data,

  setDatasetActive: async (datasetId: string, active: boolean) =>
    (await axiosInstance.put(`/datasets/manage/${encodeURIComponent(datasetId)}/status`, { active })).data,

  // force=true replaces the data even if published posts would break (the server answers 409 otherwise)
  uploadDatasetData: async (datasetId: string, file: File, onProgress?: (pct: number) => void, force = false) => {
    const fd = new FormData(); fd.append('file', file)
    return (await axiosInstance.post(`/datasets/manage/${encodeURIComponent(datasetId)}/data`, fd, {
      params: force ? { force: true } : undefined,
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress: e => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)) },
    })).data
  },

  previewDataset: async (datasetId: string, limit = 50) =>
    (await axiosInstance.get(`/datasets/manage/${encodeURIComponent(datasetId)}/preview`, { params: { limit } })).data,

  datasetSyncStatus: async (): Promise<DatasetSyncReport> =>
    (await axiosInstance.get('/datasets/manage/sync', { params: { _t: Date.now() } })).data,

  fixDatasetSync: async (dropOrphans = false): Promise<DatasetSyncReport> =>
    (await axiosInstance.post('/datasets/manage/sync', null, { params: { drop_orphans: dropOrphans } })).data,

  // Visual catalog (misc DB): the 7 categories + chart/map types. all=true includes disabled / not-built types.
  getVisualCatalog: async (all = false): Promise<VisualCatalog> =>
    (await axiosInstance.get('/visuals/catalog', { params: all ? { all: true } : undefined })).data,

  // Regions table (misc DB). (listRegions further down is the feed's region facets.)
  listRegionCatalog: async (all = false): Promise<Region[]> =>
    (await axiosInstance.get('/regions/', { params: { all, _t: Date.now() } })).data,

  deleteDataset: async (datasetId: string) =>
    (await axiosInstance.delete(`/datasets/manage/${encodeURIComponent(datasetId)}`)).data,

  reportMissingVisual: async (postId: string) =>
    (await axiosInstance.post(`/posts/${postId}/missing-visual`)).data,

  uploadBanner: async (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return (await axiosInstance.post('/uploads/banner', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data
  },

  /** End this session on the server (sessions never expire otherwise). */
  logout: async (token: string) =>
    (await axiosInstance.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } })).data,

  /** End every session of this account on every device. */
  logoutAll: async () => (await axiosInstance.post('/auth/logout-all')).data,

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

  // feed banner: the most-viewed active post (overall or in one category); null when there is none
  fetchFeaturedPost: async (category?: string): Promise<FeaturedPost | null> =>
    (await axiosInstance.get('/posts/featured', { params: category ? { category } : undefined })).data,

  // count a view of a post page (once per visitor per day on the server); returns the new total
  recordPostView: async (postId: string): Promise<{ views_count: number; counted: boolean }> =>
    (await axiosInstance.post(`/posts/${encodeURIComponent(postId)}/view`)).data,

  // tags used by the most active posts, optionally within one category (categories.slug)
  fetchTrendingKeywords: async (category?: string, limit = 10): Promise<{ word: string; posts: number }[]> =>
    (await axiosInstance.get('/posts/keywords/trending', { params: { limit, ...(category ? { category } : {}) } })).data,

  getPopularPublishers: async (limit = 15, currentUserId?: string) => {
    const params: any = { limit }
    if (currentUserId) params.current_user_id = currentUserId
    return (await axiosInstance.get('/users/popular', { params })).data
  },

  // ── Search ────────────────────────────────────────────────────────────────
  globalSearch: async (q: string) =>
    (await axiosInstance.get('/search/global', { params: { q } })).data,

  // ── Posts ─────────────────────────────────────────────────────────────────
  fetchPost: async (postId: string) =>
    (await axiosInstance.get(`/posts/${postId}`)).data,

  fetchGlobalStream: async (skip = 0, limit = 50) =>
    (await axiosInstance.get('/posts/stream', { params: { skip, limit } })).data,

  fetchTrending: async (n = 50) =>
    (await axiosInstance.get('/posts/trending', { params: { n } })).data,

  fetchTrendingFull: async (n = 20) =>
    (await axiosInstance.get('/posts/trending-full', { params: { n } })).data,

  searchPosts: async (q: string, skip = 0, limit = 25) =>
    (await axiosInstance.get('/posts/search', { params: { q, skip, limit } })).data,

  createPost: async (payload: any) =>
    (await axiosInstance.post('/posts', payload)).data,

  updatePost: async (postId: any, payload: any) =>
    (await axiosInstance.put(`/posts/${postId}`, payload)).data,

  deletePost: async (postId: string) =>
    (await axiosInstance.delete(`/posts/${postId}`)).data,

  reportPost: async (postId: string, reason: string, details: string) => {
    const fullReason = details ? `${reason}: ${details}` : reason
    return (await axiosInstance.post(`/posts/${postId}/report`, { reason: fullReason })).data
  },

  getReports: async () => (await axiosInstance.get('/posts/reports/all')).data,

  // ── Likes ─────────────────────────────────────────────────────────────────
  toggleLike: async (postId: string) =>
    (await axiosInstance.post(`/posts/${postId}/like`)).data,

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  toggleBookmark: async (postId: string) =>
    (await axiosInstance.post(`/posts/${postId}/bookmark`)).data,

  fetchUserBookmarks: async (handle: string, skip = 0, limit = 50) =>
    (await axiosInstance.get(`/posts/user/${handle}/bookmarks`, {
      params: { skip, limit },
    })).data,

  // ── Comments ──────────────────────────────────────────────────────────────
  fetchComments: async (postId: string) =>
    (await axiosInstance.get(`/posts/${postId}/comments`)).data,

  addComment: async (postId: string, content: string, parentCommentId?: string) =>
    (await axiosInstance.post(`/posts/${postId}/comments`, {
      content, parent_comment_id: parentCommentId ?? null,
    })).data,

  // ── Categories ────────────────────────────────────────────────────────────
  listCategories: async () =>
    (await axiosInstance.get('/categories/', { params: { _t: Date.now() } })).data,

  getTrendingCategories: async (limit = 5) =>
    (await axiosInstance.get('/categories/trending', { params: { limit, _t: Date.now() } })).data,

  suggestCategory: async (label: string) =>
    (await axiosInstance.post('/categories/suggest', { label })).data,

  getPendingCategories: async () =>
    (await axiosInstance.get('/categories/pending')).data,

  approvePendingCategory: async (pendingId: string) =>
    (await axiosInstance.post(`/categories/pending/${pendingId}/approve`)).data,

  rejectPendingCategory: async (pendingId: string) =>
    (await axiosInstance.post(`/categories/pending/${pendingId}/reject`)).data,

  // ── Social graph ──────────────────────────────────────────────────────────
  followUser: async (targetId: string) =>
    (await axiosInstance.post(`/network/${targetId}/follow`)).data,

  unfollowUser: async (targetId: string) =>
    (await axiosInstance.post(`/network/${targetId}/unfollow`)).data,

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

  // ── Admin — Users ─────────────────────────────────────────────────────────
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

  // ── Admin — Categories ────────────────────────────────────────────────────
  // extra: description, theme_color (#rrggbb, '' clears), sort_order — all stored in the posts DB
  createCategory: async (label: string, slug: string, extra: CategoryExtra = {}) =>
    (await axiosInstance.post('/categories', { label, slug, ...extra })).data,

  updateCategory: async (categoryId: number, label: string, slug: string, extra: CategoryExtra = {}) =>
    (await axiosInstance.put(`/categories/${categoryId}`, { label, slug, ...extra })).data,

  deleteCategory: async (categoryId: number) =>
    (await axiosInstance.delete(`/categories/${categoryId}`)).data,

  // ── Admin — Keywords ──────────────────────────────────────────────────────
  fetchAllKeywords: async (skip = 0, limit = 100) =>
    (await axiosInstance.get('/posts/keywords', { params: { skip, limit } })).data,

  deleteKeyword: async (keywordId: number) =>
    (await axiosInstance.delete(`/posts/keywords/${keywordId}`)).data,

  // ── Admin — Posts ─────────────────────────────────────────────────────────
  fetchAllPosts: async (skip = 0, limit = 50, q?: string) => {
    const params: any = { skip, limit }
    if (q) params.q = q
    return (await axiosInstance.get('/admin/posts', { params })).data
  },

  adminDeletePost: async (postId: any) =>
    (await axiosInstance.delete(`/posts/${postId}`)).data,

  adminSetPostStatus: async (postId: string, isActive: boolean) =>
    (await axiosInstance.put(`/posts/${postId}/status`, null, {
      params: { is_active: isActive },
    })).data,

  // ── Admin — Reports ───────────────────────────────────────────────────────
  fetchReports: async () =>
    (await axiosInstance.get('/posts/reports/all')).data,

  updateReportStatus: async (reportId: string, status: 'resolved' | 'dismissed') =>
    (await axiosInstance.put(`/posts/reports/${reportId}/status`, { status })).data,

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
  adminRunSnapshot: async () =>
    (await axiosInstance.post('/admin/run-snapshot')).data,

  // ── Admin — Roles ─────────────────────────────────────────────────────────
  adminFetchRoles: async () =>
    (await axiosInstance.get('/admin/roles')).data,

  adminCreateRole: async (name: string, permissions: Record<string, boolean>) =>
    (await axiosInstance.post('/admin/roles', { name, permissions })).data,

  adminUpdateRole: async (roleId: number, name: string, permissions: Record<string, boolean>) =>
    (await axiosInstance.put(`/admin/roles/${roleId}`, { name, permissions })).data,

  adminDeleteRole: async (roleId: number) =>
    (await axiosInstance.delete(`/admin/roles/${roleId}`)).data,

  // ── Admin — Comments ──────────────────────────────────────────────────────
  adminFetchComments: async (skip = 0, limit = 30, q?: string) => {
    const params: any = { skip, limit }
    if (q) params.q = q
    return (await axiosInstance.get('/admin/comments', { params })).data
  },

  adminDeleteComment: async (commentId: string) =>
    (await axiosInstance.delete(`/admin/comments/${commentId}`)).data,

  // ── Admin — Unverified Users ──────────────────────────────────────────────
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

  // ── Admin — Historical trends (analytics_db / snapshots) ──────────────────
  adminFetchTrendsDaily: async (days = 90) =>
    (await axiosInstance.get('/admin/analytics/trends/daily', { params: { days } })).data,

  adminFetchCategoryTrends: async (days = 30) =>
    (await axiosInstance.get('/admin/analytics/trends/categories', { params: { days } })).data,

  adminFetchEtlStatus: async (limit = 10) =>
    (await axiosInstance.get('/admin/analytics/etl-status', { params: { limit } })).data,

  // ── Admin — Audit trail (admin_db, live/permanent) ────────────────────────
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

  // ── Admin — Access control (page registry + derived matrix) ───────────────
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

  // ── Slug ──────────────────────────────────────────────────────────────────
  getPostBySlug: async (slug: string) =>
    (await axiosInstance.get(`/posts/slug/${slug}`)).data,

  // ── Feed (Added from api.additions.ts) ────────────────────────────────────
  /**
   * One entry point for the filtered feed.
   *
   * Today the backend has no filtered endpoint (see docs/BACKEND-NOTES.md), so
   * this degrades: with no filters set it calls the existing /posts/stream or
   * /posts/trending-full untouched. Once GET /posts/feed lands, delete the
   * fallback branch — the call signature does not change.
   */
  fetchFeed: async ({
    filters, skip = 0, limit = 12,
  }: { filters: FeedFilters; skip?: number; limit?: number }): Promise<Post[]> => {
    const extra = filtersToParams(filters)
    const hasFilters = Object.keys(extra).length > 0

    // ── fallback path: no filtered endpoint yet ──
    if (!hasFilters) {
      return filters.sort === 'trending' && skip === 0
        ? cached(`feed:trending:${limit}`, FEED_TTL,
            async () => (await axiosInstance.get('/posts/trending-full', {
              params: { n: limit },
            })).data)
        : cached(`feed:stream:${skip}:${limit}`, FEED_TTL,
            async () => (await axiosInstance.get('/posts/stream', {
              params: { skip, limit },
            })).data)
    }

    // ── filtered path ──
    const params = { ...extra, skip, limit }
    const key = `feed:${new URLSearchParams(params as any).toString()}`
    return cached(key, FEED_TTL, async () => {
      try {
        return (await axiosInstance.get('/posts/feed', { params })).data
      } catch (e: any) {
        // Backend not deployed yet → fall back to the stream so the UI still works.
        // 404 = route missing; 422 = /posts/feed was matched by /posts/{post_id} (no feed route yet)
        if (e?.response?.status === 404 || e?.response?.status === 422) {
          return (await axiosInstance.get('/posts/stream', {
            params: { skip, limit },
          })).data
        }
        throw e
      }
    })
  },

  /** Region facets for the filter bar. Falls back to [] until the route exists. */
  listRegions: async (): Promise<{ id: string; label: string; count: number }[]> => {
    try {
      return (await axiosInstance.get('/posts/regions')).data
    } catch {
      return []
    }
  },

  // ── Ask this map (Added from api.additions.ts) ────────────────────────────
  /**
   * POST /posts/{id}/ask  — see claude/GISVIZ-ASK-ARCHITECTURE.md.
   *
   * Returns { content, result?, citations? }. The endpoint is responsible for
   * scoping the model to that post's layers; the client never passes the data.
   */
  askPost: async (
    postId: string,
    question: string,
    opts?: { conversationId?: string },
  ): Promise<{
    content: string
    conversation_id?: string
    result?: any
    citations?: { kind: 'layer' | 'attr'; name: string; color?: string }[]
  }> =>
    (await axiosInstance.post(`/posts/${postId}/ask`, {
      question,
      conversation_id: opts?.conversationId ?? null,
    })).data,

  /** Promote an answer into a saved layer on the post's map. */
  askToLayer: async (postId: string, messageId: string) =>
    (await axiosInstance.post(`/posts/${postId}/ask/${messageId}/to-layer`)).data,

  /** Thumbs up / down on an answer — feeds answer-quality review. */
  askFeedback: async (postId: string, messageId: string, helpful: boolean) =>
    (await axiosInstance.post(`/posts/${postId}/ask/${messageId}/feedback`, { helpful })).data,

  // ── Geo (V2 Phase 3) (Added from api.additions.ts) ────────────────────────
  /** Map + ordered layers + compiled MapLibre style. V2 plan §6.1. */
  fetchMap: async (mapId: string) =>
    (await axiosInstance.get(`/geo/maps/${mapId}`)).data,

  fetchBasemaps: async () =>
    cached('geo:basemaps', 600_000, async () =>
      (await axiosInstance.get('/geo/basemaps')).data),
}