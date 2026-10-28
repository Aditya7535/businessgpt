import axios from 'axios'

const rawBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const cleanBase = rawBase.replace(/\/+$/, '')
const API_BASE = cleanBase.endsWith('/api') ? cleanBase : `${cleanBase}/api`

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Bearer token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('businessgpt_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global response interceptor for 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect if on login page
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('businessgpt_token')
        localStorage.removeItem('businessgpt_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  getRoles: () => api.get('/auth/roles'),
  getUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/users', data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
}

export const posAPI = {
  searchProducts: (q = '', category = '') => {
    const params = {}
    if (q) params.q = q
    if (category) params.category = category
    return api.get('/pos/products', { params })
  },
  createBill: (data) => api.post('/pos/bill', data),
  getBillsHistory: (limit = 50) => api.get('/pos/bills', { params: { limit } }),
}

export const inventoryAPI = {
  getProducts: (params = {}) => api.get('/inventory/products', { params }),
  getSummary: () => api.get('/inventory/summary'),
  addStock: (data) => api.post('/inventory/add-stock', data),
  createProduct: (data) => api.post('/inventory/product', data),
  updateProduct: (id, data) => api.put(`/inventory/product/${id}`, data),
  getTransactions: (limit = 50) => api.get('/inventory/transactions', { params: { limit } }),
}

export const analyticsAPI = {
  getSummary: (days = 30) => api.get('/analytics/summary', { params: { days } }),
}

export const voiceAPI = {
  transcribeAudio: (audioBlob, language = null) => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    if (language && language !== 'auto') {
      formData.append('language', language)
    }
    return api.post('/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const chatAPI = {
  sendMessage: (message, session_id = 'default') => api.post('/chat', { message, session_id }),
  getHistory: (session_id = 'default') => api.get('/chat/history', { params: { session_id } }),
  getSessions: () => api.get('/chat/sessions'),
  clearHistory: (session_id = null) => api.delete('/chat/history', { params: session_id ? { session_id } : {} }),
  transcribeAudio: (audioBlob, language = null) => voiceAPI.transcribeAudio(audioBlob, language),
}

export const whatsappAPI = {
  getStatus: () => api.get('/whatsapp/status'),
  linkNumber: (phone_number, opt_in_digest = true, opt_in_alerts = true) =>
    api.post('/whatsapp/link', { phone_number, opt_in_digest, opt_in_alerts }),
  updatePreferences: (opt_in_digest, opt_in_alerts) =>
    api.post('/whatsapp/preferences', { opt_in_digest, opt_in_alerts }),
  testMessage: (message, phone = '+919876543210') =>
    api.post('/whatsapp/test', null, { params: { message, phone } }),
}

export const alertsAPI = {
  getAlerts: () => api.get('/alerts/'),
  markAsRead: (id) => api.patch(`/alerts/${id}/read`),
}

export const reportsAPI = {
  getReports: () => api.get('/reports/'),
  generateReport: (report_type) => api.post(`/reports/generate?report_type=${report_type}`),
  downloadReport: (filename) => {
    return `${API_BASE}/reports/download/${filename}`
  }
}

export const marketAPI = {
  getSeasonal: () => api.get('/market/seasonal'),
  getTrends: (category = 'Grocery', region = 'IN') => api.post('/market/trends', { category, region }),
}

export const settingsAPI = {
  getSettings: () => api.get('/settings/'),
  updateSettings: (data) => api.post('/settings/update', data),
}

// ── Standalone function exports for Dashboard, AlertsList, Upload ──
export const getHealthScore = () => api.get('/health/score')
export const getPendingAlerts = () => api.get('/alerts/pending')
export const getInventoryAlerts = () => inventoryAPI.getSummary()
export const getForecast = (horizon = 'month') => api.post('/forecast/sales', { horizon })
export const generateAlerts = () => api.post('/alerts/generate')
export const markAlertRead = (id) => api.patch(`/alerts/${id}/read`)
export const uploadFile = (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    }
  })
}

export default api
