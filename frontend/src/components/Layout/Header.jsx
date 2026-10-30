import React from 'react'
import { useAuth } from '../../context/AuthContext'
import { Sun, Moon, LogOut, ShieldCheck, User, Search } from 'lucide-react'

export default function Header() {
  const { user, logout, theme, toggleTheme } = useAuth()

  const getRoleBadgeStyle = (role) => {
    switch (role?.toUpperCase()) {
      case 'OWNER':
        return 'bg-[var(--accent)] text-black border-black font-bold'
      case 'MANAGER':
        return 'bg-amber-400 text-black border-black font-bold'
      case 'EMPLOYEE':
        return 'bg-emerald-400 text-black border-black font-bold'
      default:
        return 'bg-gray-300 text-black border-black font-bold'
    }
  }

  const triggerCommandPalette = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      metaKey: true,
      bubbles: true,
    })
    window.dispatchEvent(event)
  }

  return (
    <header className="h-16 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors select-none">
      {/* Left: Store Telemetry & Spotlight Search */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="hidden lg:flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="w-2.5 h-2.5 bg-emerald-500 border border-black inline-block animate-pulse" />
          <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-[var(--text-main)]">
            [STORE POS & BI NETWORK CONNECTED]
          </span>
        </div>

        {/* Global Search Pill */}
        <button
          onClick={triggerCommandPalette}
          className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-none bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)] transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px]"
        >
          <Search size={13} className="text-[var(--text-dim)]" />
          <span className="text-[11px] font-mono">Search actions, products, or ask AI...</span>
          <kbd className="font-mono text-[10px] px-1 py-0.2 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] font-bold">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: User State, Theme Toggle, Logout */}
      <div className="flex items-center gap-2.5">
        {/* Role Badge */}
        {user && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono border shadow-[1px_1px_0px_#111111] ${getRoleBadgeStyle(
              user.role
            )}`}
          >
            <ShieldCheck size={13} />
            <span>{user.role}</span>
          </div>
        )}

        {/* User Pill */}
        {user && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] font-mono shadow-[1px_1px_0px_var(--border-color)]">
            <User size={12} className="text-[var(--text-dim)]" />
            <span className="truncate max-w-[130px]">{user.name}</span>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Paper Light' : 'Ink Dark'} Mode`}
          className="p-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px]"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out of console"
          className="p-2 border border-red-500 bg-[var(--bg-surface)] text-red-600 hover:bg-red-500/10 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold font-mono shadow-[2px_2px_0px_rgba(239,68,68,0.5)] active:translate-x-[1px] active:translate-y-[1px]"
        >
          <LogOut size={13} />
          <span className="hidden md:inline uppercase">Exit</span>
        </button>
      </div>
    </header>
  )
}
