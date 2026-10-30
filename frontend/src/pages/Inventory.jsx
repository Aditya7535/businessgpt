import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { inventoryAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Boxes,
  Plus,
  ArrowUpRight,
  Download,
  Search,
  Filter,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  X,
  Edit2,
  Package,
  Layers,
  Sparkles,
  Mic,
  MicOff,
  Check,
  AlertCircle,
  Trash2
} from 'lucide-react'
import { voiceAPI } from '../services/api'
import toast from 'react-hot-toast'

const STANDARD_CATEGORIES = [
  'Grocery',
  'Dairy & Eggs',
  'Snacks',
  'Beverages',
  'Personal Care',
  'Household',
  'Spices & Masalas',
  'Grains & Pulses',
  'Bakery',
  'Instant Food',
  'Other',
]

const STANDARD_UNITS = [
  'pcs',
  'kg',
  'gm',
  'ltr',
  'ml',
  'packet',
  'box',
  'bottle',
  'can',
  'unit',
]

export default function Inventory() {
  const { hasRole } = useAuth()
  const [products, setProducts] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  const availableCategories = useMemo(() => {
    const existing = products.map((p) => p.category).filter(Boolean)
    return Array.from(new Set([...STANDARD_CATEGORIES, ...existing]))
  }, [products])

  // Conversational Natural Language Inventory State
  const [naturalQuery, setNaturalQuery] = useState('')
  const [naturalLoading, setNaturalLoading] = useState(false)
  const [pendingAdjustment, setPendingAdjustment] = useState(null)
  const [confirmingAdjustment, setConfirmingAdjustment] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  // Modals
  const [showAddStockModal, setShowAddStockModal] = useState(false)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showEditProductModal, setShowEditProductModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Forms
  const [addStockQty, setAddStockQty] = useState('')
  const [addStockNotes, setAddStockNotes] = useState('PO Restock')
  const [submitting, setSubmitting] = useState(false)

  const [newProdForm, setNewProdForm] = useState({
    name: '',
    sku: '',
    category: 'Grocery',
    unit_price: '',
    current_stock: '',
    reorder_point: 15,
    unit: 'pcs',
  })

  const [editProdForm, setEditProdForm] = useState({
    name: '',
    sku: '',
    category: '',
    unit_price: '',
    reorder_point: 10,
    unit: 'pcs',
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      const [prodsRes, sumRes] = await Promise.all([
        inventoryAPI.getProducts(),
        inventoryAPI.getSummary(),
      ])
      setProducts(prodsRes.data)
      setSummary(sumRes.data)
    } catch (err) {
      toast.error('Failed to load inventory data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesStatus = !selectedStatus || p.status === selectedStatus
    const matchesCategory = !selectedCategory || p.category === selectedCategory
    return matchesSearch && matchesStatus && matchesCategory
  })

  // Add stock submit
  const handleAddStock = async (e) => {
    e.preventDefault()
    if (!selectedProduct || !addStockQty || parseInt(addStockQty) <= 0) {
      toast.error('Please enter a valid stock quantity.')
      return
    }

    try {
      setSubmitting(true)
      await inventoryAPI.addStock({
        product_id: selectedProduct.id,
        quantity: parseInt(addStockQty),
        notes: addStockNotes,
      })
      toast.success(`Added ${addStockQty} units to ${selectedProduct.name}`)
      setShowAddStockModal(false)
      setAddStockQty('')
      fetchData()
    } catch (err) {
      toast.error('Failed to update stock.')
    } finally {
      setSubmitting(false)
    }
  }

  // Create product submit
  const handleCreateProduct = async (e) => {
    e.preventDefault()
    if (!newProdForm.name || !newProdForm.sku || !newProdForm.unit_price) {
      toast.error('Please fill in required fields.')
      return
    }

    try {
      setSubmitting(true)
      await inventoryAPI.createProduct({
        ...newProdForm,
        unit_price: parseFloat(newProdForm.unit_price),
        current_stock: parseInt(newProdForm.current_stock || 0),
        reorder_point: parseInt(newProdForm.reorder_point || 10),
      })
      toast.success(`Product '${newProdForm.name}' created!`)
      setShowAddProductModal(false)
      setNewProdForm({
        name: '',
        sku: '',
        category: 'Grocery',
        unit_price: '',
        current_stock: '',
        reorder_point: 15,
        unit: 'pcs',
      })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create product.')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete product handler

  const handleDeleteProduct = async (product) => {

    if (!product) return

    const confirmed = window.confirm(`Kya aap sach mein "${product.name}" (${product.sku}) ko catalog se delete karna chahte hain?`)

    if (!confirmed) return



    try {

      setLoading(true)

      await inventoryAPI.deleteProduct(product.id)

      toast.success(`Product "${product.name}" successfully delete ho gaya.`)

      setShowEditProductModal(false)

      fetchData()

    } catch (err) {

      toast.error(err.response?.data?.detail || 'Product delete nahi ho paya.')

    } finally {

      setLoading(false)

    }

  }



  // Update product submit
  const handleUpdateProduct = async (e) => {
    e.preventDefault()
    if (!selectedProduct) return

    try {
      setSubmitting(true)
      await inventoryAPI.updateProduct(selectedProduct.id, {
        name: editProdForm.name,
        sku: editProdForm.sku,
        category: editProdForm.category,
        unit_price: parseFloat(editProdForm.unit_price),
        reorder_point: parseInt(editProdForm.reorder_point),
        unit: editProdForm.unit,
      })
      toast.success(`Product updated!`)
      setShowEditProductModal(false)
      fetchData()
    } catch (err) {
      toast.error('Failed to update product.')
    } finally {
      setSubmitting(false)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    if (!products.length) return
    const headers = ['ID,SKU,Name,Category,Stock,Unit,UnitPrice,ReorderPoint,Status']
    const rows = products.map(
      (p) =>
        `${p.id},"${p.sku}","${p.name}","${p.category || ''}",${p.current_stock},"${p.unit || 'pcs'}",${p.unit_price},${p.reorder_point || 10},"${p.status}"`
    )
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `inventory_report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Inventory CSV exported.')
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CRITICAL':
        return <span className="badge-critical">CRITICAL</span>
      case 'LOW':
        return <span className="badge-low">LOW STOCK</span>
      case 'OPTIMAL':
        return <span className="badge-optimal">OPTIMAL</span>
      case 'OVERSTOCK':
        return <span className="badge-overstock">OVERSTOCK</span>
      default:
        return <span className="badge-optimal">{status}</span>
    }
  }

  // Check pending natural adjustment on load
  useEffect(() => {
    const checkPending = async () => {
      try {
        const res = await inventoryAPI.getPendingAdjust()
        if (res.data?.has_pending && res.data?.pending) {
          setPendingAdjustment({
            pending_id: res.data.pending.id,
            response: res.data.pending.summary_text,
            proposals: res.data.pending.movements,
            status: 'PENDING_CONFIRMATION'
          })
        }
      } catch (err) {
        // silent
      }
    }
    checkPending()
  }, [])

  // Natural language adjustment submission
  const handleNaturalSubmit = async (e) => {
    if (e) e.preventDefault()
    const query = naturalQuery.trim()
    if (!query) {
      toast.error('Kripya stock update likhein ya bolein.')
      return
    }

    try {
      setNaturalLoading(true)
      const res = await inventoryAPI.naturalAdjust(query)
      const data = res.data

      if (data.status === 'PENDING_CONFIRMATION') {
        setPendingAdjustment(data)
        toast('Confirm karne ke liye neeche button dabayein.', { icon: '📋' })
      } else if (data.status === 'CONFIRMED') {
        toast.success(data.response || 'Stock successfully update ho gaya!')
        setPendingAdjustment(null)
        setNaturalQuery('')
        fetchData()
      } else if (data.status === 'CANCELLED') {
        toast(data.response || 'Update cancel kar diya gaya.', { icon: '🛑' })
        setPendingAdjustment(null)
        setNaturalQuery('')
      } else {
        toast(data.response || 'Please statement check karein.', { icon: 'ℹ️' })
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Stock update parse karne mein dikkat aayi.')
    } finally {
      setNaturalLoading(false)
    }
  }

  // Confirm natural adjustment
  const handleConfirmAdjustment = async () => {
    if (!pendingAdjustment?.pending_id) return
    try {
      setConfirmingAdjustment(true)
      const res = await inventoryAPI.confirmAdjust(pendingAdjustment.pending_id)
      toast.success(res.data?.response || 'Stock successfully update ho gaya!')
      setPendingAdjustment(null)
      setNaturalQuery('')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Confirmation mein error aayi.')
    } finally {
      setConfirmingAdjustment(false)
    }
  }

  // Cancel natural adjustment
  const handleCancelAdjustment = async () => {
    if (!pendingAdjustment?.pending_id) return
    try {
      await inventoryAPI.cancelAdjust(pendingAdjustment.pending_id)
      toast('Stock update cancel kar diya gaya.', { icon: '🛑' })
      setPendingAdjustment(null)
    } catch (err) {
      toast.error('Cancel nahi ho paya.')
    }
  }

  // Voice recording toggle via Web Speech API or voiceAPI
  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Aapka browser Web Speech API support nahi karta. Text likhein.')
      return
    }

    if (isRecording) {
      setIsRecording(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'hi-IN'

      recognition.onstart = () => {
        setIsRecording(true)
        toast('Bolna shuru karein...', { icon: '🎙️' })
      }

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setNaturalQuery(transcript)
        setIsRecording(false)
        toast.success(`Heard: "${transcript}"`)
      }

      recognition.onerror = (event) => {
        setIsRecording(false)
        toast.error(`Mic error: ${event.error}`)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognition.start()
    } catch (err) {
      setIsRecording(false)
      toast.error('Mic access nahi mila.')
    }
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
              Warehouse Ledger · Chapter 02
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[var(--text-main)] font-display">
            Inventory Health & Movement
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono uppercase tracking-wide">
            Live SKU availability, reorder thresholds, and warehouse valuation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="btn-secondary text-xs cursor-pointer font-bold font-mono uppercase tracking-wider"
            title="Download CSV report"
          >
            <Download size={13} className="stroke-[2.2]" />
            <span>Export CSV</span>
          </button>

          {hasRole(['MANAGER', 'OWNER']) && (
            <button
              onClick={() => setShowAddProductModal(true)}
              className="btn-accent text-xs cursor-pointer font-bold uppercase tracking-wider"
            >
              <Plus size={13} className="stroke-[2.5]" />
              <span>Add New SKU</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 space-y-1 shadow-[3px_3px_0px_var(--border-color)]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold">
              Total Catalog SKUs
            </span>
            <div className="text-2xl font-extrabold text-[var(--text-main)] font-mono">
              {summary.total_products}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Active registered products</p>
          </div>

          <div className="card p-4 space-y-1 shadow-[3px_3px_0px_var(--border-color)]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold">
              Stock Valuation
            </span>
            <div className="text-2xl font-extrabold text-[var(--text-main)] font-mono bg-[var(--accent)] text-[var(--accent-ink)] px-1.5 py-0.5 inline-block rounded-[2px] border border-[var(--border-strong)]">
              ₹{(summary.total_valuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Retail inventory capital</p>
          </div>

          <div className="card p-4 space-y-1 shadow-[3px_3px_0px_var(--border-color)]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold">
              Critical Depletion
            </span>
            <div className="text-2xl font-extrabold text-red-600 font-mono">
              {summary.critical_count}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Immediate restock required</p>
          </div>

          <div className="card p-4 space-y-1 shadow-[3px_3px_0px_var(--border-color)]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold">
              Healthy Stock
            </span>
            <div className="text-2xl font-extrabold text-emerald-600 font-mono">
              {summary.optimal_count}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Optimal supply balance</p>
          </div>
        </div>
      )}

      {/* Conversational Natural Language Inventory Adjustment Card */}

      <div className="card p-4 space-y-3 bg-[var(--bg-surface)] border-2 border-[var(--border-color)] shadow-[4px_4px_0px_var(--border-color)]">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-color)] pb-2.5">

          <div className="flex items-center gap-2">

            <div className="w-7 h-7 rounded-[3px] bg-[var(--accent)] text-[var(--accent-ink)] flex items-center justify-center font-bold shadow-[1px_1px_0px_var(--border-color)]">

              <Sparkles size={16} />

            </div>

            <div>

              <h2 className="text-sm font-bold uppercase tracking-tight text-[var(--text-main)] font-display">

                Natural Language Stock Update

              </h2>

              <p className="text-[11px] text-[var(--text-muted)] font-mono">

                Type or speak in Hindi, Hinglish, Marathi, or English (e.g. &ldquo;50 packet Maggi aayi, 20 bik gaye&rdquo;)

              </p>

            </div>

          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">

            <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold uppercase rounded-[2px]">

              Mandatory Confirmation

            </span>

          </div>

        </div>



        {/* Input Form */}

        <form onSubmit={handleNaturalSubmit} className="flex flex-col sm:flex-row gap-2">

          <div className="relative flex-1 flex items-center bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] rounded-[3px] px-3 py-1.5 focus-within:border-[var(--accent)] shadow-[1px_1px_0px_var(--border-color)]">

            <input

              type="text"

              value={naturalQuery}

              onChange={(e) => setNaturalQuery(e.target.value)}

              placeholder="e.g. 50 packet Maggi ka stock aaya hai aur 10 bik gaye..."

              className="w-full bg-transparent text-xs text-[var(--text-main)] focus:outline-none placeholder:text-[var(--text-dim)] font-medium"

            />

            {naturalQuery && (

              <button

                type="button"

                onClick={() => setNaturalQuery('')}

                className="text-[var(--text-dim)] hover:text-[var(--text-main)] p-1"

              >

                <X size={13} />

              </button>

            )}

          </div>



          <div className="flex items-center gap-2">

            <button

              type="button"

              onClick={toggleRecording}

              className={`btn-secondary text-xs cursor-pointer font-bold font-mono uppercase px-3 py-2 flex items-center gap-1.5 ${

                isRecording ? 'bg-red-500 text-white animate-pulse border-red-700' : ''

              }`}

              title="Speak stock update"

            >

              {isRecording ? <MicOff size={13} /> : <Mic size={13} />}

              <span>{isRecording ? 'Listening...' : 'Voice'}</span>

            </button>



            <button

              type="submit"

              disabled={naturalLoading || !naturalQuery.trim()}

              className="btn-accent text-xs cursor-pointer font-bold uppercase tracking-wider px-4 py-2 shrink-0 disabled:opacity-50"

            >

              {naturalLoading ? 'Analyzing...' : 'Preview Update'}

            </button>

          </div>

        </form>



        {/* Pending Adjustment Confirmation Card */}

        {pendingAdjustment && (

          <motion.div

            initial={{ opacity: 0, scale: 0.98 }}

            animate={{ opacity: 1, scale: 1 }}

            className="p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500 rounded-[3px] space-y-3 shadow-[2px_2px_0px_rgba(245,158,11,0.5)]"

          >

            <div className="flex items-center justify-between border-b border-amber-300 dark:border-amber-800 pb-2">

              <div className="flex items-center gap-2">

                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />

                <span className="text-xs font-bold font-mono uppercase tracking-wide text-amber-900 dark:text-amber-200">

                  Confirmation Required Before Updating Stock

                </span>

              </div>

              <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold uppercase rounded-[2px]">

                Pending

              </span>

            </div>



            {/* Structured Proposals List */}

            {pendingAdjustment.proposals && pendingAdjustment.proposals.length > 0 ? (

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                {pendingAdjustment.proposals.map((prop, idx) => (

                  <div

                    key={idx}

                    className="p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[2px] space-y-2 shadow-[1px_1px_0px_var(--border-color)]"

                  >

                    <div className="flex items-center justify-between">

                      <span className="text-xs font-extrabold text-[var(--text-main)] font-mono">

                        {prop.product_name}

                      </span>

                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] font-bold">

                        {prop.sku}

                      </span>

                    </div>



                    <div className="text-[11px] space-y-1 font-mono text-[var(--text-main)]">

                      {prop.movements && prop.movements.map((m, mIdx) => (

                        <div key={mIdx} className="flex justify-between items-center text-[10px]">

                          <span className="text-[var(--text-muted)]">

                            {m.type === 'RESTOCK' ? '📦 Stock Received' :

                             m.type === 'SALE' ? '🛒 Sold' :

                             m.type === 'DAMAGED' ? '⚠️ Damaged/Expired' :

                             m.type === 'RETURN_TO_SUPPLIER' ? '↩️ Supplier Return' :

                             m.type === 'CUSTOMER_RETURN' ? '🔄 Customer Return' : '📝 Correction'}:

                          </span>

                          <span className={`font-bold ${

                            m.quantity_delta > 0 ? 'text-emerald-600' : 'text-red-600'

                          }`}>

                            {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta} {prop.unit}

                          </span>

                        </div>

                      ))}

                    </div>



                    <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-xs font-mono font-bold">

                      <span className="text-[var(--text-dim)] text-[10px]">

                        Prev: {prop.previous_stock} {prop.unit}

                      </span>

                      <span className="text-emerald-600 font-extrabold">

                        New: {prop.new_stock} {prop.unit}

                      </span>

                    </div>

                  </div>

                ))}

              </div>

            ) : (

              <p className="text-xs font-mono text-[var(--text-main)] whitespace-pre-line">

                {pendingAdjustment.response}

              </p>

            )}



            {/* Action Buttons */}

            <div className="flex items-center justify-end gap-2.5 pt-2">

              <button

                type="button"

                onClick={handleCancelAdjustment}

                className="btn-secondary text-xs cursor-pointer font-bold font-mono uppercase px-3 py-1.5 text-red-600 hover:bg-red-50"

              >

                Cancel

              </button>

              <button

                type="button"

                onClick={handleConfirmAdjustment}

                disabled={confirmingAdjustment}

                className="btn-accent text-xs cursor-pointer font-bold font-mono uppercase px-4 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-800 flex items-center gap-1.5"

              >

                <Check size={14} className="stroke-[3]" />

                <span>{confirmingAdjustment ? 'Updating...' : 'Confirm & Update Stock'}</span>

              </button>

            </div>

          </motion.div>

        )}

      </div>



      {/* Filter and Search Bar */}
      <div className="card p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[2px_2px_0px_var(--border-color)]">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-72 flex items-center gap-2 bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] rounded-[3px] px-3 py-1.5 focus-within:border-[var(--accent)] shadow-[1px_1px_0px_var(--border-color)]">
            <Search size={14} className="text-[var(--text-dim)] shrink-0 stroke-[2.2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, name, category..."
              className="w-full bg-transparent border-none text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-auto text-xs font-mono bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-main)] rounded-[3px] px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-[1px_1px_0px_var(--border-color)]"
            title="Filter by Category"
          >
            <option value="">All Categories ({availableCategories.length})</option>
            {availableCategories.map((c) => (
              <option key={c} value={c} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { label: 'All SKUs', val: '' },
            { label: 'Critical', val: 'CRITICAL' },
            { label: 'Low Stock', val: 'LOW' },
            { label: 'Optimal', val: 'OPTIMAL' },
            { label: 'Overstock', val: 'OVERSTOCK' },
          ].map((st) => {
            const isActive = selectedStatus === st.val
            return (
              <button
                key={st.val}
                onClick={() => setSelectedStatus(st.val)}
                className={`px-2.5 py-1 rounded-[3px] text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--border-strong)] shadow-[1px_1px_0px_var(--border-strong)]'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-color)] hover:border-[var(--border-strong)]'
                }`}
              >
                {st.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Products Table */}
      <div className="os-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-[var(--border-color)]">
            <thead className="bg-[var(--bg-surface-elevated)] font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Product Name & Category</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Stock Level</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Reorder Point</th>
                <th className="px-4 py-3">Health Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-main)]">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-[var(--text-dim)]">
                    Auditing live warehouse database...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-[var(--text-dim)]">
                    No products match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const stockRatio = Math.min(100, Math.round((p.current_stock / (p.reorder_point * 2 || 20)) * 100))
                  return (
                    <tr key={p.id} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--text-main)]">{p.name}</div>
                        <div className="text-[10px] font-mono text-[var(--text-dim)]">{p.category || 'General'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-muted)]">
                        {p.sku}
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                          <span className="font-bold">{p.current_stock} {p.unit || 'pcs'}</span>
                          <span className="text-[10px] text-[var(--text-dim)]">Target: {p.reorder_point}</span>
                        </div>
                        <div className="w-full bg-[var(--bg-surface-elevated)] rounded-full h-1.5 overflow-hidden border border-[var(--border-subtle)]">
                          <div
                            className={`h-1.5 rounded-full ${
                              p.status === 'CRITICAL'
                                ? 'bg-red-500'
                                : p.status === 'LOW'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${stockRatio}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-xs">
                        ₹{Number(p.unit_price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {p.reorder_point || 10} {p.unit || 'pcs'}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(p.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedProduct(p)
                              setShowAddStockModal(true)
                            }}
                            className="btn-accent text-[11px] py-1 px-2.5 cursor-pointer"
                            title="Restock units"
                          >
                            <Plus size={12} />
                            <span>Restock</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProduct(p)
                              setEditProdForm({
                                name: p.name,
                                sku: p.sku,
                                category: p.category || '',
                                unit_price: p.unit_price,
                                reorder_point: p.reorder_point || 10,
                                unit: p.unit || 'pcs',
                              })
                              setShowEditProductModal(true)
                            }}
                            className="p-1.5 rounded border border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 size={12} />
                          </button>
                          {hasRole(['MANAGER', 'OWNER']) && (
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="p-1.5 rounded border border-red-200 dark:border-red-900/60 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Delete Product"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: ADD STOCK ── */}
      {showAddStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="os-surface max-w-sm w-full p-6 relative">
            <h2 className="text-sm font-bold text-[var(--text-main)] mb-1">
              Add Stock Units
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Replenishing: <span className="font-semibold text-[var(--text-main)]">{selectedProduct.name}</span>
            </p>

            <form onSubmit={handleAddStock} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                  Quantity to Add
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                  Restock Reference / Note
                </label>
                <input
                  type="text"
                  value={addStockNotes}
                  onChange={(e) => setAddStockNotes(e.target.value)}
                  placeholder="e.g. PO #1042 or Vendor Delivery"
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStockModal(false)}
                  className="btn-ghost text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-accent text-xs cursor-pointer"
                >
                  {submitting ? 'Updating...' : 'Confirm Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD PRODUCT ── */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="os-surface max-w-md w-full p-6 relative">
            <h2 className="text-sm font-bold text-[var(--text-main)] mb-1">
              Add New Inventory SKU
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Register a product in the warehouse catalog.
            </p>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProdForm.name}
                    onChange={(e) => setNewProdForm({ ...newProdForm, name: e.target.value })}
                    placeholder="e.g. Basmati Rice 5kg"
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProdForm.sku}
                    onChange={(e) => setNewProdForm({ ...newProdForm, sku: e.target.value })}
                    placeholder="e.g. GROC-RICE-001"
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-mono uppercase focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Category *
                  </label>
                  <select
                    value={availableCategories.includes(newProdForm.category) ? newProdForm.category : 'Custom'}
                    onChange={(e) => {
                      const val = e.target.value
                      setNewProdForm({ ...newProdForm, category: val === 'Custom' ? '' : val })
                    }}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer text-sm"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                        {cat}
                      </option>
                    ))}
                    <option value="Custom" className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                      + Other / Custom Category...
                    </option>
                  </select>
                  {(!availableCategories.includes(newProdForm.category) || newProdForm.category === 'Custom') && (
                    <input
                      type="text"
                      autoFocus
                      placeholder="Type custom category name..."
                      value={newProdForm.category === 'Custom' ? '' : newProdForm.category}
                      onChange={(e) => setNewProdForm({ ...newProdForm, category: e.target.value })}
                      className="w-full mt-1.5 p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--accent)] text-[var(--text-main)] text-xs focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProdForm.unit_price}
                    onChange={(e) => setNewProdForm({ ...newProdForm, unit_price: e.target.value })}
                    placeholder="250.00"
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    value={newProdForm.current_stock}
                    onChange={(e) => setNewProdForm({ ...newProdForm, current_stock: e.target.value })}
                    placeholder="100"
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Reorder Point
                  </label>
                  <input
                    type="number"
                    value={newProdForm.reorder_point}
                    onChange={(e) => setNewProdForm({ ...newProdForm, reorder_point: e.target.value })}
                    placeholder="15"
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Unit of Measurement
                  </label>
                  <select
                    value={STANDARD_UNITS.includes(newProdForm.unit) ? newProdForm.unit : 'Custom'}
                    onChange={(e) => {
                      const val = e.target.value
                      setNewProdForm({ ...newProdForm, unit: val === 'Custom' ? '' : val })
                    }}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer text-sm"
                  >
                    {STANDARD_UNITS.map((u) => (
                      <option key={u} value={u} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                        {u}
                      </option>
                    ))}
                    <option value="Custom" className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                      + Custom Unit...
                    </option>
                  </select>
                  {(!STANDARD_UNITS.includes(newProdForm.unit) || newProdForm.unit === 'Custom') && (
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. bundle / strip"
                      value={newProdForm.unit === 'Custom' ? '' : newProdForm.unit}
                      onChange={(e) => setNewProdForm({ ...newProdForm, unit: e.target.value })}
                      className="w-full mt-1.5 p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--accent)] text-[var(--text-main)] text-xs focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="btn-ghost text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-accent text-xs cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Register SKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT PRODUCT ── */}
      {showEditProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="os-surface max-w-md w-full p-6 relative">
            <h2 className="text-sm font-bold text-[var(--text-main)] mb-1">
              Edit Product Details
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Updating master information for SKU: <span className="font-mono">{selectedProduct.sku}</span>
            </p>

            <form onSubmit={handleUpdateProduct} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={editProdForm.name}
                  onChange={(e) => setEditProdForm({ ...editProdForm, name: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Category
                  </label>
                  <select
                    value={availableCategories.includes(editProdForm.category) ? editProdForm.category : 'Custom'}
                    onChange={(e) => {
                      const val = e.target.value
                      setEditProdForm({ ...editProdForm, category: val === 'Custom' ? '' : val })
                    }}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer text-sm"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                        {cat}
                      </option>
                    ))}
                    <option value="Custom" className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                      + Other / Custom Category...
                    </option>
                  </select>
                  {(!availableCategories.includes(editProdForm.category) || editProdForm.category === 'Custom') && (
                    <input
                      type="text"
                      autoFocus
                      placeholder="Type custom category name..."
                      value={editProdForm.category === 'Custom' ? '' : editProdForm.category}
                      onChange={(e) => setEditProdForm({ ...editProdForm, category: e.target.value })}
                      className="w-full mt-1.5 p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--accent)] text-[var(--text-main)] text-xs focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editProdForm.unit_price}
                    onChange={(e) => setEditProdForm({ ...editProdForm, unit_price: e.target.value })}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Reorder Point
                  </label>
                  <input
                    type="number"
                    value={editProdForm.reorder_point}
                    onChange={(e) => setEditProdForm({ ...editProdForm, reorder_point: e.target.value })}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                    Unit
                  </label>
                  <select
                    value={STANDARD_UNITS.includes(editProdForm.unit) ? editProdForm.unit : 'Custom'}
                    onChange={(e) => {
                      const val = e.target.value
                      setEditProdForm({ ...editProdForm, unit: val === 'Custom' ? '' : val })
                    }}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer text-sm"
                  >
                    {STANDARD_UNITS.map((u) => (
                      <option key={u} value={u} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                        {u}
                      </option>
                    ))}
                    <option value="Custom" className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                      + Custom Unit...
                    </option>
                  </select>
                  {(!STANDARD_UNITS.includes(editProdForm.unit) || editProdForm.unit === 'Custom') && (
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. bundle / strip"
                      value={editProdForm.unit === 'Custom' ? '' : editProdForm.unit}
                      onChange={(e) => setEditProdForm({ ...editProdForm, unit: e.target.value })}
                      className="w-full mt-1.5 p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--accent)] text-[var(--text-main)] text-xs focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between gap-2 border-t border-[var(--border-color)] mt-2">
                {hasRole(['MANAGER', 'OWNER']) ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(selectedProduct)}
                    className="btn-secondary text-xs cursor-pointer font-bold text-red-600 hover:bg-red-50 border-red-300 dark:border-red-800 flex items-center gap-1.5"
                    title="Delete SKU from catalog"
                  >
                    <Trash2 size={13} />
                    <span>Delete SKU</span>
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditProductModal(false)}
                    className="btn-ghost text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-accent text-xs cursor-pointer"
                  >
                    {submitting ? 'Saving...' : 'Update Details'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  )
}
