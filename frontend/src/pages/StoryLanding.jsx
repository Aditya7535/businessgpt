import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  Store,
  ArrowRight,
  TrendingUp,
  Boxes,
  MessageSquare,
  FileText,
  Sparkles,
  ChevronDown,
  Sun,
  Moon,
  Calendar,
  CheckCircle2,
  Package,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react'

export default function StoryLanding() {
  const navigate = useNavigate()
  const { isAuthenticated, user, theme, toggleTheme } = useAuth()
  const [activeScene, setActiveScene] = useState(1)

  // Scroll progress bar
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  })

  // Track active scene based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight * 0.35
      const scenes = [1, 2, 3, 4, 5]
      for (const s of scenes) {
        const el = document.getElementById(`scene-${s}`)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveScene(s)
            break
          }
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleEnterApp = () => {
    if (isAuthenticated) {
      if (user?.role === 'EMPLOYEE') {
        navigate('/pos')
      } else {
        navigate('/dashboard')
      }
    } else {
      navigate('/login')
    }
  }

  const scrollToScene = (sceneNum) => {
    const el = document.getElementById(`scene-${sceneNum}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] selection:bg-[var(--accent)] selection:text-black relative overflow-x-hidden">
      {/* ── Top Neo-Brutalist Acid Progress Bar ── */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-[var(--accent)] z-50 origin-left border-b border-[var(--border-strong)]"
        style={{ scaleX }}
      />

      {/* ── Minimal Brutalist Navigation ── */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-[var(--bg-main)] border-b border-[var(--border-color)] px-6 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[var(--accent)] border border-[var(--border-strong)] flex items-center justify-center text-black font-extrabold shrink-0 shadow-[2px_2px_0px_#111111]">
            <Store size={16} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-extrabold text-base tracking-tighter uppercase font-display text-[var(--text-main)]">
              BusinessGPT
            </span>
            <span className="text-[10px] text-[var(--text-dim)] font-mono uppercase tracking-wider hidden sm:inline">
              [Autonomous Store OS]
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px]"
            title={`Switch to ${theme === 'dark' ? 'Paper Light' : 'Ink Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {isAuthenticated ? (
            <button
              onClick={handleEnterApp}
              className="btn-accent py-2 px-4 shadow-[2px_2px_0px_var(--border-strong)]"
            >
              <span>Console ({user?.name || user?.role})</span>
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="btn-accent py-2 px-4 shadow-[2px_2px_0px_var(--border-strong)]"
            >
              <span>Sign In</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </header>

      {/* ── Fixed Brutalist Scene Navigator (Desktop) ── */}
      <div className="hidden xl:flex fixed right-8 top-1/2 -translate-y-1/2 z-30 flex-col items-end gap-3 select-none">
        {[
          { id: 1, label: '01 / STATEMENT' },
          { id: 2, label: '02 / UNDERSTAND' },
          { id: 3, label: '03 / DISCOVER' },
          { id: 4, label: '04 / ANTICIPATE' },
          { id: 5, label: '05 / ACT' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => scrollToScene(s.id)}
            className="flex items-center gap-2 group cursor-pointer text-right"
          >
            <span
              className={`text-[10px] font-mono tracking-wider transition-all ${
                activeScene === s.id
                  ? 'text-[var(--text-main)] font-bold opacity-100 bg-[var(--accent)] text-black px-1.5 py-0.5 border border-black'
                  : 'text-[var(--text-dim)] group-hover:text-[var(--text-main)] opacity-70'
              }`}
            >
              {s.label}
            </span>
            <span
              className={`w-2 h-2 border border-[var(--border-color)] transition-all ${
                activeScene === s.id ? 'bg-[var(--accent)] scale-125' : 'bg-[var(--bg-surface-elevated)]'
              }`}
            />
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SCENE 01 — THE OPENING STATEMENT
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="scene-1"
        className="min-h-screen flex flex-col justify-center px-6 sm:px-12 lg:px-20 pt-28 pb-16 relative border-b border-[var(--border-color)]"
      >
        <div className="max-w-6xl w-full mx-auto space-y-8">
          <div className="flex items-center gap-2">
            <span className="chapter-pill bg-[var(--accent)] text-black border-black font-bold">
              01 / THE OPENING STATEMENT
            </span>
            <span className="text-xs font-mono text-[var(--text-dim)] uppercase">
              Edition 2026 · Indian SME Architecture
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="headline-brutal text-[var(--text-main)] font-display max-w-5xl">
              YOUR BUSINESS.
              <br />
              <span className="bg-[var(--accent)] text-black px-2 inline-block border border-black shadow-[4px_4px_0px_#111111]">
                YOUR NEXT MOVE.
              </span>
            </h1>

            <p className="text-lg sm:text-2xl text-[var(--text-muted)] font-sans max-w-2xl font-normal leading-relaxed pt-2">
              Understand what&apos;s happening. Discover what matters. Decide what comes next.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={handleEnterApp}
              className="btn-accent py-4 px-8 text-sm font-bold tracking-wide shadow-[4px_4px_0px_#111111] hover:shadow-[5px_5px_0px_#111111]"
            >
              <span>ENTER YOUR BUSINESS</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => scrollToScene(2)}
              className="btn-ghost py-4 px-8 text-sm font-bold border-[var(--border-strong)] shadow-[3px_3px_0px_var(--border-color)]"
            >
              <span>EXPLORE NARRATIVE ↓</span>
            </button>
          </div>

          {/* Brutalist Asymmetric Metric Strip */}
          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-[var(--border-color)]">
            {[
              { label: 'ARCHITECTURE', val: 'LOCAL FIRST', sub: 'High-speed offline-ready' },
              { label: 'INTELLIGENCE', val: 'REALTIME', sub: 'Instant sales & margin audit' },
              { label: 'PREDICTION', val: '30-DAY HORIZON', sub: 'Festival demand signals' },
              { label: 'DISPATCH', val: 'WHATSAPP DIRECT', sub: 'Morning automated digest' },
            ].map((col, i) => (
              <div key={i} className="p-4 os-surface-elevated border border-[var(--border-color)] space-y-1">
                <span className="text-[10px] font-mono font-bold text-[var(--text-dim)] block uppercase tracking-wider">
                  {col.label}
                </span>
                <div className="font-extrabold text-base font-display text-[var(--text-main)]">
                  {col.val}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono">
                  {col.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SCENE 02 — UNDERSTAND
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="scene-2"
        className="min-h-screen flex items-center px-6 sm:px-12 lg:px-20 py-24 border-b border-[var(--border-color)] bg-[var(--bg-surface-subtle)]"
      >
        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-2">
              <span className="chapter-pill">02 / UNDERSTAND</span>
              <span className="text-xs font-mono text-[var(--text-dim)] uppercase">
                What is happening right now
              </span>
            </div>

            <h2 className="headline-section text-[var(--text-main)] font-display">
              FIRST, SEE
              <br />
              <span className="underline decoration-[var(--accent)] decoration-4 underline-offset-4">
                WHAT&apos;S HAPPENING.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
              Every day generates scores of raw transactions. Without synthesis, revenue numbers are merely noise. BusinessGPT captures every counter sale, ledger entry, and inventory movement into one living record.
            </p>

            <div className="p-4 border-l-4 border-black bg-[var(--bg-surface)] dark:border-[var(--accent)] space-y-1">
              <div className="text-xs font-bold text-[var(--text-main)] uppercase font-mono">
                Store Operating Metric #01
              </div>
              <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                Connect your counter register, point-of-sale bills, and inventory updates into an immediate diagnostic health index.
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4 }}
            className="os-surface p-6 space-y-5 border-2 border-[var(--border-strong)] shadow-[6px_6px_0px_#111111] dark:shadow-[6px_6px_0px_#000000]"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                [LIVE TELEMETRY STREAM]
              </span>
              <span className="badge-optimal font-bold">ACTIVE</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] font-bold block">
                  Today&apos;s Store Revenue
                </span>
                <span className="text-2xl font-extrabold font-mono text-[var(--text-main)]">
                  ₹28,450.00
                </span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 block font-bold">
                  ▲ +12.4% vs last week
                </span>
              </div>

              <div className="p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] font-bold block">
                  Store Health Score
                </span>
                <span className="text-2xl font-extrabold font-mono text-[var(--accent)] text-black dark:text-[var(--accent)]">
                  88 / 100
                </span>
                <span className="text-[10px] font-mono text-[var(--text-dim)] block font-bold">
                  GRADE A (STABLE)
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-2">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span>INVENTORY STABILITY</span>
                <span>94% OPTIMAL</span>
              </div>
              <div className="w-full bg-[var(--bg-surface)] h-2 border border-[var(--border-color)]">
                <div className="bg-[var(--accent)] h-full" style={{ width: '94%' }} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SCENE 03 — DISCOVER
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="scene-3"
        className="min-h-screen flex items-center px-6 sm:px-12 lg:px-20 py-24 border-b border-[var(--border-color)]"
      >
        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4 }}
            className="os-surface p-6 space-y-4 border-2 border-[var(--border-strong)] shadow-[6px_6px_0px_#111111] dark:shadow-[6px_6px_0px_#000000] order-2 lg:order-1"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <span className="font-mono text-xs font-bold uppercase text-[var(--text-main)]">
                [STOCK & MARGIN DISCOVERY]
              </span>
              <span className="text-[10px] font-mono text-[var(--text-dim)]">Realtime Audit</span>
            </div>

            <div className="space-y-2.5">
              {[
                { name: 'Basmati Rice 5kg (Premium)', stock: '8 units remaining', status: 'CRITICAL', color: 'badge-critical' },
                { name: 'Mustard Oil 1L Pouch', stock: '14 units remaining', status: 'LOW STOCK', color: 'badge-low' },
                { name: 'Pure Cow Ghee 500ml', stock: '42 units available', status: 'OPTIMAL', color: 'badge-optimal' },
              ].map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <div className="font-bold text-[var(--text-main)] font-sans">{row.name}</div>
                    <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{row.stock}</div>
                  </div>
                  <span className={row.color}>{row.status}</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-[var(--accent)] text-black border border-black text-xs font-bold flex items-center justify-between">
              <span>Automatic reorder recommendation ready</span>
              <ArrowRight size={13} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4 }}
            className="space-y-6 order-1 lg:order-2"
          >
            <div className="flex items-center gap-2">
              <span className="chapter-pill">03 / DISCOVER</span>
              <span className="text-xs font-mono text-[var(--text-dim)] uppercase">
                What changed and why it matters
              </span>
            </div>

            <h2 className="headline-section text-[var(--text-main)] font-display">
              LOOK CLOSER.
              <br />
              <span className="bg-[var(--accent)] text-black px-1.5 inline-block border border-black shadow-[3px_3px_0px_#111111]">
                FIND THE SIGNAL.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
              Not all inventory turnover is profitable. Some products sell fast but tie up operating cash in slim margins. Other products sit on the shelf silently draining store space.
            </p>

            <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
              BusinessGPT flags stockout risks, monitors reorder points, and highlights category sales shifts before shelves go empty.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SCENE 04 — ANTICIPATE
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="scene-4"
        className="min-h-screen flex items-center px-6 sm:px-12 lg:px-20 py-24 border-b border-[var(--border-color)] bg-[var(--bg-surface-subtle)]"
      >
        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-2">
              <span className="chapter-pill">04 / ANTICIPATE</span>
              <span className="text-xs font-mono text-[var(--text-dim)] uppercase">
                Predictive Horizon & Festivals
              </span>
            </div>

            <h2 className="headline-section text-[var(--text-main)] font-display">
              BEFORE THE
              <br />
              <span className="underline decoration-black dark:decoration-[var(--accent)] decoration-4 underline-offset-4">
                NEXT MOVE.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
              Indian retail follows a cultural calendar. Diwali, Holi, Raksha Bandhan, wedding seasons, and regional festivals cause sharp demand spikes that standard retail tools fail to model.
            </p>

            <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
              BusinessGPT synchronizes historical transaction trends with upcoming festive demand windows so you negotiate bulk stock with suppliers ahead of time.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4 }}
            className="os-surface p-6 space-y-4 border-2 border-[var(--border-strong)] shadow-[6px_6px_0px_#111111] dark:shadow-[6px_6px_0px_#000000]"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <span className="font-mono text-xs font-bold uppercase text-[var(--text-main)]">
                [30-DAY PREDICTIVE FORECAST]
              </span>
              <span className="badge-blue font-bold">SURGE DETECTED</span>
            </div>

            <div className="p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span>UPCOMING DIWALI FESTIVE SURGE</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">+35% VELOCITY</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Anticipated bulk purchases across sweets, cooking oil, ghee, and festive dry fruit gift hampers.
              </p>
              <div className="pt-2 border-t border-[var(--border-color)] text-[11px] font-mono text-[var(--text-main)] font-semibold">
                Action: Restock fast-moving grocery SKUs 12 days in advance.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 border border-[var(--border-color)] bg-[var(--bg-surface)]">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Next 30D Sales Estimate</span>
                <span className="text-lg font-bold text-[var(--text-main)]">₹8,45,000</span>
              </div>
              <div className="p-3 border border-[var(--border-color)] bg-[var(--bg-surface)]">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Confidence Interval</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">92.4%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SCENE 05 — ACT
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="scene-5"
        className="min-h-screen flex items-center px-6 sm:px-12 lg:px-20 py-24 border-b border-[var(--border-color)]"
      >
        <div className="max-w-6xl w-full mx-auto space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4 }}
            className="max-w-2xl space-y-4"
          >
            <div className="flex items-center gap-2">
              <span className="chapter-pill">05 / ACT</span>
              <span className="text-xs font-mono text-[var(--text-dim)] uppercase">
                Decide what comes next
              </span>
            </div>

            <h2 className="headline-section text-[var(--text-main)] font-display">
              MAKE YOUR
              <br />
              <span className="bg-[var(--accent)] text-black px-2 inline-block border border-black shadow-[4px_4px_0px_#111111]">
                NEXT MOVE.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
              Every insight immediately links to high-speed store execution: bill at the counter, replenish warehouse inventory, download verified tax dossiers, or consult your AI store assistant.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'COUNTER POS BILLING',
                desc: 'Fast barcode lookup, cash/UPI settlement, and instant 80mm thermal receipt printing.',
                icon: Store,
                route: '/pos',
                badge: 'F1 FAST-KEY',
              },
              {
                title: 'INVENTORY SAFEGUARD',
                desc: 'Track depleted SKUs, adjust buffer quantities, and execute 1-click supplier restocks.',
                icon: Boxes,
                route: '/inventory',
                badge: 'LIVE STOCK',
              },
              {
                title: 'AI STORE ASSISTANT',
                desc: 'Ask direct questions in Hindi, Hinglish, or English by voice or text.',
                icon: MessageSquare,
                route: '/chat',
                badge: 'VOICE READY',
              },
              {
                title: 'EXECUTIVE DOSSIERS',
                desc: 'Compile daily counter register PDFs and monthly reviews for accounting.',
                icon: FileText,
                route: '/reports',
                badge: 'PDF EXPORT',
              },
            ].map((card, i) => {
              const Icon = card.icon
              return (
                <div
                  key={i}
                  onClick={() => {
                    if (isAuthenticated) {
                      navigate(card.route)
                    } else {
                      navigate('/login')
                    }
                  }}
                  className="os-surface p-5 border border-[var(--border-strong)] flex flex-col justify-between hover:bg-[var(--bg-surface-elevated)] transition-all cursor-pointer group shadow-[3px_3px_0px_var(--border-color)] hover:shadow-[5px_5px_0px_var(--border-strong)] hover:-translate-x-0.5 hover:-translate-y-0.5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 bg-[var(--accent)] border border-black flex items-center justify-center text-black font-bold">
                        <Icon size={16} />
                      </div>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
                        {card.badge}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-[var(--text-main)] font-display uppercase tracking-tight">
                      {card.title}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed font-sans">
                      {card.desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-xs font-bold font-mono group-hover:text-[var(--accent)]">
                    <span>EXECUTE WORKFLOW</span>
                    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Final Call to Action Box */}
          <div className="p-8 os-surface border-2 border-black dark:border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[6px_6px_0px_#111111] dark:shadow-[6px_6px_0px_#000000] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-xl sm:text-2xl font-extrabold font-display text-[var(--text-main)] uppercase">
                Ready to take control of your store?
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] font-sans">
                Open the BusinessGPT operating console and discover what matters today.
              </p>
            </div>

            <button
              onClick={handleEnterApp}
              className="btn-accent py-3.5 px-8 text-xs font-bold tracking-wider shadow-[3px_3px_0px_#111111] shrink-0"
            >
              <span>{isAuthenticated ? 'OPEN STORE CONSOLE' : 'ENTER YOUR BUSINESS'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Minimal Brutalist Footer ── */}
      <footer className="py-8 px-6 border-t border-[var(--border-color)] bg-[var(--bg-main)] text-xs font-mono text-[var(--text-dim)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[var(--accent)] border border-black inline-block" />
          <span className="font-bold text-[var(--text-main)]">BusinessGPT OS</span>
          <span>· Built for Indian Small & Medium Business Owners</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => scrollToScene(1)} className="hover:underline cursor-pointer">
            Top ↑
          </button>
          <button onClick={() => navigate('/login')} className="hover:underline cursor-pointer">
            Kiosk Login
          </button>
        </div>
      </footer>
    </div>
  )
}
