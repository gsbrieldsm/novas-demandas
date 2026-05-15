'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
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

type DespesaTipo = 'pessoal' | 'corporativa'

interface Despesa {
  id: string
  created_at: string
  tipo: DespesaTipo
  descricao: string
  valor: number
  mes: number
  ano: number
}

export default function FinanceiroPage() {
  const [mes, setMes] = useState(new Date())
  const [clientes, setClientes] = useState<ClienteFixo[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [showDespForm, setShowDespForm] = useState(false)
  const [despForm, setDespForm] = useState<{ tipo: DespesaTipo; descricao: string; valor: string }>({ tipo: 'corporativa', descricao: '', valor: '' })
  const [savingDesp, setSavingDesp] = useState(false)
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
      api('/api/clientes-fixos').then(r => r.json()),
      api(`/api/pagamentos?mes=${m}&ano=${a}`).then(r => r.json()),
      api('/api/tickets').then(r => r.json()),
      api(`/api/despesas?mes=${m}&ano=${a}`).then(r => r.json()),
    ]).then(([c, p, t, d]) => {
      setClientes(c)
      setPagamentos(p)
      setTickets(t)
      setDespesas(d)
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
    await api(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagamento_recebido: novo }),
    })
  }

  async function togglePagamento(cliente: ClienteFixo, pag: Pagamento | undefined) {
    const m = mes.getMonth() + 1
    const a = mes.getFullYear()

    if (!pag) {
      const res = await api('/api/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: cliente.id, mes: m, ano: a, valor: cliente.valor_mensal, recebido: true }),
      })
      const novo = await res.json()
      setPagamentos(prev => [...prev, novo])
    } else {
      const res = await api(`/api/pagamentos/${pag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recebido: !pag.recebido }),
      })
      const updated = await res.json()
      setPagamentos(prev => prev.map(p => p.id === pag.id ? updated : p))
    }
  }

  async function addDespesa() {
    if (!despForm.descricao || !despForm.valor) return
    setSavingDesp(true)
    const valor = parseFloat(despForm.valor.replace(',', '.'))
    if (isNaN(valor)) { setSavingDesp(false); return }
    const res = await api('/api/despesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: despForm.tipo,
        descricao: despForm.descricao,
        valor,
        mes: mes.getMonth() + 1,
        ano: mes.getFullYear(),
      }),
    })
    const nova = await res.json()
    setDespesas(prev => [nova, ...prev])
    setDespForm({ tipo: 'corporativa', descricao: '', valor: '' })
    setShowDespForm(false)
    setSavingDesp(false)
  }

  async function deleteDespesa(id: string) {
    if (!confirm('Excluir esta despesa?')) return
    setDespesas(prev => prev.filter(d => d.id !== id))
    await api(`/api/despesas/${id}`, { method: 'DELETE' })
  }

  // ============ Cálculos ============
  const m = mes.getMonth() + 1
  const a = mes.getFullYear()

  const clientesAtivos = clientes.filter(c => c.ativo)

  const rows = clientesAtivos.map(c => ({
    cliente: c,
    pag: pagamentos.find(p => p.cliente_id === c.id),
  }))

  const totalEsperadoFixo = clientesAtivos.reduce((s, c) => s + Number(c.valor_mensal), 0)
  const totalRecebidoFixo = rows.filter(r => r.pag?.recebido).reduce((s, r) => s + Number(r.cliente.valor_mensal), 0)
  const totalPendenteFixo = totalEsperadoFixo - totalRecebidoFixo

  const avulsosMes = tickets.filter(t => {
    if (t.is_fixed_client || !t.budget_value || t.status === 'cancelado') return false
    const d = new Date(t.created_at)
    return d.getMonth() + 1 === m && d.getFullYear() === a
  })

  const totalAvulso = avulsosMes.reduce((s, t) => s + (t.budget_value ?? 0), 0)
  const totalAvulsoRecebido = avulsosMes.filter(t => t.pagamento_recebido).reduce((s, t) => s + (t.budget_value ?? 0), 0)
  const totalAvulsoPendente = totalAvulso - totalAvulsoRecebido

  const entradas = totalRecebidoFixo + totalAvulsoRecebido
  const pendente = totalPendenteFixo + totalAvulsoPendente

  const saidas = despesas.reduce((s, d) => s + Number(d.valor), 0)
  const saidasPessoais = despesas.filter(d => d.tipo === 'pessoal').reduce((s, d) => s + Number(d.valor), 0)
  const saidasCorp = despesas.filter(d => d.tipo === 'corporativa').reduce((s, d) => s + Number(d.valor), 0)

  const balanco = entradas - saidas
  const balancoPositivo = balanco >= 0

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Header com mês e balanço */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Financeiro</p>
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
            <p className="text-xs text-slate-400">Balanço do mês</p>
            <p className={clsx('text-2xl font-bold', balancoPositivo ? 'text-green-600' : 'text-red-500')}>
              {balancoPositivo ? '+' : ''}{formatBRL(balanco)}
            </p>
          </div>
        </div>

        {/* PAINEL BALANÇO (gradiente dark/gold) */}
        <div
          className="rounded-2xl p-6 shadow-md text-white"
          style={{
            background: 'radial-gradient(ellipse 80% 150% at 95% 50%, #C5A880 0%, #6B4C28 40%, #1c1a18 80%), #100E0B',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Visão Geral</p>
              <p className="text-sm text-white/80 mt-0.5">Entradas, saídas e resultado do mês</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <BalancoCard
              label="Entradas"
              value={formatBRL(entradas)}
              sub={`Fixo ${formatBRL(totalRecebidoFixo)} + Avulso ${formatBRL(totalAvulsoRecebido)}`}
              color="text-green-300"
            />
            <BalancoCard
              label="Saídas"
              value={formatBRL(saidas)}
              sub={`Pess. ${formatBRL(saidasPessoais)} + Corp. ${formatBRL(saidasCorp)}`}
              color="text-red-300"
            />
            <BalancoCard
              label="Balanço"
              value={`${balancoPositivo ? '+' : ''}${formatBRL(balanco)}`}
              sub={balancoPositivo ? 'Resultado positivo' : 'Resultado negativo'}
              color={balancoPositivo ? 'text-green-300' : 'text-red-300'}
              highlight
            />
            <BalancoCard
              label="Pendente"
              value={formatBRL(pendente)}
              sub={`${rows.filter(r => !r.pag?.recebido).length + avulsosMes.filter(t => !t.pagamento_recebido).length} a receber`}
              color={pendente > 0 ? 'text-amber-300' : 'text-white/60'}
            />
          </div>
        </div>

        {/* Tabela de clientes fixos */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Recebimentos Fixos</h2>
            <span className="text-sm font-bold text-amber-600">{formatBRL(totalRecebidoFixo)} <span className="text-xs font-normal text-slate-400">de {formatBRL(totalEsperadoFixo)}</span></span>
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
                      <span className="text-sm font-semibold text-slate-800">{formatBRL(Number(cliente.valor_mensal))}</span>
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
            <span className="text-sm font-bold text-slate-700">{formatBRL(totalAvulsoRecebido)} <span className="text-xs font-normal text-slate-400">de {formatBRL(totalAvulso)}</span></span>
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

        {/* DESPESAS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Despesas</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pessoais {formatBRL(saidasPessoais)} · Corporativas {formatBRL(saidasCorp)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-red-500">{formatBRL(saidas)}</span>
              <button
                onClick={() => setShowDespForm(v => !v)}
                className="text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity"
                style={{ background: '#C5A880' }}
              >
                {showDespForm ? 'Cancelar' : '+ Adicionar'}
              </button>
            </div>
          </div>

          {showDespForm && (
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div className="sm:col-span-3">
                  <select
                    value={despForm.tipo}
                    onChange={e => setDespForm(f => ({ ...f, tipo: e.target.value as DespesaTipo }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                  >
                    <option value="corporativa">Corporativa</option>
                    <option value="pessoal">Pessoal</option>
                  </select>
                </div>
                <div className="sm:col-span-5">
                  <input
                    placeholder="Descrição (ex: Adobe, conta de luz...)"
                    value={despForm.descricao}
                    onChange={e => setDespForm(f => ({ ...f, descricao: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#C5A880] bg-white">
                    <span className="px-2 text-xs text-slate-400 bg-slate-100 border-r border-slate-200 py-2">R$</span>
                    <input
                      placeholder="0,00"
                      value={despForm.valor}
                      onChange={e => setDespForm(f => ({ ...f, valor: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addDespesa() }}
                      inputMode="decimal"
                      className="w-full text-sm px-2 py-2 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <button
                    onClick={addDespesa}
                    disabled={savingDesp || !despForm.descricao || !despForm.valor}
                    className="w-full text-sm py-2 rounded-lg text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ background: '#C5A880' }}
                  >
                    {savingDesp ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {despesas.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">Nenhuma despesa este mês.</div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-white border-b border-slate-100">
                  <tr className="text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {despesas.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <span className={clsx(
                          'inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full',
                          d.tipo === 'pessoal'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        )}>
                          {d.tipo === 'pessoal' ? 'Pessoal' : 'Corporativa'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-sm text-slate-800">{d.descricao}</p>
                        <p className="text-xs text-slate-400">{format(new Date(d.created_at), "d 'de' MMM", { locale: ptBR })}</p>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm font-semibold text-red-500">- {formatBRL(Number(d.valor))}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => deleteDespesa(d.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none"
                        >
                          ×
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
    </div>
  )
}

function BalancoCard({ label, value, sub, color, highlight }: { label: string; value: string; sub?: string; color: string; highlight?: boolean }) {
  return (
    <div className={clsx(
      'rounded-xl p-4 border',
      highlight
        ? 'bg-white/15 border-white/30 backdrop-blur-sm'
        : 'bg-white/5 border-white/10 backdrop-blur-sm'
    )}>
      <p className="text-xs uppercase tracking-wider text-white/60 mb-2">{label}</p>
      <p className={clsx('text-2xl font-bold leading-tight', color)}>{value}</p>
      {sub && <p className="text-[11px] text-white/50 mt-1.5 leading-tight">{sub}</p>}
    </div>
  )
}
