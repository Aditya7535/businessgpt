import React from 'react'
import { TrendingUp, TrendingDown, Minus, ShieldCheck, Activity } from 'lucide-react'

export default function HealthScore({ data, loading }) {
  if (loading) {
    return (
      <div className="card flex flex-col items-center justify-center py-10 gap-4">
        <div className="skeleton w-28 h-28 rounded-full" />
        <div className="skeleton w-36 h-4" />
        <div className="skeleton w-48 h-3" />
      </div>
    )
  }

  const hasScore = data?.total_score != null
  const score = hasScore ? data.total_score : 0
  const displayScore = hasScore ? data.total_score : '—'
  const grade = data?.grade ?? 'N/A'
  const trend = data?.trend ?? 'stable'

  const gradeColor = {
    A: 'text-emerald-500',
    B: 'text-blue-500',
    C: 'text-amber-500',
    D: 'text-orange-500',
    F: 'text-red-500',
  }[grade] ?? 'text-gray-400'

  const ringColor = hasScore
    ? score >= 75
      ? '#10b981'
      : score >= 50
      ? '#f59e0b'
      : '#ef4444'
    : '#64748b'

  const radius = 42
  const circ = 2 * Math.PI * radius
  const offset = hasScore ? circ - (score / 100) * circ : circ

  return (
    <div className="card flex flex-col justify-between py-6 px-5 h-full shadow-[3px_3px_0px_var(--border-color)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold block">
            Chapter 01 · Diagnostic Index
          </span>
          <h3 className="text-sm font-bold text-[var(--text-main)] mt-0.5 font-display uppercase tracking-tight">
            Store Health Score
          </h3>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-muted)] font-bold">
          <Activity size={12} className="text-[var(--accent)]" />
          <span>REALTIME</span>
        </div>
      </div>

      {/* Circular Progress & Grade */}
      <div className="flex flex-col items-center justify-center my-4">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="var(--bg-surface-elevated)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke={ringColor}
              strokeWidth="8"
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold tracking-tight text-[var(--text-main)] font-mono">
              {displayScore}
            </span>
            <span className={`text-xs font-mono font-bold tracking-wider ${gradeColor}`}>
              GRADE {grade}
            </span>
          </div>
        </div>

        {/* Trend Indicator */}
        <div className="flex items-center gap-1.5 mt-2 text-xs font-medium">
          {trend === 'excellent' || trend === 'good' ? (
            <>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500 font-semibold capitalize">{trend} Trajectory</span>
            </>
          ) : trend === 'declining' || trend === 'critical' ? (
            <>
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-red-500 font-semibold capitalize">{trend} Trajectory</span>
            </>
          ) : (
            <>
              <Minus className="w-4 h-4 text-[var(--text-dim)]" />
              <span className="text-[var(--text-muted)] capitalize">{trend} Balance</span>
            </>
          )}
        </div>
      </div>

      {/* Component Breakdown Progress Bars */}
      {data?.components && (
        <div className="w-full space-y-2.5 pt-3 border-t border-[var(--border-subtle)]">
          {Object.entries({
            'Revenue Stability': [data.components.revenue ?? 0, 30],
            'Inventory Health': [data.components.inventory ?? 0, 25],
            'Growth Momentum': [data.components.sales_trend ?? 0, 25],
            'SKU Diversity': [data.components.product_diversity ?? 0, 20],
          }).map(([label, [val, max]]) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--text-muted)] font-medium">{label}</span>
                <span className="font-mono text-[10px] text-[var(--text-dim)]">
                  {val} / {max}
                </span>
              </div>
              <div className="w-full bg-[var(--bg-surface-elevated)] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[var(--accent)] h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, (val / max) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
