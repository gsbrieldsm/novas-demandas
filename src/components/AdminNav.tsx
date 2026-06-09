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
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { label: 'Gestão', href: '/admin' },
    { label: 'Financeiro', href: '/admin/financeiro' },
    { label: 'Clientes', href: '/admin/clientes' },
    { label: 'Demandas', href: '/admin/demandas' },
    { label: 'Agenda', href: '/admin/agenda' },
    { label: 'Comercial', href: '/admin/comercial' },
    { label: 'Propostas', href: '/admin/propostas' },
  ]

  // Verifica timer ativo
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await api('/api/tempo?ativo=true')
        if (!res.ok) return
        const data: TimerAtivo[] = await res.json()
        if (cancelled) return
        if (data.length > 0) {
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
    const id = setInterval(check, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [pathname])

  // Tick a cada 1s
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  // Fecha drawer ao navegar
  useEffect(() => { setMenuOpen(false) }, [pathname])

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
    <>
      <header
        className="px-4 md:px-6 py-0 flex items-center justify-between shadow-md sticky top-0 z-30"
        style={{
          background: 'radial-gradient(ellipse 60% 150% at 95% 50%, #C5A880 0%, #6B4C28 40%, transparent 70%), #100E0B',
        }}
      >
        {/* Logo + nav desktop */}
        <div className="flex items-center gap-8">
          <div className="py-3 flex-shrink-0">
            <Image
              src="/logo-symbol.png"
              alt="GM&Co"
              width={36}
              height={36}
              className="object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center h-full">
            {links.map(link => {
              const active = pathname === link.href
              return (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  className={clsx(
                    'px-4 py-5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
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

        {/* Lado direito: timer + extra (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Timer compacto no mobile, completo no desktop */}
          {timer && (
            <>
              {/* Mobile timer compact */}
              <button
                onClick={() => router.push(`/admin/chamado/${timer.ticket_id}`)}
                className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(197,168,128,0.3)' }}
                title={timer.ticket_title}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[#C5A880] font-bold tabular-nums">
                  {formatMinutos(minutosDesde(timer.started_at))}
                </span>
              </button>
              {/* Desktop timer */}
              <div
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(197,168,128,0.3)' }}
              >
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
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
            </>
          )}

          {/* Extra (botões específicos da página) — desktop only */}
          <div className="hidden md:block">{extra}</div>

          {/* Desktop: Portal + Sair */}
          <button
            onClick={() => router.push('/chat')}
            className="hidden md:inline-block text-sm font-medium px-3 py-1.5 rounded-lg border text-white/60 hover:text-white transition-colors"
            style={{ borderColor: `${GOLD}40` }}
          >
            Portal →
          </button>
          <button
            onClick={onLogout}
            className="hidden md:inline-block text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Sair
          </button>

          {/* Mobile: hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden w-10 h-10 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Extra no mobile (linha abaixo do header) */}
      {extra && (
        <div className="md:hidden px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-2 flex-wrap">
          {extra}
        </div>
      )}

      {/* Drawer mobile */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 animate-fade-in"
            onClick={() => setMenuOpen(false)}
          />
          {/* Drawer */}
          <div
            className="md:hidden fixed top-0 right-0 bottom-0 w-72 z-50 shadow-2xl flex flex-col"
            style={{
              background: 'radial-gradient(ellipse 80% 100% at 0% 0%, #C5A880 0%, #6B4C28 30%, #1c1a18 60%), #100E0B',
            }}
          >
            <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
              <Image
                src="/logo-symbol.png"
                alt="GM&Co"
                width={32}
                height={32}
                className="object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
              <button
                onClick={() => setMenuOpen(false)}
                className="w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center text-xl"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <nav className="flex-1 py-3 overflow-y-auto">
              {links.map(link => {
                const active = pathname === link.href
                return (
                  <button
                    key={link.href}
                    onClick={() => { router.push(link.href); setMenuOpen(false) }}
                    className={clsx(
                      'w-full text-left px-5 py-3.5 text-base font-medium transition-colors flex items-center justify-between',
                      active
                        ? 'text-[#C5A880] bg-white/5'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <span>{link.label}</span>
                    {active && <span className="text-[#C5A880]">●</span>}
                  </button>
                )
              })}
            </nav>

            <div className="border-t border-white/10 px-3 py-3 space-y-1">
              <button
                onClick={() => router.push('/chat')}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Portal →
              </button>
              <button
                onClick={onLogout}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-300/80 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
