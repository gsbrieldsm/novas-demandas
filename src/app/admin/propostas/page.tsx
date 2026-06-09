'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'
import type { Proposta, PropostaStatus } from '@/types'
import { PROPOSTA_STATUS_LABELS } from '@/types'

function formatBRL(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_COLORS: Record<PropostaStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-100 text-blue-700',
  aceita: 'bg-green-100 text-green-700',
  recusada: 'bg-red-100 text-red-700',
  expirada: 'bg-amber-100 text-amber-700',
}

const STATUS_DOTS: Record<PropostaStatus, string> = {
  rascunho: 'bg-slate-400',
  enviada: 'bg-blue-500',
  aceita: 'bg-green-500',
  recusada: 'bg-red-500',
  expirada: 'bg-amber-500',
}

export default function PropostasIndexPage() {
  const router = useRouter()
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<PropostaStatus | 'todas'>('todas')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    api('/api/propostas').then(r => r.json()).then(data => {
      setPropostas(data)
      setLoading(false)
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const filtered = useMemo(() => {
    if (filterStatus === 'todas') return propostas
    return propostas.filter(p => p.status === filterStatus)
  }, [propostas, filterStatus])

  const stats = useMemo(() => {
    return {
      total: propostas.length,
      ativas: propostas.filter(p => p.status === 'rascunho' || p.status === 'enviada').length,
      aceitas: propostas.filter(p => p.status === 'aceita').length,
      valorPipeline: propostas
        .filter(p => p.status === 'enviada' && p.valor)
        .reduce((s, p) => s + Number(p.valor), 0),
    }
  }, [propostas])

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav onLogout={handleLogout} extra={
        <button
          onClick={() => router.push('/admin/proposta/nova')}
          className="text-sm font-medium px-3 py-1.5 rounded-lg text-white hover:opacity-90"
          style={{ background: '#C5A880' }}
        >
          + Nova Proposta
        </button>
      } />

      <div className="max-w-5xl mx-auto w-full px-4 md:px-6 py-4 md:py-8 space-y-4 md:space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Propostas</p>
            <h1 className="text-lg md:text-2xl font-bold text-slate-900 mt-0.5">{filtered.length} propostas</h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] md:text-xs text-slate-400">Em negociação</p>
            <p className="text-lg md:text-2xl font-bold text-amber-600">{formatBRL(stats.valorPipeline)}</p>
          </div>
        </div>

        {/* Filtro por status */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('todas')}
            className={clsx('text-xs px-3 py-1.5 rounded-lg font-medium', filterStatus === 'todas' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600')}
          >
            Todas ({propostas.length})
          </button>
          {(['rascunho', 'enviada', 'aceita', 'recusada', 'expirada'] as PropostaStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={clsx('text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5', filterStatus === s ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600')}
            >
              <span className={clsx('w-1.5 h-1.5 rounded-full', STATUS_DOTS[s])} />
              {PROPOSTA_STATUS_LABELS[s]} ({propostas.filter(p => p.status === s).length})
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="px-6 py-12 text-center text-slate-400 text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-400">Nenhuma proposta {filterStatus !== 'todas' ? `${PROPOSTA_STATUS_LABELS[filterStatus].toLowerCase()}` : ''}.</p>
              <button
                onClick={() => router.push('/admin/proposta/nova')}
                className="text-xs mt-3 px-3 py-1.5 rounded-lg text-white"
                style={{ background: '#C5A880' }}
              >
                + Criar primeira proposta
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/admin/proposta/${p.id}`)}
                  className="w-full text-left px-4 md:px-6 py-3 md:py-4 hover:bg-slate-50 transition-colors flex items-center gap-3 md:gap-4"
                >
                  <span className={clsx('w-1 self-stretch rounded-full flex-shrink-0', STATUS_DOTS[p.status])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.titulo}</p>
                      <span className={clsx('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', STATUS_COLORS[p.status])}>
                        {PROPOSTA_STATUS_LABELS[p.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                      <span>{p.cliente_nome}{p.cliente_empresa ? ` · ${p.cliente_empresa}` : ''}</span>
                      <span className="text-slate-300">·</span>
                      <span className="capitalize">{p.modalidade}</span>
                      <span className="text-slate-300">·</span>
                      <span>{format(new Date(p.created_at), "d 'de' MMM yyyy", { locale: ptBR })}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{formatBRL(p.valor)}</p>
                    <p className="text-[10px] text-slate-400">{p.modalidade === 'mensal' ? '/mês' : 'total'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resumo de estatísticas */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
          <div className="bg-white rounded-xl border border-slate-100 p-3">
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{stats.total}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">Total geradas</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3">
            <p className="text-2xl font-bold text-amber-600 tabular-nums">{stats.ativas}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">Em andamento</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3">
            <p className="text-2xl font-bold text-green-600 tabular-nums">{stats.aceitas}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">Aceitas</p>
          </div>
        </div>
      </div>
    </div>
  )
}
