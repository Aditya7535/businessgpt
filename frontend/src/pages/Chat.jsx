import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { chatAPI, voiceAPI } from '../services/api'
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
  Layers,
  Mic,
  MicOff,
  Square,
  Loader2,
  X,
  Globe,
  Settings2
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

  // ── Voice Input Recording State ──
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [transcribing, setTranscribing] = useState(false)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState(() => {
    return localStorage.getItem('businessgpt_voice_lang') || 'auto'
  })
  const [autoSendVoice, setAutoSendVoice] = useState(() => {
    return localStorage.getItem('businessgpt_voice_autosend') === 'true'
  })
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const isCancelledRef = useRef(false)

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

  // Cleanup voice recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // ── Voice Input Methods ──
  const startRecording = async () => {
    isCancelledRef.current = false
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Microphone recording is not supported on this browser.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async () => {
        // Release microphone device hardware
        stream.getTracks().forEach((track) => track.stop())
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
        }

        if (isCancelledRef.current) {
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        if (audioBlob.size < 400) {
          toast.error('Voice recording was too brief. Please speak your question.')
          return
        }

        setTranscribing(true)
        const toastId = toast.loading('Transcribing voice with Groq Whisper...', { id: 'voice-transcribe' })

        try {
          const res = await voiceAPI.transcribeAudio(audioBlob, voiceLanguage)
          const text = (res.data?.text || '').trim()
          if (text) {
            if (autoSendVoice) {
              toast.success('Voice transcribed! Executing query...', { id: toastId })
              handleSend(text)
            } else {
              setInputMessage((prev) => (prev ? `${prev} ${text}` : text))
              toast.success('Voice transcribed! Review and edit before sending.', { id: toastId })
            }
          } else {
            toast.error('No speech detected in audio. Please speak louder and retry.', { id: toastId })
          }
        } catch (err) {
          console.error('Voice transcription error:', err)
          const detail = err.response?.data?.detail || err.message || 'Voice transcription failed.'
          toast.error(detail, { id: toastId })
        } finally {
          setTranscribing(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      setIsRecording(true)
      setRecordingSeconds(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Microphone permission error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error('Microphone permission denied. Please allow audio access in your browser.')
      } else {
        toast.error('Failed to access microphone or hardware device error.')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isCancelledRef.current = false
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isCancelledRef.current = true
      audioChunksRef.current = []
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      toast('Voice recording discarded', { icon: '🗑️' })
    }
  }

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
      </div>

      {/* ── RIGHT PANEL: Main Chat Screen ── */}
      <div className="flex-1 flex flex-col os-surface overflow-hidden">
        {/* Terminal Header */}
        <div className="p-3.5 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
              AI Business Co-Pilot
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              (Live PostgreSQL & Groq LLM)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSend('Aaj ki total sales batao')}
              disabled={loading}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            >
              <RotateCcw size={11} />
              <span>Today's Sales</span>
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {historyLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] font-mono animate-pulse">
              Loading session history...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              Type or speak a question to begin.
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user'

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    {!isUser && getModuleBadge(msg.module)}
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {isUser ? 'You' : 'BusinessGPT'} &middot; {msg.timestamp}
                    </span>
                  </div>

                  {isUser ? (
                    <div className="max-w-xl p-3 rounded-xl bg-blue-600 text-white text-xs font-medium leading-relaxed shadow-sm">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="max-w-2xl p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-main)] leading-relaxed prose prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
                              <table className="w-full text-left text-xs border-collapse" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }) => <thead className="bg-blue-600/10 border-b border-[var(--border-color)] text-blue-400 font-mono text-[11px] uppercase tracking-wider" {...props} />,
                          th: ({ node, ...props }) => <th className="px-3.5 py-2 font-bold whitespace-nowrap border-r border-[var(--border-color)] last:border-r-0" {...props} />,
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
          {/* Active Voice Recording Status Bar */}
          {isRecording && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2 text-red-400 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
                <span className="font-semibold">
                  Recording ({Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')})
                </span>
                <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
                  • Language: {voiceLanguage.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-red-400 text-[11px] font-medium transition-colors cursor-pointer"
                  aria-label="Cancel and discard recording"
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-[11px] transition-colors shadow-sm shadow-red-500/20 cursor-pointer"
                  aria-label="Stop recording and transcribe"
                >
                  <Square size={11} /> Stop & Transcribe
                </button>
              </div>
            </div>
          )}

          {/* Voice Settings Bar (Collapsible) */}
          {showVoiceSettings && (
            <div className="mb-2 p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                <Globe size={13} className="text-blue-400" />
                <span className="font-medium text-[var(--text-main)]">Voice Language Hint:</span>
                <select
                  value={voiceLanguage}
                  onChange={(e) => {
                    setVoiceLanguage(e.target.value)
                    localStorage.setItem('businessgpt_voice_lang', e.target.value)
                  }}
                  className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-none"
                >
                  <option value="auto">Auto Detect (Hinglish / English / Hindi)</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="en">English</option>
                  <option value="mr">Marathi (मराठी)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSendVoice}
                  onChange={(e) => {
                    setAutoSendVoice(e.target.checked)
                    localStorage.setItem('businessgpt_voice_autosend', String(e.target.checked))
                  }}
                  className="rounded border-[var(--border-color)] text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px]">Auto-execute query after transcribing</span>
              </label>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (isRecording) {
                stopRecording()
              } else {
                handleSend()
              }
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
                placeholder={
                  transcribing
                    ? 'Transcribing voice input with Groq Whisper...'
                    : isRecording
                    ? 'Listening... Click Stop when finished speaking'
                    : 'Ask numbers, revenue, inventory, or forecasting in English or Hinglish...'
                }
                disabled={loading || transcribing}
                aria-label="Chat query input"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>

            {/* Voice Settings Toggle Button */}
            <button
              type="button"
              onClick={() => setShowVoiceSettings((prev) => !prev)}
              className={`p-2.5 rounded-lg border transition-all text-xs cursor-pointer ${
                showVoiceSettings
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                  : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-blue-400'
              }`}
              title="Voice settings (Language & Auto-execute)"
              aria-label="Voice settings"
            >
              <Settings2 size={16} />
            </button>

            {/* Voice Input Microphone Recording Button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading || transcribing}
              className={`p-2.5 rounded-lg border transition-all text-xs font-semibold cursor-pointer ${
                isRecording
                  ? 'bg-red-600 text-white border-red-500 shadow-sm shadow-red-500/30 animate-pulse'
                  : transcribing
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 cursor-wait'
                  : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-blue-500'
              }`}
              title={isRecording ? 'Stop recording & transcribe' : 'Record voice with Groq Whisper'}
              aria-label={isRecording ? 'Stop recording & transcribe' : 'Record voice input'}
            >
              {transcribing ? (
                <Loader2 size={16} className="animate-spin text-blue-400" />
              ) : isRecording ? (
                <Square size={16} className="text-white" />
              ) : (
                <Mic size={16} />
              )}
            </button>

            <button
              type="submit"
              disabled={loading || transcribing || !inputMessage.trim()}
              className="btn-accent px-4 py-2.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Execute chat query"
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
