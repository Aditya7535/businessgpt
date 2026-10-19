import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, Package, Bell, AlertTriangle, Upload, MessageSquare, FileText, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import MetricCard from '../components/Dashboard/MetricCard'
import HealthScore from '../components/Dashboard/HealthScore'
import SalesChart from '../components/Dashboard/SalesChart'
import AlertsList from '../components/Dashboard/AlertsList'
import { getHealthScore, getPendingAlerts, getForecast, getInventoryAlerts, generateAlerts } from '../services/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [health, setHealth] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [forecast, setForecast] = useState(null)
  const [invAlerts, setInvAlerts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [forecastLoading, setForecastLoading] = useState(true)
  const [forecastError, setForecastError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadForecast = async () => {
    setForecastLoading(true)
    setForecastError(null)
    try {
      const res = await getForecast('month')
      if (res.data) {
        setForecast(res.data)
      }
    } catch (err) {
      console.error('Forecast load error:', err)
      const detail = err.response?.data?.detail || err.message || 'Forecast calculation failed.'
      setForecastError(detail)
    } finally {
      setForecastLoading(false)
    }
  }

  const loadData = async (showToast = false) => {
    try {
      const [h, a, inv] = await Promise.allSettled([
        getHealthScore(),
        getPendingAlerts(),
        getInventoryAlerts(),
      ])

      if (h.status === 'fulfilled') {
        setHealth(h.value.data)
      } else {
        console.warn('Health score load error:', h.reason)
      }

      if (a.status === 'fulfilled') {
        setAlerts(a.value.data?.alerts ?? [])
      } else {
        console.warn('Alerts load error:', a.reason)
      }

      if (inv.status === 'fulfilled') {
        setInvAlerts(inv.value.data)
      } else {
        console.warn('Inventory alerts load error:', inv.reason)
      }

      // Load forecast independently
      loadForecast()

      if (showToast) toast.success('Dashboard refreshed!')
    } catch (err) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData(true)
  }

  // Derive counts from API response (supporting both count fields and array fields)
  const lowCount = invAlerts?.low_count ?? invAlerts?.low_stock?.length ?? 0
  const criticalCount = invAlerts?.critical_count ?? invAlerts?.critical?.length ?? 0
  const totalLowStock = lowCount + criticalCount

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Welcome back! 👋</h2>
          <p className="text-sm text-gray-500 mt-0.5">Here's your business intelligence snapshot</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2 text-sm cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Health Score */}
        <MetricCard
          title="Health Score"
          value={health?.total_score != null ? `${health.total_score}/100` : (loading ? '...' : 'N/A')}
          subtitle={
            health?.grade && health.grade !== 'N/A'
              ? `Grade: ${health.grade} (${health.trend || 'stable'})`
              : (health?.message || 'No sales data')
          }
          icon={TrendingUp}
          color="blue"
          loading={loading}
        />

        {/* 2. Low Stock Alerts */}
        <MetricCard
          title="Low Stock Alerts"
          value={totalLowStock}
          subtitle={
            criticalCount > 0
              ? `${criticalCount} critical!`
              : totalLowStock > 0
              ? `${totalLowStock} product${totalLowStock > 1 ? 's' : ''} need reorder`
              : 'All products optimal'
          }
          icon={Package}
          color={criticalCount > 0 ? 'red' : totalLowStock > 0 ? 'amber' : 'green'}
          loading={loading}
        />

        {/* 3. Active Alerts */}
        <MetricCard
          title="Active Alerts"
          value={alerts.length}
          subtitle="Unread notifications"
          icon={Bell}
          color="purple"
          loading={loading}
        />

        {/* 4. Top Issue */}
        <MetricCard
          title="Top Issue"
          value={health?.grade && health.grade !== 'N/A' ? `Grade ${health.grade}` : (loading ? '...' : '—')}
          subtitle={health?.top_issue ? health.top_issue.slice(0, 45) : (loading ? 'Loading...' : 'No critical issues')}
          icon={AlertTriangle}
          color={health?.total_score && health.total_score < 75 ? 'amber' : 'green'}
          loading={loading}
        />
      </div>

      {/* Charts + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forecast chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Sales Forecast</h3>
              <p className="text-xs text-gray-500">Next 30 days prediction</p>
            </div>
            <span className="badge badge-blue">Prophet + XGBoost</span>
          </div>
          <SalesChart
            data={forecast}
            loading={forecastLoading}
            error={forecastError}
            onRetry={loadForecast}
          />
        </div>

        {/* Health score */}
        <HealthScore data={health} loading={loading} />
      </div>

      {/* Alerts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Pending Alerts</h3>
            <button
              onClick={() => generateAlerts().then(() => loadData(true))}
              className="text-xs text-primary-600 hover:underline cursor-pointer"
            >
              Generate New
            </button>
          </div>
          <AlertsList
            alerts={alerts}
            onRead={(id) => setAlerts((a) => a.filter((x) => x.id !== id))}
            loading={loading}
          />
        </div>

        {/* Quick actions */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 mb-2">Quick Actions</h3>
          {[
            { label: 'Upload New Data', icon: Upload, to: '/upload', color: 'bg-blue-600' },
            { label: 'Ask BusinessGPT', icon: MessageSquare, to: '/chat', color: 'bg-violet-600' },
            { label: 'Generate Report', icon: FileText, to: '/reports', color: 'bg-emerald-600' },
            { label: 'View Analytics', icon: TrendingUp, to: '/analytics', color: 'bg-amber-500' },
          ].map(({ label, icon: Icon, to, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all text-left group cursor-pointer"
            >
              <div className={`${color} text-white p-2 rounded-lg`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
