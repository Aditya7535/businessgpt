import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function SalesChart({ data, loading }) {
  if (loading) return <div className="skeleton h-56 w-full" />

  const chartData = data?.forecast?.slice(0, 30).map((item, i) => ({
    date: item.ds ? item.ds.slice(5, 10) : `D${i + 1}`,
    forecast: Math.round(item.yhat ?? 0),
    upper: Math.round(item.yhat_upper ?? 0),
    lower: Math.round(item.yhat_lower ?? 0),
  })) ?? []

  if (!chartData.length) return (
    <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
      Upload sales data to see forecast chart
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="forecast" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Forecast" />
        <Line type="monotone" dataKey="upper" stroke="#93c5fd" strokeWidth={1} dot={false} strokeDasharray="4 2" name="Upper" />
        <Line type="monotone" dataKey="lower" stroke="#bfdbfe" strokeWidth={1} dot={false} strokeDasharray="4 2" name="Lower" />
      </LineChart>
    </ResponsiveContainer>
  )
}
