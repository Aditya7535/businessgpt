import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Terminal,
  LineChart,
  FileText,
  Bell,
  Settings,
  Sparkles,
  Package,
  ArrowRight,
  X,
  Compass,
  Upload
} from 'lucide-react'
import { posAPI } from '../services/api'

const PAGES = [
  { id: 'story', title: 'The Story of Your Business (Start Screen)', path: '/story', icon: Sparkles, category: 'Pages' },
  { id: 'dash', title: 'Executive Story Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'Pages' },
  { id: 'pos', title: 'Point of Sale (POS Billing)', path: '/pos', icon: ShoppingCart, category: 'Pages' },
  { id: 'inv', title: 'Inventory Health & Restock', path: '/inventory', icon: Boxes, category: 'Pages' },
  { id: 'chat', title: 'AI Store Assistant (Consultant)', path: '/chat', icon: Terminal, category: 'Pages' },
  { id: 'analytics', title: 'Sales Analytics & Forecasting', path: '/analytics', icon: LineChart, category: 'Pages' },
  { id: 'market', title: 'Market Intelligence & Festivals', path: '/market', icon: Compass, category: 'Pages' },
  { id: 'reports', title: 'Executive PDF Dossiers', path: '/reports', icon: FileText, category: 'Pages' },
  { id: 'alerts', title: 'Actionable Alerts', path: '/alerts', icon: Bell, category: 'Pages' },
  { id: 'settings', title: 'Store Settings & Team PINs', path: '/settings', icon: Settings, category: 'Pages' },
  { id: 'upload', title: 'Data Ingestion (CSV / Excel)', path: '/upload', icon: Upload, category: 'Pages' },
]

const AI_QUERIES = [
  'Aaj ki sales summary aur revenue batao',
  'Critical stock products kaunse hain?',
  'Agle 30 din ka sales forecast kya hai?',
  'Business health score aur top issue batao',
  'Pending action alerts check karo',
]

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [products, setProducts] = useState([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)

  const navigate = useNavigate()
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Listen for Ctrl+K / Cmd+K anywhere
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setProducts([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Live product search
  useEffect(() => {
    if (!query.trim()) {
      setProducts([])
      setIsSearchingProducts(false)
      return
    }

    let isMounted = true
    setIsSearchingProducts(true)

    const timer = setTimeout(async () => {
      try {
        const res = await posAPI.searchProducts(query.trim())
        if (isMounted) {
          setProducts(res.data.slice(0, 5))
        }
      } catch (err) {
        console.error('CommandPalette product search error:', err)
      } finally {
        if (isMounted) setIsSearchingProducts(false)
      }
    }, 200)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [query])

  // Filtered page actions
  const filteredPages = useMemo(() => {
    if (!query.trim()) return PAGES
    const q = query.toLowerCase()
    return PAGES.filter((p) => p.title.toLowerCase().includes(q))
  }, [query])

  // Filtered AI suggestions
  const filteredAi = useMemo(() => {
    if (!query.trim()) return AI_QUERIES
    const q = query.toLowerCase()
    return AI_QUERIES.filter((item) => item.toLowerCase().includes(q))
  }, [query])

  // Flattened items for keyboard navigation
  const flatItems = useMemo(() => {
    const items = []

    filteredPages.forEach((p) => {
      items.push({ type: 'page', data: p })
    })

    products.forEach((prod) => {
      items.push({ type: 'product', data: prod })
    })

    filteredAi.forEach((ai) => {
      items.push({ type: 'ai', data: ai })
    })

    return items
  }, [filteredPages, products, filteredAi])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, flatItems.length])

  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector('[data-active="true"]')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSelect = (item) => {
    setIsOpen(false)
    if (!item) return

    if (item.type === 'page') {
      navigate(item.data.path)
    } else if (item.type === 'product') {
      navigate('/inventory', { state: { search: item.data.name } })
    } else if (item.type === 'ai') {
      navigate('/chat', { state: { initialQuery: item.data } })
    }
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, flatItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % Math.max(1, flatItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatItems[selectedIndex]) {
        handleSelect(flatItems[selectedIndex])
      } else if (query.trim()) {
        setIsOpen(false)
        navigate('/chat', { state: { initialQuery: query.trim() } })
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4 animate-in fade-in duration-100"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] rounded-none shadow-[6px_6px_0px_#111111] dark:shadow-[6px_6px_0px_#000000] overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b-2 border-[var(--border-strong)] bg-[var(--bg-surface-elevated)]">
          <Search size={16} className="text-[var(--text-main)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages, products, or ask AI a business question..."
            className="w-full bg-transparent border-none text-[var(--text-main)] placeholder-[var(--text-dim)] text-xs sm:text-sm font-sans focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] font-bold">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 divide-y divide-[var(--border-subtle)] text-xs">
          {/* Pages */}
          {filteredPages.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-bold">
                [PAGES & WORKSPACES]
              </div>
              {filteredPages.map((page) => {
                const itemIndex = flatItems.findIndex((it) => it.type === 'page' && it.data.id === page.id)
                const isActive = itemIndex === selectedIndex
                const Icon = page.icon
                return (
                  <button
                    key={page.id}
                    data-active={isActive}
                    onClick={() => handleSelect({ type: 'page', data: page })}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--accent)] text-black font-bold border border-black shadow-[2px_2px_0px_#111111]'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={15} className={isActive ? 'text-black' : 'text-[var(--text-muted)]'} />
                      <span className="font-semibold">{page.title}</span>
                    </div>
                    <ArrowRight size={13} className={isActive ? 'text-black' : 'text-[var(--text-dim)]'} />
                  </button>
                )
              })}
            </div>
          )}

          {/* Products */}
          {products.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-bold flex items-center justify-between">
                <span>[INVENTORY PRODUCTS]</span>
                {isSearchingProducts && <span className="animate-pulse">Searching...</span>}
              </div>
              {products.map((prod) => {
                const itemIndex = flatItems.findIndex((it) => it.type === 'product' && it.data.id === prod.id)
                const isActive = itemIndex === selectedIndex
                return (
                  <button
                    key={prod.id}
                    data-active={isActive}
                    onClick={() => handleSelect({ type: 'product', data: prod })}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--accent)] text-black font-bold border border-black shadow-[2px_2px_0px_#111111]'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Package size={15} className={isActive ? 'text-black' : 'text-[var(--text-muted)]'} />
                      <div>
                        <span className="font-bold">{prod.name}</span>
                        <span className={`ml-2 text-[10px] font-mono ${isActive ? 'text-black' : 'text-[var(--text-dim)]'}`}>
                          Stock: {prod.current_stock} {prod.unit}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-bold">₹{prod.unit_price}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* AI Prompts */}
          {filteredAi.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-bold flex items-center gap-1">
                <span>[ASK STORE ASSISTANT]</span>
              </div>
              {filteredAi.map((aiText, idx) => {
                const itemIndex = flatItems.findIndex((it) => it.type === 'ai' && it.data === aiText)
                const isActive = itemIndex === selectedIndex
                return (
                  <button
                    key={idx}
                    data-active={isActive}
                    onClick={() => handleSelect({ type: 'ai', data: aiText })}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--accent)] text-black font-bold border border-black shadow-[2px_2px_0px_#111111]'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Sparkles size={14} className={isActive ? 'text-black' : 'text-[var(--text-dim)]'} />
                      <span className="font-semibold truncate">{aiText}</span>
                    </div>
                    <span className={`text-[10px] font-mono uppercase font-bold shrink-0 ${isActive ? 'text-black' : 'text-[var(--text-dim)]'}`}>
                      ASK
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {flatItems.length === 0 && (
            <div className="py-8 text-center text-[var(--text-dim)] font-mono text-xs">
              No matching pages or items found for &quot;{query}&quot;.
              <div className="mt-3">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    navigate('/chat', { state: { initialQuery: query.trim() } })
                  }}
                  className="btn-accent text-xs py-1.5 px-3"
                >
                  <Sparkles size={13} /> Ask AI Assistant &quot;{query}&quot;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-[var(--bg-surface-elevated)] border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-dim)] font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] font-bold">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] font-bold">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <span>[BusinessGPT OS]</span>
        </div>
      </div>
    </div>
  )
}
