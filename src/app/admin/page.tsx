'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import type { Ticket, RequestType } from '@/types'
import { REQUEST_TYPE_LABELS } from '@/types'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
          <button
            onClick={() => router.push('/admin')}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              pathname === '/admin' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            Gestão
          </button>
          <button
            onClick={() => router.push('/admin/demandas')}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              pathname === '/admin/demandas' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            Demandas
          </button>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/chat')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          Ver portal →
        </button>
        <button onClick={onLogout} className="text-sm text-slate-500 hover:text-slate-700">
          Sair
        </button>
      </div>
    </header>
  )
}

function StatCard({
  label, value, sub, accent, icon,
}: {
  label: string; value: string; sub?: string; accent?: string; icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
          {icon}
        </div>
      </div>
      <p className={clsx('text-3xl font-bold mb-1', accent ?? 'text-slate-900')}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function GestaoPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    fetch('/api/tickets').then(r => r.json()).then(data => {
      setTickets(data)
      setLoading(false)
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })

  const concluidos = tickets.filter(t => t.status === 'concluido')

  const receitaMes = concluidos
    .filter(t => !t.is_fixed_client && t.budget_value != null && new Date(t.updated_at ?? t.created_at) >= monthStart)
    .reduce((s, t) => s + (t.budget_value ?? 0), 0)

  const receitaMesAnterior = concluidos
    .filter(t => !t.is_fixed_client && t.budget_value != null && new Date(t.updated_at ?? t.created_at) >= lastMonthStart && new Date(t.updated_at ?? t.created_at) < monthStart)
    .reduce((s, t) => s + (t.budget_value ?? 0), 0)

  const demandasAtivas = tickets.filter(t => ['novo', 'em_andamento', 'em_revisao'].includes(t.status)).length
  const novosSemana = tickets.filter(t => new Date(t.created_at) >= weekStart).length
  const clientesFixos = [...new Set(tickets.filter(t => t.is_fixed_client).map(t => t.client_email))].length

  const receitaAberta = tickets
    .filter(t => t.status !== 'concluido' && t.status !== 'cancelado' && !t.is_fixed_client && t.budget_value != null)
    .reduce((s, t) => s + (t.budget_value ?? 0), 0)

  const byType = Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => ({
    label,
    key: key as RequestType,
    total: tickets.filter(t => t.request_type === key).length,
    concluidos: tickets.filter(t => t.request_type === key && t.status === 'concluido').length,
  })).filter(t => t.total > 0).sort((a, b) => b.total - a.total)

  const recenteConcluidos = concluidos
    .filter(t => t.budget_value != null && !t.is_fixed_client)
    .sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime())
    .slice(0, 5)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Cards principais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Receita do Mês"
            value={formatBRL(receitaMes)}
            sub={receitaMesAnterior > 0 ? `Mês anterior: ${formatBRL(receitaMesAnterior)}` : 'Chamados concluídos este mês'}
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

          {/* Receita em aberto + clientes fixos */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Receita em Aberto</p>
              <p className="text-2xl font-bold text-slate-900">{formatBRL(receitaAberta)}</p>
              <p className="text-xs text-slate-400 mt-1">Demandas ativas com orçamento definido</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Clientes Fixos</p>
              <p className="text-2xl font-bold text-amber-600">{clientesFixos}</p>
              <p className="text-xs text-slate-400 mt-1">clientes com demandas em pacote</p>
            </div>
          </div>

          {/* Últimos concluídos com valor */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Últimos Concluídos</p>
            {recenteConcluidos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum chamado concluído com valor ainda.</p>
            ) : (
              <div className="space-y-3">
                {recenteConcluidos.map(t => (
                  <div
                    key={t.id}
                    onClick={() => router.push(`/admin/chamado/${t.id}`)}
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-xl px-2 py-1.5 -mx-2 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">{t.title}</p>
                      <p className="text-xs text-slate-400">{t.client_name}</p>
                    </div>
                    <span className="text-sm font-semibold text-green-600 flex-shrink-0 ml-3">
                      {formatBRL(t.budget_value!)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Demandas por tipo */}
        {byType.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Demandas por Tipo</p>
            <div className="space-y-3">
              {byType.map(({ label, total, concluidos: done }) => (
                <div key={label} className="flex items-center gap-3">
                  <p className="text-sm text-slate-700 w-28 flex-shrink-0">{label}</p>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.round((done / total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 w-20 text-right flex-shrink-0">{done}/{total} concluídos</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
