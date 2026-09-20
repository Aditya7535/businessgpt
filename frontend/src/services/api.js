import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : (import.meta.env.DEV ? 'http://localhost:8000' : '')

const api = axios.create({
  baseURL: apiBase,
  timeout: 60000,
})

// ─── Upload ───────────────────────────────────────────────
export const uploadFile = (file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded / e.total) * 100)),
  })
}

// ─── Chat ─────────────────────────────────────────────────
export const sendMessage = (message, session_id = 'default') =>
  api.post('/api/chat', { message, session_id })

// ─── Forecast ─────────────────────────────────────────────
export const getForecast = (horizon = 'month', product = null) =>
  api.post('/api/forecast/sales', { horizon, product })

// ─── Inventory ────────────────────────────────────────────
export const analyzeInventory = (product = null) =>
  api.post('/api/inventory/analyze', { product })

export const getInventoryAlerts = () =>
  api.get('/api/inventory/alerts')

// ─── Market Intelligence ──────────────────────────────────
export const getMarketTrends = (category, region = 'IN') =>
  api.post('/api/market/trends', { category, region })

export const getSeasonalOpportunities = () =>
  api.get('/api/market/seasonal')

// ─── Alerts ───────────────────────────────────────────────
export const getPendingAlerts = () =>
  api.get('/api/alerts/pending')

export const generateAlerts = () =>
  api.post('/api/alerts/generate')

export const markAlertRead = (id) =>
  api.patch(`/api/alerts/${id}/read`)

export const markAllAlertsRead = () =>
  api.patch('/api/alerts/read-all')

// ─── Health Score ─────────────────────────────────────────
export const getHealthScore = () =>
  api.get('/api/health/score')

// ─── Reports ──────────────────────────────────────────────
export const generateReport = (period = 'monthly', month = '') =>
  api.post('/api/reports/generate', { period, month }, { responseType: 'blob' })

export default api
