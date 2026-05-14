'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import clsx from 'clsx'
import type { ChatMessage } from '@/types'

const PROFESSIONAL_NAME = process.env.NEXT_PUBLIC_PROFESSIONAL_NAME || 'Gabriel'
const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || PROFESSIONAL_NAME

function Avatar({ size = 8, full = false }: { size?: number; full?: boolean }) {
  const logo = full ? '/logo-full.png' : '/logo-symbol.png'
  return (
    <div
      className="rounded-2xl overflow-hidden flex-shrink-0 bg-white flex items-center justify-center"
      style={{ width: size * 4, height: size * 4 }}
    >
      <Image
        src={logo}
        alt={COMPANY_NAME}
        width={size * 4}
        height={size * 4}
        className="w-full h-full object-contain p-0.5"
      />
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <Avatar size={8} />
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse-dot"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Message({ msg, name }: { msg: ChatMessage; name: string }) {
  const isUser = msg.role === 'user'

  const displayContent = msg.content
    .replace(/\[BRIEFING_COMPLETO\][\s\S]*/g, '')
    .replace(/\[TICKET_ID:[^\]]+\]/g, '')
    .trim()

  if (!displayContent) return null

  return (
    <div
      className={clsx(
        'flex items-end gap-2 animate-slide-up',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {name[0]}
        </div>
      )}
      <div
        className={clsx(
          'max-w-[75%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-white text-slate-800 rounded-bl-sm'
        )}
      >
        {displayContent}
      </div>
    </div>
  )
}

function SuccessModal({
  ticketId,
  onClose,
}: {
  ticketId: string
  onClose: () => void
}) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-slide-up">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Pedido registrado!</h2>
        <p className="text-slate-500 text-sm mb-6">
          Seu briefing foi recebido. Você pode acompanhar o status do seu chamado a qualquer momento.
        </p>
        <div className="bg-slate-50 rounded-xl p-3 mb-6">
          <p className="text-xs text-slate-400 mb-1">Número do chamado</p>
          <p className="font-mono text-sm font-semibold text-slate-700 break-all">
            #{ticketId.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push(`/acompanhar/${ticketId}`)}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Acompanhar status
          </button>
          <button
            onClick={onClose}
            className="w-full text-slate-500 py-2 text-sm hover:text-slate-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function startConversation() {
    setStarted(true)
    setLoading(true)
    await sendToAI([{ role: 'user', content: '__INIT__' }])
  }

  async function sendToAI(msgs: ChatMessage[]) {
    setLoading(true)

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        accumulated += chunk

        const ticketMatch = accumulated.match(/\[TICKET_ID:([^\]]+)\]/)
        if (ticketMatch) {
          setTicketId(ticketMatch[1])
        }

        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: accumulated,
          }
          return updated
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages.filter((m) => m.content.trim()), userMsg]
    setMessages(newMessages)
    setInput('')

    await sendToAI(newMessages)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-black/20 backdrop-blur-sm border-b border-white/10">
        <Avatar size={10} />
        <div>
          <p className="text-white font-semibold text-sm">{COMPANY_NAME}</p>
          <p className="text-indigo-300 text-xs">Assistente Estratégica</p>
        </div>
      </div>


      {/* Messages */}
      {!started ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 animate-fade-in">
          <Avatar size={24} full />
          <div className="text-center">
            <h1 className="text-white text-2xl font-bold mb-2">
              Seja bem-vindo a {COMPANY_NAME}
            </h1>
            <p className="text-indigo-300 text-sm max-w-xs">
              Vou te ajudar a formular seu pedido de forma estratégica. Leva só alguns minutos.
            </p>
          </div>
          <button
            onClick={startConversation}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-medium transition-all hover:scale-105 active:scale-95 shadow-lg"
          >
            Começar →
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages
            .filter((msg) => msg.content !== '__INIT__')
            .map((msg, i) => (
              <Message key={i} msg={msg} name={PROFESSIONAL_NAME} />
            ))}
          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <TypingIndicator />
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      {started && (
        <div className="px-4 py-4 bg-black/20 backdrop-blur-sm border-t border-white/10">
          <div className="flex items-end gap-3 max-w-2xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-indigo-400 focus:bg-white/15 transition-all disabled:opacity-50"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-11 h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 flex-shrink-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p className="text-center text-white/20 text-xs mt-2">
            Enter para enviar · Shift+Enter para quebrar linha
          </p>
        </div>
      )}

      {ticketId && (
        <SuccessModal ticketId={ticketId} onClose={() => setTicketId(null)} />
      )}
    </div>
  )
}
