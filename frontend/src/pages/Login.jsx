import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { Store, ShieldCheck, UserCheck, KeyRound, ArrowRight, Delete, Check } from 'lucide-react'
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
        navigate('/pos')
      }
    }
  }, [isAuthenticated, user, navigate])

  const roles = [
    {
      id: 'OWNER',
      title: 'Store Owner',
      desc: 'Full BI Access, AI Chat, Financial Forecasts, Settings',
      defaultPin: '1111',
      badge: 'Full Access',
      color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/40 text-blue-400'
    },
    {
      id: 'MANAGER',
      title: 'Store Manager',
      desc: 'Inventory Replenishment, Stock Audits, Operational Logs',
      defaultPin: '2222',
      badge: 'Operations',
      color: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400'
    },
    {
      id: 'EMPLOYEE',
      title: 'Counter Staff',
      desc: 'High-speed POS Billing, Instant Checkout, Receipt Print',
      defaultPin: '3333',
      badge: 'Counter POS',
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400'
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
      navigate('/pos')
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
        if (pin.length >= 4) submitLogin()
      } else if (e.key === 'Escape') {
        setPin('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pin, selectedRole])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="min-h-screen w-screen bg-[var(--bg-main)] flex flex-col justify-center items-center p-4"
    >
      {/* OS Terminal Style Container */}
      <div className="w-full max-w-3xl os-surface p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mb-3 shadow-lg shadow-blue-500/25">
            <Store size={26} />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-main)]">
            BusinessGPT Terminal
          </h1>
          <p className="text-xs md:text-sm text-[var(--text-muted)] mt-1 max-w-md">
            Integrated POS billing and enterprise business intelligence platform for Indian retail & SMEs.
          </p>
        </div>

        {/* Step 1: Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {roles.map((r) => {
            const isSelected = selectedRole === r.id
            return (
              <div
                key={r.id}
                onClick={() => {
                  setSelectedRole(r.id)
                  setPin('')
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/5 shadow-md'
                    : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:border-[var(--text-muted)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-main)]">{r.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${r.color}`}>
                    {r.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {r.desc}
                </p>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
                )}
              </div>
            )
          })}
        </div>

        {/* Step 2: PIN Entry Section */}
        <div className="max-w-xs mx-auto flex flex-col items-center">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            <KeyRound size={14} />
            <span>Enter 4-Digit Security PIN</span>
          </div>

          {/* PIN Indicators */}
          <div className="flex items-center gap-3 mb-6">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border transition-all ${
                    isFilled
                      ? 'bg-blue-600 border-blue-600 scale-110 shadow-sm shadow-blue-500/50'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)]'
                  }`}
                />
              )
            })}
          </div>

          {/* Virtual PIN Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-full mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyPress(num.toString())}
                className="h-12 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-semibold text-lg hover:bg-blue-600 hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-12 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-red-500 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              CLEAR
            </button>
            <button
              onClick={() => handleKeyPress('0')}
              className="h-12 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-semibold text-lg hover:bg-blue-600 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="h-12 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            >
              <Delete size={18} />
            </button>
          </div>

          {/* Submit Button */}
          <button
            onClick={() => submitLogin()}
            disabled={submitting || pin.length < 4}
            className="w-full btn-accent py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? 'Verifying...' : `Login as ${selectedRole}`}
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Quick Demo Access Bar */}
        <div className="mt-8 pt-6 border-t border-[var(--border-color)]">
          <div className="text-[11px] text-[var(--text-muted)] text-center font-mono uppercase tracking-wider mb-2.5">
            Quick Demo Shortcuts
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => handleQuickDemo('OWNER', '1111')}
              className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck size={13} />
              Owner PIN (1111)
            </button>
            <button
              onClick={() => handleQuickDemo('MANAGER', '2222')}
              className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck size={13} />
              Manager PIN (2222)
            </button>
            <button
              onClick={() => handleQuickDemo('EMPLOYEE', '3333')}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Store size={13} />
              Employee PIN (3333)
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
