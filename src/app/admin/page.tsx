'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { startOfMonth, startOfDay, subDays, format, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import type { Ticket } from '@/types'
import { AdminNav } from '@/components/AdminNav'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface ClienteFixo {
  id: string
  nome: string
  email: string | null
  valor_mensal: number
  dia_vencimento: number | null
  ativo: boolean
}

interface Pagamento {
  id: string
  cliente_id: string
  mes: number
  ano: number
  valor: number
  recebido: boolean
  recebido_em: string | null
  cliente: ClienteFixo
}

interface Lead {
  id: string
  nome: string
  status: string
  created_at: string
  convertido_em: string | null
}

interface Meta {
  mes: number
  ano: number
  meta_fixo: number
  meta_avulso: number
}

export default function GestaoPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientes, setClientes] = useState<ClienteFixo[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [meta, setMeta] = useState<Meta>({ mes: 0, ano: 0, meta_fixo: 0, meta_avulso: 0 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', valor_mensal: '', dia_vencimento: '' })
  const [saving, setSaving] = useState(false)
  const [editingMeta, setEditingMeta] = useState<'fixo' | 'avulso' | null>(null)
  const [metaInput, setMetaInput] = useState('')
  const router = useRouter()

  const now = new Date()
  const m = now.getMonth() + 1
  const a = now.getFullYear()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    Promise.all([
      api('/api/tickets').then(r => r.json()),
      api('/api/clientes-fixos').then(r => r.json()),
      api(`/api/pagamentos?mes=${m}&ano=${a}`).then(r => r.json()),
      api('/api/leads').then(r => r.json()),
      api(`/api/metas?mes=${m}&ano=${a}`).then(r => r.json()),
    ]).then(([t, c, p, l, met]) => {
      setTickets(t)
      setClientes(c)
      setPagamentos(p)
      setLeads(l)
      setMeta(met)
      setLoading(false)
    })
  }, [router, m, a])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function addCliente() {
    if (!form.nome || !form.valor_mensal) return
    setSaving(true)
    const res = await api('/api/clientes-fixos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.nome,
        email: form.email || null,
        valor_mensal: Number(form.valor_mensal),
        dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
        ativo: true,
      }),
    })
    const novo = await res.json()
    setClientes(prev => [...prev, novo])
    setForm({ nome: '', email: '', valor_mensal: '', dia_vencimento: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function toggleAtivo(c: ClienteFixo) {
    setClientes(prev => prev.map(x => x.id === c.id ? { ...x, ativo: !c.ativo } : x))
    await api(`/api/clientes-fixos/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !c.ativo }),
    })
  }

  async function deleteCliente(id: string) {
    if (!confirm('Remover este cliente fixo?')) return
    setClientes(prev => prev.filter(c => c.id !== id))
    await api(`/api/clientes-fixos/${id}`, { method: 'DELETE' })
  }

  async function saveMeta(tipo: 'fixo' | 'avulso') {
    const valor = parseFloat(metaInput.replace(',', '.')) || 0
    const updated = { ...meta, mes: m, ano: a, [`meta_${tipo}`]: valor }
    setMeta(updated)
    setEditingMeta(null)
    setMetaInput('')
    await api('/api/metas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  // ============ Cálculos ============
  const today = startOfDay(now)
  const monthStart = startOfMonth(now)
  const sevenDaysAgo = subDays(now, 7)

  const clientesAtivos = useMemo(() => clientes.filter(c => c.ativo), [clientes])
  const mrr = clientesAtivos.reduce((s, c) => s + Number(c.valor_mensal), 0)

  // Recebido fixo este mês
  const recebidoFixo = pagamentos
    .filter(p => p.recebido)
    .reduce((s, p) => s + Number(p.valor), 0)

  // Avulsos este mês
  const avulsosMes = tickets.filter(t => {
    if (t.is_fixed_client || !t.budget_value || t.status === 'cancelado') return false
    return new Date(t.created_at) >= monthStart
  })
  const recebidoAvulso = avulsosMes.filter(t => t.pagamento_recebido).reduce((s, t) => s + (t.budget_value ?? 0), 0)
  const esperadoAvulso = avulsosMes.reduce((s, t) => s + (t.budget_value ?? 0), 0)

  const receitaTotal = recebidoFixo + recebidoAvulso

  // ============ Painel Hoje ============
  const chamadosPrazoHoje = tickets.filter(t => {
    if (!t.deadline || ['concluido', 'cancelado'].includes(t.status)) return false
    const d = startOfDay(new Date(t.deadline))
    return d.getTime() === today.getTime()
  })

  const chamadosAtrasados = tickets.filter(t => {
    if (!t.deadline || ['concluido', 'cancelado'].includes(t.status)) return false
    return isBefore(new Date(t.deadline), today)
  })

  const novosSemAcao = tickets.filter(t => t.status === 'novo')

  const leadsParados = leads.filter(l => {
    if (l.convertido_em || l.status === 'perdido' || l.status === 'fechado') return false
    return isBefore(new Date(l.created_at), sevenDaysAgo)
  })

  const pagamentosPendentes = clientesAtivos.length - pagamentos.filter(p => p.recebido).length
  const avulsosPendentes = avulsosMes.filter(t => !t.pagamento_recebido).length

  // ============ Top Clientes (este mês) ============
  const topClientes = useMemo(() => {
    const map = new Map<string, number>()

    // Fixos recebidos
    pagamentos.forEach(p => {
      if (p.recebido && p.cliente) {
        const key = p.cliente.nome
        map.set(key, (map.get(key) ?? 0) + Number(p.valor))
      }
    })

    // Avulsos recebidos
    avulsosMes.forEach(t => {
      if (t.pagamento_recebido && t.budget_value) {
        const key = t.client_name
        map.set(key, (map.get(key) ?? 0) + t.budget_value)
      }
    })

    return Array.from(map.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [pagamentos, avulsosMes])

  const maxTop = topClientes[0]?.total ?? 1

  // ============ Metas ============
  const pctFixo = meta.meta_fixo > 0 ? Math.min(100, (recebidoFixo / Number(meta.meta_fixo)) * 100) : 0
  const pctAvulso = meta.meta_avulso > 0 ? Math.min(100, (recebidoAvulso / Number(meta.meta_avulso)) * 100) : 0

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Carregando...</div>
    </div>
  )

  const todayActions = chamadosPrazoHoje.length + chamadosAtrasados.length + novosSemAcao.length + leadsParados.length + pagamentosPendentes + avulsosPendentes

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto w-full px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6">

        {/* Header com saudação */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Gestão</p>
            <h1 className="text-lg md:text-2xl font-bold text-slate-900 mt-0.5 md:mt-1">
              {format(now, "EEEE',' d 'de' MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] md:text-xs text-slate-400">Receita do mês</p>
            <p className="text-lg md:text-2xl font-bold text-green-600">{formatBRL(receitaTotal)}</p>
          </div>
        </div>

        {/* PAINEL HOJE */}
        <div
          className="rounded-2xl p-4 md:p-6 shadow-md text-white"
          style={{
            background: 'radial-gradient(ellipse 80% 150% at 95% 50%, #C5A880 0%, #6B4C28 40%, #1c1a18 80%), #100E0B',
          }}
        >
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div>
              <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-white/60">Painel Hoje</p>
              <p className="text-xs md:text-sm text-white/80 mt-0.5">
                {todayActions === 0 ? 'Tudo em dia ✨' : `${todayActions} ações pra você olhar`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            <PainelItem
              label="Atrasados"
              value={chamadosAtrasados.length}
              urgent
              onClick={() => router.push('/admin/demandas')}
            />
            <PainelItem
              label="Prazo hoje"
              value={chamadosPrazoHoje.length}
              onClick={() => router.push('/admin/demandas')}
            />
            <PainelItem
              label="Novos"
              value={novosSemAcao.length}
              onClick={() => router.push('/admin/demandas')}
            />
            <PainelItem
              label="Pagamentos fixos"
              value={pagamentosPendentes}
              sub="pendentes"
              onClick={() => router.push('/admin/financeiro')}
            />
            <PainelItem
              label="Avulsos a receber"
              value={avulsosPendentes}
              onClick={() => router.push('/admin/financeiro')}
            />
            <PainelItem
              label="Leads parados"
              value={leadsParados.length}
              sub="+7 dias"
              onClick={() => router.push('/admin/comercial')}
            />
          </div>
        </div>

        {/* METAS DO MÊS */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4 md:mb-5">
            <div>
              <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Metas de {format(now, 'MMMM', { locale: ptBR })}</p>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">Acompanhe seu progresso por modalidade</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Meta Fixo */}
            <MetaCard
              tipo="fixo"
              label="Clientes Fixos"
              recebido={recebidoFixo}
              meta={Number(meta.meta_fixo)}
              pct={pctFixo}
              color="#C5A880"
              editing={editingMeta === 'fixo'}
              metaInput={metaInput}
              setMetaInput={setMetaInput}
              onStartEdit={() => { setEditingMeta('fixo'); setMetaInput(String(meta.meta_fixo || '')) }}
              onCancel={() => setEditingMeta(null)}
              onSave={() => saveMeta('fixo')}
            />

            {/* Meta Avulso */}
            <MetaCard
              tipo="avulso"
              label="Clientes Variáveis"
              recebido={recebidoAvulso}
              meta={Number(meta.meta_avulso)}
              pct={pctAvulso}
              color="#22c55e"
              editing={editingMeta === 'avulso'}
              metaInput={metaInput}
              setMetaInput={setMetaInput}
              onStartEdit={() => { setEditingMeta('avulso'); setMetaInput(String(meta.meta_avulso || '')) }}
              onCancel={() => setEditingMeta(null)}
              onSave={() => saveMeta('avulso')}
              sub={`Esperado ${formatBRL(esperadoAvulso)}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

          {/* TOP CLIENTES */}
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
            <div className="mb-4 md:mb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Clientes</p>
              <p className="text-sm text-slate-500 mt-0.5">Quem mais pagou em {format(now, 'MMMM', { locale: ptBR })}</p>
            </div>

            {topClientes.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Nenhum pagamento confirmado ainda este mês.</p>
            ) : (
              <div className="space-y-4">
                {topClientes.map((c, i) => (
                  <div key={c.nome}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-5">{i + 1}º</span>
                        <span className="text-sm font-medium text-slate-800">{c.nome}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{formatBRL(c.total)}</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden ml-7">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(c.total / maxTop) * 100}%`, background: '#C5A880' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CLIENTES FIXOS */}
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4 md:mb-5">
              <div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Clientes Fixos</p>
                <p className="text-lg md:text-2xl font-bold text-amber-600 mt-0.5">{formatBRL(mrr)}<span className="text-xs md:text-sm font-normal text-slate-400">/mês</span></p>
              </div>
              <button
                onClick={() => setShowForm(v => !v)}
                className="text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity"
                style={{ background: '#C5A880' }}
              >
                + Adicionar
              </button>
            </div>

            {showForm && (
              <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
                <input
                  placeholder="Nome do cliente"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                />
                <input
                  placeholder="E-mail (opcional)"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                />
                <div className="flex gap-2">
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#C5A880] flex-1">
                    <span className="px-3 text-sm text-slate-400 bg-slate-100 border-r border-slate-200 py-2">R$</span>
                    <input
                      type="number"
                      placeholder="Valor mensal"
                      value={form.valor_mensal}
                      onChange={e => setForm(f => ({ ...f, valor_mensal: e.target.value }))}
                      className="flex-1 text-sm px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#C5A880] w-24">
                    <span className="px-2 text-xs text-slate-400 bg-slate-100 border-r border-slate-200 py-2">Dia</span>
                    <input
                      type="number"
                      min="1" max="31"
                      placeholder="—"
                      value={form.dia_vencimento}
                      onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))}
                      className="w-full text-sm px-2 py-2 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={addCliente} disabled={saving} className="flex-1 text-white text-sm py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity" style={{ background: '#C5A880' }}>
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 px-4 py-2 hover:text-slate-700">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {clientes.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum cliente fixo cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {clientes.map(c => (
                  <div key={c.id} className={clsx('flex items-center justify-between rounded-xl px-3 py-2.5', c.ativo ? 'bg-amber-50' : 'bg-slate-50')}>
                    <div>
                      <p className={clsx('text-sm font-medium', c.ativo ? 'text-slate-800' : 'text-slate-400 line-through')}>{c.nome}</p>
                      <p className={clsx('text-xs', c.ativo ? 'text-amber-600 font-semibold' : 'text-slate-400')}>
                        {formatBRL(Number(c.valor_mensal))}/mês
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/admin/relatorio/${c.id}`)}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                        title="Ver relatório do cliente"
                      >
                        📄 Relatório
                      </button>
                      <button
                        onClick={() => toggleAtivo(c)}
                        className={clsx('text-xs px-2.5 py-1 rounded-lg font-medium transition-colors', c.ativo ? 'bg-amber-200 text-amber-800 hover:bg-amber-300' : 'bg-slate-200 text-slate-600 hover:bg-slate-300')}
                      >
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                      <button onClick={() => deleteCliente(c.id)} className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PainelItem({ label, value, sub, urgent, onClick }: { label: string; value: number; sub?: string; urgent?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-xl p-2.5 md:p-3 text-left transition-all hover:scale-[1.02] active:scale-95',
        'bg-white/10 backdrop-blur-sm hover:bg-white/15 border border-white/10 min-w-0'
      )}
    >
      <p className={clsx('text-xl md:text-2xl font-bold leading-none tabular-nums', urgent && value > 0 ? 'text-red-300' : 'text-white')}>{value}</p>
      <p className="text-[10px] md:text-xs text-white/70 mt-1 md:mt-1.5 leading-tight">{label}</p>
      {sub && <p className="text-[9px] md:text-[10px] text-white/50 mt-0.5 leading-tight">{sub}</p>}
    </button>
  )
}

function MetaCard({
  label, recebido, meta, pct, color, editing, metaInput, setMetaInput, onStartEdit, onCancel, onSave, sub,
}: {
  tipo: 'fixo' | 'avulso'
  label: string
  recebido: number
  meta: number
  pct: number
  color: string
  editing: boolean
  metaInput: string
  setMetaInput: (s: string) => void
  onStartEdit: () => void
  onCancel: () => void
  onSave: () => void
  sub?: string
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {!editing && (
          <button
            onClick={onStartEdit}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {meta > 0 ? 'editar meta' : 'definir meta'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#C5A880] flex-1 bg-white">
            <span className="px-3 text-sm text-slate-400 bg-slate-100 border-r border-slate-200 py-2">R$</span>
            <input
              autoFocus
              type="number"
              value={metaInput}
              onChange={e => setMetaInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
              className="flex-1 text-sm px-3 py-2 focus:outline-none"
              placeholder="Meta para o mês"
            />
          </div>
          <button onClick={onSave} className="text-xs px-3 py-2 rounded-lg text-white" style={{ background: color }}>OK</button>
          <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 px-2">×</button>
        </div>
      ) : (
        <div className="mb-3">
          <p className="text-2xl font-bold" style={{ color }}>{formatBRL(recebido)}</p>
          {meta > 0 ? (
            <p className="text-xs text-slate-400 mt-0.5">de {formatBRL(meta)} ({pct.toFixed(0)}%)</p>
          ) : (
            <p className="text-xs text-slate-300 mt-0.5">Defina uma meta para ver progresso</p>
          )}
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      )}

      {meta > 0 && (
        <div className="bg-white rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      )}
    </div>
  )
}
