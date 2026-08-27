import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function HealthScore({ data, loading }) {
  if (loading) return (
    <div className="card flex flex-col items-center justify-center py-8 gap-3">
      <div className="skeleton w-28 h-28 rounded-full" />
      <div className="skeleton w-32 h-5" />
    </div>
  )

  const score = data?.total_score ?? 0
  const grade = data?.grade ?? 'N/A'
  const trend = data?.trend ?? 'stable'

  const gradeColor = {
    A: 'text-emerald-500', B: 'text-blue-500',
    C: 'text-amber-500', D: 'text-orange-500', F: 'text-red-500'
  }[grade] ?? 'text-gray-400'

  const ringColor = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  const radius = 45
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ

  return (
    <div className="card flex flex-col items-center py-6 gap-4">
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Business Health</p>
      {/* SVG ring */}
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} stroke="#e5e7eb" strokeWidth="10" fill="none" />
          <circle cx="50" cy="50" r={radius} stroke={ringColor} strokeWidth="10" fill="none"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">{score}</span>
          <span className={`text-lg font-bold ${gradeColor}`}>{grade}</span>
        </div>
      </div>

      {/* Trend */}
      <div className="flex items-center gap-1.5 text-sm">
        {trend === 'excellent' || trend === 'good' ? (
          <><TrendingUp className="w-4 h-4 text-emerald-500" /><span className="text-emerald-600 font-medium capitalize">{trend}</span></>
        ) : trend === 'declining' || trend === 'critical' ? (
          <><TrendingDown className="w-4 h-4 text-red-500" /><span className="text-red-600 font-medium capitalize">{trend}</span></>
        ) : (
          <><Minus className="w-4 h-4 text-gray-400" /><span className="text-gray-500 font-medium capitalize">{trend}</span></>
        )}
      </div>

      {/* Component bars */}
      {data?.components && (
        <div className="w-full space-y-2 pt-2 border-t border-gray-100">
          {Object.entries({ Revenue: [data.components.revenue, 30], Inventory: [data.components.inventory, 25], 'Sales Trend': [data.components.sales_trend, 25], Diversity: [data.components.product_diversity, 20] }).map(([label, [val, max]]) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-gray-500 truncate">{label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${(val / max) * 100}%` }} />
              </div>
              <span className="w-10 text-right font-medium text-gray-700">{val}/{max}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
