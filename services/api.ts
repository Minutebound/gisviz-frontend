import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// 1. Create the instance and bake in the /api/v1 path
const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
});

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('gisviz_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// 2. Attach interceptors to the INSTANCE, not global axios
axiosInstance.interceptors.request.use((config) => {
  const headers = getAuthHeaders();
  if (headers.Authorization) {
    config.headers.Authorization = headers.Authorization;
  }
  return config;
});

// Response interceptor for token expiration
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gisviz_token');
        localStorage.removeItem('gisviz_handle');
        window.location.href = '/auth'; // Redirect to auth
      }
    }
    return Promise.reject(error);
  }
);

// 3. Export the API methods strictly using axiosInstance
export const gisvizApi = {
  // ----- User & Identity -----
  fetchMe: async () => {
    const res = await axiosInstance.get(`/users/me`);
    return res.data;
  },

  updateSettings: async (payload: any) => {
    const res = await axiosInstance.put(`/users/settings`, payload);
    return res.data;
  },

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post(`/uploads/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  changePassword: async (payload: { current_password: string; new_password: string }) => {
    const res = await axiosInstance.put(`/auth/change-password`, payload);
    return res.data;
  },

  deactivateUser: async (userId: string, active: boolean) => {
    const res = await axiosInstance.put(`/users/${userId}/status`, null, {
      params: { is_active: active }
    });
    return res.data;
  },

  // ----- Profile Endpoints -----
  fetchUserProfile: async (handle: string) => {
    const res = await axiosInstance.get(`/users/profile/${handle}`);
    return res.data;
  },

  fetchUserPosts: async (handle: string, skip = 0, limit = 50) => {
    const res = await axiosInstance.get(`/posts/user/${handle}`, { params: { skip, limit } });
    return res.data;
  },

  // ----- Posts -----
  fetchPost: async (postId: string) => {
    const res = await axiosInstance.get(`/posts/${postId}`);
    return res.data;
  },
  
  fetchGlobalStream: async (skip = 0, limit = 50) => {
    const res = await axiosInstance.get(`/posts/stream`, { params: { skip, limit } });
    return res.data;
  },

  searchPosts: async (q: string, skip = 0, limit = 50) => {
    const res = await axiosInstance.get(`/posts/search`, { params: { q, skip, limit } });
    return res.data;
  },

  fetchTrending: async (n = 10) => {
    const res = await axiosInstance.get(`/posts/trending`, { params: { n } });
    return res.data;
  },

  uploadVisual: async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    const res = await axiosInstance.post('/uploads/visual', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  },

  createPost: async (payload: {
    title: string;
    description: string | null;
    visual_image_path: string | null;
    category_ids: number[];
    keywords: string[];
  }) => {
    const res = await axiosInstance.post('/posts', payload)
    return res.data
  },

  deletePost: async (postId: string) => {
    const res = await axiosInstance.delete(`/posts/${postId}`);
    return res.data;
  },

  reportPost: async (postId: string, reason: string, details: string) => {
    // Combine reason and details into a single string if your backend only has one 'reason' column
    const fullReason = details ? `${reason}: ${details}` : reason;
    
    const res = await axiosInstance.post(`/posts/${postId}/report`, {
      reason: fullReason
    });
    return res.data;
  },

  getReports: async () => {
    const res = await axiosInstance.get(`/posts/reports/all`);
    return res.data;
  },

  toggleLike: async (postId: string) => {
    const res = await axiosInstance.post(`/posts/${postId}/like`);
    return res.data;
  },

  // ----- Comments -----
  fetchComments: async (postId: string) => {
    const res = await axiosInstance.get(`/posts/${postId}/comments`);
    return res.data;
  },

  addComment: async (postId: string, content: string, parentCommentId?: string) => {
    const res = await axiosInstance.post(`/posts/${postId}/comments`, {
      content,
      parent_comment_id: parentCommentId ?? null,
    });
    return res.data;
  },

  // ----- Categories -----
  listCategories: async () => {
    const res = await axiosInstance.get(`/categories`);
    return res.data;
  },

  suggestCategory: async (label: string) => {
    const res = await axiosInstance.post(`/categories/suggest`, { label });
    return res.data;
  },

  // ----- Social graph -----
  followUser: async (targetId: string) => {
    const res = await axiosInstance.post(`/network/${targetId}/follow`);
    return res.data;
  },

  unfollowUser: async (targetId: string) => {
    const res = await axiosInstance.post(`/network/${targetId}/unfollow`);
    return res.data;
  },
  
  // ----- Authentication & Security -----
  registerUser: async (payload: any) => {
    const res = await axiosInstance.post(`/auth/register`, payload);
    return res.data; 
  },

  verifyEmail: async (email: string, otp: string) => {
    const res = await axiosInstance.post(`/auth/verify`, { 
        email_address: email, 
        otp: otp 
    });
    return res.data;
  },
  
  resendOtp: async (payload: { email_address: string }) => {
    const res = await axiosInstance.post(`/auth/resend-otp`, payload);
    return res.data;
  },

  loginUser: async (payload: URLSearchParams) => {
    const res = await axiosInstance.post(`/auth/login`, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return res.data;
  },

  forgotPassword: async (email: string) => {
    const res = await axiosInstance.post(`/auth/forgot-password`, { email_address: email });
    return res.data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const res = await axiosInstance.post(`/auth/reset-password`, { token, new_password: newPassword });
    return res.data;
  },
};