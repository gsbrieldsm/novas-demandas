'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { Space_Grotesk } from 'next/font/google'
import clsx from 'clsx'
import { PainelTrafego, SkeletonPainel } from '@/components/trafego/PainelTrafego'
import { PlanoLeitura } from '@/components/trafego/PlanoAcao'
import { PERIODOS, type DadosTrafego, type Periodo, type PlanoItem } from '@/lib/trafego'

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })

interface Resposta {
  cliente: string
  recado: string | null
  plano: PlanoItem[]
  dados: DadosTrafego | null
  aviso?: string
}

export default function TrafegoClientePage() {
  const { token } = useParams<{ token: string }>()
  const [periodo, setPeriodo] = useState<Periodo>('last_30d')
  const [resp, setResp] = useState<Resposta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)

  const carregar = useCallback(async (p: Periodo) => {
    setCarregando(true)
    const res = await fetch(`/api/public/trafego/${token}?periodo=${p}`)
    if (!res.ok) setIndisponivel(true)
    else setResp(await res.json())
    setCarregando(false)
  }, [token])

  useEffect(() => { carregar(periodo) }, [periodo, carregar])

  if (indisponivel) {
    return (
      <div className={clsx(display.variable, 'min-h-screen flex items-center justify-center p-6')} style={{ background: 'rgb(var(--gm-bg))' }}>
        <div className="text-center max-w-sm">
          <p className="text-white text-xl font-semibold font-[family-name:var(--font-display)]">Link indisponível</p>
          <p className="mt-2 text-sm text-white/60">Este link foi desativado ou não existe. Fale com a Gabriel Moraes &amp; Co para receber um novo.</p>
        </div>
      </div>
    )
  }

  const dados = resp?.dados

  return (
    <div className={clsx('gm-shell', display.variable)}>
      {/* Topo escuro */}
      <header className="gm-chrome border-b border-gm-line/60" style={{ background: 'var(--gm-hero)' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-8 md:pt-6 md:pb-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gm-accent to-gm-glow shadow-[0_0_24px_-4px_rgb(var(--gm-accent)/0.8)]">
                <Image src="/logo-symbol.png" alt="" width={22} height={22} className="object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              </span>
              <span className="text-sm font-semibold tracking-tight text-gm-text">Gabriel Moraes &amp; Co</span>
            </div>
            <span className="flex items-center gap-2 text-xs text-gm-muted">
              <span className="gm-live-dot" /> Meta Ads ao vivo
            </span>
          </div>

          <div className="mt-8 md:mt-10 flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gm-glow">Tráfego pago</p>
              <h1 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight text-white font-[family-name:var(--font-display)]">
                {resp?.cliente || <span className="inline-block h-10 w-48 rounded-lg bg-white/10 animate-pulse align-middle" />}
              </h1>
              <p className="mt-2 text-sm text-white/60">Métricas das campanhas, o que está rodando e o plano de ação aprovado.</p>
            </div>
            <div className="inline-flex flex-wrap rounded-xl border border-white/15 bg-white/5 p-1" role="tablist" aria-label="Período">
              {PERIODOS.map(p => (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={periodo === p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors',
                    periodo === p.id ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {resp?.recado && (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 max-w-3xl">
              <p className="text-[10px] uppercase tracking-wider text-white/50">Recado da agência</p>
              <p className="mt-1 text-sm text-white/90 whitespace-pre-line">{resp.recado}</p>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6 md:space-y-8">
        {carregando && !resp ? (
          <SkeletonPainel />
        ) : (
          <>
            {resp?.aviso && (
              <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{resp.aviso}</p>
            )}
            {dados && (
              <div className={clsx('transition-opacity', carregando && 'opacity-50')}>
                <PainelTrafego dados={dados} />
              </div>
            )}

            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
              <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-400">Plano de ação aprovado</p>
              <h2 className="mt-1 text-lg md:text-xl font-bold text-slate-900 font-[family-name:var(--font-display)]">Próximos passos</h2>
              <div className="mt-4">
                <PlanoLeitura plano={resp?.plano ?? []} />
              </div>
            </section>

            {dados && (
              <p className="text-center text-[11px] text-slate-400">
                Dados oficiais do Meta Ads · atualizados às {new Date(dados.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
