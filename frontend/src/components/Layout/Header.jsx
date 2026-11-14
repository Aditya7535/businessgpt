import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  User,
  Search,
  Menu,
  Sparkles,
  HelpCircle,
  ShoppingCart,
  Boxes,
  LineChart,
  X,
  Keyboard,
  Info
} from 'lucide-react'

export default function Header({ onToggleMobileSidebar = () => {} }) {
  const { user, logout, theme, toggleTheme } = useAuth()
  const navigate = useNavigate()
  const [showQuickHelp, setShowQuickHelp] = useState(false)

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
    <header className="h-16 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors select-none">
      {/* Left: Mobile Toggle + Brand + Spotlight Search */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Mobile Hamburger Menu */}
        <button
          onClick={onToggleMobileSidebar}
          aria-label="Open menu"
          className="md:hidden p-2 rounded-[3px] border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] hover:bg-[var(--accent)] hover:text-black transition-colors cursor-pointer shadow-[1px_1px_0px_var(--border-color)]"
        >
          <Menu size={18} />
        </button>

        {/* Mobile Brand Mark */}
        <div className="flex md:hidden items-center gap-2">
          <img src="/logo_mark.png" alt="BusinessGPT" className="w-7 h-7 object-contain" />
          <span className="font-display font-extrabold text-xs tracking-tight uppercase">
            Business<span className="text-[var(--accent)] bg-black px-0.5 rounded-[2px] ml-0.5">GPT</span>
          </span>
        </div>

        {/* Desktop Status Telemetry */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="w-2 h-2 bg-emerald-500 inline-block animate-pulse rounded-full" />
          <span className="font-sans text-[11px] font-semibold text-[var(--text-main)]">
            Store Network Active
          </span>
        </div>

        {/* Global Search Pill */}
        <button
          onClick={triggerCommandPalette}
          className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)] transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px]"
        >
          <Search size={13} className="text-[var(--text-dim)]" />
          <span className="text-[11px] font-mono">Quick Search products, bills, actions...</span>
          <kbd className="font-mono text-[10px] px-1 py-0.2 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] font-bold rounded-[2px]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: User Help, Role, Theme, Logout */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Quick User Guide / Help Button */}
        <button
          onClick={() => setShowQuickHelp(true)}
          title="Quick Guide & System Help"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] hover:bg-[var(--accent)] hover:text-black hover:border-black transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-color)] text-xs font-mono font-bold active:translate-x-0.5 active:translate-y-0.5"
        >
          <HelpCircle size={14} />
          <span className="text-[11px] hidden lg:inline">Quick Help</span>
        </button>

        {/* Role Badge */}
        {user && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono border rounded-[2px] shadow-[1px_1px_0px_#111111] ${getRoleBadgeStyle(
              user.role
            )}`}
          >
            <ShieldCheck size={13} />
            <span className="uppercase">{user.role}</span>
          </div>
        )}

        {/* User Pill */}
        {user && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] font-mono rounded-[2px] shadow-[1px_1px_0px_var(--border-color)]">
            <User size={12} className="text-[var(--text-dim)]" />
            <span className="truncate max-w-[130px]">{user.name}</span>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Paper Light' : 'Ink Dark'} Mode`}
          className="p-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] rounded-[3px] transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px]"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out of console"
          className="p-2 border border-red-500 bg-[var(--bg-surface)] text-red-600 hover:bg-red-500/10 rounded-[3px] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold font-mono shadow-[2px_2px_0px_rgba(239,68,68,0.5)] active:translate-x-[1px] active:translate-y-[1px]"
        >
          <LogOut size={13} />
          <span className="hidden md:inline uppercase">Exit</span>
        </button>
      </div>

      {/* Quick Help & User Guide Modal */}
      {showQuickHelp && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowQuickHelp(false)}
        >
          <div
            className="card max-w-lg w-full p-5 space-y-4 bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] shadow-[6px_6px_0px_var(--border-strong)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2.5">
                <img src="/logo_mark.png" alt="BusinessGPT" className="w-7 h-7 object-contain" />
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-tight text-[var(--text-main)] font-display">
                    BusinessGPT User Guide
                  </h3>
                  <p className="text-[10px] font-mono text-[var(--text-dim)] uppercase">
                    Your Business Partner · Fast Reference
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickHelp(false)}
                className="p-1 rounded-[3px] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Action Cards */}
            <div className="space-y-2 text-xs">
              <div className="font-mono text-[10px] uppercase font-bold text-[var(--text-dim)]">
                Most Popular Workflows
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => { setShowQuickHelp(false); navigate('/pos'); }}
                  className="p-3 text-left rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-black hover:bg-[var(--accent)] hover:text-black transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <ShoppingCart size={15} />
                    <span>POS Counter Billing</span>
                    <span className="font-mono text-[9px] px-1 bg-black text-[var(--accent)] rounded-[2px] ml-auto">F1</span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-snug">
                    Scan or click items, apply customer info, accept UPI/Cash and print receipts.
                  </p>
                </button>

                <button
                  onClick={() => { setShowQuickHelp(false); navigate('/chat'); }}
                  className="p-3 text-left rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-black hover:bg-[var(--accent)] hover:text-black transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <Sparkles size={15} />
                    <span>Ask AI Store Assistant</span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-snug">
                    Ask questions in Hindi or English: sales summaries, low stock warnings, or forecasts.
                  </p>
                </button>

                <button
                  onClick={() => { setShowQuickHelp(false); navigate('/inventory'); }}
                  className="p-3 text-left rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-black hover:bg-[var(--accent)] hover:text-black transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <Boxes size={15} />
                    <span>Stock Health & Audit</span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-snug">
                    Review live stock levels, reorder alerts, dead stock, and supplier details.
                  </p>
                </button>

                <button
                  onClick={() => { setShowQuickHelp(false); navigate('/analytics'); }}
                  className="p-3 text-left rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-black hover:bg-[var(--accent)] hover:text-black transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <LineChart size={15} />
                    <span>Sales Forecasting</span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-snug">
                    Predict upcoming revenue taking Diwali, Holi & IPL seasonal spikes into account.
                  </p>
                </button>
              </div>
            </div>

            {/* Keyboard Shortcuts Reference */}
            <div className="p-3 rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-[var(--text-main)] mb-1">
                <Keyboard size={13} />
                <span>Quick Keyboard Shortcuts</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>Open Quick Command Palette</span>
                <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[2px] font-bold text-[var(--text-main)]">
                  Ctrl + K / ⌘K
                </kbd>
              </div>
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>Jump to POS Cash Register</span>
                <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[2px] font-bold text-[var(--text-main)]">
                  F1
                </kbd>
              </div>
            </div>

            {/* Footer Done */}
            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setShowQuickHelp(false)}
                className="btn-accent py-2 px-5 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Got It, Let's Work!
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
