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
  Area,
  ComposedChart
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
  ArrowDownRight,
  Sparkles,
  Package,
  Award
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

  const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-mono text-[10px] text-[var(--text-dim)] uppercase">
            {label}
          </p>
          {payload.map((entry, index) => (
            <p key={index} className="font-bold flex items-center justify-between gap-3 text-[var(--text-main)]">
              <span className="capitalize">{entry.name}:</span>
              <span className="font-mono text-[var(--accent)]">
                ₹{Number(entry.value).toLocaleString('en-IN')}
              </span>
            </p>
          ))}
        </div>
      )
    }
    return null
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
              Financial Intelligence · Chapter 02
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[var(--text-main)] font-display">
            Financial & Sales Analytics
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono uppercase tracking-wide">
            Revenue velocity, transactional volume, basket size, and category contribution.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1 p-1 rounded-[3px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] shadow-[2px_2px_0px_var(--border-color)]">
          {[
            { label: '7D', value: 7 },
            { label: '30D', value: 30 },
            { label: '60D', value: 60 },
            { label: '90D', value: 90 },
          ].map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`px-3 py-1 rounded-[2px] text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                days === r.value
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--border-strong)] shadow-[1px_1px_0px_var(--border-strong)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          <div className="card p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-semibold">
                Total Revenue ({days}D)
              </span>
              {data.revenue_growth != null && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5 ${
                    data.revenue_growth >= 0
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  {data.revenue_growth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(data.revenue_growth)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-extrabold text-[var(--text-main)] font-mono">
              ₹{(data.total_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Gross store revenue</p>
          </div>

          {/* Transactions */}
          <div className="card p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-semibold">
                Billed Transactions
              </span>
              {data.transactions_growth != null && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5 ${
                    data.transactions_growth >= 0
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  {data.transactions_growth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(data.transactions_growth)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-extrabold text-[var(--text-main)] font-mono">
              {data.total_transactions || 0}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Completed receipts</p>
          </div>

          {/* Average Order Value */}
          <div className="card p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-semibold">
                Average Basket Size
              </span>
            </div>
            <div className="text-2xl font-extrabold text-[var(--accent)] font-mono">
              ₹{Math.round(data.avg_order_value || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Spend per transaction</p>
          </div>

          {/* Gross Margin */}
          <div className="card p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-semibold">
                Estimated Gross Margin
              </span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-500 font-mono">
              {data.gross_margin_pct != null ? `${data.gross_margin_pct}%` : '28.5%'}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Estimated gross profit spread</p>
          </div>
        </div>
      ) : null}

      {/* Narrative Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Revenue Trend */}
        <div className="card lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <div>
              <h3 className="font-bold text-sm text-[var(--text-main)]">
                Daily Revenue Curve
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Aggregated daily sales register over the selected {days}-day cycle
              </p>
            </div>
            <span className="badge-blue">
              Actual Sales
            </span>
          </div>

          <div className="h-64 w-full">
            {data?.daily_trend && data.daily_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.daily_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-dim)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border-subtle)' }}
                    tickFormatter={(v) => (v && v.length >= 10 ? v.slice(5, 10) : v)}
                  />
                  <YAxis
                    stroke="var(--text-dim)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border-subtle)' }}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--accent)"
                    fill="url(#revenueGrad)"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--text-dim)] text-xs font-mono">
                No daily trend entries in range.
              </div>
            )}
          </div>
        </div>

        {/* Category Contribution Breakdown */}
        <div className="card space-y-3">
          <div className="border-b border-[var(--border-subtle)] pb-3">
            <h3 className="font-bold text-sm text-[var(--text-main)]">
              Category Sales Share
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Revenue distribution across merchandise categories
            </p>
          </div>

          <div className="h-64 w-full">
            {data?.category_breakdown && data.category_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.category_breakdown} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-dim)" fontSize={10} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <YAxis dataKey="category" type="category" stroke="var(--text-dim)" fontSize={10} width={65} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Bar dataKey="revenue" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--text-dim)] text-xs font-mono">
                No category breakdown available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Performing SKUs Table */}
      {data?.top_products && data.top_products.length > 0 && (
        <div className="os-surface overflow-hidden">
          <div className="p-3.5 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-amber-500" />
              <h3 className="font-bold text-xs text-[var(--text-main)]">
                Top Revenue Performing Products ({days} Days)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-dim)]">
              Ranked by total cash intake
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-[var(--border-color)]">
              <thead className="bg-[var(--bg-surface-elevated)] font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Units Sold</th>
                  <th className="px-4 py-3 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-main)]">
                {data.top_products.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[11px] text-[var(--text-dim)]">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {item.name || item.product_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-muted)]">
                      {item.category || 'General'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {item.units_sold || item.quantity || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[var(--accent)]">
                      ₹{Number(item.revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  )
}
