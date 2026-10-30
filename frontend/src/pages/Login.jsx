import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { Store, ShieldCheck, UserCheck, KeyRound, ArrowRight, Delete, Check, Sparkles } from 'lucide-react'
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
      desc: 'Full BI Access, AI Chat, Financial Forecasts, Settings',
      defaultPin: '1111',
      badge: 'Owner Access',
      color: 'border-blue-500/40 text-blue-500'
    },
    {
      id: 'MANAGER',
      title: 'Store Manager',
      desc: 'Inventory Replenishment, Stock Audits, Operational Logs',
      defaultPin: '2222',
      badge: 'Operations',
      color: 'border-amber-500/40 text-amber-500'
    },
    {
      id: 'EMPLOYEE',
      title: 'Counter Staff',
      desc: 'High-speed POS Billing, Instant Checkout, Receipt Print',
      defaultPin: '3333',
      badge: 'Counter POS',
      color: 'border-emerald-500/40 text-emerald-500'
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

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-[var(--bg-main)] text-[var(--text-main)] select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[3px] bg-[var(--accent)] text-[var(--accent-ink)] border-2 border-[var(--border-strong)] shadow-[3px_3px_0px_var(--border-strong)] mb-1">
            <Store size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="inline-block px-2.5 py-0.5 mb-2 font-mono text-[10px] uppercase font-bold tracking-widest bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
              Enterprise Terminal · Secure Auth
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight font-display text-[var(--text-main)]">
              The Story of Your Business
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-mono uppercase tracking-wide">
              Select access tier & enter 4-digit security PIN
            </p>
          </div>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1.5 rounded-[4px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] shadow-[2px_2px_0px_var(--border-color)]">
          {roles.map((r) => {
            const isSelected = selectedRole === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedRole(r.id)
                  setPin('')
                }}
                className={`py-2 px-1 rounded-[3px] text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--border-strong)] shadow-[2px_2px_0px_var(--border-strong)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                <span className="font-display font-bold">{r.title}</span>
                <span className="text-[9px] font-mono opacity-80">
                  {r.badge}
                </span>
              </button>
            )
          })}
        </div>

        {/* PIN Pad Console */}
        <div className="card p-6 space-y-5 bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] shadow-[4px_4px_0px_var(--border-strong)]">
          {/* PIN Dots Display */}
          <div className="text-center space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] font-bold block">
              Enter 4-Digit Security PIN
            </span>
            <div className="flex justify-center items-center gap-3 py-2">
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
                className="py-3 rounded-[3px] bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--border-strong)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_var(--border-color)] hover:shadow-[1px_1px_0px_var(--border-strong)] transition-all text-base cursor-pointer"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="py-3 rounded-[3px] bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-dim)] hover:text-red-600 hover:border-red-600 active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_var(--border-color)] transition-all text-xs font-mono font-bold tracking-wider cursor-pointer uppercase"
            >
              CLR
            </button>

            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="py-3 rounded-[3px] bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--border-strong)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_var(--border-color)] hover:shadow-[1px_1px_0px_var(--border-strong)] transition-all text-base cursor-pointer"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              className="py-3 rounded-[3px] bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-main)] active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_var(--border-color)] transition-all flex items-center justify-center cursor-pointer"
            >
              <Delete size={18} />
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => submitLogin()}
            disabled={pin.length < 4 || submitting}
            className="w-full btn-accent py-3 text-xs font-bold tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase"
          >
            {submitting ? 'Authenticating Session...' : 'Authorize Terminal Session'}
          </button>
        </div>

        {/* Instant Demo Quick Start Badges */}
        <div className="card p-4 space-y-2.5 bg-[var(--bg-surface)] border-2 border-[var(--border-color)] shadow-[2px_2px_0px_var(--border-color)]">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] block text-center font-bold">
            Demo Access Profiles
          </span>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleQuickDemo(r.id, r.defaultPin)}
                className="p-2.5 rounded-[3px] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-[var(--border-strong)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] transition-all text-center cursor-pointer group shadow-[1px_1px_0px_var(--border-color)]"
              >
                <div className="text-[11px] font-bold font-display uppercase truncate">
                  {r.title}
                </div>
                <div className="text-[10px] font-mono text-[var(--text-dim)] group-hover:text-[var(--accent-ink)] mt-0.5 font-bold">
                  PIN: {r.defaultPin}
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
