'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { AdminNav } from '@/components/AdminNav'
import { PainelTrafego, SkeletonPainel } from '@/components/trafego/PainelTrafego'
import { StatusPlano } from '@/components/trafego/PlanoAcao'
import {
  PERIODOS,
  PLANO_STATUS,
  dataBR,
  novoId,
  type DadosTrafego,
  type MetasTrafego,
  type Periodo,
  type PlanoItem,
  type TrafegoConta,
} from '@/lib/trafego'

interface Cliente {
  id: string
  nome: string
  ativo: boolean
  tipo: 'cliente' | 'outras_receitas'
}

interface ContaMeta {
  id: string
  nome: string
  ativa: boolean
}

const CAMPO = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-gm-accent'
const ROTULO = 'block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5'
const CARD = 'bg-white rounded-2xl border border-slate-100 shadow-sm'

const CAMPOS_META: { k: keyof MetasTrafego; rotulo: string; prefixo?: string; sufixo?: string; dica: string }[] = [
  { k: 'custo_compra', rotulo: 'Custo por venda', prefixo: 'R$', dica: 'CPA máximo aceitável' },
  { k: 'roas', rotulo: 'ROAS mínimo', sufixo: '×', dica: 'retorno sobre o investimento' },
  { k: 'custo_conversa', rotulo: 'Custo por conversa', prefixo: 'R$', dica: 'campanhas de mensagem' },
  { k: 'verba_mensal', rotulo: 'Verba do mês', prefixo: 'R$', dica: 'controla o ritmo de gasto' },
]
const METAS_VAZIAS = { custo_compra: '', roas: '', custo_conversa: '', verba_mensal: '' }

function metasComoTexto(m: MetasTrafego | null | undefined) {
  return Object.fromEntries(
    CAMPOS_META.map(({ k }) => [k, m?.[k] ? String(m[k]).replace('.', ',') : ''])
  ) as Record<keyof MetasTrafego, string>
}

function textoComoMetas(t: Record<keyof MetasTrafego, string>): MetasTrafego {
  return Object.fromEntries(
    CAMPOS_META.map(({ k }) => {
      const v = parseFloat(t[k].replace(/\./g, '').replace(',', '.'))
      return [k, isFinite(v) && v > 0 ? v : null]
    })
  )
}

function Trafego() {
  const router = useRouter()
  const params = useSearchParams()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '')
  const [contas, setContas] = useState<TrafegoConta[]>([])
  const [carregandoContas, setCarregandoContas] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [meta, setMeta] = useState<{ configurado: boolean; contas: ContaMeta[]; erro?: string } | null>(null)

  const [periodo, setPeriodo] = useState<Periodo>('last_30d')
  const [dados, setDados] = useState<DadosTrafego | null>(null)
  const [carregandoDados, setCarregandoDados] = useState(false)
  const [erroDados, setErroDados] = useState('')

  const [vinculo, setVinculo] = useState('')
  const [plano, setPlano] = useState<PlanoItem[]>([])
  const [recado, setRecado] = useState('')
  const [metas, setMetas] = useState<Record<keyof MetasTrafego, string>>(METAS_VAZIAS)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  const cliente = clientes.find(c => c.id === clienteId)
  const conta = contas.find(c => c.cliente_fixo_id === clienteId) ?? null

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
    api('/api/trafego').then(async r => {
      if (r.ok) setContas(await r.json())
      else {
        const err = await r.json().catch(() => ({}))
        setSemTabela(/trafego_contas/.test(err.error ?? '') || err.code === '42P01' || err.code === 'PGRST205')
      }
      setCarregandoContas(false)
    })
    api('/api/trafego/contas-meta')
      .then(r => r.json())
      .then(d => setMeta({ configurado: d.configurado, contas: d.contas ?? [], erro: d.error }))
      .catch(() => setMeta({ configurado: false, contas: [] }))
  }, [router])

  // Abre direto no primeiro cliente que já tem conta vinculada.
  useEffect(() => {
    if (params.get('cliente') || contas.length === 0 || clientes.length === 0) return
    const comConta = clientes.find(c => contas.some(t => t.cliente_fixo_id === c.id))
    if (comConta) setClienteId(comConta.id)
  }, [contas, clientes, params])

  useEffect(() => {
    setPlano(conta?.plano ?? [])
    setRecado(conta?.recado ?? '')
    setMetas(metasComoTexto(conta?.metas))
    setErro('')
  }, [conta?.id, conta?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const carregarDados = useCallback(async (id: string, p: Periodo) => {
    setCarregandoDados(true)
    setErroDados('')
    const res = await api(`/api/trafego/${id}/dados?periodo=${p}`)
    const corpo = await res.json().catch(() => ({}))
    if (res.ok) setDados(corpo)
    else {
      setDados(null)
      setErroDados(corpo.error || 'Não foi possível consultar o Meta.')
    }
    setCarregandoDados(false)
  }, [])

  useEffect(() => {
    setDados(null)
    if (conta) carregarDados(conta.id, periodo)
  }, [conta?.id, conta?.meta_ad_account_id, periodo, carregarDados]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function vincular() {
    if (!clienteId || !vinculo.trim()) return
    setSalvando(true)
    setErro('')
    const res = await api('/api/trafego', {
      method: 'POST',
      body: JSON.stringify({ cliente_fixo_id: clienteId, meta_ad_account_id: vinculo }),
    })
    const corpo = await res.json().catch(() => ({}))
    if (res.ok) {
      setContas(prev => [...prev.filter(c => c.cliente_fixo_id !== clienteId), corpo])
      setVinculo('')
    } else setErro(corpo.error || 'Não foi possível vincular a conta.')
    setSalvando(false)
  }

  async function salvar(mudancas: Record<string, unknown>) {
    if (!conta) return
    setSalvando(true)
    setErro('')
    const res = await api(`/api/trafego/${conta.id}`, { method: 'PATCH', body: JSON.stringify(mudancas) })
    const corpo = await res.json().catch(() => ({}))
    if (res.ok) setContas(prev => prev.map(c => (c.id === corpo.id ? corpo : c)))
    else setErro(corpo.error || 'Não foi possível salvar.')
    setSalvando(false)
  }

  async function desvincular() {
    if (!conta || !confirm(`Desvincular a conta de anúncios de ${cliente?.nome}? O plano de ação e o link do cliente serão apagados.`)) return
    const res = await api(`/api/trafego/${conta.id}`, { method: 'DELETE' })
    if (res.ok) setContas(prev => prev.filter(c => c.id !== conta.id))
  }

  const linkCliente = conta && typeof window !== 'undefined' ? `${window.location.origin}/trafego/${conta.link_token}` : ''

  async function copiarLink() {
    await navigator.clipboard.writeText(linkCliente)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const planoAlterado = useMemo(() => JSON.stringify(plano) !== JSON.stringify(conta?.plano ?? []), [plano, conta?.plano])
  const recadoAlterado = (recado.trim() || null) !== (conta?.recado ?? null)
  const metasAlteradas = JSON.stringify(textoComoMetas(metas)) !== JSON.stringify(textoComoMetas(metasComoTexto(conta?.metas)))

  function editarItem(id: string, mudancas: Partial<PlanoItem>) {
    setPlano(prev => prev.map(p => (p.id === id ? { ...p, ...mudancas } : p)))
  }

  function moverItem(i: number, dir: -1 | 1) {
    setPlano(prev => {
      const novo = [...prev]
      const j = i + dir
      if (j < 0 || j >= novo.length) return prev
      ;[novo[i], novo[j]] = [novo[j], novo[i]]
      return novo
    })
  }

  const contaMetaNome = meta?.contas.find(c => c.id === conta?.meta_ad_account_id)?.nome

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto w-full px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6">
        <div>
          <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Marketing</p>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 mt-0.5 md:mt-1">Tráfego pago</h1>
        </div>

        {/* HERO: cliente, período e link */}
        <div className="gm-hero rounded-2xl p-4 md:p-6" style={{ background: 'var(--gm-hero)' }}>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <label htmlFor="trafego-cliente" className="text-xs font-semibold uppercase tracking-wider text-white/60">Cliente</label>
              <select
                id="trafego-cliente"
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                className="mt-2 block w-full max-w-sm rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-base font-semibold text-white focus:outline-none focus:border-gm-glow [color-scheme:dark]"
              >
                {clientes.length === 0 && <option value="">Nenhum cliente ativo</option>}
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}{contas.some(t => t.cliente_fixo_id === c.id) ? ' · Meta Ads' : ''}
                  </option>
                ))}
              </select>
              {conta && (
                <p className="mt-2 flex items-center gap-2 text-xs text-white/60">
                  <span className="gm-live-dot" />
                  {contaMetaNome ? `${contaMetaNome} · ` : ''}{conta.meta_ad_account_id}
                </p>
              )}
            </div>

            {conta && (
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
            )}
          </div>

          {conta && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 md:p-4 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-white/60">Link do cliente</p>
                <p className={clsx('mt-1 text-sm font-mono truncate', conta.link_ativo ? 'text-white' : 'text-white/40 line-through')}>
                  {linkCliente}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={copiarLink}
                  disabled={!conta.link_ativo}
                  className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-40"
                >
                  {copiado ? '✓ Copiado' : 'Copiar link'}
                </button>
                {conta.link_ativo && (
                  <a href={linkCliente} target="_blank" rel="noreferrer" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">
                    Abrir ↗
                  </a>
                )}
                <button
                  onClick={() => salvar({ link_ativo: !conta.link_ativo })}
                  disabled={salvando}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                >
                  {conta.link_ativo ? 'Desativar' : 'Reativar'}
                </button>
                <button
                  onClick={() => confirm('Gerar um link novo? O link atual para de funcionar na hora.') && salvar({ novo_link: true })}
                  disabled={salvando}
                  className="rounded-lg px-2 py-2 text-xs text-white/60 hover:text-white"
                >
                  Gerar novo
                </button>
              </div>
            </div>
          )}
        </div>

        {semTabela && (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Falta criar a tabela no banco</p>
            <p className="mt-1">
              Rode no SQL Editor do Supabase o trecho “Tráfego pago” do final de
              <code className="mx-1 rounded bg-amber-100 px-1">supabase/schema.sql</code>. Depois recarregue esta página.
            </p>
          </div>
        )}

        {meta && !meta.configurado && (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Token do Meta não configurado</p>
            <p className="mt-1">
              Adicione a variável <code className="rounded bg-amber-100 px-1">META_ACCESS_TOKEN</code> com o token do System User
              em <code className="rounded bg-amber-100 px-1">.env.local</code> e nas variáveis de ambiente da Vercel, e reinicie o servidor.
            </p>
          </div>
        )}

        {erro && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{erro}</p>}

        {/* VINCULAR CONTA */}
        {!carregandoContas && !semTabela && cliente && !conta && (
          <div className={clsx(CARD, 'p-4 md:p-6')}>
            <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Conectar ao Meta Ads</p>
            <p className="mt-1 text-sm text-slate-600">
              Escolha a conta de anúncios de <b>{cliente.nome}</b>. Só aparecem as contas que deram acesso ao System User “GM &amp; CO TRÁFEGO”.
            </p>
            <div className="mt-4 flex gap-2 flex-wrap items-end">
              <div className="flex-1 min-w-[220px]">
                <label htmlFor="trafego-conta" className={ROTULO}>Conta de anúncios</label>
                {meta && meta.contas.length > 0 ? (
                  <select id="trafego-conta" value={vinculo} onChange={e => setVinculo(e.target.value)} className={CAMPO}>
                    <option value="">Selecione…</option>
                    {meta.contas.map(c => (
                      <option key={c.id} value={c.id} disabled={contas.some(t => t.meta_ad_account_id === c.id)}>
                        {c.nome} ({c.id}){contas.some(t => t.meta_ad_account_id === c.id) ? ' · já vinculada' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="trafego-conta"
                    value={vinculo}
                    onChange={e => setVinculo(e.target.value)}
                    placeholder="act_123456789"
                    className={CAMPO}
                  />
                )}
              </div>
              <button
                onClick={vincular}
                disabled={!vinculo.trim() || salvando}
                className="rounded-lg bg-gm-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {salvando ? 'Vinculando…' : 'Vincular conta'}
              </button>
            </div>
            {meta?.erro && <p className="mt-3 text-xs text-rose-600">Meta: {meta.erro}</p>}
          </div>
        )}

        {/* MÉTRICAS */}
        {conta && (
          <>
            {erroDados ? (
              <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <p className="font-semibold">Não foi possível carregar as métricas</p>
                <p className="mt-1">{erroDados}</p>
                <button onClick={() => carregarDados(conta.id, periodo)} className="mt-3 text-xs font-semibold underline">Tentar de novo</button>
              </div>
            ) : carregandoDados || !dados ? (
              <SkeletonPainel />
            ) : (
              <>
                <PainelTrafego dados={dados} metas={conta.metas} />
                <p className="text-right text-[11px] text-slate-400">
                  Dados do Meta Ads · atualizados às {new Date(dados.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (cache de 5 min)
                </p>
              </>
            )}

            {/* METAS */}
            <div className={clsx(CARD, 'p-4 md:p-6')}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Metas do cliente</p>
                  <p className="mt-1 text-sm text-slate-500">Pintam os indicadores e a tabela dia a dia contra a meta. Ficam só aqui; o link do cliente não mostra.</p>
                </div>
                <button
                  onClick={() => salvar({ metas: textoComoMetas(metas) })}
                  disabled={metasAlteradas === false || salvando}
                  className="rounded-lg bg-gm-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Salvar metas
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {CAMPOS_META.map(c => (
                  <div key={c.k}>
                    <label htmlFor={`meta-${c.k}`} className={ROTULO}>{c.rotulo}</label>
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:border-gm-accent">
                      {c.prefixo && <span className="px-2 text-xs text-slate-400">{c.prefixo}</span>}
                      <input
                        id={`meta-${c.k}`}
                        inputMode="decimal"
                        value={metas[c.k]}
                        onChange={e => setMetas(m => ({ ...m, [c.k]: e.target.value }))}
                        placeholder="—"
                        className={clsx('w-full text-sm py-2 focus:outline-none tabular-nums', c.prefixo ? 'pr-3' : 'px-3')}
                      />
                      {c.sufixo && <span className="px-2 text-xs text-slate-400">{c.sufixo}</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{c.dica}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* PLANO DE AÇÃO */}
            <div className={clsx(CARD, 'p-4 md:p-6')}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Plano de ação</p>
                  <p className="mt-1 text-sm text-slate-500">O cliente só vê os itens aprovados, em andamento ou concluídos. Itens “Proposto” ficam só aqui.</p>
                </div>
                <div className="flex items-center gap-2">
                  {planoAlterado && (
                    <button onClick={() => setPlano(conta.plano)} className="text-xs text-slate-500 hover:text-slate-800">Descartar</button>
                  )}
                  <button
                    onClick={() => salvar({ plano: plano.filter(p => p.titulo.trim()) })}
                    disabled={!planoAlterado || salvando}
                    className="rounded-lg bg-gm-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {salvando ? 'Salvando…' : 'Salvar plano'}
                  </button>
                </div>
              </div>

              <ol className="mt-4 space-y-3">
                {plano.map((p, i) => (
                  <li key={p.id} className="rounded-xl border border-slate-200 p-3 md:p-4">
                    <div className="grid gap-3 md:grid-cols-[28px_1fr_150px_160px_auto] md:items-start">
                      <span className="hidden md:flex h-7 w-7 items-center justify-center rounded-full bg-gm-accent/10 text-xs font-bold text-gm-accent tabular-nums">{i + 1}</span>
                      <div className="space-y-2 min-w-0">
                        <input
                          value={p.titulo}
                          onChange={e => editarItem(p.id, { titulo: e.target.value })}
                          placeholder="Ação (ex.: Destravar a campanha da Black Friday)"
                          aria-label={`Título do item ${i + 1}`}
                          className={clsx(CAMPO, 'font-semibold')}
                        />
                        <textarea
                          value={p.descricao}
                          onChange={e => editarItem(p.id, { descricao: e.target.value })}
                          placeholder="Detalhe o que será feito"
                          aria-label={`Descrição do item ${i + 1}`}
                          rows={2}
                          className={clsx(CAMPO, 'resize-y')}
                        />
                      </div>
                      <div>
                        <label className={clsx(ROTULO, 'md:hidden')} htmlFor={`prazo-${p.id}`}>Prazo</label>
                        <input
                          id={`prazo-${p.id}`}
                          type="date"
                          value={p.prazo ?? ''}
                          onChange={e => editarItem(p.id, { prazo: e.target.value || null })}
                          aria-label={`Prazo do item ${i + 1}`}
                          className={CAMPO}
                        />
                      </div>
                      <div>
                        <label className={clsx(ROTULO, 'md:hidden')} htmlFor={`status-${p.id}`}>Status</label>
                        <select
                          id={`status-${p.id}`}
                          value={p.status}
                          onChange={e => editarItem(p.id, { status: e.target.value as PlanoItem['status'] })}
                          aria-label={`Status do item ${i + 1}`}
                          className={CAMPO}
                        >
                          {PLANO_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <div className="mt-1.5"><StatusPlano s={p.status} /></div>
                      </div>
                      <div className="flex md:flex-col items-center gap-1 justify-end">
                        <button onClick={() => moverItem(i, -1)} disabled={i === 0} aria-label="Subir item" className="h-7 w-7 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">↑</button>
                        <button onClick={() => moverItem(i, 1)} disabled={i === plano.length - 1} aria-label="Descer item" className="h-7 w-7 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">↓</button>
                        <button onClick={() => setPlano(prev => prev.filter(x => x.id !== p.id))} aria-label="Remover item" className="h-7 w-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <button
                onClick={() => setPlano(prev => [...prev, { id: novoId(), titulo: '', descricao: '', prazo: null, status: 'proposto' }])}
                className="mt-3 w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-gm-accent hover:text-gm-accent"
              >
                + Adicionar ação
              </button>
            </div>

            {/* RECADO */}
            <div className={clsx(CARD, 'p-4 md:p-6')}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <label htmlFor="trafego-recado" className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Recado para o cliente</label>
                  <p className="mt-1 text-sm text-slate-500">Aparece no topo do link. Use para resumir o momento das campanhas.</p>
                </div>
                <button
                  onClick={() => salvar({ recado: recado.trim() || null })}
                  disabled={!recadoAlterado || salvando}
                  className="rounded-lg bg-gm-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Salvar recado
                </button>
              </div>
              <textarea
                id="trafego-recado"
                value={recado}
                onChange={e => setRecado(e.target.value)}
                rows={3}
                placeholder="Ex.: Os anúncios estão atraindo bem. Nesta semana o foco é destravar a Black Friday e revisar o checkout do site."
                className={clsx(CAMPO, 'mt-3 resize-y')}
              />
              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-400">
                <span>Conta vinculada em {dataBR(conta.created_at)}</span>
                <span className="flex items-center gap-3">
                  {cliente && <Link href={`/admin/cliente/${cliente.id}`} className="hover:text-slate-700">Ficha do cliente →</Link>}
                  <button onClick={desvincular} className="text-rose-500 hover:text-rose-700">Desvincular conta</button>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function TrafegoPage() {
  return (
    <Suspense>
      <Trafego />
    </Suspense>
  )
}
