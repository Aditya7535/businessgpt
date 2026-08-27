import { Menu, Bell, RefreshCw } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getPendingAlerts } from '../../services/api'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/chat': 'Ask BusinessGPT',
  '/analytics': 'Analytics',
  '/upload': 'Upload Data',
  '/alerts': 'Alerts',
  '/reports': 'Reports',
}

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    getPendingAlerts()
      .then(r => setUnread(r.data?.unread_count || 0))
      .catch(() => {})
  }, [pathname])

  return (
    <header className="h-[68px] bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden text-gray-500 hover:text-gray-800 transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{PAGE_TITLES[pathname] || 'BusinessGPT'}</h1>
      </div>
      <div className="flex items-center gap-3">
        <a href="/alerts" className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </a>
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">BG</span>
        </div>
      </div>
    </header>
  )
}
