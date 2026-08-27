import { useState, useEffect } from 'react'
import { AlertTriangle, XCircle, CheckCircle, Info, Bell, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPendingAlerts, generateAlerts, markAlertRead, markAllAlertsRead } from '../services/api'

const FILTERS = ['ALL', 'INVENTORY', 'FESTIVAL', 'REVENUE', 'TREND']
const SEVERITY_CONFIG = {
  HIGH:   { icon: XCircle,       cls: 'text-red-500',    bg: 'bg-red-50 border-red-200',    badge: 'badge-red' },
  MEDIUM: { icon: AlertTriangle, cls: 'text-amber-500',  bg: 'bg-amber-50 border-amber-200', badge: 'badge-yellow' },
  LOW:    { icon: Info,          cls: 'text-blue-500',   bg: 'bg-blue-50 border-blue-200',   badge: 'badge-blue' },
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const loadAlerts = async () => {
    try {
      const res = await getPendingAlerts()
      setAlerts(res.data?.alerts ?? [])
    } catch { toast.error('Alerts load nahi ho sake') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAlerts() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await generateAlerts()
      toast.success(`${res.data.generated} new alerts generated!`)
      await loadAlerts()
    } catch { toast.error('Alert generation failed') }
    finally { setGenerating(false) }
  }

  const handleReadAll = async () => {
    await markAllAlertsRead()
    setAlerts([])
    toast.success('Sab alerts read mark ho gaye!')
  }

  const handleRead = async (id) => {
    await markAlertRead(id)
    setAlerts(a => a.filter(x => x.id !== id))
  }

  const filtered = filter === 'ALL' ? alerts : alerts.filter(a => a.type === filter)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Alerts</h2>
          <p className="text-sm text-gray-500">{alerts.length} unread alerts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleGenerate} disabled={generating} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            Generate New
          </button>
          {alerts.length > 0 && (
            <button onClick={handleReadAll} className="btn-primary text-sm">Mark All Read</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 gap-3 text-gray-400">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
          <p className="font-semibold text-gray-600">Koi alerts nahi hain!</p>
          <p className="text-sm">Sab clear hai 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => {
            const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.LOW
            const Icon = cfg.icon
            return (
              <div key={alert.id} className={`flex items-start gap-4 p-4 rounded-2xl border ${cfg.bg}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.cls}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge ${cfg.badge}`}>{alert.severity}</span>
                    <span className="badge badge-gray">{alert.type}</span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">{alert.message}</p>
                  {alert.created_at && (
                    <p className="text-xs text-gray-400 mt-1">{new Date(alert.created_at).toLocaleString('en-IN')}</p>
                  )}
                </div>
                <button onClick={() => handleRead(alert.id)} className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
                  ✓ Read
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
