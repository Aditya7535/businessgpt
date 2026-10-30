import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { reportsAPI } from '../services/api'
import {
  FileText,
  Download,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Reports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchReports = async () => {
    try {
      setLoading(true)
      const res = await reportsAPI.getReports()
      setReports(res.data)
    } catch (err) {
      toast.error('Failed to load reports history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleGenerate = async (type) => {
    try {
      setGenerating(true)
      toast.loading(`Compiling ${type} executive PDF dossier...`, { id: 'report' })
      const res = await reportsAPI.generateReport(type)
      toast.success(`${type.toUpperCase()} PDF Report compiled successfully!`, { id: 'report' })
      fetchReports()
    } catch (err) {
      toast.error('Report compilation failed.', { id: 'report' })
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (filename) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('businessgpt_token')
      const downloadUrl = reportsAPI.downloadReport(filename)
      const response = await fetch(downloadUrl, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Report downloaded successfully!')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Download failed: ' + error.message)
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
              Executive Dossiers · Chapter 04
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[var(--text-main)] font-display">
            Performance Dossiers & PDF Exports
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono uppercase tracking-wide">
            Compile immutable financial ledgers, counter tax audits, and operational dossiers.
          </p>
        </div>
      </div>

      {/* Report Generation Dossier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            type: 'daily',
            title: 'Daily Register Ledger',
            desc: 'Counter sales, cash vs UPI totals, cashier ledger, and stock movements.',
            icon: Clock,
            badge: 'Daily Audit',
          },
          {
            type: 'weekly',
            title: 'Weekly Strategy Dossier',
            desc: '7-day revenue velocity, top volume SKUs, and inventory replenishment signals.',
            icon: Calendar,
            badge: '7-Day Review',
          },
          {
            type: 'monthly',
            title: 'Monthly Executive Review',
            desc: '30-day comprehensive P&L forecast reconciliation, tax parameters, and seasonal trends.',
            icon: FileText,
            badge: 'P&L Review',
          },
        ].map(({ type, title, desc, icon: Icon, badge }) => (
          <div
            key={type}
            className="card p-5 flex flex-col justify-between border-2 border-[var(--border-color)] shadow-[3px_3px_0px_var(--border-color)] hover:border-[var(--border-strong)] transition-all group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--accent)] group-hover:scale-105 transition-transform">
                  <Icon size={18} className="stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-dim)] font-bold">
                  {badge}
                </span>
              </div>

              <h3 className="font-bold text-sm text-[var(--text-main)] font-display uppercase tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed font-sans">
                {desc}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => handleGenerate(type)}
                disabled={generating}
                className="w-full btn-accent text-xs py-2.5 font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 shadow-[2px_2px_0px_var(--border-strong)]"
              >
                <Sparkles size={13} className="stroke-[2.5]" />
                <span>Compile {type.toUpperCase()} PDF</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Historical Generated Reports Table */}
      <div className="os-surface overflow-hidden">
        <div className="p-3.5 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-[var(--accent)]" />
            <h3 className="font-bold text-xs text-[var(--text-main)]">
              Historical Dossier Archive
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface)] border border-[var(--border-color)]">
              {reports.length} generated
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            Stored in server reports directory
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-[var(--border-color)]">
            <thead className="bg-[var(--bg-surface-elevated)] font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Report File Name</th>
                <th className="px-4 py-3">Cadence</th>
                <th className="px-4 py-3">Compilation Timestamp</th>
                <th className="px-4 py-3 text-right">Download Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-main)]">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-4 py-12 text-center text-[var(--text-dim)]">
                    Auditing reports archive...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-12 text-center text-[var(--text-dim)]">
                    No reports generated yet. Click "Compile" above to create your first dossier.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.filename} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                    <td className="px-4 py-3 font-semibold flex items-center gap-2">
                      <FileText size={14} className="text-[var(--accent)] shrink-0" />
                      <span className="font-mono text-[11px] truncate max-w-sm">{rep.filename}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
                        {rep.type || 'EXECUTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-muted)]">
                      {rep.generated_at ? new Date(rep.generated_at).toLocaleString() : rep.created_at || 'Just now'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDownload(rep.filename)}
                        className="btn-ghost text-xs py-1 px-3 cursor-pointer"
                        title="Download PDF"
                      >
                        <Download size={13} />
                        <span>Download PDF</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}
