import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function MetricCard({ title, value, subtitle, icon: Icon, color = 'blue', trend, loading, chapter = '01' }) {
  const colorStyles = {
    blue: {
      iconBg: 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]',
      borderAccent: 'border-l-[var(--accent)]',
    },
    green: {
      iconBg: 'bg-[var(--success-subtle)] text-[var(--success)] border border-[var(--success-border)]',
      borderAccent: 'border-l-[var(--success)]',
    },
    red: {
      iconBg: 'bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger-border)]',
      borderAccent: 'border-l-[var(--danger)]',
    },
    amber: {
      iconBg: 'bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning-border)]',
      borderAccent: 'border-l-[var(--warning)]',
    },
    purple: {
      iconBg: 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]',
      borderAccent: 'border-l-[var(--accent)]',
    },
  }

  const activeStyle = colorStyles[color] || colorStyles.blue

  if (loading) {
    return (
      <div className="card space-y-3 p-5">
        <div className="flex justify-between items-center">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-8 w-8 rounded-lg" />
        </div>
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-3 w-24" />
      </div>
    )
  }

  return (
    <div className={`card p-5 hover:border-[var(--border-strong)] transition-all relative overflow-hidden group shadow-[3px_3px_0px_var(--border-color)]`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold">
            {title}
          </span>
        </div>
        <div className={`p-2 rounded-[3px] border transition-transform group-hover:scale-105 ${activeStyle.iconBg}`}>
          <Icon className="w-4 h-4 stroke-[2.2]" />
        </div>
      </div>

      <div className="my-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-main)] font-mono">
          {value ?? '—'}
        </span>
      </div>

      {subtitle && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed truncate font-medium">
          {subtitle}
        </p>
      )}

      {trend !== undefined && (
        <div className={`flex items-center gap-1.5 mt-2.5 text-[11px] font-mono font-bold ${trend >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
          {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" /> : <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />}
          <span>{Math.abs(trend)}% vs previous cycle</span>
        </div>
      )}
    </div>
  )
}
