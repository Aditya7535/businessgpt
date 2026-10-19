import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { reportsAPI } from '../services/api'
import { FileText, Download, Calendar, Sparkles, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
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
      toast.loading(`Compiling ${type} executive PDF report...`, { id: 'report' })
      const res = await reportsAPI.generateReport(type)
      toast.success(`${type} PDF Report compiled successfully!`, { id: 'report' })
      fetchReports()
    } catch (err) {
      toast.error('Report compilation failed.', { id: 'report' })
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (filename) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('businessgpt_token');
      const response = await fetch(
        `http://localhost:8000/api/reports/download/${filename}`,
        { 
          headers: { 
            Authorization: `Bearer ${token}` 
          }
        }
      );
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed: ' + error.message);
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)] flex items-center gap-2">
          <FileText size={20} className="text-blue-500" />
          Executive Business Reports
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Generate comprehensive daily, weekly, or monthly PDF performance dossiers for accounting & strategy.
        </p>
      </div>

      {/* Report Generation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            type: 'daily',
            title: 'Daily Register PDF',
            desc: 'Counter sales, cash vs UPI totals, cashier ledger, and stock movements.',
            icon: Clock,
          },
          {
            type: 'weekly',
            title: 'Weekly BI Briefing',
            desc: 'MoM comparison, peak sales hours, fast-moving SKUs, and margin distribution.',
            icon: Calendar,
          },
          {
            type: 'monthly',
            title: 'Monthly P&L Audit',
            desc: 'Full tax breakdown (GST 5/12/18%), inventory valuation, supplier cost analysis.',
            icon: Sparkles,
          },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.type} className="os-surface p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mb-3">
                  <Icon size={18} />
                </div>
                <h3 className="font-bold text-sm text-[var(--text-main)]">{card.title}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{card.desc}</p>
              </div>

              <button
                onClick={() => handleGenerate(card.type)}
                disabled={generating}
                className="w-full btn-accent text-xs font-semibold py-2 cursor-pointer disabled:opacity-50"
              >
                Generate {card.type.toUpperCase()} PDF
              </button>
            </div>
          )
        })}
      </div>

      {/* Reports History Table */}
      <div className="os-surface overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
            Generated Reports Archive
          </h2>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            {reports.length} files available
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-surface-elevated)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4">Report File</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Generated Date</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-[var(--text-muted)]">
                    Loading reports list...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-[var(--text-muted)]">
                    No reports generated yet. Click above to compile your first PDF.
                  </td>
                </tr>
              ) : (
                reports.map((r, i) => (
                  <tr key={i} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[var(--text-main)]">
                      {r.filename}
                    </td>
                    <td className="py-3 px-4 uppercase font-mono text-[11px] text-[var(--text-muted)]">
                      {r.report_type || 'PDF Report'}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)] font-mono text-[11px]">
                      {r.created_at || 'Recent'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge-optimal flex items-center gap-1 w-fit">
                        <CheckCircle2 size={11} /> Ready
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDownload(r.filename)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white transition-all text-xs font-semibold cursor-pointer"
                      >
                        <Download size={13} />
                        Download
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
