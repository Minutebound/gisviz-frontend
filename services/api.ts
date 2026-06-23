import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('gisviz_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gisviz_token');
        localStorage.removeItem('gisviz_handle');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const v1 = `${API_BASE_URL}/api/v1`;

export const gisvizApi = {
  // ----- Publications -----
  fetchGlobalStream: async (skip = 0, limit = 50) => {
    const res = await axios.get(`${v1}/publications/stream`, {
      params: { skip, limit }, headers: getAuthHeaders(),
    });
    return res.data;
  },

  searchPublications: async (q: string, skip = 0, limit = 50) => {
    const res = await axios.get(`${v1}/publications/search`, {
      params: { q, skip, limit }, headers: getAuthHeaders(),
    });
    return res.data;
  },

  fetchTrending: async (n = 10) => {
    const res = await axios.get(`${v1}/publications/trending`, { params: { n } });
    return res.data;
  },

  createPublication: async (payload: unknown) => {
    const res = await axios.post(`${v1}/publications`, payload, { headers: getAuthHeaders() });
    return res.data;
  },

  toggleLike: async (publicationId: string) => {
    const res = await axios.post(`${v1}/publications/${publicationId}/like`, {}, { headers: getAuthHeaders() });
    return res.data;
  },

  // ----- Comments -----
  fetchComments: async (publicationId: string) => {
    const res = await axios.get(`${v1}/publications/${publicationId}/comments`);
    return res.data;
  },

  addComment: async (publicationId: string, content: string, parentCommentId?: string) => {
    const res = await axios.post(
      `${v1}/publications/${publicationId}/comments`,
      { content, parent_comment_id: parentCommentId ?? null },
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  // ----- Categories / tags -----
  listCategories: async () => {
    const res = await axios.get(`${v1}/categories`);
    return res.data;
  },

  suggestTag: async (label: string) => {
    const res = await axios.post(`${v1}/categories/suggest`, { label }, { headers: getAuthHeaders() });
    return res.data;
  },

  // ----- Social graph -----
  followUser: async (targetId: string) => {
    const res = await axios.post(`${v1}/users/${targetId}/follow`, {}, { headers: getAuthHeaders() });
    return res.data;
  },

  unfollowUser: async (targetId: string) => {
    const res = await axios.post(`${v1}/users/${targetId}/unfollow`, {}, { headers: getAuthHeaders() });
    return res.data;
  },
};