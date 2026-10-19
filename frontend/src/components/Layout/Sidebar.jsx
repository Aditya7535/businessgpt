import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ShoppingCart,
  Boxes,
  Terminal,
  LineChart,
  FileText,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Store,
  Sparkles,
  LayoutDashboard,
  Upload
} from 'lucide-react'

export default function Sidebar() {
  const { user, hasRole } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['OWNER'],
    },
    {
      to: '/pos',
      label: 'POS Billing',
      icon: ShoppingCart,
      roles: ['EMPLOYEE', 'MANAGER', 'OWNER'],
      shortcut: 'F1'
    },
    {
      to: '/inventory',
      label: 'Inventory',
      icon: Boxes,
      roles: ['MANAGER', 'OWNER'],
      badge: 'Live'
    },
    {
      to: '/chat',
      label: 'AI Chat',
      icon: Terminal,
      roles: ['OWNER'],
      highlight: true
    },
    {
      to: '/analytics',
      label: 'Analytics',
      icon: LineChart,
      roles: ['OWNER'],
    },
    {
      to: '/reports',
      label: 'Reports',
      icon: FileText,
      roles: ['MANAGER', 'OWNER'],
    },
    {
      to: '/alerts',
      label: 'Alerts',
      icon: Bell,
      roles: ['MANAGER', 'OWNER'],
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      roles: ['OWNER'],
    },
    {
      to: '/upload',
      label: 'Upload Data',
      icon: Upload,
      roles: ['MANAGER', 'OWNER'],
    },
  ]

  // Filter items visible to user
  const visibleItems = navItems.filter((item) => hasRole(item.roles))

  return (
    <aside
      className={`border-r border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col justify-between transition-all duration-200 z-40 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div>
        {/* Brand Header */}
        <div className="h-14 border-b border-[var(--border-color)] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shrink-0 shadow-sm shadow-blue-500/20">
              <Store size={18} />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-[var(--text-main)] flex items-center gap-1">
                  BusinessGPT
                  <Sparkles size={11} className="text-blue-500" />
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
                  OS Terminal v8
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon size={17} className="shrink-0" />
                {!collapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span>{item.label}</span>
                    {item.highlight && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">
                        AI
                      </span>
                    )}
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Role Footer */}
      {!collapsed && user && (
        <div className="p-3 border-t border-[var(--border-color)] m-2 rounded-lg bg-[var(--bg-surface-elevated)]">
          <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            Active Mode
          </div>
          <div className="text-xs font-medium text-[var(--text-main)] truncate mt-0.5">
            {user.role === 'OWNER' && 'Full BI & AI Access'}
            {user.role === 'MANAGER' && 'Store Operations & Inventory'}
            {user.role === 'EMPLOYEE' && 'Counter Billing Mode'}
          </div>
        </div>
      )}
    </aside>
  )
}
