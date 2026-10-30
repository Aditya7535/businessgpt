import React from 'react'
import { AlertTriangle, Info, CheckCircle2, XCircle, Check } from 'lucide-react'
import { markAlertRead } from '../../services/api'

const SEVERITY_STYLE = {
  HIGH: {
    cls: 'bg-red-500/10 border-red-500/25 text-red-500',
    icon: XCircle,
    badge: 'CRITICAL',
  },
  MEDIUM: {
    cls: 'bg-amber-500/10 border-amber-500/25 text-amber-500',
    icon: AlertTriangle,
    badge: 'ATTENTION',
  },
  LOW: {
    cls: 'bg-blue-500/10 border-blue-500/25 text-blue-500',
    icon: Info,
    badge: 'INFO',
  },
}

export default function AlertsList({ alerts, onRead, loading }) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-14 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!alerts?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-[var(--text-dim)] border border-dashed border-[var(--border-color)] rounded-xl">
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        <p className="text-xs font-medium text-[var(--text-muted)]">
          All systems optimal · No unread alerts
        </p>
        <span className="text-[10px] font-mono text-[var(--text-dim)]">
          Autonomous monitor active 24/7
        </span>
      </div>
    )
  }

  const handleRead = async (id) => {
    await markAlertRead(id).catch(() => {})
    onRead?.(id)
  }

  return (
    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
      {alerts.slice(0, 8).map((alert) => {
        const s = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.LOW
        const Icon = s.icon
        return (
          <div
            key={alert.id}
            className="flex items-start gap-3 p-3.5 rounded-[3px] border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] transition-all group shadow-[2px_2px_0px_var(--border-color)]"
          >
            <div className={`p-1.5 rounded-[2px] shrink-0 mt-0.5 border ${s.cls}`}>
              <Icon className="w-4 h-4 stroke-[2.2]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-[2px] border ${s.cls}`}>
                  {s.badge}
                </span>
                <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider font-bold">
                  {alert.type || 'SYSTEM'}
                </span>
              </div>
              <p className="text-xs font-semibold text-[var(--text-main)] leading-snug">
                {alert.message}
              </p>
            </div>

            <button
              onClick={() => handleRead(alert.id)}
              className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-main)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] px-2 py-1 rounded-[2px] border border-[var(--border-color)] transition-all shrink-0 cursor-pointer flex items-center gap-1 font-bold"
              title="Acknowledge alert"
            >
              <Check size={12} className="stroke-[2.5]" />
              <span>ACK</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
