'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { AdminNav } from '@/components/AdminNav'
import {
  SOCIAL_TIPO_LABELS,
  demandasPropostas,
  type DemandaProposta,
  type Pauta,
  type Plano,
  type Roteiro,
  type SocialConteudo,
  type SocialTipo,
} from '@/lib/social'

interface Cliente {
  id: string
  nome: string
  ativo: boolean
  tipo: 'cliente' | 'outras_receitas'
}

const TIPOS: SocialTipo[] = ['pauta', 'roteiro', 'plano']

const TIPO_CURTO: Record<SocialTipo, string> = { pauta: 'Pauta', roteiro: 'Roteiro', plano: 'Plano' }

const PLACEHOLDER: Record<SocialTipo, string> = {
  pauta: 'Ex: foco em Black Friday, destacar a coleção nova e os depoimentos de clientes.',
  roteiro: 'Ex: bastidores da produção, tom leve, mostrar o dono falando para a câmera.',
  plano: 'Ex: cliente quer dobrar os pedidos pelo Instagram e abrir a segunda loja em março.',
}

const ETAPAS = [
  'Lendo o escopo e o histórico do cliente…',
  'Cruzando com as demandas já produzidas…',
  'Montando a linha editorial…',
  'Escrevendo os textos finais…',
]

const CAMPO =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none'

const ROTULO = 'block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function dataCurta(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function Nucleo({ className }: { className?: string }) {
  return (
    <div className={clsx('relative flex-shrink-0', className)} aria-hidden="true">
      <span className="absolute inset-0 rounded-full border border-gm-glow/40 border-t-gm-glow animate-[spin_3s_linear_infinite]" />
      <span className="absolute inset-[14%] rounded-full border border-dashed border-gm-accent/70 animate-[spin_8s_linear_infinite_reverse]" />
      <span className="absolute inset-[34%] rounded-full bg-gm-glow shadow-[0_0_24px_4px_rgb(var(--gm-glow)/0.7)] animate-pulse" />
    </div>
  )
}

function Etiqueta({ children, tom = 'slate' }: { children: React.ReactNode; tom?: 'slate' | 'green' | 'violet' | 'amber' }) {
  const tons = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-green-100 text-green-700',
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', tons[tom])}>
      {children}
    </span>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={ROTULO}>{titulo}</p>
      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  )
}

interface AcaoDemanda {
  liberado: boolean
  ticketDe: (chave: string) => string | undefined
  criando: Set<string>
  criar: (propostas: DemandaProposta[]) => void
}

function BotaoDemanda({ proposta, acao }: { proposta: DemandaProposta; acao: AcaoDemanda }) {
  const ticketId = acao.ticketDe(proposta.chave)
  if (ticketId) {
    return (
      <Link href={`/admin/chamado/${ticketId}`} className="text-xs font-medium text-green-700 hover:underline whitespace-nowrap">
        ✓ Ver demanda →
      </Link>
    )
  }
  if (!acao.liberado) return null
  return (
    <button
      onClick={() => acao.criar([proposta])}
      disabled={acao.criando.has(proposta.chave)}
      className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gm-accent text-white disabled:opacity-50 whitespace-nowrap"
    >
      {acao.criando.has(proposta.chave) ? 'Criando…' : 'Virar demanda'}
    </button>
  )
}

function VerPauta({ pauta, propostas, acao }: { pauta: Pauta; propostas: DemandaProposta[]; acao: AcaoDemanda }) {
  return (
    <div className="space-y-4">
      <Bloco titulo="Linha editorial">{pauta.resumo}</Bloco>
      <ol className="space-y-3">
        {pauta.posts.map((p, i) => (
          <li key={i} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-900 tabular-nums capitalize">{dataCurta(p.data)}</span>
                  <Etiqueta tom="violet">{p.formato}</Etiqueta>
                  <Etiqueta>{p.pilar}</Etiqueta>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900">{p.tema}</p>
              </div>
              <BotaoDemanda proposta={propostas[i]} acao={acao} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Bloco titulo="Gancho">{p.gancho}</Bloco>
              <Bloco titulo="CTA">{p.cta}</Bloco>
            </div>
            {p.roteiro_visual?.length > 0 && (
              <div className="mt-3">
                <Bloco titulo={p.formato === 'Carrossel' ? 'Slides' : 'Cenas'}>
                  <ol className="list-decimal pl-5 space-y-1">
                    {p.roteiro_visual.map((s, j) => <li key={j}>{s}</li>)}
                  </ol>
                </Bloco>
              </div>
            )}
            <div className="mt-3">
              <Bloco titulo="Legenda">{p.legenda}</Bloco>
            </div>
            {p.hashtags.length > 0 && (
              <p className="mt-2 text-xs text-slate-400 break-words">
                {p.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function VerRoteiro({ roteiro }: { roteiro: Roteiro }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Etiqueta tom="violet">{roteiro.formato}</Etiqueta>
        <Etiqueta>{roteiro.duracao}</Etiqueta>
      </div>
      <Bloco titulo="Objetivo">{roteiro.objetivo}</Bloco>
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
        <Bloco titulo="Gancho — primeiros 3 segundos">{roteiro.gancho}</Bloco>
      </div>
      <ol className="space-y-2">
        {roteiro.cenas.map((c, i) => (
          <li key={i} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[88px_1fr_1fr]">
            <p className="text-xs font-semibold text-slate-900 tabular-nums">{c.tempo}</p>
            <Bloco titulo="Visual">
              {c.visual}
              {c.texto_tela && <span className="mt-1 block text-xs text-slate-500">Na tela: “{c.texto_tela}”</span>}
            </Bloco>
            <Bloco titulo="Fala">{c.fala || '—'}</Bloco>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 md:grid-cols-2">
        <Bloco titulo="CTA">{roteiro.cta}</Bloco>
        <Bloco titulo="Legenda">{roteiro.legenda}</Bloco>
      </div>
      {roteiro.dicas_gravacao.length > 0 && (
        <Bloco titulo="Dicas de gravação">
          <ul className="list-disc pl-5 space-y-1">
            {roteiro.dicas_gravacao.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </Bloco>
      )}
    </div>
  )
}

function VerPlano({ plano, propostas, acao }: { plano: Plano; propostas: DemandaProposta[]; acao: AcaoDemanda }) {
  return (
    <div className="space-y-5">
      <Bloco titulo="Diagnóstico">{plano.diagnostico}</Bloco>
      <div className="grid gap-4 md:grid-cols-2">
        <Bloco titulo="Público-alvo">{plano.publico_alvo}</Bloco>
        <Bloco titulo="Posicionamento">{plano.posicionamento}</Bloco>
      </div>
      <Bloco titulo="Objetivos">
        <ul className="list-disc pl-5 space-y-1">{plano.objetivos.map((o, i) => <li key={i}>{o}</li>)}</ul>
      </Bloco>
      <div>
        <p className={ROTULO}>Pilares de conteúdo</p>
        <div className="grid gap-3 md:grid-cols-2">
          {plano.pilares.map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">{p.nome}</p>
              <p className="mt-1 text-sm text-slate-600">{p.descricao}</p>
              <ul className="mt-2 list-disc pl-5 text-xs text-slate-500 space-y-0.5">
                {p.exemplos.map((e, j) => <li key={j}>{e}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className={ROTULO}>Canais</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <tbody>
              {plano.canais.map((c, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{c.canal}</td>
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{c.frequencia}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.papel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <p className={ROTULO}>Cronograma</p>
        <ol className="space-y-2">
          {plano.cronograma.map((c, i) => (
            <li key={i} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">{c.periodo} · <span className="font-normal text-slate-600">{c.foco}</span></p>
              <ul className="mt-1.5 list-disc pl-5 text-sm text-slate-600 space-y-0.5">
                {c.entregas.map((e, j) => <li key={j}>{e}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </div>
      <Bloco titulo="Indicadores">
        <ul className="list-disc pl-5 space-y-1">{plano.kpis.map((k, i) => <li key={i}>{k}</li>)}</ul>
      </Bloco>
      <div>
        <p className={ROTULO}>Primeiras ações</p>
        <ol className="space-y-2">
          {plano.acoes.map((a, i) => (
            <li key={i} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{a.titulo}</p>
                <p className="mt-1 text-sm text-slate-600">{a.descricao}</p>
                <p className="mt-1 text-xs text-slate-400">Prazo: {a.prazo_dias} dias</p>
              </div>
              <BotaoDemanda proposta={propostas[i]} acao={acao} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function SocialStudio() {
  const router = useRouter()
  const params = useSearchParams()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '')
  const [itens, setItens] = useState<SocialConteudo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)

  const [tipo, setTipo] = useState<SocialTipo>('pauta')
  const [briefing, setBriefing] = useState('')
  const [opcoes, setOpcoes] = useState({ quantidade: '8', inicio: hojeISO(), formato: 'Reels', duracao: '45 segundos', periodo: 'os próximos 3 meses' })
  const [gerando, setGerando] = useState(false)
  const [etapa, setEtapa] = useState(0)
  const [erro, setErro] = useState('')

  const [selId, setSelId] = useState<string | null>(null)
  const [naoSalvo, setNaoSalvo] = useState<SocialConteudo | null>(null)
  const [ajuste, setAjuste] = useState('')
  const [criando, setCriando] = useState<Set<string>>(new Set())

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
        if (lista.length === 0) setCarregando(false)
      })
  }, [router])

  const carregar = useCallback(async (id: string) => {
    setCarregando(true)
    const res = await api(`/api/social?cliente_id=${id}`)
    if (res.ok) {
      setItens(await res.json())
      setSemTabela(false)
    } else {
      const err = await res.json().catch(() => ({}))
      setItens([])
      setSemTabela(/social_conteudos/.test(err.error ?? '') || err.code === '42P01' || err.code === 'PGRST205')
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    if (!clienteId) return
    setSelId(null)
    setNaoSalvo(null)
    setErro('')
    carregar(clienteId)
  }, [clienteId, carregar])

  // Mensagens de progresso enquanto o Claude escreve.
  useEffect(() => {
    if (!gerando) return
    setEtapa(0)
    const id = setInterval(() => setEtapa(e => Math.min(e + 1, ETAPAS.length - 1)), 6000)
    return () => clearInterval(id)
  }, [gerando])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const selecionado = naoSalvo ?? itens.find(i => i.id === selId) ?? null
  const propostas = useMemo(() => (selecionado ? demandasPropostas(selecionado) : []), [selecionado])
  const pendentes = propostas.filter(p => !selecionado?.demandas.some(d => d.chave === p.chave))

  const contagem = (t: SocialTipo) => itens.filter(i => i.tipo === t).length
  const aprovadosSemDemanda = itens.filter(i => i.status === 'aprovado' && i.demandas.length < demandasPropostas(i).length).length

  async function pedirGeracao(corpo: Record<string, unknown>) {
    const res = await api('/api/social/gerar', { method: 'POST', body: JSON.stringify(corpo) })
    const dados = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(dados.error || `Falha ao gerar (${res.status})`)
    return dados.conteudo as SocialConteudo['conteudo']
  }

  async function gerar() {
    if (!clienteId || gerando) return
    setGerando(true)
    setErro('')
    setNaoSalvo(null)
    try {
      const conteudo = await pedirGeracao({ cliente_id: clienteId, tipo, briefing, opcoes })
      const base = { cliente_fixo_id: clienteId, tipo, titulo: conteudo.titulo, briefing: briefing.trim() || null, conteudo }
      const res = await api('/api/social', { method: 'POST', body: JSON.stringify(base) })
      if (res.ok) {
        const salvo: SocialConteudo = await res.json()
        setItens(prev => [salvo, ...prev])
        setSelId(salvo.id)
        setBriefing('')
      } else {
        // Mostra o resultado mesmo sem conseguir salvar, para não perder a geração.
        setNaoSalvo({ ...base, id: '', created_at: '', updated_at: '', status: 'rascunho', demandas: [] } as SocialConteudo)
        setSemTabela(true)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar.')
    }
    setGerando(false)
  }

  async function atualizar(item: SocialConteudo, mudancas: Partial<SocialConteudo>) {
    const res = await api(`/api/social/${item.id}`, { method: 'PATCH', body: JSON.stringify(mudancas) })
    if (!res.ok) {
      setErro('Não foi possível salvar a alteração.')
      return null
    }
    const novo: SocialConteudo = await res.json()
    setItens(prev => prev.map(i => (i.id === novo.id ? novo : i)))
    return novo
  }

  async function aplicarAjuste(item: SocialConteudo) {
    if (!ajuste.trim() || gerando) return
    setGerando(true)
    setErro('')
    try {
      const conteudo = await pedirGeracao({
        cliente_id: item.cliente_fixo_id,
        tipo: item.tipo,
        ajuste: { conteudo: item.conteudo, instrucao: ajuste },
      })
      if (item.id) {
        await atualizar(item, { conteudo, titulo: conteudo.titulo, status: 'rascunho' } as Partial<SocialConteudo>)
      } else {
        setNaoSalvo({ ...item, conteudo, titulo: conteudo.titulo } as SocialConteudo)
      }
      setAjuste('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao ajustar.')
    }
    setGerando(false)
  }

  async function excluir(item: SocialConteudo) {
    if (!confirm(`Excluir "${item.titulo}"? As demandas já criadas continuam no quadro.`)) return
    const res = await api(`/api/social/${item.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setErro('Não foi possível excluir.')
      return
    }
    setItens(prev => prev.filter(i => i.id !== item.id))
    setSelId(null)
  }

  async function criarDemandas(item: SocialConteudo, lista: DemandaProposta[]) {
    if (!cliente) return
    setCriando(new Set(lista.map(p => p.chave)))
    setErro('')
    const criadas = [...item.demandas]
    for (const p of lista) {
      const res = await api('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title: p.title,
          description: p.description,
          request_type: p.request_type,
          priority: 'normal',
          status: 'novo',
          deadline: p.deadline,
          where_used: p.where_used,
          purpose: p.purpose,
          client_email: '',
          pagamento_recebido: false,
          is_fixed_client: true,
          cliente_fixo_id: cliente.id,
          client_name: cliente.nome,
          company: null,
          budget_value: null,
        }),
      })
      if (!res.ok) {
        setErro(`Falha ao criar a demanda "${p.title}". As anteriores foram criadas.`)
        break
      }
      const ticket = await res.json()
      criadas.push({ chave: p.chave, ticket_id: ticket.id })
    }
    if (criadas.length > item.demandas.length) await atualizar(item, { demandas: criadas })
    setCriando(new Set())
  }

  const acao: AcaoDemanda = {
    liberado: !!selecionado?.id && selecionado.status === 'aprovado',
    ticketDe: chave => selecionado?.demandas.find(d => d.chave === chave)?.ticket_id,
    criando,
    criar: lista => selecionado && criarDemandas(selecionado, lista),
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto w-full px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6">
        <div>
          <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Social media</p>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 mt-0.5 md:mt-1">Estúdio de conteúdo</h1>
        </div>

        {/* HERO: cliente + números */}
        <div className="gm-hero rounded-2xl p-4 md:p-6" style={{ background: 'var(--gm-hero)' }}>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <label htmlFor="social-cliente" className="text-xs font-semibold uppercase tracking-wider text-white/60">Cliente</label>
              <select
                id="social-cliente"
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                className="mt-2 block w-full max-w-sm rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-base font-semibold text-white focus:outline-none focus:border-gm-glow [color-scheme:dark]"
              >
                {clientes.length === 0 && <option value="">Nenhum cliente ativo</option>}
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            {cliente && (
              <Link href={`/admin/cliente/${cliente.id}`} className="text-xs text-gm-glow hover:underline whitespace-nowrap">
                Abrir ficha do cliente →
              </Link>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { rotulo: 'Pautas', valor: contagem('pauta') },
              { rotulo: 'Roteiros', valor: contagem('roteiro') },
              { rotulo: 'Planos', valor: contagem('plano') },
              { rotulo: 'Aprovados sem demanda', valor: aprovadosSemDemanda, destaque: aprovadosSemDemanda > 0 },
            ].map(s => (
              <div key={s.rotulo} className={clsx('rounded-xl border p-3 md:p-4 min-w-0', s.destaque ? 'bg-white/15 border-white/30' : 'bg-white/5 border-white/10')}>
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-white/60 truncate">{s.rotulo}</p>
                <p className={clsx('mt-1.5 text-2xl font-bold tabular-nums', s.destaque ? 'text-amber-300' : 'text-white')}>{s.valor}</p>
              </div>
            ))}
          </div>
        </div>

        {semTabela && (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Falta criar a tabela no banco</p>
            <p className="mt-1">
              Para salvar pautas, roteiros e planos, rode no SQL Editor do Supabase o trecho “estúdio de social media” do final de
              <code className="mx-1 rounded bg-amber-100 px-1">supabase/schema.sql</code>. Enquanto isso, o que for gerado aparece aqui mas não fica salvo.
            </p>
          </div>
        )}

        {/* GERADOR */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Gerar com IA</p>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">Usa o escopo, as métricas, os documentos e as demandas recentes do cliente</p>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 p-1" role="tablist" aria-label="Tipo de conteúdo">
              {TIPOS.map(t => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tipo === t}
                  onClick={() => setTipo(t)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    tipo === t ? 'bg-gm-accent text-white' : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  {TIPO_CURTO[t]}
                </button>
              ))}
            </div>
          </div>

          {gerando ? (
            <div className="mt-5 flex items-center gap-4 rounded-xl bg-slate-50 border border-slate-200 p-5" aria-live="polite">
              <Nucleo className="h-12 w-12" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Gerando {SOCIAL_TIPO_LABELS[tipo].toLowerCase()} para {cliente?.nome}</p>
                <p className="text-sm text-slate-500 mt-0.5">{ETAPAS[etapa]}</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="social-briefing" className={ROTULO}>Direcionamento (opcional)</label>
                <textarea
                  id="social-briefing"
                  value={briefing}
                  onChange={e => setBriefing(e.target.value)}
                  rows={3}
                  placeholder={PLACEHOLDER[tipo]}
                  className={clsx(CAMPO, 'resize-none')}
                />
              </div>

              <div className="flex items-end gap-3 flex-wrap">
                {tipo === 'pauta' && (
                  <>
                    <div>
                      <label htmlFor="social-qtd" className={ROTULO}>Postagens</label>
                      <select id="social-qtd" value={opcoes.quantidade} onChange={e => setOpcoes(o => ({ ...o, quantidade: e.target.value }))} className={CAMPO}>
                        {['4', '8', '12', '16'].map(n => <option key={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="social-inicio" className={ROTULO}>A partir de</label>
                      <input id="social-inicio" type="date" value={opcoes.inicio} onChange={e => setOpcoes(o => ({ ...o, inicio: e.target.value }))} className={CAMPO} />
                    </div>
                  </>
                )}
                {tipo === 'roteiro' && (
                  <>
                    <div>
                      <label htmlFor="social-formato" className={ROTULO}>Formato</label>
                      <select id="social-formato" value={opcoes.formato} onChange={e => setOpcoes(o => ({ ...o, formato: e.target.value }))} className={CAMPO}>
                        {['Reels', 'Stories', 'Vídeo longo', 'Anúncio'].map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="social-duracao" className={ROTULO}>Duração</label>
                      <select id="social-duracao" value={opcoes.duracao} onChange={e => setOpcoes(o => ({ ...o, duracao: e.target.value }))} className={CAMPO}>
                        {['15 segundos', '30 segundos', '45 segundos', '60 segundos', '90 segundos', '3 minutos'].map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {tipo === 'plano' && (
                  <div>
                    <label htmlFor="social-periodo" className={ROTULO}>Período</label>
                    <select id="social-periodo" value={opcoes.periodo} onChange={e => setOpcoes(o => ({ ...o, periodo: e.target.value }))} className={CAMPO}>
                      {['o próximo mês', 'os próximos 3 meses', 'os próximos 6 meses', 'os próximos 12 meses'].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                )}
                <button
                  onClick={gerar}
                  disabled={!clienteId}
                  className="ml-auto text-sm font-semibold px-5 py-2.5 rounded-xl bg-gm-accent text-white disabled:opacity-50"
                >
                  Gerar {TIPO_CURTO[tipo].toLowerCase()}
                </button>
              </div>
            </div>
          )}

          {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</p>}
        </div>

        {/* BIBLIOTECA + DETALHE */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-[320px_1fr] items-start">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Biblioteca do cliente</p>
            </div>
            {carregando ? (
              <p className="p-6 text-sm text-slate-400 text-center">Carregando…</p>
            ) : itens.length === 0 ? (
              <p className="p-6 text-sm text-slate-400 text-center">Nada gerado ainda para este cliente.</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                {itens.map(i => {
                  const total = demandasPropostas(i).length
                  return (
                    <li key={i.id}>
                      <button
                        onClick={() => { setSelId(i.id); setNaoSalvo(null); setAjuste('') }}
                        className={clsx('w-full text-left px-4 py-3 transition-colors hover:bg-slate-50', selId === i.id && !naoSalvo && 'bg-gm-accent/10')}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Etiqueta tom="violet">{TIPO_CURTO[i.tipo]}</Etiqueta>
                          <Etiqueta tom={i.status === 'aprovado' ? 'green' : 'slate'}>{i.status === 'aprovado' ? 'Aprovado' : 'Rascunho'}</Etiqueta>
                          {i.demandas.length > 0 && <Etiqueta tom="amber">{i.demandas.length}/{total} demandas</Etiqueta>}
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-slate-900 line-clamp-2">{i.titulo}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{new Date(i.created_at).toLocaleDateString('pt-BR')}</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 min-w-0">
            {!selecionado ? (
              <p className="py-16 text-center text-sm text-slate-400">Gere um conteúdo ou escolha um item da biblioteca para ver aqui.</p>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Etiqueta tom="violet">{SOCIAL_TIPO_LABELS[selecionado.tipo]}</Etiqueta>
                      {selecionado.id ? (
                        <Etiqueta tom={selecionado.status === 'aprovado' ? 'green' : 'slate'}>{selecionado.status === 'aprovado' ? 'Aprovado' : 'Rascunho'}</Etiqueta>
                      ) : (
                        <Etiqueta tom="amber">Não salvo</Etiqueta>
                      )}
                    </div>
                    <h2 className="mt-2 text-lg md:text-xl font-bold text-slate-900">{selecionado.titulo}</h2>
                  </div>

                  {selecionado.id && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {selecionado.status === 'rascunho' ? (
                        <button onClick={() => atualizar(selecionado, { status: 'aprovado' })} className="text-sm font-semibold px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
                          ✓ Aprovar
                        </button>
                      ) : (
                        <>
                          {pendentes.length > 1 && (
                            <button
                              onClick={() => criarDemandas(selecionado, pendentes)}
                              disabled={criando.size > 0}
                              className="text-sm font-semibold px-4 py-2 rounded-lg bg-gm-accent text-white disabled:opacity-50"
                            >
                              {criando.size > 0 ? 'Criando…' : `Criar ${pendentes.length} demandas`}
                            </button>
                          )}
                          {selecionado.tipo === 'roteiro' && <BotaoDemanda proposta={propostas[0]} acao={acao} />}
                          <button onClick={() => atualizar(selecionado, { status: 'rascunho' })} className="text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                            Voltar a rascunho
                          </button>
                        </>
                      )}
                      <button onClick={() => excluir(selecionado)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50">
                        Excluir
                      </button>
                    </div>
                  )}
                </div>

                {selecionado.id && selecionado.status === 'rascunho' && (
                  <p className="text-xs text-slate-400">Aprove para liberar a criação de demandas.</p>
                )}

                {selecionado.tipo === 'pauta' && <VerPauta pauta={selecionado.conteudo} propostas={propostas} acao={acao} />}
                {selecionado.tipo === 'roteiro' && <VerRoteiro roteiro={selecionado.conteudo} />}
                {selecionado.tipo === 'plano' && <VerPlano plano={selecionado.conteudo} propostas={propostas} acao={acao} />}

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <label htmlFor="social-ajuste" className={ROTULO}>Ajustar com IA</label>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <input
                      id="social-ajuste"
                      value={ajuste}
                      onChange={e => setAjuste(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && aplicarAjuste(selecionado)}
                      placeholder="Ex: deixe as legendas mais curtas e troque o post 3 por um depoimento"
                      className={CAMPO}
                    />
                    <button
                      onClick={() => aplicarAjuste(selecionado)}
                      disabled={!ajuste.trim() || gerando}
                      className="text-sm font-semibold px-4 py-2 rounded-lg bg-gm-accent text-white disabled:opacity-50 whitespace-nowrap"
                    >
                      {gerando ? 'Reescrevendo…' : 'Reescrever'}
                    </button>
                  </div>
                  {selecionado.status === 'aprovado' && (
                    <p className="mt-2 text-xs text-slate-400">Reescrever volta o item para rascunho; demandas já criadas não mudam.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SocialPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Carregando...</div>}>
      <SocialStudio />
    </Suspense>
  )
}
