import React, { useState, useEffect } from 'react'
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
  Edit2
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Inventory() {
  const { hasRole } = useAuth()
  const [products, setProducts] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

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
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !selectedStatus || p.status === selectedStatus
    return matchesSearch && matchesStatus
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
      toast.success(`Restocked ${addStockQty} units of ${selectedProduct.name}!`)
      setShowAddStockModal(false)
      setAddStockQty('')
      setSelectedProduct(null)
      fetchData()
    } catch (err) {
      toast.error('Failed to restock product.')
    } finally {
      setSubmitting(false)
    }
  }

  // Add product submit
  const handleCreateProduct = async (e) => {
    e.preventDefault()
    if (!newProdForm.name || !newProdForm.sku || !newProdForm.unit_price) {
      toast.error('Please complete all required fields.')
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
      toast.success('Product created successfully!')
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

  // Edit product submit
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
      toast.success('Product updated successfully!')
      setShowEditProductModal(false)
      setSelectedProduct(null)
      fetchData()
    } catch (err) {
      toast.error('Failed to update product.')
    } finally {
      setSubmitting(false)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    if (products.length === 0) return
    const headers = ['ID', 'Name', 'SKU', 'Category', 'Unit Price (INR)', 'Current Stock', 'Reorder Point', 'Unit', 'Status', 'Valuation (INR)']
    const rows = products.map((p) => [
      p.id,
      `"${p.name}"`,
      p.sku,
      p.category,
      p.unit_price,
      p.current_stock,
      p.reorder_point,
      p.unit,
      p.status,
      p.total_value,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `inventory_report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Inventory exported to CSV!')
  }

  const getBadgeStyle = (status) => {
    switch (status) {
      case 'CRITICAL':
        return 'badge-critical'
      case 'LOW':
        return 'badge-low'
      case 'OVERSTOCK':
        return 'badge-overstock'
      default:
        return 'badge-optimal'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-5"
    >
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)] flex items-center gap-2">
            <Boxes size={20} className="text-blue-500" />
            Inventory & Stock Control
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Real-time multi-category warehouse management and automated replenishment alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn-ghost text-xs cursor-pointer">
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddProductModal(true)}
            className="btn-ghost text-xs cursor-pointer"
          >
            <Plus size={14} />
            New Product
          </button>
          <button
            onClick={() => {
              if (products.length > 0) {
                setSelectedProduct(products[0])
                setShowAddStockModal(true)
              }
            }}
            className="btn-accent text-xs cursor-pointer"
          >
            <ArrowUpRight size={14} />
            Add Stock (Purchase)
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 os-surface flex flex-col justify-between">
            <span className="text-[11px] text-[var(--text-muted)] font-medium">Total Products</span>
            <span className="text-xl font-bold font-mono text-[var(--text-main)] mt-1">{summary.total_products}</span>
          </div>
          <div className="p-4 os-surface flex flex-col justify-between">
            <span className="text-[11px] text-[var(--text-muted)] font-medium">Inventory Value</span>
            <span className="text-xl font-bold font-mono text-[var(--text-main)] mt-1">₹{summary.total_valuation.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-4 os-surface border-l-4 border-l-red-500 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-red-500 font-semibold">Critical Stock</span>
              <AlertOctagon size={14} className="text-red-500" />
            </div>
            <span className="text-xl font-bold font-mono text-red-500 mt-1">{summary.critical_count}</span>
          </div>
          <div className="p-4 os-surface border-l-4 border-l-amber-500 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-amber-500 font-semibold">Low Stock</span>
              <AlertTriangle size={14} className="text-amber-500" />
            </div>
            <span className="text-xl font-bold font-mono text-amber-500 mt-1">{summary.low_count}</span>
          </div>
          <div className="p-4 os-surface border-l-4 border-l-emerald-500 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-emerald-500 font-semibold">Optimal Stock</span>
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
            <span className="text-xl font-bold font-mono text-emerald-500 mt-1">{summary.optimal_count}</span>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-3 os-surface flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={15} />
          <input
            type="text"
            placeholder="Filter by product name, SKU, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs">
          {['', 'CRITICAL', 'LOW', 'OPTIMAL', 'OVERSTOCK'].map((st) => (
            <button
              key={st || 'ALL'}
              onClick={() => setSelectedStatus(st)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all ${
                selectedStatus === st
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-main)]'
              }`}
            >
              {st || 'ALL STATUS'}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="os-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-surface-elevated)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Stock Level</th>
                <th className="py-3 px-4">Reorder Pt</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[var(--text-muted)]">
                    Loading inventory records...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[var(--text-muted)]">
                    No matching inventory products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isCritical = p.status === 'CRITICAL'
                  const isLow = p.status === 'LOW'
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[var(--bg-surface-elevated)] transition-colors ${
                        isCritical ? 'bg-red-500/5' : isLow ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-[var(--text-main)]">
                        {p.name}
                        {isCritical && (
                          <span className="ml-2 text-[10px] text-red-500 font-mono font-bold">● Urgent Restock</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-muted)]">{p.sku}</td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">{p.category}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--text-main)]">
                        ₹{p.unit_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[var(--text-main)]">
                        {p.current_stock} {p.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                        {p.reorder_point} {p.unit}
                      </td>
                      <td className="py-3 px-4">
                        <span className={getBadgeStyle(p.status)}>{p.status}</span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => {
                            setSelectedProduct(p)
                            setShowAddStockModal(true)
                          }}
                          className="px-2 py-1 rounded bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white transition-colors text-[11px] font-medium cursor-pointer"
                        >
                          + Restock
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduct(p)
                            setEditProdForm({
                              name: p.name,
                              sku: p.sku,
                              category: p.category,
                              unit_price: p.unit_price,
                              reorder_point: p.reorder_point,
                              unit: p.unit,
                            })
                            setShowEditProductModal(true)
                          }}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: ADD STOCK (PURCHASE ORDER) ── */}
      {showAddStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="os-surface max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowAddStockModal(false)}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            >
              <X size={18} />
            </button>
            <h2 className="text-sm font-bold text-[var(--text-main)] mb-1">
              Add Stock / Purchase Replenishment
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Restock <span className="font-semibold text-[var(--text-main)]">{selectedProduct.name}</span> ({selectedProduct.sku})
            </p>

            <form onSubmit={handleAddStock} className="space-y-4">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                  Select Product:
                </label>
                <select
                  value={selectedProduct.id}
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === parseInt(e.target.value))
                    if (prod) setSelectedProduct(prod)
                  }}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Current: {p.current_stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                  Quantity Received ({selectedProduct.unit}):
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 50"
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                  Supplier / PO Notes:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Supplier Invoice #PO-9921"
                  value={addStockNotes}
                  onChange={(e) => setAddStockNotes(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
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
                  {submitting ? 'Updating...' : 'Confirm Stock Addition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE PRODUCT ── */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="os-surface max-w-lg w-full p-6 relative">
            <button
              onClick={() => setShowAddProductModal(false)}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            >
              <X size={18} />
            </button>
            <h2 className="text-sm font-bold text-[var(--text-main)] mb-1">Create Catalog Product</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">Add a new SKU to inventory and POS catalog.</p>

            <form onSubmit={handleCreateProduct} className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Haldiram Moong Dal 200g"
                  value={newProdForm.name}
                  onChange={(e) => setNewProdForm({ ...newProdForm, name: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">SKU Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SNACK-009"
                  value={newProdForm.sku}
                  onChange={(e) => setNewProdForm({ ...newProdForm, sku: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Category *</label>
                <select
                  value={newProdForm.category}
                  onChange={(e) => setNewProdForm({ ...newProdForm, category: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                >
                  <option value="Grocery">Grocery</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Personal Care">Personal Care</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Household">Household</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Selling Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 65.00"
                  value={newProdForm.unit_price}
                  onChange={(e) => setNewProdForm({ ...newProdForm, unit_price: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Unit of Measure</label>
                <input
                  type="text"
                  placeholder="pcs, pack, kg, ltr"
                  value={newProdForm.unit}
                  onChange={(e) => setNewProdForm({ ...newProdForm, unit: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Initial Opening Stock</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newProdForm.current_stock}
                  onChange={(e) => setNewProdForm({ ...newProdForm, current_stock: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Reorder Point Threshold</label>
                <input
                  type="number"
                  min="1"
                  placeholder="10"
                  value={newProdForm.reorder_point}
                  onChange={(e) => setNewProdForm({ ...newProdForm, reorder_point: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                />
              </div>

              <div className="col-span-2 pt-3 flex justify-end gap-2">
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
                  {submitting ? 'Creating...' : 'Create Product'}
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
            <button
              onClick={() => setShowEditProductModal(false)}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            >
              <X size={18} />
            </button>
            <h2 className="text-sm font-bold text-[var(--text-main)] mb-1">Edit Product Details</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">{selectedProduct.name}</p>

            <form onSubmit={handleUpdateProduct} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Product Name</label>
                <input
                  type="text"
                  value={editProdForm.name}
                  onChange={(e) => setEditProdForm({ ...editProdForm, name: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editProdForm.unit_price}
                    onChange={(e) => setEditProdForm({ ...editProdForm, unit_price: e.target.value })}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Reorder Threshold</label>
                  <input
                    type="number"
                    value={editProdForm.reorder_point}
                    onChange={(e) => setEditProdForm({ ...editProdForm, reorder_point: e.target.value })}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono focus:outline-none focus:border-blue-500 text-[var(--text-main)]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
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
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  )
}
