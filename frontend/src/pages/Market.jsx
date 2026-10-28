import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { marketAPI } from '../services/api'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Sparkles,
  Globe,
  Newspaper,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  RefreshCw,
  Tag
} from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = [
  'Grocery',
  'Snacks',
  'Personal Care',
  'Beverages',
  'Dairy',
  'Household',
  'Spices',
  'Gifting'
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function Market() {
  const [selectedCategory, setSelectedCategory] = useState('Grocery')
  const [seasonalData, setSeasonalData] = useState(null)
  const [trendsData, setTrendsData] = useState(null)
  const [loadingSeasonal, setLoadingSeasonal] = useState(true)
  const [loadingTrends, setLoadingTrends] = useState(true)

  const currentMonthIdx = new Date().getMonth() + 1
  const nextMonthIdx = (currentMonthIdx % 12) + 1

  const loadSeasonal = async () => {
    try {
      setLoadingSeasonal(true)
      const res = await marketAPI.getSeasonal()
      setSeasonalData(res.data)
    } catch (err) {
      console.error('Failed to load seasonal opportunities:', err)
      toast.error('Failed to load seasonal calendar.')
    } finally {
      setLoadingSeasonal(false)
    }
  }

  const loadTrends = async (cat) => {
    try {
      setLoadingTrends(true)
      const res = await marketAPI.getTrends(cat, 'IN')
      setTrendsData(res.data)
    } catch (err) {
      console.error('Failed to load market trends:', err)
      toast.error(`Failed to load trends for ${cat}.`)
    } finally {
      setLoadingTrends(false)
    }
  }

  useEffect(() => {
    loadSeasonal()
  }, [])

  useEffect(() => {
    loadTrends(selectedCategory)
  }, [selectedCategory])

  const getTrendBadge = (direction, pct) => {
    if (direction === 'rising') {
      return (
        <span className="badge-optimal flex items-center gap-1">
          <ArrowUpRight size={13} /> Demand Rising (+{pct}%)
        </span>
      )
    } else if (direction === 'falling') {
      return (
        <span className="badge-critical flex items-center gap-1">
          <ArrowDownRight size={13} /> Demand Falling ({pct}%)
        </span>
      )
    }
    return (
      <span className="badge-warning flex items-center gap-1">
        <Minus size={13} /> Demand Stable
      </span>
    )
  }

  const getSentimentBadge = (sentiment) => {
    if (sentiment === 'positive') {
      return (
        <span className="text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase font-mono">
          Positive
        </span>
      )
    } else if (sentiment === 'cautious') {
      return (
        <span className="text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase font-mono">
          Cautious
        </span>
      )
    }
    return (
      <span className="text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase font-mono">
        Neutral
      </span>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)] flex items-center gap-2">
            <Compass size={22} className="text-blue-500" />
            Market Intelligence & Seasonal Trends
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Real-time Indian consumer search demand, festival calendar opportunities & category insights.
          </p>
        </div>
        <button
          onClick={() => {
            loadSeasonal()
            loadTrends(selectedCategory)
          }}
          disabled={loadingSeasonal || loadingTrends}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-main)] text-xs font-medium cursor-pointer transition-colors w-fit disabled:opacity-50"
        >
          <RefreshCw size={13} className={loadingSeasonal || loadingTrends ? 'animate-spin' : ''} />
          Refresh Trends
        </button>
      </div>

      {/* Seasonal Opportunities Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Month Opportunity */}
        <div className="os-surface p-5 border-l-4 border-l-blue-500 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-blue-500 font-semibold flex items-center gap-1.5">
                <Calendar size={13} /> Active Season &middot; {MONTH_NAMES[currentMonthIdx - 1]}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded">
                This Month
              </span>
            </div>
            <h3 className="text-base font-bold text-[var(--text-main)] mt-2">
              {loadingSeasonal
                ? 'Loading seasonal insights...'
                : seasonalData?.current_month_opportunity || 'Regular Retail Demand'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Align catalog procurement, shelf merchandising, and store combos with this month's high-intent purchase patterns.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <Sparkles size={12} className="text-amber-400" />
            <span>Recommended for high customer footfall & festive cart size</span>
          </div>
        </div>

        {/* Next Month Preparation Opportunity */}
        <div className="os-surface p-5 border-l-4 border-l-purple-500 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-1.5">
                <Calendar size={13} /> Upcoming Horizon &middot; {MONTH_NAMES[nextMonthIdx - 1]}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded">
                Next Month
              </span>
            </div>
            <h3 className="text-base font-bold text-[var(--text-main)] mt-2">
              {loadingSeasonal
                ? 'Loading upcoming opportunities...'
                : seasonalData?.next_month_opportunity || 'Regular Season'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Begin pre-booking wholesale stock and supplier margins 2-3 weeks ahead to secure lower acquisition costs.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span>Advance inventory procurement opportunity</span>
          </div>
        </div>
      </div>

      {/* Category Trends Section */}
      <div className="os-surface p-5 space-y-5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            Category Demand Trends & Insights (India Region)
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Select a retail segment to view consumer search momentum, trending product queries, and sentiment analysis.
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Trend Card Content */}
        {loadingTrends ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)] font-mono animate-pulse">
            Analyzing search volume & market signals for {selectedCategory}...
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Top row: Trend status & Recommendation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-[var(--text-muted)]">
                    Search Momentum
                  </span>
                  {getTrendBadge(trendsData?.trend_direction, trendsData?.trend_change_pct)}
                </div>
                <div className="text-lg font-bold text-[var(--text-main)] capitalize">
                  {trendsData?.category} Demand
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Source: {trendsData?.data_sources?.trends || 'Market Intelligence'}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-[var(--text-muted)]">
                    Market Sentiment
                  </span>
                  {getSentimentBadge(trendsData?.news_sentiment)}
                </div>
                <div className="text-sm font-semibold text-[var(--text-main)] leading-snug">
                  {trendsData?.competitor_insight || 'Market conditions are steady.'}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Source: {trendsData?.data_sources?.news || 'News Intelligence'}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-2">
                <div className="text-[11px] font-mono uppercase text-[var(--text-muted)]">
                  Active Opportunity
                </div>
                <div className="text-sm font-bold text-blue-400">
                  {trendsData?.seasonal_opportunity || 'Year-round FMCG demand'}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Target Region: India (IN)
                </div>
              </div>
            </div>

            {/* Strategic Recommendation */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase font-mono tracking-wider mb-1">
                <Sparkles size={14} />
                Business Co-Pilot Strategic Advice
              </div>
              <p className="text-xs text-[var(--text-main)] leading-relaxed font-medium">
                {trendsData?.recommendation || 'Focus on fast-moving SKUs and customer retention.'}
              </p>
            </div>

            {/* Trending Products & News Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trending Queries */}
              <div className="p-4 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
                  <Tag size={13} className="text-blue-500" />
                  Top Trending Search Queries
                </h3>
                <div className="space-y-1.5">
                  {trendsData?.trending_products?.length > 0 ? (
                    trendsData.trending_products.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs px-3 py-2 rounded bg-[var(--bg-surface)] border border-[var(--border-color)]"
                      >
                        <span className="font-medium text-[var(--text-main)] capitalize">
                          {item}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Trending
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[var(--text-muted)] py-4 text-center">
                      No specific trending queries recorded.
                    </div>
                  )}
                </div>
              </div>

              {/* Business News Digest */}
              <div className="p-4 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
                  <Newspaper size={13} className="text-blue-500" />
                  Market Intelligence Brief
                </h3>
                <div className="text-xs text-[var(--text-muted)] leading-relaxed bg-[var(--bg-surface)] p-3 rounded border border-[var(--border-color)] whitespace-pre-line font-mono text-[11px]">
                  {trendsData?.news_summary || 'No recent articles found.'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 12-Month Indian Seasonal Business Calendar */}
      <div className="os-surface p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            12-Month Indian Retail Seasonal Business Calendar
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Annual strategic roadmap to optimize procurement, festive stock buildup, and working capital.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MONTH_NAMES.map((name, idx) => {
            const mNum = idx + 1
            const isCurrent = mNum === currentMonthIdx
            const isNext = mNum === nextMonthIdx
            const opp = seasonalData?.full_calendar?.[mNum] || seasonalData?.full_calendar?.[String(mNum)] || 'Regular Retail Demand'

            return (
              <div
                key={mNum}
                className={`p-3.5 rounded-lg border transition-all ${
                  isCurrent
                    ? 'bg-blue-600/10 border-blue-500/40 shadow-sm shadow-blue-500/10'
                    : isNext
                    ? 'bg-purple-600/10 border-purple-500/40'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-[var(--text-main)]">
                    {mNum}. {name}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded font-semibold">
                      Current
                    </span>
                  )}
                  {isNext && (
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded font-semibold">
                      Next Up
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {opp}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
