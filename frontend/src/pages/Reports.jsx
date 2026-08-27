import { useState } from 'react'
import { FileText, Download, Loader2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateReport } from '../services/api'

const PERIODS = ['monthly', 'weekly']

export default function Reports() {
  const [period, setPeriod] = useState('monthly')
  const [month, setMonth] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await generateReport(period, month)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `businessgpt_${period}_report.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded!')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Report generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Generate Business Report</h2>
        <p className="text-sm text-gray-500 mt-1">Download a PDF report with health score, sales, inventory & recommendations</p>
      </div>

      <div className="card space-y-5">
        {/* Period selector */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Report Period</label>
          <div className="flex gap-3">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`flex-1 py-3 rounded-xl border font-medium text-sm capitalize transition-all ${period === p ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Month label */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Period Label (optional)</label>
          <input
            value={month}
            onChange={e => setMonth(e.target.value)}
            placeholder="e.g. July 2026"
            className="input"
          />
        </div>

        {/* What's included */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Report includes:</p>
          {['Business Health Score (A-F grade)', 'Sales Performance & Top Products', 'Inventory Status & Alerts', 'Seasonal Recommendations', 'Top 3 Action Items'].map(item => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />{item}
            </div>
          ))}
        </div>

        <button onClick={handleGenerate} disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base">
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" />Generating PDF...</>
          ) : (
            <><Download className="w-5 h-5" />Download {period} Report</>
          )}
        </button>
      </div>
    </div>
  )
}
