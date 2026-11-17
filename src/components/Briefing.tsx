'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export interface BriefingData {
  nome: string
  atrasados: number
  prazoHoje: string[]
  novos: number
  abertos: number
  leadsParados: number
  pagamentosPendentes: number
  recebido: number
  previsto: number
  meta: number
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

function lista(itens: string[]) {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

function saudacao(hora: number) {
  if (hora < 5) return 'Boa madrugada'
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function montarBriefing(d: BriefingData, agora: Date): string[] {
  const linhas: string[] = []
  const nHoje = d.prazoHoje.length

  // Operação
  if (nHoje === 0 && d.atrasados === 0) {
    linhas.push('Operação limpa: nada vence hoje e não há nenhuma entrega atrasada.')
  } else {
    if (nHoje > 0) {
      const nomes = d.prazoHoje.slice(0, 3)
      const resto = nHoje - nomes.length
      linhas.push(
        `Hoje vamos arrebentar: ${plural(nHoje, 'entrega vence', 'entregas vencem')} hoje — ${lista(nomes)}${resto > 0 ? ` e mais ${resto}` : ''}.`
      )
    }
    if (d.atrasados > 0) {
      linhas.push(
        `${nHoje > 0 ? 'Antes disso, ' : 'Prioridade do dia: '}${plural(d.atrasados, 'demanda atrasada', 'demandas atrasadas')} de ${d.abertos} em aberto.`
      )
    }
  }
  if (d.novos > 0) {
    linhas.push(`${plural(d.novos, 'chamado novo aguarda', 'chamados novos aguardam')} triagem.`)
  }

  // Financeiro
  const pct = d.previsto > 0 ? Math.round((d.recebido / d.previsto) * 100) : 0
  const pend = d.pagamentosPendentes
  if (d.previsto === 0) {
    linhas.push('Ainda não há receita prevista para este mês — hora de ir atrás de projetos.')
  } else if (pct >= 80) {
    linhas.push(`Seu financeiro está rodando bem: ${brl(d.recebido)} de ${brl(d.previsto)} previstos já entraram (${pct}%).`)
  } else if (agora.getDate() > 20 && pct < 50) {
    linhas.push(
      `O financeiro pede atenção: só ${pct}% do previsto entrou (${brl(d.recebido)} de ${brl(d.previsto)})${pend > 0 ? ` e ${plural(pend, 'pagamento fixo segue pendente', 'pagamentos fixos seguem pendentes')}` : ''}.`
    )
  } else {
    linhas.push(
      `Financeiro em andamento: ${brl(d.recebido)} de ${brl(d.previsto)} previstos (${pct}%)${pend > 0 ? `, com ${plural(pend, 'pagamento fixo', 'pagamentos fixos')} a cobrar` : ''}.`
    )
  }

  if (d.meta > 0) {
    if (d.previsto >= d.meta) {
      linhas.push(`A carteira atual cobre a meta do mês de ${brl(d.meta)}.`)
    } else {
      linhas.push(`Faltam ${brl(d.meta - d.previsto)} em carteira para a meta de ${brl(d.meta)} — precisamos ir atrás de mais projetos.`)
    }
  }

  // Comercial
  if (d.leadsParados > 0) {
    linhas.push(`${plural(d.leadsParados, 'lead está parado', 'leads estão parados')} há mais de 7 dias: vale um follow-up hoje.`)
  }

  return linhas
}

function Gauge({ label, pct, valor, cor }: { label: string; pct: number | null; valor: string; cor: string }) {
  const [p, setP] = useState(0)
  const r = 34
  const c = 2 * Math.PI * r

  useEffect(() => {
    const id = requestAnimationFrame(() => setP(Math.max(0, Math.min(100, pct ?? 0))))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="relative h-[84px] w-[84px]">
        <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
          <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="5" />
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke={cor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * p) / 100}
            style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.2, 0.8, 0.2, 1)', filter: `drop-shadow(0 0 6px ${cor})` }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums text-white">
          {pct === null ? '—' : `${Math.round(pct)}%`}
        </span>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">{label}</p>
      <p className="text-[11px] text-white/70 text-center truncate max-w-full">{valor}</p>
    </div>
  )
}

function Nucleo() {
  return (
    <div className="relative h-16 w-16 md:h-20 md:w-20 flex-shrink-0" aria-hidden="true">
      <span className="absolute inset-0 rounded-full border border-gm-glow/40 border-t-gm-glow animate-[spin_6s_linear_infinite]" />
      <span className="absolute inset-[7px] rounded-full border border-dashed border-gm-accent/60 animate-[spin_14s_linear_infinite_reverse]" />
      <span className="absolute inset-[15px] rounded-full border border-gm-glow/30 border-b-gm-glow animate-[spin_3.5s_linear_infinite]" />
      <span className="absolute inset-[24px] rounded-full bg-gm-glow shadow-[0_0_28px_6px_rgb(var(--gm-glow)/0.7)] animate-pulse" />
    </div>
  )
}

export function Briefing({ data, children }: { data: BriefingData; children?: React.ReactNode }) {
  const agora = useMemo(() => new Date(), [])
  const linhas = useMemo(() => montarBriefing(data, agora), [data, agora])
  const texto = linhas.join(' ')
  const [chars, setChars] = useState(0)
  const [falando, setFalando] = useState(false)
  const textoRef = useRef(texto)

  // Escreve a leitura em tempo real; reinicia se os dados mudarem.
  useEffect(() => {
    textoRef.current = texto
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setChars(texto.length)
      return
    }
    setChars(0)
    const id = setInterval(() => {
      setChars(n => {
        if (n >= textoRef.current.length) {
          clearInterval(id)
          return n
        }
        return n + 2
      })
    }, 22)
    return () => clearInterval(id)
  }, [texto])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const titulo = `${saudacao(agora.getHours())}${data.nome ? `, ${data.nome}` : ''}.`

  function ouvir() {
    const synth = window.speechSynthesis
    if (!synth) return
    if (falando) {
      synth.cancel()
      setFalando(false)
      return
    }
    const fala = new SpeechSynthesisUtterance(`${titulo} ${texto}`)
    fala.lang = 'pt-BR'
    const voz = synth.getVoices().find(v => v.lang.replace('_', '-').startsWith('pt-BR'))
    if (voz) fala.voice = voz
    fala.rate = 1.05
    fala.onend = () => setFalando(false)
    fala.onerror = () => setFalando(false)
    setFalando(true)
    synth.speak(fala)
  }

  const pctCaixa = data.previsto > 0 ? (data.recebido / data.previsto) * 100 : null
  const pctMeta = data.meta > 0 ? (data.recebido / data.meta) * 100 : null
  const pctPrazo = data.abertos > 0 ? ((data.abertos - data.atrasados) / data.abertos) * 100 : null
  const escrevendo = chars < texto.length

  return (
    <section
      className="gm-hero rounded-3xl p-5 md:p-8 text-white"
      style={{ background: 'var(--gm-hero)' }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4 md:gap-5">
            <Nucleo />
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-gm-glow/80">
                Briefing · {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="mt-1 text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-gm-glow bg-clip-text text-transparent">
                {titulo}
              </h1>
            </div>
          </div>

          <p className="mt-5 text-sm md:text-base leading-relaxed text-white/85 min-h-[4.5rem]" aria-live="polite">
            {texto.slice(0, chars)}
            {escrevendo && <span className="inline-block w-[2px] h-[1em] translate-y-[2px] ml-0.5 bg-gm-glow animate-pulse" />}
          </p>

          <button
            onClick={ouvir}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-gm-glow/40 bg-gm-glow/10 px-3.5 py-1.5 text-xs font-medium text-gm-glow hover:bg-gm-glow/20 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {falando ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <>
                  <path d="M11 5L6 9H3v6h3l5 4V5z" />
                  <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
                </>
              )}
            </svg>
            {falando ? 'Parar' : 'Ouvir briefing'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-6 lg:w-[340px] flex-shrink-0">
          <Gauge
            label="No prazo"
            pct={pctPrazo}
            valor={data.abertos > 0 ? `${data.abertos - data.atrasados} de ${data.abertos}` : 'sem demandas'}
            cor="rgb(45 212 238)"
          />
          <Gauge
            label="Caixa"
            pct={pctCaixa}
            valor={data.previsto > 0 ? `${brl(data.recebido)}` : 'sem previsão'}
            cor="rgb(74 222 128)"
          />
          <Gauge
            label="Meta"
            pct={pctMeta}
            valor={data.meta > 0 ? `de ${brl(data.meta)}` : 'defina a meta'}
            cor="rgb(167 139 250)"
          />
        </div>
      </div>

      {children && <div className="mt-6 md:mt-8">{children}</div>}
    </section>
  )
}
