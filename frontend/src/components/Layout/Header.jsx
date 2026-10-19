import React from 'react'
import { useAuth } from '../../context/AuthContext'
import { Sun, Moon, Bell, LogOut, ShieldCheck, User } from 'lucide-react'

export default function Header() {
  const { user, logout, theme, toggleTheme } = useAuth()

  const getRoleBadgeStyle = (role) => {
    switch (role?.toUpperCase()) {
      case 'OWNER':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'MANAGER':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'EMPLOYEE':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
  }

  return (
    <header className="h-14 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)]">
          Store Operations Console
        </span>
        <span className="text-xs text-[var(--text-muted)] opacity-50">/</span>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live POS Network</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Role Badge */}
        {user && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${getRoleBadgeStyle(
              user.role
            )}`}
          >
            <ShieldCheck size={13} />
            <span>{user.role}</span>
          </div>
        )}

        {/* User Pill */}
        {user && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-main)]">
            <User size={12} className="text-[var(--text-muted)]" />
            <span>{user.name}</span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          className="p-2 rounded-md border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-all cursor-pointer"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out of console"
          className="p-2 rounded-md border border-[var(--border-color)] text-red-500 hover:bg-red-500/10 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium"
        >
          <LogOut size={14} />
          <span className="hidden md:inline">Exit</span>
        </button>
      </div>
    </header>
  )
}
