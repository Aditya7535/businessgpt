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
  Tag,
  ExternalLink,
  PackagePlus,
  Check,
  ShoppingBag,
  Flame,
  Award
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
  'Gifting',
]

export default function Market() {
  const [selectedCategory, setSelectedCategory] = useState('Grocery')
  const [seasonalData, setSeasonalData] = useState(null)
  const [trendsData, setTrendsData] = useState(null)
  const [arrivalsData, setArrivalsData] = useState([])
  const [loadingSeasonal, setLoadingSeasonal] = useState(true)
  const [loadingTrends, setLoadingTrends] = useState(true)
  const [loadingArrivals, setLoadingArrivals] = useState(true)
  const [adoptingId, setAdoptingId] = useState(null)

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

  const loadArrivals = async () => {
    try {
      setLoadingArrivals(true)
      const res = await marketAPI.getNewArrivals()
      setArrivalsData(res.data.arrivals || [])
    } catch (err) {
      console.error('Failed to load new arrivals:', err)
    } finally {
      setLoadingArrivals(false)
    }
  }

  const handleAdoptProduct = async (product) => {
    try {
      setAdoptingId(product.id)
      const res = await marketAPI.adoptProduct({
        name: product.name,
        sku: product.sku,
        category: product.category,
        unit_price: product.mrp,
        unit: product.unit || 'pcs',
        reorder_point: 15,
        initial_stock: 0,
      })

      toast.success(res.data.message || `Product "${product.name}" catalog mein add ho gaya!`)

      // Mark as adopted locally
      setArrivalsData((prev) =>
        prev.map((item) =>
          item.id === product.id ? { ...item, already_in_catalog: true } : item
        )
      )
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add product to catalog.')
    } finally {
      setAdoptingId(null)
    }
  }

  useEffect(() => {
    loadSeasonal()
    loadArrivals()
  }, [])

  useEffect(() => {
    loadTrends(selectedCategory)
  }, [selectedCategory])

  const getTrendBadge = (direction, pct) => {
    if (direction === 'rising') {
      return (
        <span className="badge-optimal flex items-center gap-1">
          <ArrowUpRight size={12} /> Demand Rising (+{pct}%)
        </span>
      )
    } else if (direction === 'falling') {
      return (
        <span className="badge-critical flex items-center gap-1">
          <ArrowDownRight size={12} /> Demand Softening ({pct}%)
        </span>
      )
    }
    return (
      <span className="badge-warning flex items-center gap-1">
        <Minus size={12} /> Demand Balanced
      </span>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-7 max-w-7xl mx-auto pb-12"
    >
      {/* Editorial Prologue Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
              Market Externalities · Chapter 03
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[var(--text-main)] font-display">
            Indian Festival Calendar & Demand Signals
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono uppercase tracking-wide">
            Cultural seasonal shifts, newly arrived market products, and category consumer spending surges.
          </p>
        </div>

        <button
          onClick={() => {
            loadSeasonal()
            loadArrivals()
            loadTrends(selectedCategory)
          }}
          className="btn-secondary text-xs cursor-pointer font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0px_var(--border-color)]"
        >
          <RefreshCw size={13} className="stroke-[2.2]" />
          <span>Refresh Signals</span>
        </button>
      </div>

      {/* ── SECTION 1: Indian Festival & Seasonal Surge Calendar ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-purple-500" />
            <h2 className="text-sm font-bold text-[var(--text-main)] font-mono uppercase tracking-wide">
              Upcoming Indian Festivals & Demand Surge Windows
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            Built-in Bharat Festival Engine
          </span>
        </div>

        {loadingSeasonal ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>
        ) : seasonalData?.festivals?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {seasonalData.festivals.map((fest, idx) => (
              <div
                key={fest.id || idx}
                className="os-surface p-4 flex flex-col justify-between hover:border-[var(--border-strong)] transition-all group relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {fest.date_display || fest.date || fest.month}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {fest.days_remaining != null ? (fest.days_remaining === 0 ? 'Active Today' : `in ~${fest.days_remaining} days`) : 'Seasonal Surge'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-bold text-sm text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                      {fest.name}
                    </h3>
                  </div>

                  {fest.surge_level && (
                    <div className="mt-1">
                      <span className="text-[9px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 inline-block">
                        {fest.surge_level}
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
                    {fest.impact_summary || fest.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] space-y-1.5">
                  {fest.recommended_stock && (
                    <div className="text-[11px]">
                      <span className="text-[var(--text-dim)] font-mono block text-[10px] uppercase font-bold">
                        Stock Buffer Priority:
                      </span>
                      <span className="font-semibold text-emerald-500 text-xs">
                        {fest.recommended_stock}
                      </span>
                    </div>
                  )}

                  {fest.high_demand_products && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {fest.high_demand_products.slice(0, 3).map((p, i) => (
                        <span
                          key={i}
                          className="text-[9px] font-mono px-1.5 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] rounded"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card py-8 text-center text-[var(--text-dim)] text-xs font-mono">
            No impending high-impact festival spikes scheduled this month.
          </div>
        )}
      </div>

      {/* ── SECTION 2: New Market Product Arrivals & In-Demand Products ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackagePlus size={16} className="text-emerald-500" />
            <h2 className="text-sm font-bold text-[var(--text-main)] font-mono uppercase tracking-wide">
              New Market Arrivals & High-Demand Retail Launches
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            Verified Indian FMCG Launches ({arrivalsData.length} Items)
          </span>
        </div>

        {loadingArrivals ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-44 rounded-xl" />
            ))}
          </div>
        ) : arrivalsData.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {arrivalsData.map((item) => (
              <div
                key={item.id}
                className="os-surface p-4 flex flex-col justify-between hover:border-[var(--border-strong)] transition-all group"
              >
                <div>
                  {/* Badge & Brand */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {item.badge}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-dim)]">
                      {item.brand}
                    </span>
                  </div>

                  {/* Name & Category */}
                  <h3 className="font-bold text-xs text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors leading-snug">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-[var(--text-dim)]">
                    <span>{item.category}</span>
                    <span>·</span>
                    <span>{item.sku}</span>
                  </div>

                  {/* Pricing Matrix */}
                  <div className="mt-2.5 p-2 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] grid grid-cols-3 gap-1 text-center font-mono text-[11px]">
                    <div>
                      <span className="block text-[9px] text-[var(--text-dim)]">MRP</span>
                      <span className="font-bold text-[var(--text-main)]">₹{item.mrp}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-[var(--text-dim)]">Wholesale</span>
                      <span className="text-[var(--text-muted)]">₹{item.wholesale_price}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-[var(--text-dim)]">Margin</span>
                      <span className="font-bold text-emerald-500">{item.margin}</span>
                    </div>
                  </div>

                  {/* Market Rationale */}
                  <p className="text-[11px] text-[var(--text-muted)] mt-2 leading-relaxed">
                    {item.market_rationale}
                  </p>
                </div>

                {/* Bottom Action: Add to Inventory */}
                <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)]">
                  {item.already_in_catalog ? (
                    <div className="w-full py-1.5 px-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold flex items-center justify-center gap-1.5">
                      <Check size={12} className="stroke-[2.5]" />
                      <span>Already in Catalog</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAdoptProduct(item)}
                      disabled={adoptingId === item.id}
                      className="w-full btn-accent text-xs cursor-pointer font-mono font-bold flex items-center justify-center gap-1.5 py-1.5 shadow-[1px_1px_0px_var(--border-color)]"
                    >
                      <PackagePlus size={13} className="stroke-[2.2]" />
                      <span>{adoptingId === item.id ? 'Adding SKU...' : '+ Add SKU to Store'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card py-8 text-center text-[var(--text-dim)] text-xs font-mono">
            No new market arrivals reported.
          </div>
        )}
      </div>

      {/* ── SECTION 3: Regional Demand Trends by Category ── */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-blue-500" />
            <h2 className="text-sm font-bold text-[var(--text-main)] font-mono uppercase tracking-wide">
              Regional Demand Trends by Merchandise Category
            </h2>
          </div>

          {/* Category Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-[3px] text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--border-strong)] shadow-[1px_1px_0px_var(--border-strong)]'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-color)] hover:border-[var(--border-strong)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loadingTrends ? (
          <div className="card p-8 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={20} className="animate-spin text-[var(--accent)]" />
            <span className="text-xs font-mono text-[var(--text-dim)]">
              Auditing regional market signals for {selectedCategory}...
            </span>
          </div>
        ) : trendsData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trend Summary Card */}
            <div className="os-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-main)] font-mono uppercase tracking-wider">
                  Category Market Velocity: {selectedCategory}
                </span>
                {getTrendBadge(trendsData.direction, trendsData.percentage || 12)}
              </div>

              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {trendsData.summary ||
                  `Current consumer search and purchase sentiment for ${selectedCategory} across Indian retail channels.`}
              </p>

              {trendsData.high_demand_items && (
                <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] block font-bold">
                    High Consumer Demand Items
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {trendsData.high_demand_items.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[11px] font-mono text-[var(--text-main)] flex items-center gap-1"
                      >
                        <Flame size={10} className="text-amber-500" />
                        <span>{kw}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {trendsData.top_brands && (
                <div className="pt-2 text-[11px] font-mono text-[var(--text-dim)] flex items-center gap-2">
                  <Award size={12} className="text-blue-400" />
                  <span>Top Market Brands:</span>
                  <span className="text-[var(--text-main)] font-bold">
                    {trendsData.top_brands.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Strategic Advice Card */}
            <div className="os-surface p-5 space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5 mb-2 font-mono uppercase tracking-wider">
                  <Sparkles size={14} className="text-blue-400" />
                  Store Procurement Playbook
                </span>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {trendsData.procurement_advice ||
                    `Ensure minimum 15-day inventory buffer for ${selectedCategory}. Negotiate advance purchase orders before festive wholesale price inflation.`}
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-dim)] font-mono">
                <span>Signal Source: FMCG Reports & Regional Market Audits</span>
                <span>Region: India (IN)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card py-8 text-center text-[var(--text-dim)] text-xs font-mono">
            No live trend signals available for {selectedCategory}.
          </div>
        )}
      </div>
    </motion.div>
  )
}
