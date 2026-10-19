import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { alertsAPI } from '../services/api'
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  TrendingUp,
  Boxes,
  Sparkles,
  Calendar,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState('ALL')

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const res = await alertsAPI.getAlerts()
      setAlerts(res.data)
    } catch (err) {
      toast.error('Failed to load store alerts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  const markRead = async (id) => {
    try {
      await alertsAPI.markAsRead(id)
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
      )
      toast.success('Alert marked as read.')
    } catch (err) {
      toast.error('Failed to update alert.')
    }
  }

  const filteredAlerts = alerts.filter((a) => {
    if (filterTab === 'UNREAD') return !a.is_read
    if (filterTab === 'CRITICAL') return a.severity === 'HIGH'
    if (filterTab === 'INVENTORY') return a.alert_type === 'INVENTORY'
    if (filterTab === 'FESTIVAL') return a.alert_type === 'FESTIVAL'
    return true
  })

  const getAlertIcon = (type) => {
    switch (type) {
      case 'INVENTORY':
        return <Boxes size={16} className="text-amber-500" />
      case 'FESTIVAL':
        return <Sparkles size={16} className="text-purple-500" />
      case 'REVENUE':
        return <TrendingUp size={16} className="text-emerald-500" />
      default:
        return <Bell size={16} className="text-blue-500" />
    }
  }

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'HIGH':
        return <span className="badge-critical">HIGH SEVERITY</span>
      case 'MEDIUM':
        return <span className="badge-low">MEDIUM</span>
      default:
        return <span className="badge-optimal">INFO</span>
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)] flex items-center gap-2">
            <Bell size={20} className="text-blue-500" />
            Operational & Business Intelligence Alerts
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Automated stock warnings, seasonal festival demand spikes, and anomaly alerts.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs">
          {['ALL', 'UNREAD', 'CRITICAL', 'INVENTORY', 'FESTIVAL'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1 rounded-md font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                filterTab === tab
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Stream */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl os-surface animate-pulse" />
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="os-surface p-12 text-center text-[var(--text-muted)] flex flex-col items-center">
            <CheckCircle size={36} className="text-emerald-500 mb-2 opacity-80" />
            <p className="text-sm font-semibold text-[var(--text-main)]">Sab Theek Hai! (All Clear)</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">No pending unread alerts in this category.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl os-surface border transition-all flex items-start justify-between gap-4 ${
                alert.is_read
                  ? 'opacity-60 bg-[var(--bg-surface)]'
                  : alert.severity === 'HIGH'
                  ? 'border-l-4 border-l-red-500 bg-red-500/5'
                  : 'border-l-4 border-l-blue-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] shrink-0">
                  {getAlertIcon(alert.alert_type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {alert.alert_type}
                    </span>
                    {getSeverityBadge(alert.severity)}
                    {alert.is_read && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">Read</span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-[var(--text-main)] leading-relaxed">
                    {alert.message}
                  </p>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono">
                    {new Date(alert.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
              </div>

              {!alert.is_read && (
                <button
                  onClick={() => markRead(alert.id)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[var(--border-color)] hover:border-emerald-500 hover:text-emerald-500 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Check size={12} />
                  Mark Read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}
