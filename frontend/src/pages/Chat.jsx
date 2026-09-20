import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles } from 'lucide-react'
import { sendMessage } from '../services/api'
import toast from 'react-hot-toast'

const MODULE_BADGE = {
  rag:        { label: 'RAG',       cls: 'badge-blue' },
  sql:        { label: 'SQL',       cls: 'badge-green' },
  forecasting:{ label: 'Forecast',  cls: 'badge-purple' },
  inventory:  { label: 'Inventory', cls: 'badge-amber' },
  market:     { label: 'Market',    cls: 'badge-gray' },
  health:     { label: 'Health',    cls: 'badge-green' },
  alerts:     { label: 'Alerts',    cls: 'badge-red' },
  general:    { label: 'General',   cls: 'badge-gray' },
}

const SUGGESTED = [
  'Aaj ki sales kitni hai?',
  'Kaunsa product slow hai?',
  'Agle mahine ka forecast do',
  'Inventory alert hai kya?',
  'Mera business kaisa chal raha hai?',
  'Konsa product overstock hai?',
]

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-primary-600" />
      </div>
      <div className="chat-ai px-4 py-3">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const badge = MODULE_BADGE[msg.module] ?? MODULE_BADGE.general

  return (
    <div className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-primary-600' : 'bg-primary-100'}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-primary-600" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isUser && msg.module && (
          <span className={`badge text-[10px] ${badge.cls}`}>{badge.label}</span>
        )}
        <div className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'chat-user' : 'chat-ai'}`}>
          {msg.content}
        </div>
      </div>
    </div>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState([
    { id: 0, role: 'assistant', content: 'Namaste! 🙏 Main BusinessGPT hoon. Aapke business ke baare mein kuch bhi poochho — sales, inventory, forecast, ya market trends!', module: 'general' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}`)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const message = text || input.trim()
    if (!message) return
    setInput('')

    setMessages(m => [...m, { id: Date.now(), role: 'user', content: message }])
    setLoading(true)

    try {
      const res = await sendMessage(message, sessionId)
      setMessages(m => [...m, {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.data.response,
        module: res.data.module_used,
        confidence: res.data.confidence,
      }])
    } catch (err) {
      toast.error('Response nahi mila. Backend check karein.')
      setMessages(m => [...m, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, abhi connect nahi ho pa raha. Please backend server start karein aur try karein.',
        module: 'general',
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex h-[calc(100vh-68px-48px)] gap-6 max-w-6xl mx-auto">
      {/* Sidebar — Suggested questions */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0">
        <div className="card flex-1 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <p className="text-sm font-semibold text-gray-700">Try asking...</p>
          </div>
          {SUGGESTED.map(q => (
            <button key={q} onClick={() => send(q)}
              className="text-left text-xs text-gray-600 p-3 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 transition-all leading-relaxed">
              {q}
            </button>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col card p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5">
          {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Suggested (mobile) */}
        <div className="lg:hidden px-4 py-2 border-t border-gray-100 flex gap-2 overflow-x-auto">
          {SUGGESTED.slice(0, 3).map(q => (
            <button key={q} onClick={() => send(q)}
              className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-700 transition-all flex-shrink-0">
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Kuch bhi poochho Hinglish mein... (e.g., Aaj ki sales kitni hai?)"
            className="input flex-1"
            disabled={loading}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary flex-shrink-0 flex items-center gap-2">
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </div>
    </div>
  )
}
