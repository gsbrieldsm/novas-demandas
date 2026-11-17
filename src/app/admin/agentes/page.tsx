'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { AdminNav } from '@/components/AdminNav'
import { AGENTES, type AgenteId, type Ata, type EventoReuniao, type MensagemAgente, type Reuniao } from '@/lib/agentes'

interface Cliente {
  id: string
  nome: string
  ativo: boolean
  tipo: 'cliente' | 'outras_receitas'
}

const CARD = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const ROTULO = 'text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-400'

const COR: Record<AgenteId, { bolha: string; avatar: string; nome: string }> = {
  trafego: { bolha: 'bg-white border-slate-200', avatar: 'from-gm-accent to-violet-400', nome: 'text-gm-accent' },
  social: { bolha: 'bg-cyan-50/70 border-cyan-100', avatar: 'from-gm-glow to-sky-500', nome: 'text-cyan-700' },
}

function Avatar({ agente, ativo }: { agente: AgenteId; ativo?: boolean }) {
  return (
    <span
      className={clsx(
        'relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white',
        COR[agente].avatar,
        ativo && 'shadow-[0_0_20px_-2px_rgb(var(--gm-glow)/0.9)]'
      )}
      aria-hidden="true"
    >
      {agente === 'trafego' ? 'TR' : 'SM'}
      {ativo && <span className="absolute -right-0.5 -top-0.5 gm-live-dot" />}
    </span>
  )
}

function Fala({ m, digitando }: { m: MensagemAgente; digitando?: boolean }) {
  const direita = m.agente === 'social'
  return (
    <li className={clsx('flex gap-3 animate-gm-enter', direita && 'flex-row-reverse')}>
      <Avatar agente={m.agente} ativo={digitando} />
      <div className={clsx('max-w-[85%] md:max-w-[75%] rounded-2xl border px-4 py-3', COR[m.agente].bolha, direita ? 'rounded-tr-md' : 'rounded-tl-md')}>
        <p className={clsx('text-[11px] font-semibold', COR[m.agente].nome)}>
          {AGENTES[m.agente].nome} <span className="font-normal text-slate-400">· {AGENTES[m.agente].papel}</span>
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
          {m.texto}
          {digitando && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-slate-400" />}
        </p>
      </div>
    </li>
  )
}

function Lista({ titulo, itens, tom }: { titulo: string; itens: string[]; tom: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 min-w-0">
      <p className={clsx('text-xs font-semibold', tom)}>{titulo}</p>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
        {itens.map((t, i) => <li key={i} className="flex gap-2"><span className="text-slate-300">•</span><span>{t}</span></li>)}
      </ul>
    </div>
  )
}

function VerAta({
  ata,
  reuniao,
  clienteId,
  onAtualizar,
}: {
  ata: Ata
  reuniao: Reuniao | null
  clienteId: string
  onAtualizar: (r: Reuniao) => void
}) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')

  async function enviarPlano() {
    if (!reuniao) return
    setEnviando(true)
    setMsg('')
    const res = await api(`/api/agentes/${reuniao.id}/plano-trafego`, { method: 'POST' })
    const corpo = await res.json().catch(() => ({}))
    setEnviando(false)
    if (!res.ok) {
      setMsg(corpo.error || 'Não foi possível enviar.')
      return
    }
    onAtualizar({ ...reuniao, enviados: corpo.enviados })
    setMsg(`${corpo.adicionados} ações enviadas ao plano como “Proposto”.`)
  }

  async function abrirEstudio() {
    const briefing = [
      ata.briefing_social,
      'Conteúdos combinados na reunião de agentes:',
      ...ata.pautas_social.map(p => `- ${p.formato}: ${p.tema} (por quê: ${p.por_que})`),
    ].join('\n')
    if (reuniao) {
      const enviados = { ...reuniao.enviados, estudio: true }
      api(`/api/agentes/${reuniao.id}`, { method: 'PATCH', body: JSON.stringify({ enviados }) })
      onAtualizar({ ...reuniao, enviados })
    }
    router.push(`/admin/social?cliente=${clienteId}&tipo=pauta&briefing=${encodeURIComponent(briefing)}`)
  }

  return (
    <div className={clsx(CARD, 'p-4 md:p-6 space-y-5 animate-gm-enter')}>
      <div>
        <p className={ROTULO}>Ata da reunião</p>
        <p className="mt-2 text-sm md:text-base leading-relaxed text-slate-800">{ata.cenario}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Lista titulo="O que falta" itens={ata.falta} tom="text-rose-600" />
        <Lista titulo="O que precisa" itens={ata.precisa} tom="text-amber-600" />
        <Lista titulo="O que vamos melhorar" itens={ata.melhorar} tom="text-emerald-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-semibold text-gm-accent">Ações de tráfego</p>
            {reuniao && (
              reuniao.enviados.plano_trafego ? (
                <Link href={`/admin/trafego?cliente=${clienteId}`} className="text-xs font-medium text-emerald-700 hover:underline">✓ No plano de tráfego →</Link>
              ) : (
                <button onClick={enviarPlano} disabled={enviando} className="rounded-lg bg-gm-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  {enviando ? 'Enviando…' : 'Enviar ao plano de tráfego'}
                </button>
              )
            )}
          </div>
          <ol className="mt-3 space-y-2.5">
            {ata.acoes_trafego.map((a, i) => (
              <li key={i} className="grid grid-cols-[22px_1fr] gap-2 text-sm">
                <span className="text-xs font-bold text-gm-accent tabular-nums pt-0.5">{i + 1}</span>
                <div>
                  <p className="font-semibold text-slate-900">{a.titulo} <span className="font-normal text-xs text-slate-400">· {a.prazo_dias <= 0 ? 'hoje' : a.prazo_dias === 1 ? 'amanhã' : `em ${a.prazo_dias} dias`}</span></p>
                  <p className="text-slate-600">{a.descricao}</p>
                </div>
              </li>
            ))}
          </ol>
          {msg && <p className="mt-3 text-xs text-slate-500">{msg}</p>}
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-semibold text-cyan-700">Conteúdos para o social media</p>
            <button onClick={abrirEstudio} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
              {reuniao?.enviados.estudio ? 'Abrir de novo no Estúdio →' : 'Gerar pauta no Estúdio →'}
            </button>
          </div>
          <ul className="mt-3 space-y-2.5">
            {ata.pautas_social.map((p, i) => (
              <li key={i} className="text-sm">
                <p className="font-semibold text-slate-900"><span className="mr-1.5 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">{p.formato}</span>{p.tema}</p>
                <p className="mt-0.5 text-slate-600">{p.por_que}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Agentes() {
  const router = useRouter()
  const params = useSearchParams()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '')
  const [historico, setHistorico] = useState<Reuniao[]>([])
  const [semTabela, setSemTabela] = useState(false)
  const [foco, setFoco] = useState('')

  const [rodando, setRodando] = useState(false)
  const [falando, setFalando] = useState<AgenteId | null>(null)
  const [mensagens, setMensagens] = useState<MensagemAgente[]>([])
  const [fontes, setFontes] = useState<{ trafego: boolean; instagram: boolean; avisos: string[] } | null>(null)
  const [escrevendoAta, setEscrevendoAta] = useState(false)
  const [ata, setAta] = useState<Ata | null>(null)
  const [reuniao, setReuniao] = useState<Reuniao | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const fim = useRef<HTMLDivElement>(null)
  const cliente = clientes.find(c => c.id === clienteId)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    api('/api/clientes-fixos')
      .then(r => r.json())
      .then((todos: Cliente[]) => {
        const lista = todos.filter(c => c.ativo && c.tipo !== 'outras_receitas').sort((a, b) => a.nome.localeCompare(b.nome))
        setClientes(lista)
        setClienteId(atual => atual || lista[0]?.id || '')
      })
  }, [router])

  useEffect(() => {
    if (!clienteId) return
    setMensagens([])
    setAta(null)
    setReuniao(null)
    setFontes(null)
    setErro('')
    setAviso('')
    api(`/api/agentes?cliente_id=${clienteId}`).then(async r => {
      if (r.ok) {
        const lista: Reuniao[] = await r.json()
        setHistorico(lista)
        setSemTabela(false)
      } else {
        const err = await r.json().catch(() => ({}))
        setHistorico([])
        setSemTabela(/agentes_reunioes/.test(err.error ?? '') || err.code === '42P01' || err.code === 'PGRST205')
      }
    })
  }, [clienteId])

  useEffect(() => {
    if (rodando) fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens, rodando, escrevendoAta])

  function abrir(r: Reuniao) {
    setMensagens(r.mensagens)
    setAta(r.resumo)
    setReuniao(r)
    setFontes(null)
    setErro('')
    setAviso('')
  }

  function tratar(e: EventoReuniao) {
    switch (e.tipo) {
      case 'contexto':
        setFontes({ trafego: e.trafego, instagram: e.instagram, avisos: e.avisos })
        break
      case 'turno':
        setFalando(e.agente)
        setMensagens(prev => [...prev, { agente: e.agente, texto: '' }])
        break
      case 'texto':
        setMensagens(prev => {
          const novo = [...prev]
          const ultimo = novo[novo.length - 1]
          novo[novo.length - 1] = { ...ultimo, texto: ultimo.texto + e.delta }
          return novo
        })
        break
      case 'fim_turno':
        setFalando(null)
        break
      case 'ata_inicio':
        setEscrevendoAta(true)
        break
      case 'ata':
        setEscrevendoAta(false)
        setAta(e.ata)
        break
      case 'salvo':
        if (e.reuniao) {
          setReuniao(e.reuniao)
          setHistorico(prev => [e.reuniao!, ...prev])
        }
        if (e.aviso) setAviso(e.aviso)
        break
      case 'erro':
        setErro(e.mensagem)
        break
    }
  }

  async function rodar() {
    if (!clienteId || rodando) return
    setRodando(true)
    setMensagens([])
    setAta(null)
    setReuniao(null)
    setFontes(null)
    setErro('')
    setAviso('')
    try {
      const res = await api('/api/agentes/reuniao', { method: 'POST', body: JSON.stringify({ cliente_id: clienteId, foco }) })
      if (!res.ok || !res.body) {
        const corpo = await res.json().catch(() => ({}))
        throw new Error(corpo.error || `Falha ao iniciar (${res.status})`)
      }
      const leitor = res.body.getReader()
      const dec = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await leitor.read()
        if (done) break
        buffer += dec.decode(value, { stream: true })
        const linhas = buffer.split('\n')
        buffer = linhas.pop() ?? ''
        for (const l of linhas) if (l.trim()) tratar(JSON.parse(l))
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na reunião.')
    }
    setRodando(false)
    setFalando(null)
    setEscrevendoAta(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const vazio = mensagens.length === 0 && !rodando

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto w-full px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6">
        <div>
          <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Marketing</p>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 mt-0.5 md:mt-1">Agentes</h1>
        </div>

        {/* HERO */}
        <div className="gm-hero rounded-2xl p-4 md:p-6" style={{ background: 'var(--gm-hero)' }}>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="min-w-0 space-y-4">
              <div>
                <label htmlFor="agentes-cliente" className="text-xs font-semibold uppercase tracking-wider text-white/60">Cliente</label>
                <select
                  id="agentes-cliente"
                  value={clienteId}
                  onChange={e => setClienteId(e.target.value)}
                  disabled={rodando}
                  className="mt-2 block w-full max-w-sm rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-base font-semibold text-white focus:outline-none focus:border-gm-glow [color-scheme:dark]"
                >
                  {clientes.length === 0 && <option value="">Nenhum cliente ativo</option>}
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="agentes-foco" className="text-xs font-semibold uppercase tracking-wider text-white/60">Pauta da reunião (opcional)</label>
                <input
                  id="agentes-foco"
                  value={foco}
                  onChange={e => setFoco(e.target.value)}
                  disabled={rodando}
                  placeholder="Ex.: preparar a Black Friday e entender por que o carrinho não vira venda"
                  className="mt-2 block w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-gm-glow"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex items-center gap-2">
                {(['trafego', 'social'] as AgenteId[]).map((a, i) => (
                  <div key={a} className="flex items-center gap-2">
                    {i === 1 && <span className={clsx('h-px w-8 bg-gradient-to-r from-gm-accent to-gm-glow', rodando && 'animate-pulse')} />}
                    <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2.5 py-2">
                      <Avatar agente={a} ativo={falando === a} />
                      <div>
                        <p className="text-xs font-semibold text-white">{AGENTES[a].nome}</p>
                        <p className="text-[11px] text-white/50">{AGENTES[a].papel}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={rodar}
                disabled={!clienteId || rodando}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_0_30px_-6px_rgb(var(--gm-glow)/0.9)] disabled:opacity-60"
              >
                {rodando ? (escrevendoAta ? 'Escrevendo a ata…' : 'Reunião em andamento…') : 'Rodar reunião'}
              </button>
            </div>
          </div>
        </div>

        {semTabela && (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Falta criar a tabela no banco</p>
            <p className="mt-1">
              Rode no SQL Editor do Supabase os trechos “Instagram do cliente” e “Agentes” do final de
              <code className="mx-1 rounded bg-amber-100 px-1">supabase/schema.sql</code>. A reunião funciona sem eles, mas não fica salva.
            </p>
          </div>
        )}

        {fontes && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Dados na mesa:</span>
            <span className={clsx('rounded-full px-2.5 py-1 font-semibold', fontes.trafego ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400 line-through')}>Meta Ads</span>
            <span className={clsx('rounded-full px-2.5 py-1 font-semibold', fontes.instagram ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-400 line-through')}>Instagram</span>
            {fontes.avisos.length > 0 && <span className="text-amber-700">{fontes.avisos.join(' ')}</span>}
          </div>
        )}

        {erro && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}
        {aviso && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{aviso}</p>}

        <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4 md:space-y-6 min-w-0">
            {/* CONVERSA */}
            <div className={clsx(CARD, 'p-4 md:p-6')}>
              <p className={ROTULO}>Conversa</p>
              {vazio ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Os dois agentes leem os dados de hoje de {cliente?.nome ?? 'cada cliente'}: o de tráfego vê o Meta Ads e o de social vê o Instagram.
                    Eles trocam o cenário, dizem o que falta e o que precisam um do outro, e no fim sai uma ata com as ações.
                  </p>
                </div>
              ) : (
                <ol className="mt-4 space-y-4" aria-live="polite">
                  {mensagens.map((m, i) => <Fala key={i} m={m} digitando={rodando && falando === m.agente && i === mensagens.length - 1} />)}
                  {escrevendoAta && (
                    <li className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
                      <span className="gm-live-dot" /> Escrevendo a ata da reunião…
                    </li>
                  )}
                </ol>
              )}
              <div ref={fim} />
            </div>

            {ata && <VerAta ata={ata} reuniao={reuniao} clienteId={clienteId} onAtualizar={r => { setReuniao(r); setHistorico(prev => prev.map(x => (x.id === r.id ? r : x))) }} />}
          </div>

          {/* HISTÓRICO */}
          <aside className={clsx(CARD, 'p-4 h-fit')}>
            <p className={ROTULO}>Reuniões anteriores</p>
            {historico.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nenhuma ainda.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {historico.map(r => (
                  <li key={r.id}>
                    <button
                      onClick={() => abrir(r)}
                      disabled={rodando}
                      className={clsx('w-full rounded-lg px-3 py-2 text-left transition-colors', reuniao?.id === r.id ? 'bg-gm-accent/10' : 'hover:bg-slate-50')}
                    >
                      <p className="text-xs font-semibold text-slate-900 tabular-nums">
                        {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{r.foco || r.resumo?.cenario || 'Sem ata'}</p>
                      <p className="mt-1 flex gap-1.5">
                        {r.enviados.plano_trafego && <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-700">plano</span>}
                        {r.enviados.estudio && <span className="rounded-full bg-cyan-100 px-1.5 text-[10px] font-semibold text-cyan-700">estúdio</span>}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

export default function AgentesPage() {
  return (
    <Suspense>
      <Agentes />
    </Suspense>
  )
}
