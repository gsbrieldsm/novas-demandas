'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import clsx from 'clsx'
import type { ChatMessage } from '@/types'

const PROFESSIONAL_NAME = process.env.NEXT_PUBLIC_PROFESSIONAL_NAME || 'Gabriel'
const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || PROFESSIONAL_NAME

const GOLD = '#C5A880'
const GOLD_DARK = '#A88960'

function Avatar({ size = 8, full = false }: { size?: number; full?: boolean }) {
  const logo = full ? '/logo-full.png' : '/logo-symbol.png'
  return (
    <Image
      src={logo}
      alt={COMPANY_NAME}
      width={size * 4}
      height={size * 4}
      className="flex-shrink-0 object-contain"
      style={{ width: size * 4, height: size * 4, filter: 'brightness(0) invert(1)' }}
    />
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[#1C1A18] text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: GOLD }}
      >
        G
      </div>
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full animate-pulse-dot"
              style={{ backgroundColor: GOLD, animationDelay: `${i * 0.16}s` }}
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
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#1C1A18] text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: GOLD }}
        >
          {name[0]}
        </div>
      )}
      <div
        className={clsx(
          'max-w-[75%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'text-[#1C1A18] rounded-br-sm'
            : 'bg-white/10 backdrop-blur-sm text-white/90 rounded-bl-sm'
        )}
        style={isUser ? { backgroundColor: GOLD } : {}}
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-[#1C1A18] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-slide-up">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${GOLD}20` }}>
          <svg className="w-8 h-8" style={{ color: GOLD }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Pedido registrado!</h2>
        <p className="text-white/50 text-sm mb-6">
          Seu briefing foi recebido. Você pode acompanhar o status do seu chamado a qualquer momento.
        </p>
        <div className="bg-white/5 rounded-xl p-3 mb-6">
          <p className="text-xs text-white/30 mb-1">Número do chamado</p>
          <p className="font-mono text-sm font-semibold text-white/80 break-all">
            #{ticketId.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push(`/acompanhar/${ticketId}`)}
            className="w-full py-3 rounded-xl font-medium transition-all hover:opacity-90 text-[#1C1A18]"
            style={{ backgroundColor: GOLD }}
          >
            Acompanhar status
          </button>
          <button
            onClick={onClose}
            className="w-full text-white/40 py-2 text-sm hover:text-white/70 transition-colors"
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
    <div className="flex flex-col h-screen" style={{ background: 'radial-gradient(ellipse 75% 75% at 92% -10%, #C5A880 0%, #8B6840 45%, transparent 70%), radial-gradient(ellipse 65% 85% at 115% 70%, #B8946A 0%, #7A5530 45%, transparent 68%), radial-gradient(ellipse 90% 55% at 20% 90%, #3D2A14 0%, transparent 55%), #100E0B' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-black/30 backdrop-blur-sm border-b border-white/5">
        <Avatar size={10} />
        <div>
          <p className="text-white font-semibold text-sm">{COMPANY_NAME}</p>
          <p className="text-xs" style={{ color: `${GOLD}99` }}>Assistente Estratégica</p>
        </div>
      </div>

      {/* Messages */}
      {!started ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 animate-fade-in">
          <div className="flex flex-col items-center gap-0">
            <div className="-mb-16">
              <Avatar size={130} full />
            </div>
            <div className="text-center max-w-lg">
              <h1 className="text-white text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-4">
                Nada do que fazemos existe por acaso.
              </h1>
              <p className="text-sm sm:text-base max-w-sm mx-auto leading-relaxed" style={{ color: `${GOLD}99` }}>
                Vou entender sua demanda de forma estratégica. Leva só alguns segundos!
              </p>
            </div>
          </div>
          <button
            onClick={startConversation}
            className="px-10 py-3.5 rounded-2xl font-semibold transition-all hover:opacity-90 active:scale-95 shadow-lg text-sm text-[#1C1A18]"
            style={{ backgroundColor: GOLD }}
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
        <div className="px-4 py-4 bg-black/30 backdrop-blur-sm border-t border-white/5">
          <div className="flex items-end gap-3 max-w-2xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-white/5 text-white placeholder-white/25 border border-white/10 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:bg-white/8 transition-all disabled:opacity-50"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onFocus={(e) => (e.target.style.borderColor = `${GOLD}66`)}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-11 h-11 disabled:opacity-30 disabled:cursor-not-allowed text-[#1C1A18] rounded-2xl flex items-center justify-center transition-all hover:opacity-90 active:scale-95 flex-shrink-0"
              style={{ backgroundColor: GOLD }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p className="text-center text-white/15 text-xs mt-2">
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
