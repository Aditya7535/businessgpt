import axios, { AxiosError } from 'axios';
import Config, { CLOUD_BACKEND_URL } from '../constants/config';
import Storage from '../utils/storage';

export const apiClient = axios.create({
  baseURL: Config.API_URL,
  timeout: Config.TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export const updateApiBaseUrl = async (newUrl: string) => {
  apiClient.defaults.baseURL = newUrl;
  Config.API_URL = newUrl;
  await Storage.setItem('custom_api_url', newUrl);
};

// Load saved custom URL on boot
Storage.getItem('custom_api_url').then((savedUrl) => {
  if (savedUrl) {
    apiClient.defaults.baseURL = savedUrl;
    Config.API_URL = savedUrl;
  }
}).catch(() => {});

// Interceptor to attach JWT token to every request
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await Storage.getItem('auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Continue without token
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to format errors cleanly
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    let message = 'An unexpected error occurred. Please check your connection.';
    if (error.response?.data) {
      const data = error.response.data as any;
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail.map((d: any) => d.msg || d).join(', ');
      } else if (data.message) {
        message = data.message;
      }
    } else if (error.message) {
      if (error.message.includes('Network Error')) {
        message = `Cannot reach backend at ${apiClient.defaults.baseURL || Config.API_URL}. Tap below to switch connection.`;
      } else {
        message = error.message;
      }
    }
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
