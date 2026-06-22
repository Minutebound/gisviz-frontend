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

export const gisvizApi = {
  fetchGlobalStream: async (skip: number = 0, limit: number = 50) => {
    const response = await axios.get(`${API_BASE_URL}/api/v1/publications`, {
      params: { skip, limit },
      headers: getAuthHeaders()
    });
    return response.data;
  }
};