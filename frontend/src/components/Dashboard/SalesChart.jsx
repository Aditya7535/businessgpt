import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function SalesChart({ data, loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="h-56 flex flex-col items-center justify-center gap-3 text-gray-500">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-gray-400">Computing ML forecast (Prophet + XGBoost)...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-56 flex flex-col items-center justify-center gap-2 text-center p-4">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <p className="text-xs font-semibold text-red-500">Forecast computation unavailable</p>
        <p className="text-xs text-gray-400 max-w-sm">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-xs font-medium cursor-pointer transition-colors"
          >
            <RefreshCw size={12} />
            <span>Retry Forecast</span>
          </button>
        )}
      </div>
    )
  }

  const rawHistorical = data?.chart_data?.historical || data?.historical || []
  const rawForecast = data?.chart_data?.forecast || data?.forecast || []

  // Take recent historical data (e.g. last 14 days leading up to today)
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
        // Connect to forecast at boundary point so line doesn't gap
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
    // Fallback: only forecast available
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
      <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
        No sales data available to generate forecast chart
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.15)" />
        <XAxis
          dataKey="date"
          stroke="rgba(156, 163, 175, 0.7)"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="rgba(156, 163, 175, 0.7)"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backgroundColor: '#111827',
            color: '#F9FAFB',
            fontSize: 12,
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)'
          }}
          labelFormatter={(label, payload) => {
            if (payload && payload[0]?.payload?.fullDate) {
              return `Date: ${payload[0].payload.fullDate}`
            }
            return label
          }}
          formatter={(value, name) => {
            if (value === null || value === undefined) return [null, null]
            if (name === 'actual') return [`${value} units`, 'Actual Sales']
            if (name === 'forecast') return [`${value} units`, 'Forecasted']
            return [value, name]
          }}
        />
        {/* Actual sales line */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#3b82f6', strokeWidth: 1, stroke: '#fff' }}
          activeDot={{ r: 5 }}
          name="actual"
          connectNulls={false}
        />
        {/* Forecasted line */}
        <Line
          type="monotone"
          dataKey="forecast"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          strokeDasharray="4 4"
          dot={{ r: 2.5, fill: '#8b5cf6' }}
          activeDot={{ r: 5 }}
          name="forecast"
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
