'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'
import type { Ticket } from '@/types'

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

export default function FinanceiroPage() {
  const [mes, setMes] = useState(new Date())
  const [clientes, setClientes] = useState<ClienteFixo[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
  }, [router])

  useEffect(() => {
    setLoading(true)
    const m = mes.getMonth() + 1
    const a = mes.getFullYear()

    Promise.all([
      fetch('/api/clientes-fixos').then(r => r.json()),
      fetch(`/api/pagamentos?mes=${m}&ano=${a}`).then(r => r.json()),
      fetch('/api/tickets').then(r => r.json()),
    ]).then(([c, p, t]) => {
      setClientes(c)
      setPagamentos(p)
      setTickets(t)
      setLoading(false)
    })
  }, [mes])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function toggleAvulso(ticket: Ticket) {
    const novo = !ticket.pagamento_recebido
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, pagamento_recebido: novo } : t))
    await fetch(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagamento_recebido: novo }),
    })
  }

  async function togglePagamento(cliente: ClienteFixo, pag: Pagamento | undefined) {
    const m = mes.getMonth() + 1
    const a = mes.getFullYear()

    if (!pag) {
      // Criar e marcar como recebido
      const res = await fetch('/api/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: cliente.id, mes: m, ano: a, valor: cliente.valor_mensal, recebido: true }),
      })
      const novo = await res.json()
      setPagamentos(prev => [...prev, novo])
    } else {
      // Toggle recebido
      const res = await fetch(`/api/pagamentos/${pag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recebido: !pag.recebido }),
      })
      const updated = await res.json()
      setPagamentos(prev => prev.map(p => p.id === pag.id ? updated : p))
    }
  }

  const m = mes.getMonth() + 1
  const a = mes.getFullYear()

  const clientesAtivos = clientes.filter(c => c.ativo)

  const rows = clientesAtivos.map(c => ({
    cliente: c,
    pag: pagamentos.find(p => p.cliente_id === c.id),
  }))

  const totalEsperado = clientesAtivos.reduce((s, c) => s + c.valor_mensal, 0)
  const totalRecebido = rows.filter(r => r.pag?.recebido).reduce((s, r) => s + r.cliente.valor_mensal, 0)
  const totalPendente = totalEsperado - totalRecebido

  // Avulsos concluídos neste mês sem pagamento registrado (sem budget é ignorado)
  const avulsosMes = tickets.filter(t => {
    if (t.status !== 'concluido' || t.is_fixed_client || !t.budget_value) return false
    const d = new Date(t.created_at)
    return d.getMonth() + 1 === m && d.getFullYear() === a
  })

  const totalAvulso = avulsosMes.reduce((s, t) => s + (t.budget_value ?? 0), 0)
  const totalAvulsoRecebido = avulsosMes.filter(t => t.pagamento_recebido).reduce((s, t) => s + (t.budget_value ?? 0), 0)
  const totalAvulsoPendente = totalAvulso - totalAvulsoRecebido

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Seletor de mês */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">
            {format(mes, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setMes(m => subMonths(m, 1))} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors">‹</button>
            <button onClick={() => setMes(new Date())} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-colors">Hoje</button>
            <button onClick={() => setMes(m => addMonths(m, 1))} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors">›</button>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Esperado</p>
            <p className="text-2xl font-bold text-slate-900">{formatBRL(totalEsperado + totalAvulso)}</p>
            <p className="text-xs text-slate-400 mt-1">Fixo {formatBRL(totalEsperado)} + Avulso {formatBRL(totalAvulso)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Recebido</p>
            <p className="text-2xl font-bold text-green-600">{formatBRL(totalRecebido + totalAvulsoRecebido)}</p>
            <p className="text-xs text-slate-400 mt-1">Fixo {formatBRL(totalRecebido)} + Avulso {formatBRL(totalAvulsoRecebido)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Pendente</p>
            <p className={clsx('text-2xl font-bold', (totalPendente + totalAvulsoPendente) > 0 ? 'text-red-500' : 'text-slate-400')}>{formatBRL(totalPendente + totalAvulsoPendente)}</p>
            <p className="text-xs text-slate-400 mt-1">Fixo {formatBRL(totalPendente)} + Avulso {formatBRL(totalAvulsoPendente)}</p>
          </div>
        </div>

        {/* Tabela de clientes fixos */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Recebimentos Fixos</h2>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Carregando...</div>
          ) : clientesAtivos.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum cliente fixo ativo. Cadastre em Gestão.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Vencimento</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(({ cliente, pag }) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-800">{cliente.nome}</p>
                      {cliente.email && <p className="text-xs text-slate-400">{cliente.email}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-slate-800">{formatBRL(cliente.valor_mensal)}</span>
                    </td>
                    <td className="px-6 py-4">
                      {cliente.dia_vencimento ? (
                        <span className="text-sm text-slate-600">Dia {cliente.dia_vencimento}</span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {pag?.recebido ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                            ✓ Recebido
                          </span>
                          {pag.recebido_em && (
                            <p className="text-xs text-slate-400 mt-1">
                              {format(new Date(pag.recebido_em), "d 'de' MMM", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-500 px-2.5 py-1 rounded-full">
                          ⏳ Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => togglePagamento(cliente, pag)}
                        className={clsx(
                          'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                          pag?.recebido
                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        )}
                      >
                        {pag?.recebido ? 'Desfazer' : 'Marcar recebido'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Avulsos do mês */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Avulsos com Orçamento</h2>
            <span className="text-sm font-bold text-slate-700">{formatBRL(totalAvulso)}</span>
          </div>
          {avulsosMes.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum avulso com orçamento este mês.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Chamado</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {avulsosMes.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/admin/chamado/${t.id}`)}>
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">{t.title}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">{t.client_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-slate-800">{formatBRL(t.budget_value!)}</span>
                    </td>
                    <td className="px-6 py-4">
                      {t.pagamento_recebido ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                          ✓ Recebido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-500 px-2.5 py-1 rounded-full">
                          ⏳ Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleAvulso(t)}
                        className={clsx(
                          'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                          t.pagamento_recebido
                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        )}
                      >
                        {t.pagamento_recebido ? 'Desfazer' : 'Marcar recebido'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  )
}
