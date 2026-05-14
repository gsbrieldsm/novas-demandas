'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { startOfMonth, startOfWeek, subMonths } from 'date-fns'
import clsx from 'clsx'
import type { Ticket, RequestType } from '@/types'
import { REQUEST_TYPE_LABELS } from '@/types'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface ClienteFixo {
  id: string
  nome: string
  email: string | null
  valor_mensal: number
  ativo: boolean
}

function AdminNav({ onLogout }: { onLogout: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="font-bold text-slate-900">GM&Co</span>
        </div>
        <nav className="flex items-center gap-1">
          <button onClick={() => router.push('/admin')} className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', pathname === '/admin' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800')}>Gestão</button>
          <button onClick={() => router.push('/admin/demandas')} className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', pathname === '/admin/demandas' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800')}>Demandas</button>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/chat')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Ver portal →</button>
        <button onClick={onLogout} className="text-sm text-slate-500 hover:text-slate-700">Sair</button>
      </div>
    </header>
  )
}

function StatCard({ label, value, sub, accent, icon }: { label: string; value: string; sub?: string; accent?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">{icon}</div>
      </div>
      <p className={clsx('text-3xl font-bold mb-1', accent ?? 'text-slate-900')}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function GestaoPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientes, setClientes] = useState<ClienteFixo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', valor_mensal: '' })
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    Promise.all([
      fetch('/api/tickets').then(r => r.json()),
      fetch('/api/clientes-fixos').then(r => r.json()),
    ]).then(([t, c]) => {
      setTickets(t)
      setClientes(c)
      setLoading(false)
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function addCliente() {
    if (!form.nome || !form.valor_mensal) return
    setSaving(true)
    const res = await fetch('/api/clientes-fixos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: form.nome, email: form.email || null, valor_mensal: Number(form.valor_mensal), ativo: true }),
    })
    const novo = await res.json()
    setClientes(prev => [...prev, novo])
    setForm({ nome: '', email: '', valor_mensal: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function toggleAtivo(c: ClienteFixo) {
    const updated = { ...c, ativo: !c.ativo }
    setClientes(prev => prev.map(x => x.id === c.id ? updated : x))
    await fetch(`/api/clientes-fixos/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !c.ativo }),
    })
  }

  async function deleteCliente(id: string) {
    if (!confirm('Remover este cliente fixo?')) return
    setClientes(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/clientes-fixos/${id}`, { method: 'DELETE' })
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })

  const mrr = clientes.filter(c => c.ativo).reduce((s, c) => s + c.valor_mensal, 0)

  const receitaAvulsa = tickets
    .filter(t => t.status === 'concluido' && !t.is_fixed_client && t.budget_value != null && new Date(t.created_at) >= monthStart)
    .reduce((s, t) => s + (t.budget_value ?? 0), 0)

  const receitaAvulsaMesAnterior = tickets
    .filter(t => t.status === 'concluido' && !t.is_fixed_client && t.budget_value != null && new Date(t.created_at) >= lastMonthStart && new Date(t.created_at) < monthStart)
    .reduce((s, t) => s + (t.budget_value ?? 0), 0)

  const receitaTotalMes = mrr + receitaAvulsa
  const demandasAtivas = tickets.filter(t => ['novo', 'em_andamento', 'em_revisao'].includes(t.status)).length
  const novosSemana = tickets.filter(t => new Date(t.created_at) >= weekStart).length

  const receitaAberta = tickets
    .filter(t => t.status !== 'concluido' && t.status !== 'cancelado' && !t.is_fixed_client && t.budget_value != null)
    .reduce((s, t) => s + (t.budget_value ?? 0), 0)

  const byType = Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => ({
    label, key: key as RequestType,
    total: tickets.filter(t => t.request_type === key).length,
    concluidos: tickets.filter(t => t.request_type === key && t.status === 'concluido').length,
  })).filter(t => t.total > 0).sort((a, b) => b.total - a.total)

  const recenteConcluidos = tickets
    .filter(t => t.status === 'concluido' && t.budget_value != null && !t.is_fixed_client)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Carregando...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Cards principais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Receita Total do Mês"
            value={formatBRL(receitaTotalMes)}
            sub={`MRR ${formatBRL(mrr)} + Avulso ${formatBRL(receitaAvulsa)}`}
            accent="text-green-600"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="Demandas Ativas"
            value={String(demandasAtivas)}
            sub="em aberto no momento"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          />
          <StatCard
            label="Novos Chamados"
            value={String(novosSemana)}
            sub="esta semana"
            accent={novosSemana > 0 ? 'text-blue-600' : undefined}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Clientes Fixos */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clientes Fixos</p>
                <p className="text-2xl font-bold text-amber-600 mt-0.5">{formatBRL(mrr)}<span className="text-sm font-normal text-slate-400">/mês</span></p>
              </div>
              <button
                onClick={() => setShowForm(v => !v)}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
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
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="E-mail (opcional)"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                  <span className="px-3 text-sm text-slate-400 bg-slate-100 border-r border-slate-200 py-2">R$</span>
                  <input
                    type="number"
                    placeholder="Valor mensal"
                    value={form.valor_mensal}
                    onChange={e => setForm(f => ({ ...f, valor_mensal: e.target.value }))}
                    className="flex-1 text-sm px-3 py-2 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={addCliente} disabled={saving} className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
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
                        {formatBRL(c.valor_mensal)}/mês
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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

          {/* Receita em aberto + últimos concluídos */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Receita Avulsa em Aberto</p>
              <p className="text-2xl font-bold text-slate-900">{formatBRL(receitaAberta)}</p>
              <p className="text-xs text-slate-400 mt-1">Demandas ativas com orçamento definido</p>
              {receitaAvulsaMesAnterior > 0 && (
                <p className="text-xs text-slate-400 mt-1">Mês anterior: {formatBRL(receitaAvulsaMesAnterior)}</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Últimos Concluídos</p>
              {recenteConcluidos.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum chamado concluído com valor ainda.</p>
              ) : (
                <div className="space-y-3">
                  {recenteConcluidos.map(t => (
                    <div key={t.id} onClick={() => router.push(`/admin/chamado/${t.id}`)} className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-xl px-2 py-1.5 -mx-2 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-slate-800 line-clamp-1">{t.title}</p>
                        <p className="text-xs text-slate-400">{t.client_name}</p>
                      </div>
                      <span className="text-sm font-semibold text-green-600 flex-shrink-0 ml-3">{formatBRL(t.budget_value!)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Demandas por tipo */}
        {byType.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Demandas por Tipo</p>
            <div className="space-y-3">
              {byType.map(({ label, total, concluidos }) => (
                <div key={label} className="flex items-center gap-3">
                  <p className="text-sm text-slate-700 w-28 flex-shrink-0">{label}</p>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round((concluidos / total) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 w-20 text-right flex-shrink-0">{concluidos}/{total} concluídos</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
