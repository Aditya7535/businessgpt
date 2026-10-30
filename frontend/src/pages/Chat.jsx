import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { chatAPI, voiceAPI } from '../services/api'
import {
  Terminal,
  Send,
  Database,
  TrendingUp,
  Boxes,
  Sparkles,
  RotateCcw,
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
  Settings2,
  CheckCircle2,
  Bot,
  User as UserIcon,
  HelpCircle,
  FileCheck2
} from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const INITIAL_GREETING = {
  id: 'init-1',
  role: 'assistant',
  module: 'SQL',
  text: 'Namaste! Main hoon BusinessGPT — aapka store intelligence assistant. Aapki dukan ke sales, stock, aur forecast records live connect hain. Aap sales summary, revenue, low stock, ya agle mahine ke forecast ke bare mein direct Hindi ya English mein pooch sakte hain.',
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
  const [showSessionsSidebar, setShowSessionsSidebar] = useState(false)
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
    { label: 'Aaj ki sales summary aur revenue batao', query: 'Aaj ki sales summary aur total revenue batao' },
    { label: 'Kaunsa product slow chal raha hai?', query: 'Kaunsa product slow chal raha hai pichle 30 din mein?' },
    { label: 'Top 3 products by revenue', query: 'Top 3 products by revenue batao' },
    { label: 'Agle mahine ka forecast', query: 'Agle mahine ka sales forecast kya hai?' },
    { label: 'Low stock reorder alert hai kya?', query: 'Kaunse products ka stock reorder point se kam hai?' },
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
      console.warn('Using local conversation cache:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Load history whenever sessionId changes
  useEffect(() => {
    loadHistoryForSession(sessionId)
    loadSessions()
  }, [sessionId])

  // Handle incoming initialQuery from other pages
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
        stream.getTracks().forEach((track) => track.stop())
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
        }

        if (isCancelledRef.current) {
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        })

        if (audioBlob.size < 500) {
          toast.error('Audio recording too brief. Please speak into the mic.')
          return
        }

        try {
          setTranscribing(true)
          toast.loading('Processing voice recording...', { id: 'voice-transcribe' })

          const res = await voiceAPI.transcribeAudio(
            audioBlob,
            voiceLanguage === 'auto' ? null : voiceLanguage
          )
          const transcribedText = res.data?.text?.trim()

          if (!transcribedText) {
            toast.error('We couldn\'t hear any speech. Please try again.', { id: 'voice-transcribe' })
            return
          }

          toast.success(`Heard: "${transcribedText.slice(0, 45)}..."`, { id: 'voice-transcribe' })

          if (autoSendVoice) {
            handleSend(transcribedText)
          } else {
            setInputMessage((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText))
          }
        } catch (err) {
          console.error('Transcription error:', err)
          toast.error('We couldn\'t understand that recording. Please speak clearly or type your message.', { id: 'voice-transcribe' })
        } finally {
          setTranscribing(false)
        }
      }

      recorder.start(250)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            stopRecording()
            return 60
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      console.error('Microphone permission error:', err)
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone permission denied. Please allow microphone access in your browser settings.')
      } else {
        toast.error('Could not access your microphone. Please check browser permissions.')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
  }

  const cancelRecording = () => {
    isCancelledRef.current = true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    toast('Recording cancelled', { icon: '🚫' })
  }

  const handleVoiceLanguageChange = (lang) => {
    setVoiceLanguage(lang)
    localStorage.setItem('businessgpt_voice_lang', lang)
  }

  const handleAutoSendToggle = () => {
    const nextVal = !autoSendVoice
    setAutoSendVoice(nextVal)
    localStorage.setItem('businessgpt_voice_autosend', String(nextVal))
  }

  // ── Session Operations ──
  const handleNewSession = () => {
    const newId = `session_${Date.now()}`
    setSessionId(newId)
    setMessages([INITIAL_GREETING])
    setShowSessionsSidebar(false)
    toast.success('Started a fresh conversation.')
  }

  const handleSwitchSession = (sId) => {
    setSessionId(sId)
    setShowSessionsSidebar(false)
  }

  const handleClearCurrentSession = async () => {
    if (!window.confirm('Clear conversation history for this conversation?')) return
    try {
      await chatAPI.clearHistory(sessionId)
      localStorage.removeItem(`businessgpt_chat_cache_${sessionId}`)
      setMessages([INITIAL_GREETING])
      toast.success('Conversation cleared.')
      loadSessions()
    } catch (err) {
      toast.error('Failed to clear conversation history.')
    }
  }

  // ── Send Message ──
  const handleSend = async (messageToSend = inputMessage) => {
    const text = (typeof messageToSend === 'string' ? messageToSend : inputMessage).trim()
    if (!text || loading) return

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputMessage('')
    setLoading(true)

    try {
      const res = await chatAPI.sendMessage(text, sessionId)
      const data = res.data

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.response || 'Here is the summary based on your store records.',
        module: data.module_used || data.module || 'SQL',
        sql: data.sql_query || null,
        executionTime: data.execution_time_ms || null,
        confidence: data.confidence || null,
        inventory_adjustment: data.inventory_adjustment || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, assistantMsg])
      loadSessions()
    } catch (err) {
      console.error('Chat error:', err)
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        module: 'INFO',
        text: 'There isn\'t enough information in your current records to answer that question yet. You can rephrase, ask for general business advice, or check if the latest sales data is uploaded.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const getModuleBadge = (module) => {
    switch (module?.toUpperCase()) {
      case 'SQL':
        return { label: 'Store Sales Records', color: 'badge-blue', icon: Database }
      case 'FORECAST':
        return { label: 'Sales Forecast', color: 'badge-optimal', icon: TrendingUp }
      case 'RAG':
        return { label: 'Store Knowledge', color: 'badge-warning', icon: Boxes }
      case 'CONSULTANT':
        return { label: 'Business Guidance', color: 'badge-blue', icon: Sparkles }
      case 'INVENTORY_ADJUSTMENT':
      case 'INVENTORY_ADJUST':
        return { label: 'Inventory Adjustment', color: 'badge-optimal', icon: Boxes }
      default:
        return { label: 'Store Intelligence', color: 'badge-blue', icon: Sparkles }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="flex h-[calc(100vh-6.5rem)] relative gap-4"
    >
      {/* ── Left Sidebar (History & Prompts) ── */}
      <div
        className={`${
          showSessionsSidebar ? 'flex' : 'hidden'
        } md:flex flex-col w-72 shrink-0 os-surface border border-[var(--border-color)] overflow-hidden transition-all duration-200 z-20 absolute md:relative h-full bg-[var(--bg-surface)] shadow-xl md:shadow-none`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-main)]">
              Conversations
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-dim)]">
              {sessions.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleNewSession}
              className="p-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] hover:bg-[var(--accent-subtle)]/80 transition-colors cursor-pointer"
              title="New Conversation"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => setShowSessionsSidebar(false)}
              className="md:hidden p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="p-2 border-b border-[var(--border-subtle)] flex gap-1 bg-[var(--bg-surface-elevated)]">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1 rounded text-xs font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex-1 py-1 rounded text-xs font-medium transition-all ${
              activeTab === 'prompts'
                ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Suggestions
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
          {activeTab === 'history' ? (
            <>
              {sessions.length === 0 ? (
                <div className="py-8 text-center text-[var(--text-dim)]">
                  <Clock size={20} className="mx-auto mb-1.5 opacity-40" />
                  <span>No previous conversations.</span>
                </div>
              ) : (
                sessions.map((sess) => (
                  <button
                    key={sess.session_id}
                    onClick={() => handleSwitchSession(sess.session_id)}
                    className={`w-full text-left p-2.5 rounded-[3px] border-2 transition-all flex items-start gap-2.5 cursor-pointer ${
                      sessionId === sess.session_id
                        ? 'border-[var(--border-strong)] bg-[var(--accent)] text-[var(--accent-ink)] font-bold shadow-[2px_2px_0px_var(--border-strong)]'
                        : 'border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-main)]'
                    }`}
                  >
                    <MessageSquare size={14} className="mt-0.5 shrink-0 stroke-[2.2]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-xs uppercase font-display tracking-tight">
                        {sess.last_message ? sess.last_message.replace(/\*\*/g, '').replace(/###/g, '').trim() : 'New Question'}
                      </div>
                      <div className="text-[10px] font-mono text-[var(--text-dim)] flex items-center justify-between mt-1 opacity-80">
                        <span>{sess.message_count} messages</span>
                        <span>{sess.updated_at ? new Date(sess.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </>
          ) : (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] block mb-1">
                Common Business Questions
              </span>
              {suggestedCommands.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => {
                    handleSend(cmd.query)
                    setShowSessionsSidebar(false)
                  }}
                  className="w-full text-left p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer group"
                >
                  <div className="font-medium text-[11px] leading-snug">
                    {cmd.label}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear History Button */}
        <div className="p-2.5 border-t border-[var(--border-color)] bg-[var(--bg-surface-elevated)]">
          <button
            onClick={handleClearCurrentSession}
            className="w-full py-1.5 px-3 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/30 transition-colors text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Clear This Conversation</span>
          </button>
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col os-surface border border-[var(--border-color)] overflow-hidden bg-[var(--bg-surface)]">
        {/* Chat Canvas Header */}
        <div className="h-14 border-b border-[var(--border-color)] px-4 flex items-center justify-between bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setShowSessionsSidebar((prev) => !prev)}
              className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              title="Toggle Conversations"
            >
              <Layers size={14} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-[var(--text-main)] truncate">
                  AI Business Assistant
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-semibold">
                  Always Active
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-dim)] truncate">
                Instant conversational intelligence from your store sales records and inventory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewSession}
              className="btn-ghost text-xs py-1 px-2.5 hidden sm:inline-flex cursor-pointer"
            >
              <Plus size={13} />
              <span>New Question</span>
            </button>
          </div>
        </div>

        {/* Messages Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {historyLoading ? (
            <div className="h-full flex items-center justify-center text-[var(--text-dim)] text-xs font-mono">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)] mr-2" />
              Loading your conversation...
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user'
              const badge = !isUser ? getModuleBadge(msg.module) : null
              const BadgeIcon = badge?.icon

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl ${
                    isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                  {/* Avatar Icon */}
                  <div
                    className={`w-7 h-7 rounded-[3px] flex items-center justify-center shrink-0 mt-0.5 border-2 ${
                      isUser
                        ? 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-main)] shadow-[1px_1px_0px_var(--border-color)]'
                        : 'bg-[var(--accent)] border-[var(--border-strong)] text-[var(--accent-ink)] shadow-[1px_1px_0px_var(--border-strong)]'
                    }`}
                  >
                    {isUser ? <UserIcon size={14} className="stroke-[2.2]" /> : <Bot size={14} className="stroke-[2.2]" />}
                  </div>

                  {/* Message Bubble & Meta */}
                  <div className={`space-y-1.5 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Header info */}
                    <div className={`flex items-center gap-2 text-[10px] font-mono text-[var(--text-dim)] ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && badge && (
                        <span className={`px-1.5 py-0.2 rounded-[2px] border text-[9px] font-bold flex items-center gap-1 ${badge.color}`}>
                          {BadgeIcon && <BadgeIcon size={10} />}
                          {badge.label}
                        </span>
                      )}
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Text Body */}
                    <div
                      className={`p-3.5 rounded-[4px] text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-bold border-2 border-[var(--border-strong)] shadow-[3px_3px_0px_var(--border-strong)] rounded-tr-none'
                          : 'bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-[var(--text-main)] shadow-[3px_3px_0px_var(--border-color)] rounded-tl-none'
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap font-sans text-[var(--accent-ink)]">{msg.text}</div>
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm space-y-2">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({ node, ...props }) => (
                                <div className="overflow-x-auto my-2 rounded-[3px] border-2 border-[var(--border-color)]">
                                  <table className="w-full text-xs divide-y divide-[var(--border-subtle)]" {...props} />
                                </div>
                              ),
                              th: ({ node, ...props }) => (
                                <th className="px-3 py-2 bg-[var(--bg-surface)] text-left font-bold text-[var(--text-main)] font-mono uppercase text-[10px]" {...props} />
                              ),
                              td: ({ node, ...props }) => (
                                <td className="px-3 py-2 whitespace-nowrap text-[var(--text-muted)] font-mono" {...props} />
                              ),
                              code: ({ node, inline, ...props }) => (
                                inline ? (
                                  <code className="px-1.5 py-0.5 rounded-[2px] bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] font-mono text-[11px] font-bold" {...props} />
                                ) : (
                                  <div className="p-3 my-2 rounded-[3px] bg-[var(--bg-main)] border-2 border-[var(--border-color)] overflow-x-auto">
                                    <code className="font-mono text-[11px] text-[var(--text-main)]" {...props} />
                                  </div>
                                )
                              )
                            }}
                          >
                            {(msg.text || '')
                              .replace(/Live PostgreSQL Store Database/gi, 'Live Store Database')
                              .replace(/PostgreSQL Store Database/gi, 'Live Store Database')
                              .replace(/PostgreSQL/gi, 'Store Database')
                              .replace(/ChromaDB/gi, 'Store Knowledge Base')
                              .replace(/Vector database/gi, 'Store Knowledge Base')}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* Interactive Conversational Inventory Confirmation Card */}
                    {!isUser && msg.inventory_adjustment?.status === 'PENDING_CONFIRMATION' && (
                      <div className="mt-2.5 p-3 rounded-[3px] bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500 shadow-[2px_2px_0px_rgba(245,158,11,0.5)] flex flex-col sm:flex-row items-center justify-between gap-2.5">
                        <span className="text-xs font-mono font-bold text-amber-900 dark:text-amber-200">
                          Kya aap yeh stock update confirm karna chahte hain?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSend('Nahi')}
                            className="px-3 py-1 rounded-[2px] bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 font-mono text-xs font-bold cursor-pointer"
                          >
                            Nahi (Cancel)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSend('Haan')}
                            className="px-3 py-1 rounded-[2px] bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 font-mono text-xs font-bold cursor-pointer"
                          >
                            Haan (Confirm)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Subtle Source Citation (No raw SQL code dumping) */}
                    {!isUser && (msg.sql || msg.executionTime) && (
                      <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)] font-mono px-1">
                        <FileCheck2 size={11} className="text-emerald-500" />
                        <span>Source: Verified store transaction records</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Friendly Analyzing Indicator */}
          {loading && (
            <div className="flex gap-3 max-w-xl">
              <div className="w-7 h-7 rounded-[3px] bg-[var(--accent)] text-[var(--accent-ink)] border-2 border-[var(--border-strong)] shadow-[1px_1px_0px_var(--border-strong)] flex items-center justify-center shrink-0">
                <Bot size={14} className="stroke-[2.2]" />
              </div>
              <div className="p-3.5 rounded-[4px] bg-[var(--bg-surface-elevated)] border-2 border-[var(--border-color)] text-xs flex items-center gap-2 text-[var(--text-muted)] font-mono shadow-[2px_2px_0px_var(--border-color)]">
                <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
                <span>Reviewing your store numbers and calculating response...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Voice Recording Active Banner */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-3 bg-red-500/10 border-t border-red-500/30 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="font-semibold text-red-500 font-mono">
                  Listening ({recordingSeconds}s / 60s max)
                </span>
                <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
                  Speak Hindi, Hinglish, or English clearly
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={cancelRecording}
                  className="px-2.5 py-1 rounded bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={stopRecording}
                  className="px-3 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700 text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Square size={11} fill="white" />
                  <span>Done</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transcribing Indicator Banner */}
        {transcribing && (
          <div className="px-4 py-2.5 bg-blue-500/10 border-t border-blue-500/30 flex items-center gap-2 text-xs text-[var(--accent)] font-medium">
            <Loader2 size={13} className="animate-spin" />
            <span>Processing your voice message...</span>
          </div>
        )}

        {/* Composer Input Bar */}
        <div className="p-3 sm:p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface-elevated)]">
          {/* Quick Voice Settings Panel */}
          {showVoiceSettings && (
            <div className="mb-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-[var(--text-main)]">Language:</span>
                <div className="flex gap-1">
                  {[
                    { id: 'auto', label: 'Auto Detect' },
                    { id: 'hi', label: 'Hindi' },
                    { id: 'en', label: 'English' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => handleVoiceLanguageChange(l.id)}
                      className={`px-2 py-0.5 rounded-[2px] text-[11px] font-mono cursor-pointer font-bold ${
                        voiceLanguage === l.id
                          ? 'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--border-strong)] shadow-[1px_1px_0px_var(--border-strong)]'
                          : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-color)]'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={autoSendVoice}
                    onChange={handleAutoSendToggle}
                    className="rounded text-[var(--accent)]"
                  />
                  <span>Send automatically after speaking</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-2 focus-within:border-[var(--accent)] transition-all">
            <button
              type="button"
              onClick={() => setShowVoiceSettings((prev) => !prev)}
              className="p-2 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
              title="Voice Settings"
            >
              <Settings2 size={16} />
            </button>

            {/* Voice Record Mic Trigger */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={transcribing}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'text-[var(--text-dim)] hover:text-red-500 hover:bg-red-500/10'
              }`}
              title={isRecording ? 'Stop Recording' : 'Record voice message'}
            >
              <Mic size={16} />
            </button>

            <textarea
              rows="1"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask anything about today's sales, forecast, low stock, or profit margins..."
              className="flex-1 bg-transparent border-none text-[var(--text-main)] placeholder-[var(--text-dim)] text-xs sm:text-sm resize-none focus:outline-none min-h-[36px] max-h-32 p-1.5"
            />

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputMessage.trim() || loading}
              className="btn-accent py-2 px-3.5 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={14} />
              <span className="hidden sm:inline">Ask</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
