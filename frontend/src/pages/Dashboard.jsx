import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Package,
  Bell,
  AlertTriangle,
  Upload,
  MessageSquare,
  FileText,
  RefreshCw,
  ShoppingCart,
  Compass,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Boxes
} from 'lucide-react'
import toast from 'react-hot-toast'
import MetricCard from '../components/Dashboard/MetricCard'
import HealthScore from '../components/Dashboard/HealthScore'
import SalesChart from '../components/Dashboard/SalesChart'
import AlertsList from '../components/Dashboard/AlertsList'
import { useAuth } from '../context/AuthContext'
import {
  getHealthScore,
  getPendingAlerts,
  getForecast,
  getInventoryAlerts,
  generateAlerts
} from '../services/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

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

      loadForecast()

      if (showToast) toast.success('Business narrative refreshed!')
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

  const lowCount = invAlerts?.low_count ?? invAlerts?.low_stock?.length ?? 0
  const criticalCount = invAlerts?.critical_count ?? invAlerts?.critical?.length ?? 0
  const totalLowStock = lowCount + criticalCount

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 max-w-7xl mx-auto pb-10"
    >
      {/* Editorial Prologue Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-[var(--border-color)] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
              Operating Ledger · Chapter 01
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-[var(--text-main)] font-display">
            Your Business, Understood.
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1.5 max-w-2xl font-mono uppercase tracking-wide">
            {user?.name ? `OPERATOR: ${user.name} // ` : ''}
            LIVE METRICS, PREDICTIVE SALES TRAJECTORY, AND DIRECTIVES FOR TODAY.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/chat', { state: { initialQuery: 'Summarize today\'s store health and performance' } })}
            className="btn-accent text-xs cursor-pointer font-bold uppercase tracking-wider"
          >
            <Sparkles size={14} className="stroke-[2.5]" />
            <span>Consult AI Co-Pilot</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary text-xs cursor-pointer font-bold uppercase tracking-wider"
            title="Reload telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[2.2] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* CHAPTER 01 — UNDERSTAND */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold">
              Chapter 01
            </span>
            <span className="text-xs font-semibold text-[var(--text-main)]">
              Understand · Realtime Store State
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Health Score */}
          <MetricCard
            title="Business Health Score"
            value={health?.total_score != null ? `${health.total_score}/100` : (loading ? '...' : 'N/A')}
            subtitle={
              health?.grade && health.grade !== 'N/A'
                ? `Grade ${health.grade} · ${health.trend || 'stable'} trajectory`
                : (health?.message || 'Awaiting sales records')
            }
            icon={TrendingUp}
            color="blue"
            loading={loading}
          />

          {/* 2. Low Stock Alerts */}
          <MetricCard
            title="Inventory Attention"
            value={totalLowStock}
            subtitle={
              criticalCount > 0
                ? `${criticalCount} SKUs in critical depletion!`
                : totalLowStock > 0
                ? `${totalLowStock} SKUs under reorder threshold`
                : 'All warehouse SKUs optimal'
            }
            icon={Package}
            color={criticalCount > 0 ? 'red' : totalLowStock > 0 ? 'amber' : 'green'}
            loading={loading}
          />

          {/* 3. Active Alerts */}
          <MetricCard
            title="Unread Directives"
            value={alerts.length}
            subtitle="Actionable operational signals"
            icon={Bell}
            color={alerts.length > 0 ? 'purple' : 'green'}
            loading={loading}
          />

          {/* 4. Top Operational Issue */}
          <MetricCard
            title="Strategic Diagnostic"
            value={health?.grade && health.grade !== 'N/A' ? `Grade ${health.grade}` : (loading ? '...' : 'Optimal')}
            subtitle={health?.top_issue ? health.top_issue.slice(0, 48) : (loading ? 'Auditing telemetry...' : 'Zero critical blockers detected')}
            icon={AlertTriangle}
            color={health?.total_score && health.total_score < 75 ? 'amber' : 'green'}
            loading={loading}
          />
        </div>
      </section>

      {/* CHAPTER 02 & 03 — DISCOVER & ANTICIPATE */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold">
            Chapter 02 & 03
          </span>
          <span className="text-xs font-semibold text-[var(--text-main)]">
            Discover & Anticipate · 30-Day Sales Forecast
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Forecast Chart */}
          <div className="card lg:col-span-2 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-3">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-main)]">
                  Sales Trajectory & Forward Outlook
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  14-day historical register reconciled with 30-day ensemble forecast
                </p>
              </div>
              <span className="badge-blue">
                Predictive Sales Analysis
              </span>
            </div>

            <SalesChart
              data={forecast}
              loading={forecastLoading}
              error={forecastError}
              onRetry={loadForecast}
            />
          </div>

          {/* Health Index Radar */}
          <div className="lg:col-span-1">
            <HealthScore data={health} loading={loading} />
          </div>
        </div>
      </section>

      {/* CHAPTER 04 & 05 — ACT & GROW */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold">
            Chapter 04 & 05
          </span>
          <span className="text-xs font-semibold text-[var(--text-main)]">
            Act & Grow · Priority Directives & Quick Execution
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Alerts List */}
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-main)]">
                  Operational Signals & Pending Directives
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Automated thresholds for stockout prevention and margin leaks
                </p>
              </div>
              <button
                onClick={() => generateAlerts().then(() => loadData(true))}
                className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Sparkles size={12} />
                <span>Refresh Store Alerts</span>
              </button>
            </div>

            <AlertsList
              alerts={alerts}
              onRead={(id) => setAlerts((a) => a.filter((x) => x.id !== id))}
              loading={loading}
            />
          </div>

          {/* Quick Action Hub */}
          <div className="card space-y-3">
            <div className="border-b border-[var(--border-subtle)] pb-2.5">
              <h3 className="font-bold text-sm text-[var(--text-main)]">
                Immediate Execution
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Instant pathways to store workflows
              </p>
            </div>

            <div className="space-y-2">
              {[
                {
                  label: 'Launch POS Register',
                  desc: 'High-speed billing counter & receipt print',
                  icon: ShoppingCart,
                  to: '/pos',
                  badge: 'F1',
                },
                {
                  label: 'Replenish Inventory',
                  desc: 'Add stock to depleted products',
                  icon: Boxes,
                  to: '/inventory',
                  badge: totalLowStock > 0 ? `${totalLowStock} Low` : 'Active',
                },
                {
                  label: 'Consult AI Co-Pilot',
                  desc: 'Ask complex revenue and margin queries',
                  icon: MessageSquare,
                  to: '/chat',
                  badge: 'Assistant',
                },
                {
                  label: 'Compile Executive Dossier',
                  desc: 'Export daily/monthly PDF summary',
                  icon: FileText,
                  to: '/reports',
                  badge: 'PDF',
                },
                {
                  label: 'Review Market Festivals',
                  desc: 'Upcoming Indian festivals & demand spikes',
                  icon: Compass,
                  to: '/market',
                  badge: 'Seasonal',
                },
              ].map(({ label, desc, icon: Icon, to, badge }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className="w-full flex items-center justify-between p-3 rounded-[3px] border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] transition-all text-left group cursor-pointer shadow-[2px_2px_0px_var(--border-color)] active:translate-x-0.5 active:translate-y-0.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-[2px] bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--accent)] group-hover:text-[var(--accent-ink)] group-hover:scale-105 transition-transform">
                      <Icon className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold font-display uppercase tracking-wide group-hover:text-[var(--accent-ink)] transition-colors truncate">
                        {label}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--accent-ink)] opacity-90 truncate">
                        {desc}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-dim)] group-hover:text-[var(--accent-ink)] font-bold shrink-0 ml-2">
                    {badge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  )
}
