import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import toast from 'react-hot-toast'
import { getForecast, analyzeInventory } from '../services/api'

const COLORS = ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
const STATUS_BADGE = {
  OPTIMAL:   'badge-green',
  LOW_STOCK: 'badge-yellow',
  CRITICAL:  'badge-red',
  OVERSTOCK: 'badge-blue',
}

export default function Analytics() {
  const [forecast, setForecast] = useState(null)
  const [inventory, setInventory] = useState(null)
  const [horizon, setHorizon] = useState('month')
  const [loadingF, setLoadingF] = useState(false)
  const [loadingI, setLoadingI] = useState(true)

  const loadForecast = async (h) => {
    setLoadingF(true)
    try {
      const res = await getForecast(h)
      setForecast(res.data)
    } catch { toast.error('Forecast load failed') }
    finally { setLoadingF(false) }
  }

  const loadInventory = async () => {
    try {
      const res = await analyzeInventory()
      setInventory(res.data)
    } catch {} finally { setLoadingI(false) }
  }

  useEffect(() => { loadForecast(horizon); loadInventory() }, [])

  const forecastChart = forecast?.forecast?.slice(0, 30).map((d, i) => ({
    date: d.ds ? d.ds.slice(5, 10) : `D${i+1}`,
    forecast: Math.round(d.yhat ?? 0),
    upper: Math.round(d.yhat_upper ?? 0),
    lower: Math.round(d.yhat_lower ?? 0),
  })) ?? []

  const inventoryChart = inventory?.analysis?.filter(a => !a.error).map(a => ({
    name: a.product?.slice(0, 12),
    stock: a.current_stock,
    reorder: a.reorder_point,
    status: a.status,
  })) ?? []

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Forecast Section */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h3 className="font-bold text-gray-900">Sales Forecast</h3>
            <p className="text-sm text-gray-500">AI-powered demand prediction with confidence intervals</p>
          </div>
          <div className="flex gap-2">
            {['week', 'month', 'quarter'].map(h => (
              <button key={h} onClick={() => { setHorizon(h); loadForecast(h) }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${horizon === h ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'}`}>
                {h}
              </button>
            ))}
          </div>
        </div>
        {loadingF ? <div className="skeleton h-56 w-full" /> : forecastChart.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={forecastChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="forecast" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Forecast" />
              <Line dataKey="upper" stroke="#93c5fd" strokeWidth={1} dot={false} strokeDasharray="4 2" name="Upper" />
              <Line dataKey="lower" stroke="#bfdbfe" strokeWidth={1} dot={false} strokeDasharray="4 2" name="Lower" />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-center text-gray-400 py-16 text-sm">Upload sales data to see forecast</p>}
        {forecast && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>Model: <b className="text-gray-700">{forecast.model_used}</b></span>
            <span>Rows: <b className="text-gray-700">{forecast.data_points}</b></span>
            <span>Narrative: <b className="text-gray-700 italic">{forecast.narrative?.slice(0, 80)}...</b></span>
          </div>
        )}
      </div>

      {/* Inventory Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-bold text-gray-900 mb-4">Stock Levels vs Reorder Point</h3>
          {loadingI ? <div className="skeleton h-48 w-full" /> : inventoryChart.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={inventoryChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="stock" fill="#2563eb" radius={[4,4,0,0]} name="Current Stock" />
                <Bar dataKey="reorder" fill="#fca5a5" radius={[4,4,0,0]} name="Reorder Point" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-400 py-12 text-sm">No inventory data</p>}
        </div>

        <div className="card">
          <h3 className="font-bold text-gray-900 mb-4">Product Status</h3>
          {loadingI ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded-xl" />)}</div> :
            inventory?.analysis?.filter(a => !a.error).length ? (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {inventory.analysis.filter(a => !a.error).map(a => (
                  <div key={a.product} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.product}</p>
                      <p className="text-xs text-gray-500">{a.days_remaining} days remaining · {a.demand_classification}</p>
                    </div>
                    <span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-gray'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-gray-400 py-12 text-sm">No inventory data</p>}
          {inventory?.health_score && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
              <span className="text-gray-500">Inventory Health:</span>
              <span className="font-bold text-gray-900">{inventory.health_score.score}/100</span>
              <span className={`badge ${inventory.health_score.grade === 'A' ? 'badge-green' : inventory.health_score.grade === 'B' ? 'badge-blue' : 'badge-red'}`}>
                {inventory.health_score.grade}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
