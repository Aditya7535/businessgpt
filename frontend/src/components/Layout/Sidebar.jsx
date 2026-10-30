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
  Upload,
  Compass,
  Command
} from 'lucide-react'

export default function Sidebar() {
  const { user, hasRole } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const navChapters = [
    {
      chapter: '01 · UNDERSTAND',
      items: [
        {
          to: '/dashboard',
          label: 'Executive Story',
          icon: LayoutDashboard,
          roles: ['OWNER'],
        },
        {
          to: '/pos',
          label: 'POS Register',
          icon: ShoppingCart,
          roles: ['EMPLOYEE', 'MANAGER', 'OWNER'],
          shortcut: 'F1',
        },
      ],
    },
    {
      chapter: '02 · DISCOVER & ANTICIPATE',
      items: [
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
      ],
    },
    {
      chapter: '03 · ACT & GROW',
      items: [
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
      ],
    },
    {
      chapter: 'MANAGE',
      items: [
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
      ],
    },
  ]

  return (
    <aside
      className={`border-r border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col justify-between transition-all duration-200 z-40 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Brand Header */}
        <div className="h-16 border-b border-[var(--border-color)] px-4 flex items-center justify-between">
          <NavLink to="/story" className="flex items-center gap-3 overflow-hidden group cursor-pointer" title="View The Story of Your Business">
            <div className="w-8 h-8 rounded-none bg-[var(--accent)] border border-black flex items-center justify-center text-black font-extrabold shrink-0 shadow-[2px_2px_0px_#111111] group-hover:translate-x-0.5 transition-transform">
              <Store size={16} />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-sm tracking-tight text-[var(--text-main)] font-display uppercase truncate">
                  BusinessGPT
                </span>
                <span className="text-[10px] text-[var(--text-dim)] font-mono uppercase tracking-wider truncate">
                  [Store OS]
                </span>
              </div>
            )}
          </NavLink>

          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="py-3 px-2 space-y-4">
          {navChapters.map((group, groupIdx) => {
            const visibleInGroup = group.items.filter((item) => hasRole(item.roles))
            if (visibleInGroup.length === 0) return null

            return (
              <div key={groupIdx} className="space-y-1">
                {!collapsed && (
                  <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-bold">
                    {group.chapter}
                  </div>
                )}
                {visibleInGroup.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 py-2 rounded-none text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-[var(--accent)] text-black border border-black shadow-[2px_2px_0px_#111111] font-bold'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] border border-transparent'
                        }`
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={16} className="shrink-0" />
                      {!collapsed && (
                        <div className="flex items-center justify-between w-full min-w-0">
                          <span className="truncate">{item.label}</span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1 font-mono text-[9px]">
                            {item.highlight && (
                              <span className="px-1 py-0.2 bg-black text-[var(--accent)] font-bold border border-black">
                                AI
                              </span>
                            )}
                            {item.badge && (
                              <span className="px-1 py-0.2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-bold">
                                {item.badge}
                              </span>
                            )}
                            {item.shortcut && (
                              <span className="px-1 py-0.2 border border-[var(--border-color)] text-[var(--text-dim)]">
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
            )
          })}
        </div>
      </div>

      {/* Role Footer */}
      {!collapsed && user && (
        <div className="p-3 border-t border-[var(--border-color)] m-2 rounded-none bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] shadow-[2px_2px_0px_var(--border-color)]">
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
