'use client'

import { useEffect, useState, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'
import { formatMinutos, valorHora } from '@/lib/tempo'
import type { Ticket, TempoApontamento } from '@/types'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface ClienteFixo {
  id: string
  nome: string
  valor_mensal: number
  ativo: boolean
}

interface LinhaCliente {
  key: string
  nome: string
  tipo: 'fixo' | 'avulso'
  receita: number
  minutos: number
  rh: number | null
  ticketIds: string[]
  tickets: Ticket[]
}

export default function ClientesPage() {
  const [mes, setMes] = useState(new Date())
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientesFixos, setClientesFixos] = useState<ClienteFixo[]>([])
  const [apontamentos, setApontamentos] = useState<TempoApontamento[]>([])
  const [horaAlvo, setHoraAlvo] = useState(300)
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [editingAlvo, setEditingAlvo] = useState(false)
  const [alvoInput, setAlvoInput] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
  }, [router])

  useEffect(() => {
    setLoading(true)
    const from = format(startOfMonth(mes), 'yyyy-MM-dd')
    const to = format(endOfMonth(mes), 'yyyy-MM-dd')

    Promise.all([
      api('/api/tickets').then(r => r.json()),
      api('/api/clientes-fixos').then(r => r.json()),
      api(`/api/tempo?from=${from}&to=${to}`).then(r => r.json()),
      api('/api/configuracoes').then(r => r.json()),
    ]).then(([t, cf, ap, cfg]) => {
      setTickets(t)
      setClientesFixos(cf)
      setApontamentos(ap)
      if (cfg.hora_alvo) setHoraAlvo(Number(cfg.hora_alvo) || 300)
      setLoading(false)
    })
  }, [mes])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function saveHoraAlvo() {
    const v = parseFloat(alvoInput.replace(',', '.'))
    if (isNaN(v) || v <= 0) { setEditingAlvo(false); return }
    setHoraAlvo(v)
    await api('/api/configuracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave: 'hora_alvo', valor: String(v) }),
    })
    setEditingAlvo(false)
  }

  // Tempo total por ticket no mês
  const minutosPorTicket = useMemo(() => {
    const map = new Map<string, number>()
    apontamentos.forEach(a => {
      if (a.minutos != null && !a.ativo) {
        map.set(a.ticket_id, (map.get(a.ticket_id) ?? 0) + a.minutos)
      }
    })
    return map
  }, [apontamentos])

  // Linhas agregadas por cliente
  const linhas = useMemo(() => {
    const monthStart = startOfMonth(mes)
    const monthEnd = endOfMonth(mes)
    const mNum = mes.getMonth() + 1
    const aNum = mes.getFullYear()

    // Tickets do mês (criados, em curso, ou com tempo apontado no mês)
    const ticketsMes = tickets.filter(t => {
      const created = new Date(t.created_at)
      // ticket criado no mês OU tem tempo apontado no mês
      return (created >= monthStart && created <= monthEnd) || minutosPorTicket.has(t.id)
    })

    const result: LinhaCliente[] = []

    // === Clientes fixos ativos ===
    clientesFixos.filter(c => c.ativo).forEach(cf => {
      const tks = ticketsMes.filter(t => t.cliente_fixo_id === cf.id || (t.is_fixed_client && t.client_name?.toLowerCase().trim() === cf.nome?.toLowerCase().trim()))
      const min = tks.reduce((s, t) => s + (minutosPorTicket.get(t.id) ?? 0), 0)
      // Receita = valor_mensal cheio (modo A escolhido pelo usuário)
      const receita = Number(cf.valor_mensal)
      result.push({
        key: `fixo-${cf.id}`,
        nome: cf.nome,
        tipo: 'fixo',
        receita,
        minutos: min,
        rh: valorHora(receita, min),
        ticketIds: tks.map(t => t.id),
        tickets: tks,
      })
    })

    // === Clientes avulsos (agregados por client_name) ===
    const avulsos = ticketsMes.filter(t => !t.is_fixed_client && t.budget_value != null)
    const avulsoMap = new Map<string, { tickets: Ticket[]; receita: number }>()
    avulsos.forEach(t => {
      const key = t.client_name || 'Sem nome'
      const existing = avulsoMap.get(key) ?? { tickets: [], receita: 0 }
      existing.tickets.push(t)
      existing.receita += t.budget_value ?? 0
      avulsoMap.set(key, existing)
    })
    avulsoMap.forEach((v, nome) => {
      const min = v.tickets.reduce((s, t) => s + (minutosPorTicket.get(t.id) ?? 0), 0)
      result.push({
        key: `avulso-${nome}`,
        nome,
        tipo: 'avulso',
        receita: v.receita,
        minutos: min,
        rh: valorHora(v.receita, min),
        ticketIds: v.tickets.map(t => t.id),
        tickets: v.tickets,
      })
    })

    // Ordena: melhor R$/h primeiro, sem tempo no fim
    return result.sort((a, b) => {
      if (a.rh == null && b.rh == null) return b.receita - a.receita
      if (a.rh == null) return 1
      if (b.rh == null) return -1
      return b.rh - a.rh
    })
  }, [tickets, clientesFixos, minutosPorTicket, mes])

  const totalReceita = linhas.reduce((s, l) => s + l.receita, 0)
  const totalMinutos = linhas.reduce((s, l) => s + l.minutos, 0)
  const rhMedio = valorHora(totalReceita, totalMinutos)

  function indicadorRH(rh: number | null) {
    if (rh == null) return null
    if (rh >= horaAlvo) return { cor: 'bg-green-100 text-green-700', label: 'alto' }
    if (rh >= horaAlvo * 0.5) return { cor: 'bg-amber-100 text-amber-700', label: 'médio' }
    return { cor: 'bg-red-100 text-red-700', label: 'baixo' }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clientes · Rentabilidade</p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                {format(mes, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
              </h1>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <button onClick={() => setMes(m => subMonths(m, 1))} className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors">‹</button>
              <button onClick={() => setMes(new Date())} className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-colors">Hoje</button>
              <button onClick={() => setMes(m => addMonths(m, 1))} className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors">›</button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">R$/h médio</p>
            <p className={clsx('text-2xl font-bold', rhMedio == null ? 'text-slate-300' : rhMedio >= horaAlvo ? 'text-green-600' : rhMedio >= horaAlvo * 0.5 ? 'text-amber-500' : 'text-red-500')}>
              {rhMedio == null ? '—' : formatBRL(rhMedio)}
            </p>
          </div>
        </div>

        {/* Painel resumo */}
        <div
          className="rounded-2xl p-6 shadow-md text-white"
          style={{ background: 'radial-gradient(ellipse 80% 150% at 95% 50%, #C5A880 0%, #6B4C28 40%, #1c1a18 80%), #100E0B' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Visão Geral</p>
              <p className="text-sm text-white/80 mt-0.5">Receita, tempo e rentabilidade do mês</p>
            </div>
            <div className="text-right">
              {editingAlvo ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60">Hora-alvo R$</span>
                  <input
                    autoFocus
                    type="number"
                    value={alvoInput}
                    onChange={e => setAlvoInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveHoraAlvo(); if (e.key === 'Escape') setEditingAlvo(false) }}
                    className="w-20 text-sm px-2 py-1 rounded bg-white/10 text-white border border-white/20 focus:outline-none"
                  />
                  <button onClick={saveHoraAlvo} className="text-xs px-2 py-1 rounded bg-[#C5A880] text-white">OK</button>
                </div>
              ) : (
                <button
                  onClick={() => { setAlvoInput(String(horaAlvo)); setEditingAlvo(true) }}
                  className="text-xs text-white/60 hover:text-white/90 transition-colors"
                >
                  Hora-alvo: <span className="text-[#C5A880] font-semibold">{formatBRL(horaAlvo)}/h</span> · editar
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label="Receita total" value={formatBRL(totalReceita)} color="text-green-300" />
            <Card label="Tempo trabalhado" value={formatMinutos(totalMinutos)} color="text-blue-300" />
            <Card
              label="R$/h médio"
              value={rhMedio == null ? '—' : formatBRL(rhMedio)}
              sub={rhMedio == null ? 'Aponte tempo nos chamados' : rhMedio >= horaAlvo ? `Acima da meta de ${formatBRL(horaAlvo)}/h` : `Abaixo da meta de ${formatBRL(horaAlvo)}/h`}
              color={rhMedio == null ? 'text-white/60' : rhMedio >= horaAlvo ? 'text-green-300' : 'text-amber-300'}
              highlight
            />
            <Card label="Clientes ativos" value={String(linhas.length)} color="text-white" />
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Ranking por rentabilidade</h2>
            <p className="text-xs text-slate-400 mt-0.5">Do melhor R$/h ao pior · clique no cliente pra ver demandas</p>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Carregando...</div>
          ) : linhas.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum cliente com atividade este mês.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Receita</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tempo</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">R$/h</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Demandas</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {linhas.map(l => {
                  const ind = indicadorRH(l.rh)
                  const isOpen = expandido === l.key
                  return (
                    <Fragment key={l.key}>
                      <tr
                        onClick={() => setExpandido(isOpen ? null : l.key)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', l.tipo === 'fixo' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                              {l.tipo === 'fixo' ? 'Fixo' : 'Avulso'}
                            </span>
                            <span className="text-sm font-medium text-slate-800">{l.nome}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-800">{formatBRL(l.receita)}</td>
                        <td className="px-6 py-4 text-sm text-slate-700 tabular-nums">{l.minutos > 0 ? formatMinutos(l.minutos) : '—'}</td>
                        <td className="px-6 py-4">
                          {l.rh != null ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800">{formatBRL(l.rh)}</span>
                              {ind && <span className={clsx('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full', ind.cor)}>{ind.label}</span>}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">{l.tickets.length}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={clsx('text-slate-300 text-lg transition-transform inline-block', isOpen && 'rotate-180')}>⌄</span>
                        </td>
                      </tr>
                      {isOpen && l.tickets.length > 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-3 bg-slate-50">
                            <div className="space-y-1">
                              {l.tickets.map(t => (
                                <div
                                  key={t.id}
                                  onClick={() => router.push(`/admin/chamado/${t.id}`)}
                                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white cursor-pointer text-sm"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xs text-slate-400 w-16 flex-shrink-0">{format(new Date(t.created_at), 'd MMM', { locale: ptBR })}</span>
                                    <span className="text-slate-800 truncate">{t.title}</span>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-xs text-slate-500 tabular-nums">{formatMinutos(minutosPorTicket.get(t.id) ?? 0)}</span>
                                    {t.budget_value != null && <span className="text-xs font-semibold text-green-600">{formatBRL(t.budget_value)}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="text-xs text-slate-400 px-2">
          💡 <span className="font-medium">Como funciona:</span> para clientes fixos, receita = valor_mensal cheio independente do número de demandas.
          Para avulsos, receita = soma dos orçamentos do mês. Tempo = tudo apontado nos chamados dentro do mês.
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, sub, color, highlight }: { label: string; value: string; sub?: string; color: string; highlight?: boolean }) {
  return (
    <div className={clsx('rounded-xl p-4 border', highlight ? 'bg-white/15 border-white/30' : 'bg-white/5 border-white/10', 'backdrop-blur-sm')}>
      <p className="text-xs uppercase tracking-wider text-white/60 mb-2">{label}</p>
      <p className={clsx('text-2xl font-bold leading-tight', color)}>{value}</p>
      {sub && <p className="text-[11px] text-white/50 mt-1.5 leading-tight">{sub}</p>}
    </div>
  )
}
