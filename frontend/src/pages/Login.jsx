import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  ShieldCheck,
  UserCheck,
  KeyRound,
  ArrowRight,
  Delete,
  Check,
  Sparkles,
  Zap,
  Lock,
  Boxes,
  ShoppingCart,
  Crown
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  const [selectedRole, setSelectedRole] = useState('OWNER')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'EMPLOYEE') {
        navigate('/pos')
      } else {
        navigate('/dashboard')
      }
    }
  }, [isAuthenticated, user, navigate])

  const roles = [
    {
      id: 'OWNER',
      title: 'Store Owner',
      icon: Crown,
      desc: 'Executive BI, Sales Forecasts, AI Assistant & Settings',
      defaultPin: '1111',
      badge: 'Full Access',
      tag: 'Owner',
    },
    {
      id: 'MANAGER',
      title: 'Store Manager',
      icon: Boxes,
      desc: 'Inventory Restock, Audits, Supplier Orders & Reports',
      defaultPin: '2222',
      badge: 'Inventory',
      tag: 'Manager',
    },
    {
      id: 'EMPLOYEE',
      title: 'Counter Staff',
      icon: ShoppingCart,
      desc: 'Fast POS Cash Register, Barcode Billing, Receipts',
      defaultPin: '3333',
      badge: 'POS Cashier',
      tag: 'Staff',
    }
  ]

  const handleKeyPress = (num) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num)
    }
  }

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1))
  }

  const handleClear = () => {
    setPin('')
  }

  const handleQuickDemo = (roleId, demoPin) => {
    setSelectedRole(roleId)
    setPin(demoPin)
    submitLogin(roleId, demoPin)
  }

  const submitLogin = async (roleToUse = selectedRole, pinToUse = pin) => {
    if (!pinToUse || pinToUse.length < 4) {
      toast.error('Please enter a 4-digit PIN.')
      return
    }

    try {
      setSubmitting(true)
      const loggedUser = await login(roleToUse, pinToUse)
      toast.success(`Welcome back, ${loggedUser.name}!`)
      if (loggedUser.role === 'EMPLOYEE') {
        navigate('/pos')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Login failed. Invalid PIN.'
      toast.error(msg)
      setPin('')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle keyboard numbers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        if (pin.length < 6) setPin((prev) => prev + e.key)
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1))
      } else if (e.key === 'Enter') {
        submitLogin()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pin, selectedRole])

  const activeRoleData = roles.find((r) => r.id === selectedRole) || roles[0]

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-[var(--bg-main)] text-[var(--text-main)] select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg space-y-5"
      >
        {/* Brand Banner with Official Logo */}
        <div className="text-center space-y-2.5">
          <div className="flex justify-center">
            <img
              src="/logo_transparent.png"
              alt="BusinessGPT - Your Business Partner"
              className="h-28 sm:h-32 w-auto object-contain drop-shadow-md hover:scale-105 transition-transform duration-300"
            />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 mb-1.5 font-mono text-[10px] uppercase font-bold tracking-widest bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] shadow-[1px_1px_0px_var(--border-color)]">
              <Sparkles size={11} className="text-emerald-500" />
              <span>Autonomous Store OS · Indian SME Intelligence</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wide">
              Select your role or click instant 1-tap demo access below
            </p>
          </div>
        </div>

        {/* 1-Click Instant Demo Profiles - High Visibility */}
        <div className="card p-3.5 bg-[var(--bg-surface)] border-2 border-[var(--border-color)] shadow-[3px_3px_0px_var(--border-color)] space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-bold">
            <span className="flex items-center gap-1 text-[var(--text-main)]">
              <Zap size={12} className="text-amber-500 fill-amber-500" />
              Instant 1-Click Sign In
            </span>
            <span>Pre-Configured PINs</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {roles.map((r) => {
              const Icon = r.icon
              const isSelected = selectedRole === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleQuickDemo(r.id, r.defaultPin)}
                  className={`p-2.5 rounded-[3px] text-left transition-all cursor-pointer group border flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[var(--accent)] text-black border-black shadow-[2px_2px_0px_#111111] font-bold'
                      : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-main)] hover:border-black hover:bg-[var(--accent)] hover:text-black shadow-[1px_1px_0px_var(--border-color)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold font-display uppercase">
                      <Icon size={14} className="shrink-0" />
                      {r.title}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono opacity-80 mb-2 truncate">
                    {r.badge} · PIN: {r.defaultPin}
                  </div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 bg-black text-[var(--accent)] rounded-[2px] text-center w-full group-hover:bg-black group-hover:text-white transition-colors">
                    1-Tap Enter →
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* PIN Pad Console for Manual Entry */}
        <div className="card p-5 space-y-4 bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] shadow-[4px_4px_0px_var(--border-strong)]">
          {/* Active Role Indicator */}
          <div className="flex items-center justify-between p-2 rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold text-[var(--text-dim)]">Selected Tier:</span>
              <span className="font-bold uppercase font-display text-[var(--text-main)]">{activeRoleData.title}</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-dim)]">Default: {activeRoleData.defaultPin}</span>
          </div>

          {/* PIN Dots Display */}
          <div className="text-center space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold block">
              Enter 4-Digit Security PIN
            </span>
            <div className="flex justify-center items-center gap-3 py-1">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-[2px] transition-all duration-120 ${
                      filled
                        ? 'bg-[var(--accent)] border-2 border-[var(--border-strong)] scale-110 shadow-[1px_1px_0px_var(--border-strong)]'
                        : 'border-2 border-[var(--border-color)] bg-[var(--bg-surface-elevated)]'
                    }`}
                  />
                )
              })}
            </div>
          </div>

          {/* Numeric Keypad Grid */}
          <div className="grid grid-cols-3 gap-2 font-mono font-bold">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="py-2.5 rounded-[3px] bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--border-strong)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_var(--border-color)] hover:shadow-[1px_1px_0px_var(--border-strong)] transition-all text-sm cursor-pointer"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="py-2.5 rounded-[3px] bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-dim)] hover:text-red-600 hover:border-red-600 active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_var(--border-color)] transition-all text-xs font-mono font-bold tracking-wider cursor-pointer uppercase"
            >
              CLR
            </button>

            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="py-2.5 rounded-[3px] bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--border-strong)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_var(--border-color)] hover:shadow-[1px_1px_0px_var(--border-strong)] transition-all text-sm cursor-pointer"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 rounded-[3px] bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-main)] active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_var(--border-color)] transition-all flex items-center justify-center cursor-pointer"
            >
              <Delete size={17} />
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => submitLogin()}
            disabled={pin.length < 4 || submitting}
            className="w-full btn-accent py-3 text-xs font-bold tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase shadow-[3px_3px_0px_var(--border-strong)]"
          >
            {submitting ? 'Authorizing Session...' : `Authorize as ${activeRoleData.title}`}
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center font-mono text-[10px] text-[var(--text-dim)] uppercase">
          BusinessGPT Enterprise · Powered by Llama 3 & Local Hybrid Intelligence
        </div>
      </motion.div>
    </div>
  )
}
