import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { analyticsAPI } from '../services/api'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        const res = await analyticsAPI.getSummary(days)
        setData(res.data)
      } catch (err) {
        toast.error('Failed to load analytics data.')
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [days])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-6"
    >
      {/* Top Header & Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)] flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" />
            Financial & Sales Analytics
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Pre-aggregated daily sales intelligence, Prophet forecasting, and margin analysis.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)]">
          {[
            { label: '7D', value: 7 },
            { label: '30D', value: 30 },
            { label: '60D', value: 60 },
            { label: '90D', value: 90 },
          ].map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
                days === r.value
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          <div className="p-4 os-surface flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-medium">Total Revenue</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  data.mom_growth >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                }`}
              >
                {data.mom_growth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {data.mom_growth > 0 ? `+${data.mom_growth}%` : `${data.mom_growth}%`} MoM
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-2">
              ₹{data.total_revenue.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Gross Profit */}
          <div className="p-4 os-surface flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-medium">Gross Profit</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold">
                {data.profit_margin}% Margin
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-500 mt-2">
              ₹{data.gross_profit.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Total Units Sold */}
          <div className="p-4 os-surface flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-medium">Units Sold</span>
              <ShoppingBag size={14} className="text-[var(--text-muted)]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-2">
              {data.total_units_sold.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Total Bills / Transactions */}
          <div className="p-4 os-surface flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-medium">Customer Bills</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">Completed</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-2">
              {data.total_bills}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Chart: Actual vs Forecast */}
      <div className="os-surface p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">Daily Revenue: Actual vs ML Forecast</h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Historical actual performance plotted with forward 7-day Prophet & XGBoost trendline.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span className="text-[var(--text-main)]">Actual Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span className="text-[var(--text-main)]">ML Forecast</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          {loading ? (
            <div className="h-full w-full bg-[var(--bg-surface-elevated)] animate-pulse rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.daily_trend || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.15)" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111111',
                    borderColor: '#333333',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F3F4F6',
                    fontFamily: 'monospace'
                  }}
                  formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual (₹)"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast (₹)"
                  stroke="#A855F7"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Grid: Top Products Bar Chart & Category Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Products Bar Chart */}
        <div className="os-surface p-5 space-y-3">
          <div className="border-b border-[var(--border-color)] pb-3">
            <h2 className="text-sm font-bold text-[var(--text-main)]">Top Products by Revenue</h2>
            <p className="text-[11px] text-[var(--text-muted)]">Highest grossing items in current window.</p>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full w-full bg-[var(--bg-surface-elevated)] animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.top_products || []}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.15)" />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={11} tickFormatter={(val) => `₹${val / 1000}k`} />
                  <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={10} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      borderColor: '#333333',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }}
                    formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown Table (Clean table, NOT pie) */}
        <div className="os-surface p-5 space-y-3">
          <div className="border-b border-[var(--border-color)] pb-3">
            <h2 className="text-sm font-bold text-[var(--text-main)]">Category Financial Matrix</h2>
            <p className="text-[11px] text-[var(--text-muted)]">Breakdown by revenue, volume, and profit margin.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-color)]">
                <tr>
                  <th className="pb-2">Category</th>
                  <th className="pb-2 text-right">Revenue (₹)</th>
                  <th className="pb-2 text-center">Share</th>
                  <th className="pb-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {data?.category_breakdown?.map((cat) => (
                  <tr key={cat.category} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                    <td className="py-2.5 font-medium text-[var(--text-main)]">{cat.category}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-[var(--text-main)]">
                      ₹{cat.revenue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 text-center font-mono text-[var(--text-muted)]">
                      {cat.share_percent}%
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold text-emerald-500">
                      {cat.margin}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
