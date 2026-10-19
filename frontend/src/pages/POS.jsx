import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { posAPI, settingsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import PrintModal from '../components/PrintModal'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  CheckCircle,
  X,
  Package,
  AlertTriangle,
  RotateCcw
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function POS() {
  const { user } = useAuth()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [taxRate, setTaxRate] = useState(0.05) // 5% default GST
  const [submitting, setSubmitting] = useState(false)
  const [completedBill, setCompletedBill] = useState(null)
  const [lastBill, setLastBill] = useState(null)
  const [showBillModal, setShowBillModal] = useState(false)
  const [storeSettings, setStoreSettings] = useState({
    business_name: 'Bharat General Store & Supermart',
    address: 'Shop No. 12, Main Market, MG Road, Mumbai 400001',
    gstin: '27AABCB1234F1Z5',
  })

  const searchInputRef = useRef(null)

  // Load store settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await settingsAPI.getSettings()
        if (res.data) setStoreSettings(res.data)
      } catch (err) {
        // Fallback to default
      }
    }
    fetchSettings()
  }, [])

  // Fetch products
  const fetchProducts = async (q = searchQuery, cat = selectedCategory) => {
    try {
      setLoading(true)
      const res = await posAPI.searchProducts(q, cat)
      setProducts(res.data)
    } catch (err) {
      toast.error('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts(searchQuery, selectedCategory)
  }, [searchQuery, selectedCategory])

  // Cart operations
  const addToCart = (product) => {
    if (product.current_stock <= 0) {
      toast.error(`'${product.name}' is out of stock!`)
      return
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id)
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          toast.error(`Only ${product.current_stock} units available in stock.`)
          return prev
        }
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        )
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            sku: product.sku,
            unit_price: product.unit_price,
            quantity: 1,
            unit: product.unit,
            max_stock: product.current_stock,
            subtotal: product.unit_price,
          },
        ]
      }
    })
  }

  const updateQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta
            if (newQty > item.max_stock) {
              toast.error(`Maximum stock reached (${item.max_stock} units).`)
              return item
            }
            if (newQty <= 0) return null
            return {
              ...item,
              quantity: newQty,
              subtotal: Math.round(newQty * item.unit_price * 100) / 100,
            }
          }
          return item
        })
        .filter(Boolean)
    )
  }

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId))
  }

  const clearCart = () => {
    setCart([])
  }

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100

  // Keyboard shortcuts: F2 = search, Esc = clear cart, Ctrl+P = print last bill
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (e.key === 'Escape') {
        if (showBillModal) {
          setShowBillModal(false)
        } else if (cart.length > 0) {
          clearCart()
          toast('Cart cleared', { icon: '🧹' })
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        const targetBill = completedBill || lastBill
        if (targetBill) {
          setCompletedBill(targetBill)
          setShowBillModal(true)
        } else {
          toast.error('No bill to print yet.')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showBillModal, cart, completedBill, lastBill])

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty. Add products to generate a bill.')
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        items: cart.map((c) => ({
          product_id: c.product_id,
          quantity: c.quantity,
          unit_price: c.unit_price,
        })),
        payment_method: paymentMethod,
        tax_rate: taxRate,
      }

      const res = await posAPI.createBill(payload)
      setCompletedBill(res.data)
      setLastBill(res.data)
      setShowBillModal(true)
      clearCart()
      toast.success(`Bill ${res.data.bill_number} generated successfully!`)
      // Refresh products to update live stock count
      fetchProducts(searchQuery, selectedCategory)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to complete transaction.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const categories = ['All', 'Grocery', 'Snacks', 'Personal Care', 'Dairy', 'Household']

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-3 h-[calc(100vh-5.5rem)]"
    >
      <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0">
      {/* ── LEFT PANEL (60%): Product Search & Grid ── */}
      <div className="flex-[3] flex flex-col os-surface overflow-hidden">
        {/* Search & Category Filter Header */}
        <div className="p-4 border-b border-[var(--border-color)] space-y-3 bg-[var(--bg-surface)]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product by name or SKU (e.g., Basmati, GROC-001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => {
              const active = (cat === 'All' && !selectedCategory) || selectedCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === 'All' ? '' : cat)}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-[var(--bg-surface-elevated)] animate-pulse border border-[var(--border-color)]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
              <Package size={36} className="mb-2 opacity-50" />
              <p className="text-xs font-medium">No products found matching your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p) => {
                const isOutOfStock = p.current_stock <= 0
                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer group ${
                      isOutOfStock
                        ? 'opacity-40 border-[var(--border-color)] bg-[var(--bg-surface)] cursor-not-allowed'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:border-blue-500 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">{p.sku}</span>
                        {p.is_critical ? (
                          <span className="badge-critical">Critical</span>
                        ) : p.is_low_stock ? (
                          <span className="badge-low">Low Stock</span>
                        ) : (
                          <span className="badge-optimal">In Stock</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-xs text-[var(--text-main)] line-clamp-2 mb-1 group-hover:text-blue-500 transition-colors">
                        {p.name}
                      </h3>
                      <div className="text-[11px] text-[var(--text-muted)]">{p.category}</div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[var(--border-color)] flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-[var(--text-muted)]">Price</span>
                        <span className="text-sm font-bold text-[var(--text-main)] font-mono">
                          ₹{p.unit_price.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[var(--text-muted)]">Stock:</span>
                        <span className="text-xs font-semibold font-mono ml-1 text-[var(--text-main)]">
                          {p.current_stock} {p.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL (40%): Cart & Fast Checkout ── */}
      <div className="flex-[2] flex flex-col os-surface overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <Receipt size={17} className="text-blue-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-main)]">Current Bill</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold">
              {cart.reduce((total, i) => total + i.quantity, 0)} items
            </span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[11px] text-[var(--text-muted)] hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              Clear (Esc)
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)]">
              <Receipt size={32} className="mb-2 opacity-30" />
              <p className="text-xs font-medium">Cart is empty</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Click any product to add to cart</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product_id}
                className="p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[var(--text-main)] truncate">{item.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">
                    ₹{item.unit_price.toFixed(2)} × {item.quantity}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md px-1 py-0.5">
                  <button
                    onClick={() => updateQuantity(item.product_id, -1)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center font-mono font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product_id, 1)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Subtotal & Delete */}
                <div className="text-right flex items-center gap-2">
                  <span className="font-bold font-mono text-[var(--text-main)]">₹{item.subtotal.toFixed(2)}</span>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="text-[var(--text-muted)] hover:text-red-500 cursor-pointer p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Calculation & Payment Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] space-y-3">
          {/* GST Selection */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">GST Slab:</span>
            <div className="flex items-center gap-1">
              {[0, 0.05, 0.12, 0.18, 0.28].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setTaxRate(rate)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium cursor-pointer ${
                    taxRate === rate
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)]'
                  }`}
                >
                  {(rate * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>

          {/* Subtotal & Tax */}
          <div className="space-y-1 text-xs pt-1 border-t border-[var(--border-color)]">
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Items Subtotal:</span>
              <span className="font-mono">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>GST ({(taxRate * 100).toFixed(0)}%):</span>
              <span className="font-mono">₹{taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[var(--text-main)] pt-1 border-t border-[var(--border-color)]">
              <span>Total Payable:</span>
              <span className="font-mono text-base text-blue-500">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { id: 'UPI', label: 'UPI / QR', icon: QrCode },
              { id: 'Cash', label: 'Cash', icon: Banknote },
              { id: 'Card', label: 'Card', icon: CreditCard },
            ].map((pm) => {
              const Icon = pm.icon
              const isSelected = paymentMethod === pm.id
              return (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`py-2 px-1 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <Icon size={14} />
                  <span>{pm.label}</span>
                </button>
              )
            })}
          </div>

          {/* Generate Bill Button */}
          <button
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0}
            className="w-full btn-accent py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-blue-500/20"
          >
            {submitting ? 'Generating Bill...' : `Generate Bill (₹${grandTotal.toFixed(2)})`}
          </button>
        </div>
      </div>
      </div>

      {/* ── SHORTCUT HINT BAR AT BOTTOM ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-xs font-mono text-[var(--text-muted)] shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <kbd className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] px-1.5 py-0.5 rounded font-bold text-[var(--text-main)]">[F2]</kbd>
            <span>Search</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] px-1.5 py-0.5 rounded font-bold text-[var(--text-main)]">[Esc]</kbd>
            <span>Clear</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] px-1.5 py-0.5 rounded font-bold text-[var(--text-main)]">[Ctrl+P]</kbd>
            <span>Print</span>
          </span>
        </div>
        <span className="hidden md:inline text-[11px] text-[var(--text-muted)]">Thermal 80mm Active</span>
      </div>

      {/* ── 80MM THERMAL RECEIPT PRINT MODAL ── */}
      <PrintModal
        bill={completedBill}
        storeSettings={storeSettings}
        cashierName={completedBill?.employee_name || user?.name}
        isOpen={showBillModal}
        onClose={() => setShowBillModal(false)}
        autoPrint={true}
      />
    </motion.div>
  )
}
