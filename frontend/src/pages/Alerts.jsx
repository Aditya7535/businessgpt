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
  Check,
  CheckCheck
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
        return <span className="badge-critical">CRITICAL</span>
      case 'MEDIUM':
        return <span className="badge-low">ATTENTION</span>
      default:
        return <span className="badge-optimal">INFORMATIONAL</span>
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-6 max-w-7xl mx-auto pb-10"
    >
      {/* Editorial Prologue Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
              Priority Signals · Chapter 04
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[var(--text-main)] font-display">
            Action Directives & Anomaly Alerts
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono uppercase tracking-wide">
            Automated stock warnings, Indian festival surge alerts, and margin anomaly monitoring.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-[3px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] shadow-[2px_2px_0px_var(--border-color)]">
          {[
            { label: 'All Alerts', val: 'ALL' },
            { label: 'Unread', val: 'UNREAD' },
            { label: 'Critical', val: 'CRITICAL' },
            { label: 'Inventory', val: 'INVENTORY' },
            { label: 'Festivals', val: 'FESTIVAL' },
          ].map((tab) => {
            const isActive = filterTab === tab.val
            return (
              <button
                key={tab.val}
                onClick={() => setFilterTab(tab.val)}
                className={`px-3 py-1 rounded-[2px] text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--border-strong)] shadow-[1px_1px_0px_var(--border-strong)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="card py-16 flex flex-col items-center justify-center text-center gap-3">
            <CheckCheck size={32} className="text-emerald-500" />
            <div>
              <p className="text-sm font-bold text-[var(--text-main)]">
                No active directives in this category
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                All business parameters and inventory buffers are operating within defined thresholds.
              </p>
            </div>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            return (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  alert.is_read
                    ? 'bg-[var(--bg-surface)] border-[var(--border-color)] opacity-70'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-strong)] shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] shrink-0 mt-0.5">
                    {getAlertIcon(alert.alert_type)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getSeverityBadge(alert.severity)}
                      <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase">
                        {alert.alert_type}
                      </span>
                      {alert.created_at && (
                        <span className="text-[10px] font-mono text-[var(--text-dim)]">
                          · {new Date(alert.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-medium text-[var(--text-main)] leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                </div>

                {!alert.is_read && (
                  <button
                    onClick={() => markRead(alert.id)}
                    className="btn-ghost text-xs py-1.5 px-3 shrink-0 cursor-pointer self-end sm:self-center"
                  >
                    <Check size={13} />
                    <span>Acknowledge</span>
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}
