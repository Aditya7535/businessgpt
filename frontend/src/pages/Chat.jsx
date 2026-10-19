import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { chatAPI } from '../services/api'
import {
  Terminal,
  Send,
  Database,
  TrendingUp,
  Boxes,
  Sparkles,
  RotateCcw,
  Zap,
  Plus,
  Trash2,
  MessageSquare,
  Clock,
  ChevronRight,
  Layers
} from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const INITIAL_GREETING = {
  id: 'init-1',
  role: 'assistant',
  module: 'SQL',
  text: 'Namaste! Main hoon BusinessGPT — aapka automated store intelligence terminal. PostgreSQL database real-time connect ho chuka hai. Aap direct numbers, forecasting, inventory alerts, ya SQL queries pooch sakte hain.',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
}

export default function Chat() {
  const location = useLocation()
  const navigate = useNavigate()

  // ── Session & History State ──
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('businessgpt_active_chat_session') || 'session_default'
  })
  const [sessions, setSessions] = useState([])
  const [activeTab, setActiveTab] = useState('history') // 'history' | 'prompts'
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Messages State ──
  const [messages, setMessages] = useState(() => {
    try {
      const cached = localStorage.getItem(`businessgpt_chat_cache_${sessionId}`)
      return cached ? JSON.parse(cached) : [INITIAL_GREETING]
    } catch {
      return [INITIAL_GREETING]
    }
  })

  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const chatBottomRef = useRef(null)

  const suggestedCommands = [
    { label: 'Aaj ki sales summary do', query: 'Aaj ki sales summary aur total revenue batao' },
    { label: 'Kaunsa product slow chal raha hai?', query: 'Kaunsa product slow chal raha hai pichle 30 din mein?' },
    { label: 'Top 3 products by revenue', query: 'Top 3 products by revenue batao' },
    { label: 'Agle mahine ka forecast', query: 'Agle mahine ka sales forecast kya hai?' },
    { label: 'Low stock alert hai kya?', query: 'Kaunse products ka stock reorder point se kam hai?' },
  ]

  // Persist current session ID
  useEffect(() => {
    localStorage.setItem('businessgpt_active_chat_session', sessionId)
  }, [sessionId])

  // Persist messages cache whenever messages change
  useEffect(() => {
    try {
      localStorage.setItem(`businessgpt_chat_cache_${sessionId}`, JSON.stringify(messages))
    } catch (e) {
      // Ignore quota errors
    }
  }, [messages, sessionId])

  // Scroll to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Fetch all sessions on mount
  const loadSessions = async () => {
    try {
      const res = await chatAPI.getSessions()
      if (res.data) {
        setSessions(res.data)
      }
    } catch (err) {
      console.warn('Could not load sessions:', err)
    }
  }

  // Load chat history for current session from database
  const loadHistoryForSession = async (sId) => {
    setHistoryLoading(true)
    try {
      const res = await chatAPI.getHistory(sId)
      if (res.data && res.data.length > 0) {
        setMessages(res.data)
      } else {
        setMessages([INITIAL_GREETING])
      }
    } catch (err) {
      console.warn('Could not fetch server chat history, using local cache:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Load history whenever sessionId changes
  useEffect(() => {
    loadHistoryForSession(sessionId)
    loadSessions()
  }, [sessionId])

  // Handle incoming initialQuery from other pages (e.g. Dashboard shortcuts)
  useEffect(() => {
    if (location.state?.initialQuery) {
      const q = location.state.initialQuery
      navigate(location.pathname, { replace: true, state: {} })
      handleSend(q)
    }
  }, [location.state])

  // Start a new chat session
  const handleNewChat = () => {
    const newSessionId = `session_${Date.now()}`
    setSessionId(newSessionId)
    setMessages([INITIAL_GREETING])
    toast.success('New chat session started!')
  }

  // Switch to an existing session
  const handleSelectSession = (sId) => {
    if (sId === sessionId) return
    setSessionId(sId)
  }

  // Clear current chat history
  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear this conversation?')) return
    try {
      await chatAPI.clearHistory(sessionId)
      localStorage.removeItem(`businessgpt_chat_cache_${sessionId}`)
      setMessages([INITIAL_GREETING])
      await loadSessions()
      toast.success('Chat history cleared.')
    } catch (err) {
      toast.error('Failed to clear chat history on server.')
    }
  }

  const handleSend = async (queryText = inputMessage) => {
    const textToSend = queryText.trim()
    if (!textToSend || loading) return

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputMessage('')
    setLoading(true)

    try {
      const res = await chatAPI.sendMessage(textToSend, sessionId)
      const aiResponse = res.data

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: aiResponse.response,
        module: aiResponse.module_used || 'SQL',
        confidence: aiResponse.confidence,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, aiMsg])
      // Refresh session list so recent preview updates
      loadSessions()
    } catch (err) {
      toast.error('AI assistant service error. Check connection.')
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          module: 'ERROR',
          text: '⚠️ Query process karne mein dikkat aayi. Please retry karein.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const getModuleBadge = (module) => {
    const m = (module || 'SQL').toUpperCase()
    if (m === 'SQL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
          <Database size={11} />
          [SQL]
        </span>
      )
    }
    if (m === 'FORECAST' || m === 'FORECASTING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
          <TrendingUp size={11} />
          [FORECAST]
        </span>
      )
    }
    if (m === 'INVENTORY') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Boxes size={11} />
          [INVENTORY]
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <Sparkles size={11} />
        [RAG]
      </span>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5.5rem)]"
    >
      {/* ── LEFT PANEL: Terminal Command Hub & Chat History ── */}
      <div className="hidden lg:flex lg:w-80 flex-col os-surface overflow-hidden">
        {/* Header with New Chat & Clear */}
        <div className="p-3.5 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">AI Workspace</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-sm"
              title="Start a new chat conversation"
            >
              <Plus size={12} />
              <span>New</span>
            </button>
            <button
              onClick={handleClearHistory}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Clear current conversation"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Chat History vs Suggested Prompts */}
        <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-surface)] p-1 text-xs">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-[var(--bg-surface-elevated)] text-blue-500 font-semibold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <MessageSquare size={13} />
            <span>History ({sessions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'prompts'
                ? 'bg-[var(--bg-surface-elevated)] text-blue-500 font-semibold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Zap size={13} />
            <span>Prompts</span>
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {activeTab === 'history' ? (
            sessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                <Clock size={20} className="mx-auto mb-2 opacity-50" />
                <p>No past chat history yet.</p>
                <p className="text-[11px] mt-1 text-[var(--text-muted)]">Conversations are saved automatically.</p>
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = s.session_id === sessionId
                return (
                  <button
                    key={s.session_id}
                    onClick={() => handleSelectSession(s.session_id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 group ${
                      isActive
                        ? 'border-blue-500 bg-blue-500/10 text-[var(--text-main)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:border-blue-500/50 text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-xs text-[var(--text-main)] truncate max-w-[170px]">
                        {s.title}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {s.message_count} msgs
                      </span>
                    </div>
                    {s.last_message && (
                      <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[220px]">
                        {s.last_message}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-0.5">
                      <span>{s.last_active}</span>
                      <ChevronRight size={11} className={`opacity-0 group-hover:opacity-100 ${isActive ? 'text-blue-500 opacity-100' : ''}`} />
                    </div>
                  </button>
                )
              })
            )
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1 px-1">
                Suggested Prompts
              </div>
              {suggestedCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(cmd.query)}
                  className="w-full text-left p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:border-blue-500 hover:text-blue-500 text-xs font-medium text-[var(--text-main)] transition-all cursor-pointer flex items-center justify-between group"
                >
                  <span className="truncate">{cmd.label}</span>
                  <Zap size={12} className="opacity-0 group-hover:opacity-100 text-blue-500 shrink-0 ml-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Engine Pipeline Status (Docked at bottom) */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-surface)] space-y-1.5">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Active Engines</div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--text-main)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                PostgreSQL SQL
              </span>
              <span className="text-[10px] text-emerald-500">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--text-main)]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Groq Llama-3 70B
              </span>
              <span className="text-[10px] text-blue-500">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTER PANEL: Terminal Chat Stream ── */}
      <div className="flex-1 flex flex-col os-surface overflow-hidden">
        {/* Terminal Title Bar */}
        <div className="h-11 border-b border-[var(--border-color)] px-4 flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
            </div>
            <span className="text-xs font-mono font-medium text-[var(--text-muted)] ml-2">
              bash: businessgpt --bi-terminal
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {sessionId}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewChat}
              className="lg:hidden flex items-center gap-1 text-xs text-blue-500 font-semibold cursor-pointer"
            >
              <Plus size={14} /> New
            </button>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span>Online</span>
            </div>
          </div>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 font-mono text-xs">
          {historyLoading ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)] animate-pulse">
              Loading chat history...
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isUser
                      ? 'border-blue-500/30 bg-blue-500/5 text-[var(--text-main)] ml-auto max-w-2xl'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] mr-auto max-w-3xl w-full'
                  }`}
                >
                  {/* Meta Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[11px] text-[var(--text-main)]">
                        {isUser ? '> user@counter' : 'businessgpt@os'}
                      </span>
                      {!isUser && getModuleBadge(msg.module)}
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{msg.timestamp}</span>
                  </div>

                  {/* Message Body */}
                  {isUser ? (
                    <div className="whitespace-pre-wrap leading-relaxed text-[13px] font-sans">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="text-[13px] font-sans text-[var(--text-main)]">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ node, ...props }) => <p className="leading-relaxed mb-2 last:mb-0" {...props} />,
                          strong: ({ node, ...props }) => <strong className="font-semibold text-[var(--text-main)] dark:text-white" {...props} />,
                          em: ({ node, ...props }) => <em className="italic text-[var(--text-main)]" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 my-2 text-[var(--text-main)]" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 my-2 text-[var(--text-main)]" {...props} />,
                          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                          h1: ({ node, ...props }) => <h1 className="text-base font-bold text-[var(--text-main)] mt-3 mb-1" {...props} />,
                          h2: ({ node, ...props }) => <h2 className="text-sm font-bold text-[var(--text-main)] mt-2.5 mb-1" {...props} />,
                          h3: ({ node, ...props }) => <h3 className="text-xs font-bold text-[var(--text-main)] mt-2 mb-1" {...props} />,
                          code: ({ node, inline, ...props }) => (
                            <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono text-[11px] text-amber-500 dark:text-amber-400" {...props} />
                          ),
                          pre: ({ node, ...props }) => (
                            <pre className="bg-black/20 dark:bg-black/50 p-3 rounded-lg overflow-x-auto my-2 border border-[var(--border-color)] font-mono text-xs text-[var(--text-main)]" {...props} />
                          ),
                          blockquote: ({ node, ...props }) => (
                            <blockquote className="border-l-2 border-blue-500 pl-3 my-2 italic text-[var(--text-muted)]" {...props} />
                          ),
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
                              <table className="w-full text-xs text-left border-collapse" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }) => <thead className="bg-blue-500/10 text-[var(--text-main)] font-semibold border-b border-[var(--border-color)]" {...props} />,
                          th: ({ node, ...props }) => <th className="px-3.5 py-2 font-semibold text-[var(--text-main)] border-r border-[var(--border-color)] last:border-r-0 whitespace-nowrap" {...props} />,
                          td: ({ node, ...props }) => <td className="px-3.5 py-2 border-t border-[var(--border-color)] border-r border-[var(--border-color)] last:border-r-0 text-[var(--text-main)] whitespace-nowrap" {...props} />,
                          tr: ({ node, ...props }) => <tr className="hover:bg-blue-500/5 transition-colors odd:bg-transparent even:bg-[var(--bg-surface-elevated)]/40" {...props} />,
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {loading && (
            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] max-w-md animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono text-blue-500">Generating SQL & executing query...</span>
              </div>
              <div className="h-3 bg-[var(--border-color)] rounded w-3/4 mb-1.5"></div>
              <div className="h-3 bg-[var(--border-color)] rounded w-1/2"></div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Terminal Input Bar */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 font-mono text-xs">
                $&gt;
              </div>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask numbers, revenue, inventory, or forecasting in English or Hinglish..."
                disabled={loading}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="btn-accent px-4 py-2.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send size={14} />
              <span className="hidden sm:inline">Execute</span>
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  )
}
