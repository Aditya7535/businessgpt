import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Package, Bell, IndianRupee, Upload, MessageSquare, FileText, RefreshCw } from 'lucide-react'
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
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async (showToast = false) => {
    try {
      const [h, a, inv] = await Promise.allSettled([
        getHealthScore(),
        getPendingAlerts(),
        getInventoryAlerts(),
      ])
      if (h.status === 'fulfilled') setHealth(h.value.data)
      if (a.status === 'fulfilled') setAlerts(a.value.data?.alerts ?? [])
      if (inv.status === 'fulfilled') setInvAlerts(inv.value.data)

      // Forecast independently (may take longer)
      getForecast('month').then(r => setForecast(r.data)).catch(() => {})

      if (showToast) toast.success('Dashboard refreshed!')
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleRefresh = () => { setRefreshing(true); loadData(true) }

  const lowStock = invAlerts?.low_stock?.length ?? 0
  const critical = invAlerts?.critical?.length ?? 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Welcome back! 👋</h2>
          <p className="text-sm text-gray-500 mt-0.5">Here's your business intelligence snapshot</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Health Score" value={health?.total_score ? `${health.total_score}/100` : '—'} subtitle={`Grade: ${health?.grade ?? '...'}`} icon={TrendingUp} color="blue" loading={loading} />
        <MetricCard title="Low Stock Alerts" value={lowStock + critical} subtitle={critical > 0 ? `${critical} critical!` : 'products need reorder'} icon={Package} color={critical > 0 ? 'red' : 'amber'} loading={loading} />
        <MetricCard title="Active Alerts" value={alerts.length} subtitle="Unread notifications" icon={Bell} color="purple" loading={loading} />
        <MetricCard title="Top Issue" value={health?.grade ?? '—'} subtitle={health?.top_issue?.slice(0, 40) ?? 'Loading...'} icon={IndianRupee} color="green" loading={loading} />
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
          <SalesChart data={forecast} loading={loading && !forecast} />
        </div>

        {/* Health score */}
        <HealthScore data={health} loading={loading} />
      </div>

      {/* Alerts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Pending Alerts</h3>
            <button onClick={() => generateAlerts().then(() => loadData())} className="text-xs text-primary-600 hover:underline">
              Generate New
            </button>
          </div>
          <AlertsList alerts={alerts} onRead={(id) => setAlerts(a => a.filter(x => x.id !== id))} loading={loading} />
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
            <button key={to} onClick={() => navigate(to)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all text-left group">
              <div className={`${color} text-white p-2 rounded-lg`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
