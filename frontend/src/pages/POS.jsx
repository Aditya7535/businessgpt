import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { posAPI, settingsAPI, customerAPI } from '../services/api'
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
  CheckCircle2,
  X,
  Package,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  User,
  UserCheck,
  UserPlus,
  Check,
  Contact,
  Edit2,
  ShieldAlert,
  Save
} from 'lucide-react'
import toast from 'react-hot-toast'

const isPhoneValid = (phone) => {
  if (!phone || !String(phone).trim()) return false
  const str = String(phone).trim()
  if (/[a-zA-Z]/.test(str)) return false
  const digits = str.replace(/[^\d]/g, '')
  return digits.length >= 10 && digits.length <= 15
}

const isEmailValid = (email) => {
  if (!email || !String(email).trim()) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

const FIELD_CONFIG_METADATA = {
  full_name: { label: 'Full name', placeholder: 'e.g. Ramesh Sharma', type: 'text' },
  phone: { label: 'Mobile number', placeholder: 'e.g. 9876543210', type: 'tel' },
  email: { label: 'Email address', placeholder: 'e.g. ramesh@example.com', type: 'email' },
  billing_address: { label: 'Billing address', placeholder: 'Street, City, Pincode', type: 'text' },
  date_of_birth: { label: 'Date of birth', placeholder: 'YYYY-MM-DD', type: 'date' },
  notes: { label: 'Customer notes', placeholder: 'Preferences or remarks', type: 'text' }
}

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
  const [cashTendered, setCashTendered] = useState('')

  const [storeSettings, setStoreSettings] = useState({
    business_name: 'Bharat General Store & Supermart',
    address: 'Shop No. 12, Main Market, MG Road, Mumbai 400001',
    gstin: '27AABCB1234F1Z5',
  })

  // Customer Information CRM State
  const [customerSettings, setCustomerSettings] = useState({
    enabled: false,
    allow_walk_in: true,
    customer_selection_optional: true,
    save_purchase_history: false,
    require_consent: false,
    enabled_fields: ['full_name', 'phone'],
    required_fields: []
  })

  // Customer Selection / Form Mode: 'walk_in' | 'select' | 'new'
  const [customerMode, setCustomerMode] = useState('walk_in')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)

  // New Customer Form State
  const [newCustomerForm, setNewCustomerForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    billing_address: '',
    date_of_birth: '',
    notes: '',
    consent_given: false
  })
  const [touchedFields, setTouchedFields] = useState({})

  // Edit Customer Modal State
  const [showEditModal, setShowEditModal] = useState(false)
  const [editCustomerForm, setEditCustomerForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  const searchInputRef = useRef(null)

  // Load store settings & customer collection configuration on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [storeRes, custRes] = await Promise.allSettled([
          settingsAPI.getSettings(),
          customerAPI.getSettings()
        ])
        if (storeRes.status === 'fulfilled' && storeRes.value.data) {
          setStoreSettings(storeRes.value.data)
        }
        if (custRes.status === 'fulfilled' && custRes.value.data) {
          const cfg = custRes.value.data
          setCustomerSettings(cfg)

          // If required fields exist, walk-in cannot bypass them -> switch mode to 'new' or 'select'
          const hasRequiredFields = (cfg.required_fields || []).length > 0
          if (cfg.enabled && (hasRequiredFields || !cfg.allow_walk_in)) {
            setCustomerMode('new')
          } else {
            setCustomerMode('walk_in')
          }
        }
      } catch (err) {
        // Fallback to default
      }
    }
    fetchSettings()
  }, [])

  // Customer search debouncer
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.trim().length < 2) {
      setCustomerResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        setSearchingCustomer(true)
        const res = await customerAPI.searchCustomers(customerSearch.trim())
        setCustomerResults(res.data || [])
      } catch (err) {
        setCustomerResults([])
      } finally {
        setSearchingCustomer(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [customerSearch])

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

  // Extract unique categories
  const categories = ['All', ...new Set(products.map((p) => p.category).filter(Boolean))]

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
            unit_price: Number(product.unit_price),
            quantity: 1,
            unit: product.unit || 'pcs',
            max_stock: product.current_stock,
            subtotal: Number(product.unit_price),
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
            const nextQty = item.quantity + delta
            if (nextQty <= 0) return null
            if (nextQty > item.max_stock) {
              toast.error(`Max stock available is ${item.max_stock}.`)
              return item
            }
            return {
              ...item,
              quantity: nextQty,
              subtotal: nextQty * item.unit_price,
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
    if (cart.length > 0) {
      setCart([])
      setCashTendered('')
    }
  }

  // Customer selection helpers
  const handleSelectCustomer = (cust) => {
    setSelectedCustomer(cust)
    setCustomerMode('select')
    setShowCustomerSearch(false)
    setCustomerSearch('')
  }

  const handleClearCustomer = () => {
    setSelectedCustomer(null)
    const hasRequired = (customerSettings.required_fields || []).length > 0
    if (!customerSettings.enabled || (customerSettings.allow_walk_in && !hasRequired)) {
      setCustomerMode('walk_in')
    } else {
      setCustomerMode('new')
    }
    setNewCustomerForm({
      full_name: '',
      phone: '',
      email: '',
      billing_address: '',
      date_of_birth: '',
      notes: '',
      consent_given: false
    })
    setTouchedFields({})
  }

  // Edit selected customer
  const handleOpenEditModal = () => {
    if (!selectedCustomer) return
    setEditCustomerForm({
      full_name: selectedCustomer.full_name || '',
      phone: selectedCustomer.phone || '',
      email: selectedCustomer.email || '',
      billing_address: selectedCustomer.billing_address || '',
      date_of_birth: selectedCustomer.date_of_birth || '',
      notes: selectedCustomer.notes || '',
      consent_given: Boolean(selectedCustomer.consent_given)
    })
    setShowEditModal(true)
  }

  const handleSaveEditCustomer = async (e) => {
    e.preventDefault()
    try {
      setSavingEdit(true)
      const res = await customerAPI.updateCustomer(selectedCustomer.id, editCustomerForm)
      setSelectedCustomer(res.data)
      setShowEditModal(false)
      toast.success('Customer details updated!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update customer details.')
    } finally {
      setSavingEdit(false)
    }
  }

  // Financial calculations
  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0)
  const taxAmount = subtotal * taxRate
  const grandTotal = subtotal + taxAmount
  const changeDue = Math.max(0, Number(cashTendered || 0) - grandTotal)

  // ── STRICT CUSTOMER VALIDATION BEFORE BILL GENERATION ──
  const isWalkInPermitted = useMemo(() => {
    if (!customerSettings.enabled) return true
    const requiredList = customerSettings.required_fields || []
    return customerSettings.allow_walk_in && requiredList.length === 0
  }, [customerSettings])

  // Selected customer validation (does selected customer satisfy all required fields?)
  const selectedCustomerValidationErrors = useMemo(() => {
    if (!customerSettings.enabled || customerMode !== 'select' || !selectedCustomer) return []
    const required = customerSettings.required_fields || []
    const errors = []

    for (const req of required) {
      const val = selectedCustomer[req]
      if (!val || !String(val).trim()) {
        const label = FIELD_CONFIG_METADATA[req]?.label || req
        errors.push(`${label} is required by store policy. Click Edit to complete details.`)
      }
    }

    if (required.includes('phone') && selectedCustomer.phone && !isPhoneValid(selectedCustomer.phone)) {
      errors.push('Mobile number is invalid. Click Edit to update.')
    }

    return errors
  }, [customerSettings, customerMode, selectedCustomer])

  // New Customer Form Validation
  const newCustomerValidationErrors = useMemo(() => {
    if (!customerSettings.enabled || customerMode !== 'new') return {}
    const required = customerSettings.required_fields || []
    const errors = {}

    for (const req of required) {
      const val = newCustomerForm[req]
      if (!val || !String(val).trim()) {
        errors[req] = `${FIELD_CONFIG_METADATA[req]?.label || req} is required.`
      }
    }

    // Phone format check
    if (newCustomerForm.phone && newCustomerForm.phone.trim()) {
      if (!isPhoneValid(newCustomerForm.phone)) {
        errors.phone = 'Please enter a valid 10-digit mobile number.'
      }
    }

    // Email format check
    if (newCustomerForm.email && newCustomerForm.email.trim()) {
      if (!isEmailValid(newCustomerForm.email)) {
        errors.email = 'Please enter a valid email address.'
      }
    }

    // Consent check
    if (customerSettings.require_consent && !newCustomerForm.consent_given) {
      errors.consent = 'Customer consent must be confirmed.'
    }

    return errors
  }, [customerSettings, customerMode, newCustomerForm])

  // Master checkout readiness boolean
  const isCustomerInfoValid = useMemo(() => {
    if (!customerSettings.enabled) return true

    if (customerMode === 'walk_in') {
      return isWalkInPermitted
    }

    if (customerMode === 'select') {
      return Boolean(selectedCustomer) && selectedCustomerValidationErrors.length === 0
    }

    if (customerMode === 'new') {
      return Object.keys(newCustomerValidationErrors).length === 0
    }

    return false
  }, [
    customerSettings.enabled,
    customerMode,
    isWalkInPermitted,
    selectedCustomer,
    selectedCustomerValidationErrors,
    newCustomerValidationErrors
  ])

  // Submit Bill
  const handleCheckout = async () => {
    if (cart.length === 0 || submitting) return

    if (!isCustomerInfoValid) {
      if (customerMode === 'walk_in' && !isWalkInPermitted) {
        toast.error('Walk-in billing is not permitted when required customer fields are configured.')
      } else if (customerMode === 'select' && selectedCustomerValidationErrors.length > 0) {
        toast.error(selectedCustomerValidationErrors[0])
      } else if (customerMode === 'new') {
        const firstErr = Object.values(newCustomerValidationErrors)[0]
        toast.error(firstErr || 'Please complete all required customer fields before generating bill.')
      } else {
        toast.error('Please select or provide customer information before generating bill.')
      }
      return
    }

    if (paymentMethod === 'Cash' && cashTendered && Number(cashTendered) < grandTotal) {
      toast.error(`Tendered cash is less than grand total ₹${grandTotal.toFixed(2)}`)
      return
    }

    // Prepare Customer Payload
    let customerIdToSend = null
    let customerDataToSend = null

    if (customerSettings.enabled) {
      if (customerMode === 'select' && selectedCustomer) {
        customerIdToSend = selectedCustomer.id
      } else if (customerMode === 'new') {
        const enabledFields = new Set(customerSettings.enabled_fields || [])
        customerDataToSend = {
          consent_given: Boolean(newCustomerForm.consent_given)
        }
        for (const f of enabledFields) {
          if (newCustomerForm[f]) customerDataToSend[f] = String(newCustomerForm[f]).trim()
        }
      }
    }

    try {
      setSubmitting(true)
      const payload = {
        items: cart.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        })),
        payment_method: paymentMethod,
        tax_rate: taxRate,
        customer_id: customerIdToSend,
        customer_data: customerDataToSend,
        notes: ''
      }

      const res = await posAPI.createBill(payload)
      const billData = res.data
      setCompletedBill(billData)
      setLastBill(billData)
      setShowBillModal(true)
      toast.success(`Bill #${billData.bill_number || billData.id} generated successfully!`)

      // Reset cart and customer state for next customer
      setCart([])
      setCashTendered('')
      handleClearCustomer()

      // Refresh products to show updated stock
      fetchProducts()
    } catch (err) {
      console.error('Checkout error:', err)
      const msg = err.response?.data?.detail || 'Transaction failed.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="h-[calc(100vh-6.5rem)] flex flex-col lg:flex-row gap-4"
    >
      {/* ── Left Column: Product Catalog & Fast Grid ── */}
      <div className="flex-1 flex flex-col card p-0 border-2 border-[var(--border-color)] overflow-hidden bg-[var(--bg-surface)] shadow-[4px_4px_0px_var(--border-color)]">
        {/* Catalog Header & Search */}
        <div className="p-3.5 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface-elevated)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold block">
                Chapter 01 · Immediate Counter Register
              </span>
              <h2 className="text-base font-extrabold uppercase tracking-tight text-[var(--text-main)] font-display">
                Point of Sale Terminal
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {lastBill && (
                <button
                  onClick={() => {
                    setCompletedBill(lastBill)
                    setShowBillModal(true)
                  }}
                  className="btn-secondary text-xs py-1 px-2.5 cursor-pointer font-bold font-mono uppercase tracking-wider"
                  title="Reprint last receipt"
                >
                  <Printer size={13} className="stroke-[2.2]" />
                  <span>Reprint #{lastBill.bill_number || lastBill.id}</span>
                </button>
              )}
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 bg-[var(--bg-surface)] border-2 border-[var(--border-color)] rounded-[3px] px-3 py-1.5 focus-within:border-[var(--accent)] transition-all shadow-[1px_1px_0px_var(--border-color)]">
            <Search size={15} className="text-[var(--text-dim)] shrink-0 stroke-[2.2]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name, SKU, or category..."
              className="w-full bg-transparent border-none text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[var(--text-dim)] hover:text-[var(--text-main)]">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => {
              const isActive = selectedCategory === (cat === 'All' ? '' : cat)
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === 'All' ? '' : cat)}
                  className={`px-2.5 py-1 rounded-[3px] text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--border-strong)] shadow-[1px_1px_0px_var(--border-strong)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-color)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-3.5">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="skeleton h-28 rounded-[3px]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-dim)] gap-2 py-12">
              <Package size={28} className="opacity-40 stroke-[2]" />
              <p className="text-xs font-bold font-mono uppercase tracking-wider">No products match your query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((prod) => {
                const inCart = cart.find((it) => it.product_id === prod.id)
                const isOutOfStock = prod.current_stock <= 0
                const isLow = prod.current_stock <= (prod.reorder_point || 10)

                return (
                  <div
                    key={prod.id}
                    onClick={() => !isOutOfStock && addToCart(prod)}
                    className={`p-3 border-2 transition-all flex flex-col justify-between cursor-pointer group relative rounded-[3px] ${
                      isOutOfStock
                        ? 'opacity-40 cursor-not-allowed border-[var(--border-color)] bg-[var(--bg-surface-elevated)]'
                        : inCart
                        ? 'border-[var(--border-strong)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-[2px_2px_0px_var(--border-strong)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:shadow-[3px_3px_0px_var(--border-color)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase truncate font-bold">
                          {prod.category}
                        </span>
                        {isOutOfStock ? (
                          <span className="badge-critical text-[9px] px-1 py-0.2 rounded-[2px]">Out</span>
                        ) : isLow ? (
                          <span className="badge-low text-[9px] px-1 py-0.2 rounded-[2px]">Low</span>
                        ) : null}
                      </div>

                      <h4 className="font-bold text-xs text-[var(--text-main)] group-hover:text-[var(--border-strong)] transition-colors line-clamp-2 uppercase font-display">
                        {prod.name}
                      </h4>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[var(--border-color)] flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs sm:text-sm font-extrabold text-[var(--text-main)]">
                          ₹{prod.unit_price}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-dim)] font-bold">
                          Stock: {prod.current_stock}
                        </span>
                      </div>

                      <div className="p-1 rounded-[2px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] group-hover:border-[var(--border-strong)] transition-all">
                        <Plus size={13} className="stroke-[2.5]" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Column: Live Checkout Docket & Customer Information Step ── */}
      <div className="w-full lg:w-[420px] flex flex-col card p-0 border-2 border-[var(--border-color)] overflow-hidden bg-[var(--bg-surface)] shrink-0 shadow-[4px_4px_0px_var(--border-color)]">
        {/* Cart Header */}
        <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-[var(--accent)]" />
            <h3 className="font-bold text-xs text-[var(--text-main)] uppercase font-mono">
              Billing Docket
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] font-semibold">
              {cart.reduce((a, b) => a + b.quantity, 0)} items
            </span>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[10px] font-mono text-red-500 hover:underline cursor-pointer"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* ── SECTION: CUSTOMER INFORMATION FORM BEFORE BILL GENERATION ── */}
        {customerSettings.enabled && (
          <div className="p-3.5 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface-elevated)] space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Contact size={15} className="text-[var(--accent)]" />
                <h4 className="font-extrabold text-xs text-[var(--text-main)] font-display uppercase tracking-tight">
                  Customer Information
                </h4>
              </div>

              {/* Validation Status Pill */}
              <span
                className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold border uppercase tracking-wider ${
                  isCustomerInfoValid
                    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-500 border-amber-500/40 animate-pulse'
                }`}
              >
                {isCustomerInfoValid ? '✓ Validated' : '⚠ Required info needed'}
              </span>
            </div>

            {/* Selection Mode Tabs: Walk-in (if permitted) | Existing Customer | Add New */}
            <div className="grid grid-cols-3 gap-1 bg-[var(--bg-surface)] p-1 rounded border border-[var(--border-color)] text-[10px] font-mono">
              {/* Tab 1: Walk-in */}
              <button
                type="button"
                disabled={!isWalkInPermitted}
                onClick={() => {
                  setCustomerMode('walk_in')
                  setSelectedCustomer(null)
                }}
                className={`py-1 px-1.5 rounded font-bold transition-all text-center truncate ${
                  customerMode === 'walk_in'
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-[1px_1px_0px_var(--border-strong)]'
                    : isWalkInPermitted
                    ? 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    : 'text-[var(--text-dim)] opacity-40 cursor-not-allowed'
                }`}
                title={!isWalkInPermitted ? 'Walk-in is disabled when required customer fields are configured' : 'Fast anonymous checkout'}
              >
                Walk-in {!isWalkInPermitted && '(Locked)'}
              </button>

              {/* Tab 2: Existing Search */}
              <button
                type="button"
                onClick={() => {
                  setCustomerMode('select')
                  setShowCustomerSearch(true)
                }}
                className={`py-1 px-1.5 rounded font-bold transition-all text-center truncate ${
                  customerMode === 'select'
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-[1px_1px_0px_var(--border-strong)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Existing
              </button>

              {/* Tab 3: New Customer */}
              <button
                type="button"
                onClick={() => {
                  setCustomerMode('new')
                  setSelectedCustomer(null)
                }}
                className={`py-1 px-1.5 rounded font-bold transition-all text-center truncate ${
                  customerMode === 'new'
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-[1px_1px_0px_var(--border-strong)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                + New Client
              </button>
            </div>

            {/* Mode 1: Walk-in Notice */}
            {customerMode === 'walk_in' && (
              <div className="p-2.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Anonymous Walk-in Billing Permitted
                </span>
                <span className="text-emerald-500 text-[10px] font-bold font-mono">● Ready</span>
              </div>
            )}

            {/* Mode 2: Existing Customer Search & Selection */}
            {customerMode === 'select' && (
              <div className="space-y-2">
                {selectedCustomer ? (
                  <div className="p-2.5 rounded bg-[var(--bg-surface)] border-2 border-emerald-500/50 space-y-1.5 shadow-[2px_2px_0px_rgba(16,185,129,0.3)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-[10px] shrink-0">
                          <UserCheck size={13} />
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-xs text-[var(--text-main)] truncate">
                            {selectedCustomer.full_name || 'Customer'}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                            {selectedCustomer.phone || selectedCustomer.email || 'Registered Client'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleOpenEditModal}
                          className="p-1 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer"
                          title="Edit Customer Information"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={handleClearCustomer}
                          className="p-1 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-dim)] hover:text-red-500 cursor-pointer"
                          title="Unlink Customer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Validation Errors for Selected Customer */}
                    {selectedCustomerValidationErrors.length > 0 && (
                      <div className="p-2 rounded bg-red-500/10 border border-red-500/40 text-[10px] text-red-500 font-mono space-y-0.5">
                        <div className="font-bold flex items-center gap-1">
                          <ShieldAlert size={12} />
                          <span>Missing Required Information:</span>
                        </div>
                        {selectedCustomerValidationErrors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border-2 border-[var(--border-color)] rounded p-1.5 focus-within:border-[var(--accent)]">
                      <Search size={13} className="text-[var(--text-dim)] shrink-0" />
                      <input
                        type="text"
                        placeholder="Search existing customer by name or phone..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value)
                          setShowCustomerSearch(true)
                        }}
                        onFocus={() => setShowCustomerSearch(true)}
                        className="w-full bg-transparent border-none text-[11px] font-mono text-[var(--text-main)] focus:outline-none"
                      />
                      {customerSearch && (
                        <button onClick={() => setCustomerSearch('')} className="text-[var(--text-dim)]">
                          <X size={11} />
                        </button>
                      )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showCustomerSearch && customerResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] rounded shadow-2xl z-30 max-h-48 overflow-y-auto divide-y divide-[var(--border-color)]">
                        {customerResults.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className="p-2 hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] cursor-pointer transition-colors flex items-center justify-between text-[11px] group"
                          >
                            <div className="min-w-0">
                              <div className="font-bold truncate">{c.full_name || 'Customer'}</div>
                              <div className="text-[10px] font-mono opacity-80">{c.phone || c.email}</div>
                            </div>
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] group-hover:border-transparent">
                              Select
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {showCustomerSearch && customerSearch.length >= 2 && !searchingCustomer && customerResults.length === 0 && (
                      <div className="p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded mt-1 text-[10px] font-mono text-[var(--text-muted)] text-center">
                        No customer matching "{customerSearch}".
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Add New Customer Form (Dynamically Renders ONLY Enabled Fields) */}
            {customerMode === 'new' && (
              <div className="space-y-2 p-2.5 rounded bg-[var(--bg-surface)] border-2 border-[var(--border-color)]">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-dim)] border-b border-[var(--border-subtle)] pb-1 flex items-center justify-between">
                  <span>Enter Customer Details</span>
                  <span className="text-red-500 text-[9px]">* Required by store</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  {customerSettings.enabled_fields?.map((fieldKey) => {
                    const meta = FIELD_CONFIG_METADATA[fieldKey]
                    if (!meta) return null
                    const isRequired = customerSettings.required_fields?.includes(fieldKey)
                    const errorMsg = newCustomerValidationErrors[fieldKey]
                    const isTouched = touchedFields[fieldKey]

                    return (
                      <div key={fieldKey} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-[var(--text-muted)] font-medium">
                            {meta.label} {isRequired ? <span className="text-red-500 font-bold">*</span> : <span className="text-[9px] text-[var(--text-dim)]">(Optional)</span>}
                          </label>
                          {isTouched && errorMsg && (
                            <span className="text-[9px] font-mono text-red-500 font-bold">
                              {errorMsg}
                            </span>
                          )}
                        </div>

                        <input
                          type={meta.type}
                          placeholder={meta.placeholder}
                          value={newCustomerForm[fieldKey] || ''}
                          onChange={(e) => {
                            setNewCustomerForm({ ...newCustomerForm, [fieldKey]: e.target.value })
                            setTouchedFields({ ...touchedFields, [fieldKey]: true })
                          }}
                          onBlur={() => setTouchedFields({ ...touchedFields, [fieldKey]: true })}
                          className={`w-full p-1.5 rounded bg-[var(--bg-surface-elevated)] border text-[11px] text-[var(--text-main)] font-mono focus:outline-none transition-colors ${
                            isTouched && errorMsg
                              ? 'border-red-500 focus:border-red-500 bg-red-500/5'
                              : 'border-[var(--border-color)] focus:border-[var(--accent)]'
                          }`}
                        />
                      </div>
                    )
                  })}

                  {/* Customer Consent Checkbox */}
                  {customerSettings.require_consent && (
                    <div className="pt-1">
                      <label className="flex items-start gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCustomerForm.consent_given}
                          onChange={(e) => {
                            setNewCustomerForm({ ...newCustomerForm, consent_given: e.target.checked })
                            setTouchedFields({ ...touchedFields, consent: true })
                          }}
                          className="mt-0.5 rounded text-[var(--accent)]"
                        />
                        <span className="text-[10px] text-[var(--text-main)]">
                          Customer agrees to record contact details for digital invoice & SMS <span className="text-red-500 font-bold">*</span>
                        </span>
                      </label>
                      {touchedFields.consent && newCustomerValidationErrors.consent && (
                        <div className="text-[9px] font-mono text-red-500 font-bold mt-0.5">
                          {newCustomerValidationErrors.consent}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-dim)] py-8 gap-2 text-center">
              <Receipt size={24} className="opacity-40" />
              <p className="text-xs font-medium">Cart docket is empty.</p>
              <span className="text-[10px] max-w-[200px]">
                Click any product on the catalog grid or scan barcode to add.
              </span>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product_id}
                className="p-2.5 rounded border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-[var(--text-main)] truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-dim)] mt-0.5">
                    ₹{item.unit_price} × {item.quantity} = ₹{item.subtotal.toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.product_id, -1)}
                    className="p-1 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--border-strong)]"
                  >
                    <Minus size={11} />
                  </button>

                  <span className="font-mono text-xs font-bold w-6 text-center">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => updateQuantity(item.product_id, 1)}
                    className="p-1 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--border-strong)]"
                  >
                    <Plus size={11} />
                  </button>

                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="p-1 rounded text-red-500 hover:bg-red-500/10 ml-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation & Settlement Controls */}
        <div className="p-3.5 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface-elevated)] space-y-3">
          {/* Tax rate selector */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)] font-mono uppercase font-bold tracking-wider text-[11px]">GST Rate:</span>
            <div className="flex gap-1">
              {[
                { label: '0%', val: 0.0 },
                { label: '5%', val: 0.05 },
                { label: '12%', val: 0.12 },
                { label: '18%', val: 0.18 },
              ].map((t) => (
                <button
                  key={t.val}
                  onClick={() => setTaxRate(t.val)}
                  className={`px-2 py-0.5 rounded-[2px] text-[11px] font-mono cursor-pointer font-bold transition-all ${
                    taxRate === t.val
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--border-strong)] shadow-[1px_1px_0px_var(--border-strong)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-color)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subtotal & Tax Breakup */}
          <div className="space-y-1 text-xs border-t border-[var(--border-subtle)] pt-2 font-mono">
            <div className="flex justify-between text-[var(--text-muted)]">
              <span className="font-sans font-medium">Subtotal:</span>
              <span className="font-bold">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-muted)]">
              <span className="font-sans font-medium">GST ({(taxRate * 100).toFixed(0)}%):</span>
              <span className="font-bold">₹{taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-[var(--text-main)] pt-1 border-t-2 border-[var(--border-color)]">
              <span className="font-display uppercase tracking-tight">Grand Total:</span>
              <span className="font-mono text-base font-extrabold text-[var(--text-main)] bg-[var(--accent)] px-1.5 py-0.2 rounded-[2px] border border-[var(--border-strong)]">
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold block">
              Payment Settlement
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                { id: 'Cash', label: 'Cash', icon: Banknote },
                { id: 'Card', label: 'Card', icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon
                const isActive = paymentMethod === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2 px-1 rounded-[3px] border-2 text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isActive
                        ? 'border-[var(--border-strong)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-[2px_2px_0px_var(--border-strong)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <Icon size={14} className="stroke-[2.2]" />
                    <span>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Contextual Payment Detail */}
          {paymentMethod === 'Cash' && (
            <div className="p-2.5 rounded-[3px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-xs space-y-1.5 shadow-[1px_1px_0px_var(--border-color)]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] font-mono font-bold text-[11px] uppercase">Cash Received:</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="w-24 p-1 rounded-[2px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-right font-mono text-xs font-bold focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              {Number(cashTendered) > grandTotal && (
                <div className="flex items-center justify-between text-emerald-600 font-bold font-mono text-xs pt-1 border-t border-[var(--border-subtle)]">
                  <span className="uppercase text-[10px]">Change Due:</span>
                  <span>₹{changeDue.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'UPI' && (
            <div className="p-2 rounded-[3px] bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs flex items-center justify-between">
              <span className="text-[var(--text-muted)] text-[11px] font-mono">Instant UPI QR generated on print</span>
              <span className="font-mono text-[10px] text-emerald-600 font-bold uppercase tracking-wide">● Ready</span>
            </div>
          )}

          {/* Validation Banner when disabled */}
          {!isCustomerInfoValid && cart.length > 0 && (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-500 font-mono flex items-center gap-1.5">
              <AlertTriangle size={13} className="shrink-0" />
              <span>
                {customerMode === 'walk_in' && !isWalkInPermitted
                  ? 'Walk-in locked: Store policy mandates customer information.'
                  : customerMode === 'select' && selectedCustomerValidationErrors.length > 0
                  ? selectedCustomerValidationErrors[0]
                  : 'Complete mandatory customer details above to enable bill generation.'}
              </span>
            </div>
          )}

          {/* Checkout Submit Button (Disabled until cart has items and customer info validates) */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting || !isCustomerInfoValid}
            className={`w-full py-3 text-xs font-bold tracking-wider uppercase cursor-pointer shadow-[3px_3px_0px_var(--border-strong)] transition-all ${
              cart.length === 0 || submitting || !isCustomerInfoValid
                ? 'opacity-40 cursor-not-allowed bg-zinc-700 text-zinc-300 border-2 border-zinc-600'
                : 'btn-accent'
            }`}
          >
            {submitting ? (
              <span>Validating & Recording Bill...</span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>Charge ₹{grandTotal.toFixed(2)} & Generate Bill</span>
                <ArrowRight size={14} className="stroke-[2.5]" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Receipt Print Modal ── */}
      {showBillModal && completedBill && (
        <PrintModal
          bill={completedBill}
          storeSettings={storeSettings}
          cashierName={user?.name || 'Cashier'}
          isOpen={showBillModal}
          onClose={() => setShowBillModal(false)}
          autoPrint={true}
        />
      )}

      {/* ── MODAL: EDIT CUSTOMER DETAILS ── */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="os-surface max-w-sm w-full p-5 relative border-2 border-[var(--border-strong)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Edit2 size={15} className="text-[var(--accent)]" />
                <h3 className="font-bold text-xs text-[var(--text-main)] uppercase font-display">
                  Edit Customer Information
                </h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-[var(--text-dim)] hover:text-[var(--text-main)]">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] font-medium block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editCustomerForm.full_name || ''}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, full_name: e.target.value })}
                  className="w-full p-2 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] font-medium block mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={editCustomerForm.phone || ''}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, phone: e.target.value })}
                  className="w-full p-2 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-mono text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] font-medium block mb-1">Email Address</label>
                <input
                  type="email"
                  value={editCustomerForm.email || ''}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, email: e.target.value })}
                  className="w-full p-2 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] font-medium block mb-1">Billing Address</label>
                <input
                  type="text"
                  value={editCustomerForm.billing_address || ''}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, billing_address: e.target.value })}
                  className="w-full p-2 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-ghost text-xs py-1.5 px-3 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-accent text-xs py-1.5 px-4 cursor-pointer font-bold"
                >
                  {savingEdit ? 'Saving...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  )
}
