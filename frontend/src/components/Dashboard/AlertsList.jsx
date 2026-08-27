import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import { markAlertRead } from '../../services/api'

const SEVERITY_STYLE = {
  HIGH: { cls: 'bg-red-50 border-red-200', icon: XCircle, iconCls: 'text-red-500' },
  MEDIUM: { cls: 'bg-amber-50 border-amber-200', icon: AlertTriangle, iconCls: 'text-amber-500' },
  LOW: { cls: 'bg-blue-50 border-blue-200', icon: Info, iconCls: 'text-blue-500' },
}

export default function AlertsList({ alerts, onRead, loading }) {
  if (loading) return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
    </div>
  )

  if (!alerts?.length) return (
    <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
      <CheckCircle className="w-10 h-10 text-emerald-400" />
      <p className="text-sm font-medium">Koi active alerts nahi hain!</p>
    </div>
  )

  const handleRead = async (id) => {
    await markAlertRead(id).catch(() => {})
    onRead?.(id)
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {alerts.slice(0, 8).map((alert) => {
        const s = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.LOW
        const Icon = s.icon
        return (
          <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border ${s.cls}`}>
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${s.iconCls}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 leading-snug">{alert.message}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{alert.type}</p>
            </div>
            <button onClick={() => handleRead(alert.id)} className="text-[10px] text-gray-400 hover:text-gray-600 whitespace-nowrap">
              ✓ Read
            </button>
          </div>
        )
      })}
    </div>
  )
}
