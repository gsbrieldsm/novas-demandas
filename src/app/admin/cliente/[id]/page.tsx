'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'
import { formatMinutos, valorHora } from '@/lib/tempo'
import type { Ticket, TempoApontamento, Proposta, PropostaStatus } from '@/types'
import { PROPOSTA_STATUS_LABELS } from '@/types'

const PROPOSTA_STATUS_COLORS: Record<PropostaStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-100 text-blue-700',
  aceita: 'bg-green-100 text-green-700',
  recusada: 'bg-red-100 text-red-700',
  expirada: 'bg-amber-100 text-amber-700',
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface ClienteFixo {
  id: string
  nome: string
  email: string | null
  valor_mensal: number
  dia_vencimento: number | null
  ativo: boolean
  escopo_mensal: string | null
  observacoes_internas: string | null
  data_inicio: string | null
  data_cancelamento: string | null
  created_at: string
  cnpj: string | null
  razao_social: string | null
  telefone: string | null
}

function formatCNPJ(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function formatTelefone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

interface Metrica {
  id: string
  cliente_fixo_id: string
  mes: number
  ano: number
  seguidores: number | null
  engajamento_percent: number | null
  alcance: number | null
  visualizacoes: number | null
  observacoes: string | null
}

export default function ClienteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [cliente, setCliente] = useState<ClienteFixo | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [tempo, setTempo] = useState<TempoApontamento[]>([])
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [editingIdent, setEditingIdent] = useState(false)
  const [editingEscopo, setEditingEscopo] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelDate, setCancelDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // Form states
  const [identForm, setIdentForm] = useState({
    nome: '', email: '', valor_mensal: '', dia_vencimento: '', data_inicio: '',
    cnpj: '', razao_social: '', telefone: '',
  })
  const [escopoForm, setEscopoForm] = useState({ escopo_mensal: '', observacoes_internas: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
  }, [router])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [cs, ts, tm, ms, ps] = await Promise.all([
      api('/api/clientes-fixos').then(r => r.json()),
      api('/api/tickets').then(r => r.json()),
      api('/api/tempo').then(r => r.json()),
      api(`/api/metricas?cliente_id=${id}`).then(r => r.json()),
      api(`/api/propostas?cliente_fixo_id=${id}`).then(r => r.json()),
    ])
    const cf = (cs as ClienteFixo[]).find(c => c.id === id)
    setCliente(cf ?? null)
    setTickets(ts)
    setTempo(tm)
    setMetricas(ms)
    setPropostas(ps)
    if (cf) {
      setIdentForm({
        nome: cf.nome,
        email: cf.email ?? '',
        valor_mensal: String(cf.valor_mensal),
        dia_vencimento: cf.dia_vencimento ? String(cf.dia_vencimento) : '',
        data_inicio: cf.data_inicio ?? '',
        cnpj: cf.cnpj ?? '',
        razao_social: cf.razao_social ?? '',
        telefone: cf.telefone ?? '',
      })
      setEscopoForm({
        escopo_mensal: cf.escopo_mensal ?? '',
        observacoes_internas: cf.observacoes_internas ?? '',
      })
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function patchCliente(body: Record<string, unknown>) {
    await api(`/api/clientes-fixos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function salvarIdent() {
    if (!identForm.nome.trim()) return
    const body = {
      nome: identForm.nome.trim(),
      email: identForm.email.trim() || null,
      valor_mensal: parseFloat(identForm.valor_mensal.replace(',', '.')) || 0,
      dia_vencimento: identForm.dia_vencimento ? parseInt(identForm.dia_vencimento, 10) : null,
      data_inicio: identForm.data_inicio || null,
      cnpj: identForm.cnpj.trim() || null,
      razao_social: identForm.razao_social.trim() || null,
      telefone: identForm.telefone.trim() || null,
    }
    await patchCliente(body)
    setEditingIdent(false)
    loadAll()
  }

  async function salvarEscopo() {
    await patchCliente({
      escopo_mensal: escopoForm.escopo_mensal.trim() || null,
      observacoes_internas: escopoForm.observacoes_internas.trim() || null,
    })
    setEditingEscopo(false)
    loadAll()
  }

  async function confirmarCancelamento() {
    await patchCliente({
      data_cancelamento: cancelDate,
      ativo: false,
    })
    setShowCancel(false)
    loadAll()
  }

  async function reativarCliente() {
    if (!confirm('Reativar este cliente? A data de cancelamento será removida.')) return
    await patchCliente({
      data_cancelamento: null,
      ativo: true,
    })
    loadAll()
  }

  async function deleteCliente() {
    if (!confirm('Excluir este cliente PERMANENTEMENTE? Os dados históricos serão perdidos. Considere apenas marcar como cancelado em vez disso.')) return
    await api(`/api/clientes-fixos/${id}`, { method: 'DELETE' })
    router.push('/admin/clientes')
  }

  // ============ Cálculos ============
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const minutosPorTicket = useMemo(() => {
    const map = new Map<string, number>()
    tempo.forEach(a => {
      if (a.minutos != null && !a.ativo) {
        map.set(a.ticket_id, (map.get(a.ticket_id) ?? 0) + a.minutos)
      }
    })
    return map
  }, [tempo])

  const ticketsDoCliente = useMemo(() => {
    if (!cliente) return []
    const cfNome = cliente.nome?.toLowerCase().trim()
    return tickets.filter(t => {
      if (t.cliente_fixo_id === cliente.id) return true
      if (!t.is_fixed_client || !cfNome) return false
      const cn = t.client_name?.toLowerCase().trim()
      const co = t.company?.toLowerCase().trim()
      return cn === cfNome || co === cfNome
    }).sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
  }, [tickets, cliente])

  const ticketsDoMes = useMemo(() => {
    return ticketsDoCliente.filter(t => {
      const d = new Date(t.created_at)
      return d >= monthStart && d <= monthEnd
    })
  }, [ticketsDoCliente, monthStart, monthEnd])

  const totalMinMes = ticketsDoMes.reduce((s, t) => s + (minutosPorTicket.get(t.id) ?? 0), 0)
  const totalMinHistorico = ticketsDoCliente.reduce((s, t) => s + (minutosPorTicket.get(t.id) ?? 0), 0)
  const rhMes = cliente ? valorHora(Number(cliente.valor_mensal), totalMinMes) : null

  // Histórico de últimos 6 meses
  const historicoMeses = useMemo(() => {
    const result: { mes: Date; ticketsCount: number; minutos: number; concluidos: number }[] = []
    for (let i = 0; i < 6; i++) {
      const m = subMonths(now, i)
      const ms = startOfMonth(m)
      const me = endOfMonth(m)
      const tks = ticketsDoCliente.filter(t => {
        const d = new Date(t.created_at)
        return d >= ms && d <= me
      })
      const min = tks.reduce((s, t) => s + (minutosPorTicket.get(t.id) ?? 0), 0)
      const con = tks.filter(t => t.status === 'concluido').length
      result.push({ mes: m, ticketsCount: tks.length, minutos: min, concluidos: con })
    }
    return result
  }, [ticketsDoCliente, minutosPorTicket, now])

  if (loading || !cliente) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  const isCancelled = !cliente.ativo || cliente.data_cancelamento != null

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-5xl mx-auto w-full px-4 md:px-6 py-4 md:py-8 space-y-4 md:space-y-6">

        {/* Voltar */}
        <button
          onClick={() => router.push('/admin/clientes')}
          className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
        >
          ← Clientes
        </button>

        {/* HEADER */}
        <div
          className="rounded-2xl p-6 md:p-8 text-white shadow-md"
          style={{
            background: 'radial-gradient(ellipse 70% 100% at 90% 50%, #C5A880 0%, #6B4C28 45%, #1c1a18 80%), #100E0B',
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs font-bold tracking-[0.22em] uppercase text-white/60 mb-1.5">Cliente Fixo</p>
              <h1 className="text-2xl md:text-3xl font-bold capitalize">{cliente.nome}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                {isCancelled ? (
                  <span className="bg-red-500/20 text-red-200 px-2.5 py-1 rounded-full">
                    ⊘ Cancelado {cliente.data_cancelamento ? `em ${format(new Date(cliente.data_cancelamento + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}` : ''}
                  </span>
                ) : (
                  <span className="bg-green-500/20 text-green-200 px-2.5 py-1 rounded-full">● Ativo</span>
                )}
                {cliente.data_inicio && (
                  <span className="text-white/50">desde {format(new Date(cliente.data_inicio + 'T12:00:00'), "MMM yyyy", { locale: ptBR })}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider">Contrato</p>
              <p className="text-2xl md:text-3xl font-bold text-[#C5A880]">{formatBRL(Number(cliente.valor_mensal))}</p>
              <p className="text-xs text-white/40">por mês</p>
            </div>
          </div>

          {/* Stats da operação */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10">
            <StatBlock label="Demandas este mês" value={String(ticketsDoMes.length)} sub={`${ticketsDoCliente.length} histórico`} />
            <StatBlock label="Tempo este mês" value={formatMinutos(totalMinMes)} sub={`${formatMinutos(totalMinHistorico)} histórico`} />
            <StatBlock
              label="R$/h este mês"
              value={rhMes != null ? formatBRL(rhMes) : '—'}
              sub={rhMes != null ? (rhMes >= 300 ? 'Acima da meta' : 'Abaixo da meta') : 'Aponte tempo'}
              accent={rhMes != null ? (rhMes >= 300 ? 'text-green-300' : 'text-amber-300') : undefined}
            />
          </div>
        </div>

        {/* AÇÕES RÁPIDAS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push(`/admin/relatorio/${id}`)}
            className="text-sm font-medium px-4 py-2 rounded-xl text-white hover:opacity-90 transition-opacity flex items-center gap-1.5"
            style={{ background: '#C5A880' }}
          >
            🖨 Gerar relatório do mês
          </button>
          <button
            onClick={() => router.push(`/admin/proposta/nova?cliente_fixo_id=${id}`)}
            className="text-sm font-medium px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            📄 Nova proposta
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams({
                nome: cliente.razao_social || cliente.nome,
                cnpj: cliente.cnpj ?? '',
                valor: String(cliente.valor_mensal),
                referente: `Mensalidade de ${format(new Date(), 'MMMM/yyyy', { locale: ptBR })}`,
              })
              window.open(`/admin/recibo?${params.toString()}`, '_blank')
            }}
            className="text-sm font-medium px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            🧾 Gerar recibo
          </button>
          {isCancelled ? (
            <button
              onClick={reativarCliente}
              className="text-sm font-medium px-4 py-2 rounded-xl border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            >
              ↻ Reativar cliente
            </button>
          ) : (
            <button
              onClick={() => setShowCancel(true)}
              className="text-sm font-medium px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              ⊘ Marcar como cancelado
            </button>
          )}
        </div>

        {/* IDENTIFICAÇÃO */}
        <SectionCard title="Identificação" onEdit={() => setEditingIdent(true)} editing={editingIdent}>
          {editingIdent ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Nome">
                  <input value={identForm.nome} onChange={e => setIdentForm(f => ({ ...f, nome: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </FormField>
                <FormField label="E-mail">
                  <input value={identForm.email} onChange={e => setIdentForm(f => ({ ...f, email: e.target.value }))} type="email" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </FormField>
                <FormField label="Valor mensal (R$)">
                  <input value={identForm.valor_mensal} onChange={e => setIdentForm(f => ({ ...f, valor_mensal: e.target.value }))} inputMode="decimal" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </FormField>
                <FormField label="Dia do vencimento">
                  <input value={identForm.dia_vencimento} onChange={e => setIdentForm(f => ({ ...f, dia_vencimento: e.target.value }))} type="number" min="1" max="31" placeholder="ex: 5" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </FormField>
                <FormField label="Data de início do contrato">
                  <input value={identForm.data_inicio} onChange={e => setIdentForm(f => ({ ...f, data_inicio: e.target.value }))} type="date" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </FormField>
                <FormField label="CNPJ">
                  <input value={identForm.cnpj} onChange={e => setIdentForm(f => ({ ...f, cnpj: formatCNPJ(e.target.value) }))} placeholder="00.000.000/0000-00" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </FormField>
                <FormField label="Razão Social">
                  <input value={identForm.razao_social} onChange={e => setIdentForm(f => ({ ...f, razao_social: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </FormField>
                <FormField label="Telefone">
                  <input value={identForm.telefone} onChange={e => setIdentForm(f => ({ ...f, telefone: formatTelefone(e.target.value) }))} placeholder="(00) 00000-0000" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </FormField>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={salvarIdent} className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: '#C5A880' }}>Salvar</button>
                <button onClick={() => { setEditingIdent(false); if (cliente) setIdentForm({ nome: cliente.nome, email: cliente.email ?? '', valor_mensal: String(cliente.valor_mensal), dia_vencimento: cliente.dia_vencimento ? String(cliente.dia_vencimento) : '', data_inicio: cliente.data_inicio ?? '', cnpj: cliente.cnpj ?? '', razao_social: cliente.razao_social ?? '', telefone: cliente.telefone ?? '' }) }} className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <FieldDisplay label="Nome" value={cliente.nome} />
              <FieldDisplay label="E-mail" value={cliente.email ?? '—'} />
              <FieldDisplay label="Valor mensal" value={formatBRL(Number(cliente.valor_mensal))} />
              <FieldDisplay label="Vencimento" value={cliente.dia_vencimento ? `Todo dia ${cliente.dia_vencimento}` : '—'} />
              <FieldDisplay label="Início do contrato" value={cliente.data_inicio ? format(new Date(cliente.data_inicio + 'T12:00:00'), "d 'de' MMM 'de' yyyy", { locale: ptBR }) : '—'} />
              <FieldDisplay label="Cancelamento" value={cliente.data_cancelamento ? format(new Date(cliente.data_cancelamento + 'T12:00:00'), "d 'de' MMM 'de' yyyy", { locale: ptBR }) : '—'} />
              <FieldDisplay label="CNPJ" value={cliente.cnpj ?? '—'} />
              <FieldDisplay label="Razão Social" value={cliente.razao_social ?? '—'} />
              <FieldDisplay label="Telefone" value={cliente.telefone ?? '—'} />
            </div>
          )}
        </SectionCard>

        {/* ESCOPO + OBSERVAÇÕES */}
        <SectionCard title="Escopo de Trabalho" onEdit={() => setEditingEscopo(true)} editing={editingEscopo}>
          {editingEscopo ? (
            <div className="space-y-3">
              <FormField label="Escopo mensal (aparece no relatório do cliente)">
                <textarea
                  value={escopoForm.escopo_mensal}
                  onChange={e => setEscopoForm(f => ({ ...f, escopo_mensal: e.target.value }))}
                  rows={6}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                  placeholder={'• 2 posts no Instagram por semana\n• 3 diárias gravadas no mês\n• 1 reunião estratégica mensal\n• Consultoria sob demanda'}
                />
              </FormField>
              <FormField label="Observações internas (só você vê)">
                <textarea
                  value={escopoForm.observacoes_internas}
                  onChange={e => setEscopoForm(f => ({ ...f, observacoes_internas: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                  placeholder="Cobrar dia 15, aprovação com Marina..."
                />
              </FormField>
              <div className="flex gap-2 pt-1">
                <button onClick={salvarEscopo} className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: '#C5A880' }}>Salvar</button>
                <button onClick={() => { setEditingEscopo(false); if (cliente) setEscopoForm({ escopo_mensal: cliente.escopo_mensal ?? '', observacoes_internas: cliente.observacoes_internas ?? '' }) }} className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {cliente.escopo_mensal ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Escopo</p>
                  <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{cliente.escopo_mensal}</div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Escopo ainda não definido.</p>
              )}
              {cliente.observacoes_internas && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Observações internas <span className="text-slate-400 normal-case font-normal">(só você vê)</span></p>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{cliente.observacoes_internas}</div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* HISTÓRICO MENSAL */}
        <SectionCard title="Últimos 6 meses">
          <div className="overflow-x-auto -mx-2">
            <div className="flex gap-2 px-2 min-w-max">
              {historicoMeses.map((h, i) => {
                const isCurrent = i === 0
                return (
                  <button
                    key={i}
                    onClick={() => router.push(`/admin/relatorio/${id}?mes=${h.mes.getMonth() + 1}&ano=${h.mes.getFullYear()}`)}
                    className={clsx(
                      'rounded-xl p-3 min-w-[110px] text-left transition-colors',
                      isCurrent ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <p className={clsx('text-[10px] uppercase tracking-wider font-bold mb-1', isCurrent ? 'text-white/50' : 'text-slate-400')}>
                      {format(h.mes, 'MMM yyyy', { locale: ptBR })}
                    </p>
                    <p className={clsx('text-lg font-bold tabular-nums', isCurrent ? 'text-white' : 'text-slate-800')}>
                      {h.ticketsCount}
                    </p>
                    <p className={clsx('text-[10px] mt-0.5', isCurrent ? 'text-white/60' : 'text-slate-500')}>
                      {formatMinutos(h.minutos)} · {h.concluidos} concl.
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </SectionCard>

        {/* DEMANDAS RECENTES */}
        <SectionCard title={`Demandas (${ticketsDoCliente.length})`}>
          {ticketsDoCliente.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">Nenhuma demanda registrada ainda para este cliente.</p>
          ) : (
            <div className="divide-y divide-slate-50 -mx-2">
              {ticketsDoCliente.slice(0, 15).map(t => {
                const min = minutosPorTicket.get(t.id) ?? 0
                return (
                  <div
                    key={t.id}
                    onClick={() => router.push(`/admin/chamado/${t.id}`)}
                    className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-3"
                  >
                    <span className={clsx(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      t.status === 'concluido' ? 'bg-green-500'
                      : t.status === 'em_andamento' ? 'bg-amber-500'
                      : t.status === 'em_revisao' ? 'bg-purple-500'
                      : t.status === 'cancelado' ? 'bg-slate-300'
                      : 'bg-blue-500'
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {format(new Date(t.created_at), "d 'de' MMM yyyy", { locale: ptBR })}
                        {min > 0 && ` · ${formatMinutos(min)}`}
                      </p>
                    </div>
                  </div>
                )
              })}
              {ticketsDoCliente.length > 15 && (
                <p className="text-xs text-slate-400 text-center py-2 px-3">+ {ticketsDoCliente.length - 15} demandas mais antigas</p>
              )}
            </div>
          )}
        </SectionCard>

        {/* PROPOSTAS */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Propostas ({propostas.length})</h2>
            <button
              onClick={() => router.push(`/admin/proposta/nova?cliente_fixo_id=${id}`)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white hover:opacity-90"
              style={{ background: '#C5A880' }}
            >
              + Nova
            </button>
          </div>
          <div className="px-4 md:px-6 py-4 md:py-5">
            {propostas.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">Nenhuma proposta para este cliente ainda.</p>
            ) : (
              <div className="space-y-2">
                {propostas.map(p => (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/admin/proposta/${p.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.titulo}</p>
                        <span className={clsx('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', PROPOSTA_STATUS_COLORS[p.status])}>
                          {PROPOSTA_STATUS_LABELS[p.status]}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {p.modalidade === 'mensal' ? 'Mensal' : 'Pontual'} ·{' '}
                        {format(new Date(p.created_at), "d 'de' MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-800 tabular-nums">
                        {p.valor != null ? formatBRL(p.valor) : '—'}
                      </p>
                      <p className="text-[10px] text-slate-400">{p.modalidade === 'mensal' ? '/mês' : 'total'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MÉTRICAS RECENTES */}
        <SectionCard title={`Métricas registradas (${metricas.length})`}>
          {metricas.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              Nenhuma métrica registrada ainda. Preencha métricas no relatório mensal.
            </p>
          ) : (
            <div className="space-y-2">
              {metricas.slice(0, 6).map(met => (
                <button
                  key={met.id}
                  onClick={() => router.push(`/admin/relatorio/${id}?mes=${met.mes}&ano=${met.ano}`)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-800 capitalize">
                      {format(new Date(met.ano, met.mes - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {met.seguidores != null && `${met.seguidores.toLocaleString('pt-BR')} seguidores`}
                      {met.engajamento_percent != null && ` · ${met.engajamento_percent}% engajamento`}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">Ver relatório →</span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Zona de perigo */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={deleteCliente}
            className="text-xs text-slate-300 hover:text-red-500 transition-colors"
          >
            Excluir cliente permanentemente
          </button>
        </div>
      </div>

      {/* Modal cancelamento */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-800 mb-2">Cancelar cliente</h2>
            <p className="text-xs text-slate-500 mb-4">
              Qual o <strong>último dia</strong> que esse cliente foi seu fixo? Os dados históricos antes dessa data continuam preservados no sistema (no relatório anual, ele vai aparecer pelos meses em que foi ativo).
            </p>
            <FormField label="Data de cancelamento">
              <input
                type="date"
                value={cancelDate}
                onChange={e => setCancelDate(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
              />
            </FormField>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCancel(false)} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">Cancelar</button>
              <button onClick={confirmarCancelamento} className="flex-1 text-sm py-2 rounded-lg text-white" style={{ background: '#C5A880' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ Sub componentes ============

function StatBlock({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1.5">{label}</p>
      <p className={clsx('text-xl md:text-2xl font-bold tabular-nums', accent ?? 'text-white')}>{value}</p>
      {sub && <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionCard({ title, onEdit, editing, children }: { title: string; onEdit?: () => void; editing?: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {onEdit && !editing && (
          <button onClick={onEdit} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
            ✎ Editar
          </button>
        )}
      </div>
      <div className="px-4 md:px-6 py-4 md:py-5">
        {children}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  )
}
