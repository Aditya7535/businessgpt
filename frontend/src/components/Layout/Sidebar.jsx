import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, BarChart2, Upload,
  FileText, Bell, ChevronLeft, Bot, X
} from 'lucide-react'

const navItems = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat',    icon: MessageSquare,   label: 'Ask BusinessGPT' },
  { to: '/analytics', icon: BarChart2,     label: 'Analytics' },
  { to: '/upload',  icon: Upload,          label: 'Upload Data' },
  { to: '/alerts',  icon: Bell,            label: 'Alerts' },
  { to: '/reports', icon: FileText,        label: 'Reports' },
]

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onMobileClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-40 bg-white border-r border-gray-100 shadow-lg
        flex flex-col transition-all duration-300
        ${collapsed ? 'w-[68px]' : 'w-[240px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 min-h-[68px]">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-gray-900 text-sm leading-tight">BusinessGPT</p>
              <p className="text-xs text-gray-500">AI Intelligence</p>
            </div>
          )}
          <button onClick={onMobileClose} className="ml-auto lg:hidden text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onMobileClose}
              className={({ isActive }) => `
                flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl mb-0.5
                transition-all duration-200 group
                ${isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle — desktop only */}
        <div className="hidden lg:flex p-3 border-t border-gray-100">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-all"
          >
            <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>
    </>
  )
}
