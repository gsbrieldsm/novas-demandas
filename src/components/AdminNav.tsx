'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { formatMinutos, minutosDesde } from '@/lib/tempo'

const GOLD = '#C5A880'

interface TimerAtivo {
  id: string
  ticket_id: string
  started_at: string
  descricao: string | null
  ticket_title?: string
}

export function AdminNav({ onLogout, extra }: { onLogout: () => void; extra?: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [timer, setTimer] = useState<TimerAtivo | null>(null)
  const [, setTick] = useState(0)

  const links = [
    { label: 'Gestão', href: '/admin' },
    { label: 'Financeiro', href: '/admin/financeiro' },
    { label: 'Clientes', href: '/admin/clientes' },
    { label: 'Demandas', href: '/admin/demandas' },
    { label: 'Agenda', href: '/admin/agenda' },
    { label: 'Comercial', href: '/admin/comercial' },
  ]

  // Verifica se há timer ativo
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await api('/api/tempo?ativo=true')
        if (!res.ok) return
        const data: TimerAtivo[] = await res.json()
        if (cancelled) return
        if (data.length > 0) {
          // Pega o título do ticket
          const t = data[0]
          const tRes = await api(`/api/tickets/${t.ticket_id}`)
          if (tRes.ok) {
            const ticket = await tRes.json()
            t.ticket_title = ticket.title
          }
          setTimer(t)
        } else {
          setTimer(null)
        }
      } catch {}
    }
    check()
    const id = setInterval(check, 15000) // re-check a cada 15s
    return () => { cancelled = true; clearInterval(id) }
  }, [pathname])

  // Tick a cada 1s pra atualizar contador visual
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  async function pararTimer() {
    if (!timer) return
    const minutos = Math.max(1, minutosDesde(timer.started_at))
    await api(`/api/tempo/${timer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutos, ativo: false, started_at: null }),
    })
    setTimer(null)
  }

  return (
    <header
      className="px-6 py-0 flex items-center justify-between shadow-md"
      style={{
        background: 'radial-gradient(ellipse 60% 150% at 95% 50%, #C5A880 0%, #6B4C28 40%, transparent 70%), #100E0B',
      }}
    >
      <div className="flex items-center gap-8">
        <div className="py-3">
          <Image
            src="/logo-symbol.png"
            alt="GM&Co"
            width={36}
            height={36}
            className="object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </div>
        <nav className="flex items-center h-full">
          {links.map(link => {
            const active = pathname === link.href
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={clsx(
                  'px-4 py-5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  active
                    ? 'text-white border-[#C5A880]'
                    : 'text-white/50 border-transparent hover:text-white/80'
                )}
              >
                {link.label}
              </button>
            )
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {timer && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium animate-pulse-slow"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(197,168,128,0.3)' }}
          >
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <button
              onClick={() => router.push(`/admin/chamado/${timer.ticket_id}`)}
              className="text-white/90 hover:text-white max-w-[200px] truncate"
              title={timer.ticket_title}
            >
              {timer.ticket_title ? `⏱ ${timer.ticket_title}` : '⏱ Em andamento'}
            </button>
            <span className="text-[#C5A880] font-bold tabular-nums">
              {formatMinutos(minutosDesde(timer.started_at))}
            </span>
            <button
              onClick={pararTimer}
              className="ml-1 text-white/70 hover:text-white transition-colors"
              title="Parar timer"
            >
              ⏸
            </button>
          </div>
        )}
        {extra}
        <button
          onClick={() => router.push('/chat')}
          className="text-sm font-medium px-3 py-1.5 rounded-lg border text-white/60 hover:text-white transition-colors"
          style={{ borderColor: `${GOLD}40` }}
        >
          Portal →
        </button>
        <button
          onClick={onLogout}
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Sair
        </button>
      </div>
    </header>
  )
}
