import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  MessageSquare,
  BarChart2,
  FileText,
  Bell,
  Settings,
  Sparkles,
  Package,
  ArrowRight,
  CornerDownLeft,
  X
} from 'lucide-react'
import { posAPI } from '../services/api'

const PAGES = [
  { id: 'dash', title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'Pages' },
  { id: 'pos', title: 'Point of Sale (POS)', path: '/pos', icon: ShoppingCart, category: 'Pages' },
  { id: 'inv', title: 'Inventory Management', path: '/inventory', icon: Boxes, category: 'Pages' },
  { id: 'chat', title: 'AI Assistant Chat', path: '/chat', icon: MessageSquare, category: 'Pages' },
  { id: 'analytics', title: 'Sales Analytics & ML', path: '/analytics', icon: BarChart2, category: 'Pages' },
  { id: 'reports', title: 'Reports & Export', path: '/reports', icon: FileText, category: 'Pages' },
  { id: 'alerts', title: 'Stock & System Alerts', path: '/alerts', icon: Bell, category: 'Pages' },
  { id: 'settings', title: 'Store Settings', path: '/settings', icon: Settings, category: 'Pages' },
]

const AI_QUERIES = [
  'Aaj ki sales summary',
  'Critical stock products',
  'Is hafte ka forecast',
  'Business health score',
  'Pending alerts',
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
          setProducts(res.data.slice(0, 6)) // top 6 products
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

  // Filter Pages
  const filteredPages = useMemo(() => {
    if (!query.trim()) return PAGES
    const q = query.toLowerCase()
    return PAGES.filter((p) => p.title.toLowerCase().includes(q))
  }, [query])

  // Filter AI Queries
  const filteredAiQueries = useMemo(() => {
    if (!query.trim()) return AI_QUERIES
    const q = query.toLowerCase()
    return AI_QUERIES.filter((item) => item.toLowerCase().includes(q))
  }, [query])

  // Build unified items list for keyboard navigation
  const allItems = useMemo(() => {
    const items = []

    filteredPages.forEach((page) => {
      items.push({
        type: 'PAGE',
        id: `page-${page.id}`,
        title: page.title,
        data: page,
      })
    })

    filteredAiQueries.forEach((qText, idx) => {
      items.push({
        type: 'AI_QUERY',
        id: `ai-${idx}`,
        title: qText,
        data: qText,
      })
    })

    products.forEach((prod) => {
      items.push({
        type: 'PRODUCT',
        id: `prod-${prod.id}`,
        title: prod.name,
        data: prod,
      })
    })

    return items
  }, [filteredPages, filteredAiQueries, products])

  // Ensure selectedIndex is within range
  useEffect(() => {
    if (selectedIndex >= allItems.length) {
      setSelectedIndex(Math.max(0, allItems.length - 1))
    }
  }, [allItems.length, selectedIndex])

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]')
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  const handleSelectItem = (item) => {
    if (!item) return
    setIsOpen(false)

    if (item.type === 'PAGE') {
      navigate(item.data.path)
    } else if (item.type === 'AI_QUERY') {
      navigate('/chat', { state: { initialQuery: item.data } })
    } else if (item.type === 'PRODUCT') {
      // Navigate to POS or inventory with product highlighted
      navigate('/inventory', { state: { searchProduct: item.data.name } })
    }
  }

  // Handle keyboard events in input
  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1 < allItems.length ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allItems.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allItems[selectedIndex]) {
        handleSelectItem(allItems[selectedIndex])
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-md transition-opacity"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[var(--border-color)] gap-3 bg-[var(--bg-surface)]">
          <Search size={18} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command, ask AI, or search products..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] font-medium"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
          <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] px-1.5 py-0.5 rounded">
            <span>ESC</span>
          </div>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-4">
          {allItems.length === 0 && !isSearchingProducts && (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] font-mono">
              No matching pages, queries, or products found.
            </div>
          )}

          {/* Section: NAVIGATION */}
          {filteredPages.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
                Navigation
              </div>
              <div className="space-y-0.5">
                {filteredPages.map((page) => {
                  const globalIdx = allItems.findIndex((it) => it.id === `page-${page.id}`)
                  const isSelected = globalIdx === selectedIndex
                  const Icon = page.icon
                  return (
                    <div
                      key={page.id}
                      data-active={isSelected}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      onClick={() => handleSelectItem(allItems[globalIdx])}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className={isSelected ? 'text-white' : 'text-[var(--text-muted)]'} />
                        <span>{page.title}</span>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1 text-[10px] opacity-80 font-mono">
                          <span>Open</span>
                          <CornerDownLeft size={11} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section: AI QUICK QUERIES */}
          {filteredAiQueries.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-blue-500 flex items-center gap-1.5">
                <Sparkles size={11} />
                <span>AI Quick Queries</span>
              </div>
              <div className="space-y-0.5">
                {filteredAiQueries.map((qText, idx) => {
                  const globalIdx = allItems.findIndex((it) => it.id === `ai-${idx}`)
                  const isSelected = globalIdx === selectedIndex
                  return (
                    <div
                      key={`ai-${idx}`}
                      data-active={isSelected}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      onClick={() => handleSelectItem(allItems[globalIdx])}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sparkles size={14} className={isSelected ? 'text-white' : 'text-blue-500'} />
                        <span>"{qText}"</span>
                      </div>
                      {isSelected ? (
                        <div className="flex items-center gap-1 text-[10px] opacity-80 font-mono">
                          <span>Run Query</span>
                          <CornerDownLeft size={11} />
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">Ask AI</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section: PRODUCTS */}
          {products.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-emerald-500 flex items-center gap-1.5">
                <Package size={11} />
                <span>Products ({products.length})</span>
              </div>
              <div className="space-y-0.5">
                {products.map((prod) => {
                  const globalIdx = allItems.findIndex((it) => it.id === `prod-${prod.id}`)
                  const isSelected = globalIdx === selectedIndex
                  return (
                    <div
                      key={`prod-${prod.id}`}
                      data-active={isSelected}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      onClick={() => handleSelectItem(allItems[globalIdx])}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Package size={14} className={isSelected ? 'text-white' : 'text-emerald-500 shrink-0'} />
                        <span className="truncate">{prod.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'}`}>
                          {prod.sku}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-semibold">₹{prod.unit_price}</span>
                        <span className={`text-[10px] font-mono ${prod.current_stock <= prod.reorder_point ? 'text-amber-400 font-bold' : isSelected ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                          Stock: {prod.current_stock}
                        </span>
                        {isSelected && <ArrowRight size={12} className="opacity-80" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 bg-[var(--bg-surface-elevated)] border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="bg-[var(--bg-surface)] border border-[var(--border-color)] px-1 rounded text-[10px]">↑</kbd>
              <kbd className="bg-[var(--bg-surface)] border border-[var(--border-color)] px-1 rounded text-[10px]">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-[var(--bg-surface)] border border-[var(--border-color)] px-1.5 rounded text-[10px]">↵</kbd>
              Select
            </span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-[var(--bg-surface)] border border-[var(--border-color)] px-1.5 rounded text-[10px]">Esc</kbd>
            Close
          </div>
        </div>
      </div>
    </div>
  )
}
