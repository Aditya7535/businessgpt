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
  LayoutDashboard,
  Upload,
  Compass,
  Command,
  X,
  Sparkles
} from 'lucide-react'

export default function Sidebar({ mobileOpen = false, onCloseMobile = () => {} }) {
  const { user, hasRole } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = [
    {
      to: '/dashboard',
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      roles: ['OWNER'],
    },
    {
      to: '/pos',
      label: 'POS Register',
      icon: ShoppingCart,
      roles: ['EMPLOYEE', 'MANAGER', 'OWNER'],
      shortcut: 'F1',
      badge: 'Quick',
    },
    {
      to: '/inventory',
      label: 'Inventory Health',
      icon: Boxes,
      roles: ['MANAGER', 'OWNER'],
      badge: 'Live',
    },
    {
      to: '/analytics',
      label: 'Sales Analytics',
      icon: LineChart,
      roles: ['OWNER'],
    },
    {
      to: '/market',
      label: 'Market & Festivals',
      icon: Compass,
      roles: ['MANAGER', 'OWNER'],
    },
    {
      to: '/chat',
      label: 'AI Store Assistant',
      icon: Terminal,
      roles: ['OWNER'],
      highlight: true,
    },
    {
      to: '/alerts',
      label: 'Action Alerts',
      icon: Bell,
      roles: ['MANAGER', 'OWNER'],
    },
    {
      to: '/reports',
      label: 'Dossier Reports',
      icon: FileText,
      roles: ['MANAGER', 'OWNER'],
    },
    {
      to: '/settings',
      label: 'Store Settings',
      icon: Settings,
      roles: ['OWNER'],
    },
    {
      to: '/upload',
      label: 'Data Ingestion',
      icon: Upload,
      roles: ['MANAGER', 'OWNER'],
    },
  ]

  const visibleItems = navItems.filter((item) => hasRole(item.roles))

  return (
    <aside
      className={`border-r border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col justify-between transition-all duration-200 z-50 select-none
        fixed md:static inset-y-0 left-0 
        ${mobileOpen ? 'translate-x-0 shadow-2xl' : 'max-md:-translate-x-full'}
        ${collapsed ? 'md:w-16' : 'w-72 md:w-64'}
      `}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Brand Header */}
        <div className="h-16 border-b border-[var(--border-color)] px-3.5 flex items-center justify-between bg-[var(--bg-surface)]">
          <NavLink
            to="/story"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 overflow-hidden group cursor-pointer"
            title="BusinessGPT · Your Business Partner"
          >
            {/* BusinessGPT 3D Logo Mark */}
            <div className="w-9 h-9 rounded-[4px] bg-transparent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img
                src="/logo_mark.png"
                alt="BusinessGPT"
                className="w-full h-full object-contain drop-shadow-xs"
              />
            </div>

            {(!collapsed || mobileOpen) && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-sm tracking-tight text-[var(--text-main)] font-display uppercase truncate">
                    Business
                  </span>
                  <span className="text-[11px] font-black tracking-tight text-[var(--accent-ink)] bg-[var(--accent)] border border-[var(--border-strong)] px-1 py-0 rounded-[2px]">
                    GPT
                  </span>
                </div>
                <span className="text-[9px] text-[var(--text-dim)] font-mono uppercase tracking-wider truncate font-semibold">
                  YOUR BUSINESS PARTNER
                </span>
              </div>
            )}
          </NavLink>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:flex p-1.5 rounded-[3px] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="md:hidden p-1.5 rounded-[3px] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Clean Unified Navigation List (No Chapter Headings) */}
        <div className="py-3 px-2 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[var(--accent)] text-black border border-black shadow-[2px_2px_0px_#111111] font-bold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] border border-transparent'
                  }`
                }
                title={collapsed && !mobileOpen ? item.label : undefined}
              >
                <Icon size={16} className="shrink-0" />
                {(!collapsed || mobileOpen) && (
                  <div className="flex items-center justify-between w-full min-w-0">
                    <span className="truncate">{item.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1 font-mono text-[9px]">
                      {item.highlight && (
                        <span className="px-1 py-0.2 bg-black text-[var(--accent)] font-bold border border-black rounded-[2px] flex items-center gap-0.5">
                          <Sparkles size={8} /> AI
                        </span>
                      )}
                      {item.badge && (
                        <span className="px-1 py-0.2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-bold rounded-[2px]">
                          {item.badge}
                        </span>
                      )}
                      {item.shortcut && (
                        <span className="px-1 py-0.2 border border-[var(--border-color)] text-[var(--text-dim)] rounded-[2px]">
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </NavLink>
            )
          })}
        </div>
      </div>

      {/* Role Footer */}
      {(!collapsed || mobileOpen) && user && (
        <div className="p-3 border-t border-[var(--border-color)] m-2 rounded-[4px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] shadow-[2px_2px_0px_var(--border-color)]">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] font-mono font-bold">
            <span>OPERATIONAL ROLE</span>
            <span className="flex items-center gap-1 text-[var(--text-muted)]">
              <Command size={10} />K
            </span>
          </div>
          <div className="text-xs font-bold font-sans text-[var(--text-main)] mt-0.5 truncate uppercase">
            {user.role === 'OWNER' && 'Store Owner · Full Access'}
            {user.role === 'MANAGER' && 'Operations · Inventory Manager'}
            {user.role === 'EMPLOYEE' && 'Cashier · Counter Billing'}
          </div>
        </div>
      )}
    </aside>
  )
}
