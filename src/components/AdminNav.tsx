'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { formatMinutos, minutosDesde } from '@/lib/tempo'
import { NAV_GROUPS, NavIcon, isNavActive } from '@/components/AdminSidebar'

interface TimerAtivo {
  id: string
  ticket_id: string
  started_at: string
  descricao: string | null
  ticket_title?: string
}

const ALL_LINKS = NAV_GROUPS.flatMap(g => g.links)

function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null)

  useEffect(() => {
    setAgora(new Date())
    const id = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!agora) return null

  return (
    <span className="hidden lg:inline text-xs tabular-nums text-gm-muted">
      {agora.toLocaleTimeString('pt-BR')}
    </span>
  )
}

export function AdminNav({ onLogout, extra }: { onLogout: () => void; extra?: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [timer, setTimer] = useState<TimerAtivo | null>(null)
  const [, setTick] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const secao = ALL_LINKS.find(l => isNavActive(l, pathname))

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
      <header className="gm-chrome sticky top-0 z-30 h-14 px-4 md:px-6 flex items-center justify-between gap-3 border-b border-gm-line/60 bg-gm-bg text-gm-text after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-gm-glow/60 after:to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin"
            className="md:hidden flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gm-accent to-gm-glow"
            aria-label="Gestão"
          >
            <Image
              src="/logo-symbol.png"
              alt=""
              width={18}
              height={18}
              className="object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </Link>
          {secao && (
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="gm-live-dot flex-shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold tracking-tight truncate">{secao.label}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {timer && (
            <div className="flex items-center gap-2 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-medium border border-gm-glow/30 bg-gm-glow/10">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-400 animate-pulse" />
              <button
                onClick={() => router.push(`/admin/chamado/${timer.ticket_id}`)}
                className="hidden md:block text-gm-text/90 hover:text-gm-text max-w-[200px] truncate"
                title={timer.ticket_title}
              >
                {timer.ticket_title ?? 'Em andamento'}
              </button>
              <button
                onClick={() => router.push(`/admin/chamado/${timer.ticket_id}`)}
                className="text-gm-glow font-bold tabular-nums"
                title={timer.ticket_title}
              >
                {formatMinutos(minutosDesde(timer.started_at))}
              </button>
              <button
                onClick={pararTimer}
                className="hidden md:block ml-1 text-gm-muted hover:text-gm-text transition-colors"
                title="Parar timer"
                aria-label="Parar timer"
              >
                ⏸
              </button>
            </div>
          )}

          <div className="hidden md:block">{extra}</div>

          <Relogio />

          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden w-10 h-10 rounded-lg text-gm-text/80 hover:text-gm-text hover:bg-white/10 flex items-center justify-center transition-colors"
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
        <div className="gm-chrome md:hidden px-4 py-2 border-b border-gm-line/60 bg-gm-surface flex items-center gap-2 flex-wrap">
          {extra}
        </div>
      )}

      {/* Drawer mobile */}
      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setMenuOpen(false)}
          />
          <div className="gm-chrome md:hidden fixed top-0 right-0 bottom-0 w-72 z-50 flex flex-col border-l border-gm-line/60 bg-gm-bg text-gm-text shadow-2xl animate-gm-drawer">
            <div className="h-14 px-5 flex items-center justify-between border-b border-gm-line/60">
              <span className="text-sm font-semibold tracking-tight">Gabriel Moraes &amp; Co</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-9 h-9 rounded-lg text-gm-muted hover:text-gm-text hover:bg-white/10 flex items-center justify-center text-xl"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <nav className="flex-1 py-3 px-3 overflow-y-auto">
              {NAV_GROUPS.map(group => (
                <div key={group.title} className="mb-4">
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gm-muted/70">
                    {group.title}
                  </p>
                  {group.links.map(link => {
                    const active = isNavActive(link, pathname)
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className={clsx(
                          'flex items-center gap-3 px-3 h-12 rounded-xl text-base font-medium transition-colors',
                          active
                            ? 'text-gm-text bg-gm-accent/15 shadow-[inset_0_0_0_1px_rgb(var(--gm-accent)/0.35)]'
                            : 'text-gm-muted hover:text-gm-text hover:bg-white/5'
                        )}
                      >
                        <NavIcon name={link.icon} className={clsx(active && 'text-gm-glow')} />
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </nav>

            <div className="border-t border-gm-line/60 px-3 py-3 space-y-1">
              <Link
                href="/chat"
                className="flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium text-gm-muted hover:text-gm-text hover:bg-white/5 transition-colors"
              >
                <NavIcon name="portal" />
                Portal do cliente
              </Link>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium text-red-300/80 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <NavIcon name="sair" />
                Sair
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
