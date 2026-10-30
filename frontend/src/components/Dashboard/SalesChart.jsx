import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine
} from 'recharts'
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react'

export default function SalesChart({ data, loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-[var(--text-dim)]">
          Calculating 30-day predictive sales forecast...
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-2 text-center p-6 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-color)]">
        <AlertCircle className="w-6 h-6 text-amber-500" />
        <p className="text-xs font-semibold text-[var(--text-main)]">Sales Forecast Temporarily Unavailable</p>
        <p className="text-xs text-[var(--text-muted)] max-w-sm">We couldn&apos;t generate the forecast right now. Please verify that recent sales records are uploaded.</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] hover:bg-[var(--accent-subtle)]/80 text-xs font-semibold cursor-pointer transition-all border border-[var(--accent-border)]"
          >
            <RefreshCw size={12} />
            <span>Recalculate Forecast</span>
          </button>
        )}
      </div>
    )
  }

  const rawHistorical = data?.chart_data?.historical || data?.historical || []
  const rawForecast = data?.chart_data?.forecast || data?.forecast || []

  // Last 14 days historical + 30 days forecast
  const recentHistorical = rawHistorical.slice(-14)
  const forecastDays = rawForecast.slice(0, 30)

  const chartData = []

  if (recentHistorical.length > 0) {
    // 1. Add historical points
    recentHistorical.forEach((item, idx) => {
      const isLast = idx === recentHistorical.length - 1 && forecastDays.length > 0
      const dStr = item.date || item.ds || ''
      const shortDate = dStr.length >= 10 ? dStr.slice(5, 10) : dStr
      const actualVal = Math.round(item.actual ?? item.sales ?? 0)

      chartData.push({
        date: shortDate,
        fullDate: dStr,
        actual: actualVal,
        forecast: isLast ? actualVal : null,
        upper: null,
        lower: null,
      })
    })

    // 2. Add forecast points
    forecastDays.forEach((item) => {
      const dStr = item.date || item.ds || ''
      const shortDate = dStr.length >= 10 ? dStr.slice(5, 10) : dStr
      const predVal = Math.round(item.predicted ?? item.yhat ?? 0)
      const upperVal = Math.round(item.upper ?? item.yhat_upper ?? predVal)
      const lowerVal = Math.round(item.lower ?? item.yhat_lower ?? predVal)

      chartData.push({
        date: shortDate,
        fullDate: dStr,
        actual: null,
        forecast: predVal,
        upper: upperVal,
        lower: lowerVal,
      })
    })
  } else {
    // Fallback if only forecast exists
    forecastDays.forEach((item, i) => {
      const dStr = item.date || item.ds || ''
      const shortDate = dStr.length >= 10 ? dStr.slice(5, 10) : `D${i + 1}`
      chartData.push({
        date: shortDate,
        fullDate: dStr,
        actual: null,
        forecast: Math.round(item.predicted ?? item.yhat ?? 0),
        upper: Math.round(item.upper ?? item.yhat_upper ?? 0),
        lower: Math.round(item.lower ?? item.yhat_lower ?? 0),
      })
    })
  }

  if (!chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center text-[var(--text-dim)] text-xs font-mono">
        No sales transaction ledger found to calibrate trend curve.
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const p = payload[0]?.payload
      return (
        <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-mono text-[10px] text-[var(--text-dim)] uppercase">
            {p?.fullDate || label}
          </p>
          {p?.actual !== null && p?.actual !== undefined && (
            <p className="font-bold text-[var(--text-main)] flex items-center justify-between gap-3">
              <span>Actual Revenue:</span>
              <span className="font-mono text-emerald-500">₹{p.actual.toLocaleString('en-IN')}</span>
            </p>
          )}
          {p?.forecast !== null && p?.forecast !== undefined && (
            <p className="font-bold text-[var(--accent)] flex items-center justify-between gap-3">
              <span>Predicted (AI):</span>
              <span className="font-mono">₹{p.forecast.toLocaleString('en-IN')}</span>
            </p>
          )}
          {p?.upper && p?.lower && (
            <p className="text-[10px] text-[var(--text-dim)] font-mono">
              CI: ₹{p.lower.toLocaleString('en-IN')} – ₹{p.upper.toLocaleString('en-IN')}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-3">
      {/* Legend & Meta indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium text-[11px]">
            <span className="w-3 h-0.5 bg-emerald-500 inline-block"></span>
            <span>Historical Ledger</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium text-[11px]">
            <span className="w-3 h-0.5 bg-[var(--accent)] border-t border-dashed inline-block"></span>
            <span>Forecast Curve</span>
          </div>
        </div>
        <div className="text-[10px] font-mono text-[var(--text-dim)] flex items-center gap-1">
          <Sparkles size={11} className="text-blue-400" />
          <span>30-Day Predictive Sales Horizon</span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--text-dim)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
            />
            <YAxis
              stroke="var(--text-dim)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Historical actual line */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 2, fill: '#10b981' }}
              activeDot={{ r: 4 }}
              isAnimationActive={true}
            />

            {/* Forecast predicted line */}
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 2, fill: 'var(--accent)' }}
              activeDot={{ r: 4 }}
              isAnimationActive={true}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
