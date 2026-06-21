'use client'

import { useEffect, useMemo, useState } from 'react'
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
  pago: boolean
  pago_em: string | null
  vencimento: string | null
  recorrente: boolean
  recorrencia_meses: number | null
  recorrencia_grupo_id: string | null
}

export default function FinanceiroPage() {
  const [mes, setMes] = useState(new Date())
  const [clientes, setClientes] = useState<ClienteFixo[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [showDespForm, setShowDespForm] = useState(false)
  const [despForm, setDespForm] = useState<{ tipo: DespesaTipo; descricao: string; valor: string; vencimento: string; recorrente: boolean; recorrencia_meses: string }>({ tipo: 'corporativa', descricao: '', valor: '', vencimento: '', recorrente: false, recorrencia_meses: '12' })
  const [savingDesp, setSavingDesp] = useState(false)
  const [despesasTodas, setDespesasTodas] = useState<Despesa[]>([])
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
      api('/api/despesas').then(r => r.json()),
    ]).then(([c, p, t, d, dTodas]) => {
      setClientes(c)
      setPagamentos(p)
      setTickets(t)
      setDespesas(d)
      setDespesasTodas(dTodas)
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
        vencimento: despForm.vencimento || null,
        recorrente: despForm.recorrente,
        recorrencia_meses: despForm.recorrente ? parseInt(despForm.recorrencia_meses, 10) || 1 : null,
      }),
    })
    const nova = await res.json()
    setDespesas(prev => [nova, ...prev])
    const dTodas = await api('/api/despesas').then(r => r.json())
    setDespesasTodas(dTodas)
    setDespForm({ tipo: 'corporativa', descricao: '', valor: '', vencimento: '', recorrente: false, recorrencia_meses: '12' })
    setShowDespForm(false)
    setSavingDesp(false)
  }

  async function togglePago(despesa: Despesa) {
    const novo = !despesa.pago
    setDespesas(prev => prev.map(d => d.id === despesa.id ? {
      ...d,
      pago: novo,
      pago_em: novo ? new Date().toISOString() : null,
    } : d))
    await api(`/api/despesas/${despesa.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pago: novo,
        pago_em: novo ? new Date().toISOString() : null,
      }),
    })
  }

  async function deleteDespesa(despesa: Despesa) {
    let serie = false
    if (despesa.recorrente) {
      serie = confirm('Essa despesa é recorrente. Clique OK pra excluir ela e todos os meses futuros da recorrência, ou Cancelar pra excluir só este mês.')
    } else if (!confirm('Excluir esta despesa?')) {
      return
    }
    setDespesas(prev => prev.filter(d => d.id !== despesa.id))
    await api(`/api/despesas/${despesa.id}${serie ? '?serie=true' : ''}`, { method: 'DELETE' })
    const dTodas = await api('/api/despesas').then(r => r.json())
    setDespesasTodas(dTodas)
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

  const saidasPagas = despesas.filter(d => d.pago).reduce((s, d) => s + Number(d.valor), 0)
  const saidasAPagar = despesas.filter(d => !d.pago).reduce((s, d) => s + Number(d.valor), 0)
  const saidasTotal = saidasPagas + saidasAPagar
  const saidasPessoais = despesas.filter(d => d.tipo === 'pessoal').reduce((s, d) => s + Number(d.valor), 0)
  const saidasCorp = despesas.filter(d => d.tipo === 'corporativa').reduce((s, d) => s + Number(d.valor), 0)

  // Balanço considera apenas o que efetivamente saiu da conta
  const balanco = entradas - saidasPagas
  const balancoPositivo = balanco >= 0

  // Projeção mês a mês até dezembro do ano atual
  const projecao = useMemo(() => {
    const hoje = new Date()
    const anoAtual = hoje.getFullYear()
    let mp = hoje.getMonth() + 1
    let ap = anoAtual
    const meses: { mes: number; ano: number; receita: number; despesas: number; despesasAPagar: number; saldo: number }[] = []
    while (ap < anoAtual || (ap === anoAtual && mp <= 12)) {
      const receita = clientesAtivos.reduce((s, c) => s + Number(c.valor_mensal), 0)
      const despesasMes = despesasTodas.filter(d => d.mes === mp && d.ano === ap)
      const totalDespesas = despesasMes.reduce((s, d) => s + Number(d.valor), 0)
      const aPagar = despesasMes.filter(d => !d.pago).reduce((s, d) => s + Number(d.valor), 0)
      meses.push({ mes: mp, ano: ap, receita, despesas: totalDespesas, despesasAPagar: aPagar, saldo: receita - totalDespesas })
      mp++
      if (mp > 12) { mp = 1; ap++ }
    }
    return meses
  }, [clientesAtivos, despesasTodas])

  const totalAPagarAteDezembro = projecao.reduce((s, p) => s + p.despesasAPagar, 0)
  const saldoAcumuladoAteDezembro = projecao.reduce((s, p) => s + p.saldo, 0)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto w-full px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8">

        {/* Header com mês e balanço */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Financeiro</p>
              <h1 className="text-lg md:text-2xl font-bold text-slate-900 mt-0.5 md:mt-1">
                {format(mes, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <button onClick={() => setMes(m => subMonths(m, 1))} className="w-8 h-8 md:w-9 md:h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors">‹</button>
              <button onClick={() => setMes(new Date())} className="text-xs px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-colors">Hoje</button>
              <button onClick={() => setMes(m => addMonths(m, 1))} className="w-8 h-8 md:w-9 md:h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors">›</button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] md:text-xs text-slate-400">Balanço do mês</p>
            <p className={clsx('text-lg md:text-2xl font-bold', balancoPositivo ? 'text-green-600' : 'text-red-500')}>
              {balancoPositivo ? '+' : ''}{formatBRL(balanco)}
            </p>
          </div>
        </div>

        {/* PAINEL BALANÇO (gradiente dark/gold) */}
        <div
          className="rounded-2xl p-4 md:p-6 shadow-md text-white"
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
              value={formatBRL(saidasPagas)}
              sub={saidasAPagar > 0 ? `+ ${formatBRL(saidasAPagar)} a pagar` : 'Tudo pago ✓'}
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

        {/* PROJEÇÃO ATÉ DEZEMBRO */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Projeção até Dezembro de {new Date().getFullYear()}</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Receita fixa prevista e despesas já lançadas, mês a mês</p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">A pagar até dez.</p>
                <p className="text-sm font-bold text-red-500">{formatBRL(totalAPagarAteDezembro)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Saldo acumulado</p>
                <p className={clsx('text-sm font-bold', saldoAcumuladoAteDezembro >= 0 ? 'text-green-600' : 'text-red-500')}>
                  {saldoAcumuladoAteDezembro >= 0 ? '+' : ''}{formatBRL(saldoAcumuladoAteDezembro)}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-2 px-4 md:px-6 py-4 min-w-max">
              {projecao.map(p => {
                const dataMes = new Date(p.ano, p.mes - 1, 1)
                const isAtual = p.mes === new Date().getMonth() + 1 && p.ano === new Date().getFullYear()
                return (
                  <div
                    key={`${p.mes}-${p.ano}`}
                    className={clsx(
                      'rounded-xl p-3 min-w-[140px] border',
                      isAtual ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'
                    )}
                  >
                    <p className={clsx('text-[10px] uppercase tracking-wider font-bold mb-2', isAtual ? 'text-white/60' : 'text-slate-400')}>
                      {format(dataMes, 'MMM yyyy', { locale: ptBR })}
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={clsx('text-[10px]', isAtual ? 'text-white/50' : 'text-slate-400')}>Receita</span>
                        <span className={clsx('text-xs font-semibold', isAtual ? 'text-green-300' : 'text-green-600')}>{formatBRL(p.receita)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={clsx('text-[10px]', isAtual ? 'text-white/50' : 'text-slate-400')}>Despesas</span>
                        <span className={clsx('text-xs font-semibold', isAtual ? 'text-red-300' : 'text-red-500')}>{formatBRL(p.despesas)}</span>
                      </div>
                      <div className={clsx('flex items-center justify-between gap-2 pt-1 border-t', isAtual ? 'border-white/10' : 'border-slate-100')}>
                        <span className={clsx('text-[10px] font-bold', isAtual ? 'text-white/70' : 'text-slate-500')}>Saldo</span>
                        <span className={clsx('text-xs font-bold', p.saldo >= 0 ? (isAtual ? 'text-white' : 'text-slate-800') : 'text-red-500')}>
                          {p.saldo >= 0 ? '+' : ''}{formatBRL(p.saldo)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 px-4 md:px-6 pb-3 -mt-1">
            💡 Receita prevista considera os clientes fixos ativos hoje. Despesas recorrentes já aparecem em todos os meses futuros — cadastre como recorrente na seção de Despesas abaixo.
          </p>
        </div>

        {/* Tabela de clientes fixos */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Recebimentos Fixos</h2>
            <span className="text-sm font-bold text-amber-600">{formatBRL(totalRecebidoFixo)} <span className="text-xs font-normal text-slate-400">de {formatBRL(totalEsperadoFixo)}</span></span>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Carregando...</div>
          ) : clientesAtivos.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum cliente fixo ativo. Cadastre em Gestão.</div>
          ) : (
            <>
              {/* Desktop: tabela */}
              <table className="hidden md:table w-full">
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

              {/* Mobile: cards compactos */}
              <div className="md:hidden divide-y divide-slate-50">
                {rows.map(({ cliente, pag }) => (
                  <button
                    key={cliente.id}
                    onClick={() => togglePagamento(cliente, pag)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-slate-50 transition-colors"
                  >
                    <span className={clsx(
                      'w-1 self-stretch rounded-full flex-shrink-0',
                      pag?.recebido ? 'bg-green-400' : 'bg-amber-400'
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate flex-1">{cliente.nome}</p>
                        <span className="text-sm font-bold text-amber-600 whitespace-nowrap">{formatBRL(Number(cliente.valor_mensal))}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                        {pag?.recebido ? (
                          <span className="text-green-600 font-medium">✓ Recebido</span>
                        ) : (
                          <span className="text-amber-600">⏳ Pendente</span>
                        )}
                        {cliente.dia_vencimento && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="text-slate-400">Vence dia {cliente.dia_vencimento}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Avulsos do mês */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Avulsos com Orçamento</h2>
            <span className="text-sm font-bold text-slate-700">{formatBRL(totalAvulsoRecebido)} <span className="text-xs font-normal text-slate-400">de {formatBRL(totalAvulso)}</span></span>
          </div>
          {avulsosMes.length === 0 ? (
            <div className="px-6 py-6 md:py-8 text-center text-slate-400 text-xs md:text-sm">Nenhum avulso com orçamento este mês.</div>
          ) : (
            <>
              {/* Desktop: tabela */}
              <table className="hidden md:table w-full">
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

              {/* Mobile: cards compactos */}
              <div className="md:hidden divide-y divide-slate-50">
                {avulsosMes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleAvulso(t)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-slate-50 transition-colors"
                  >
                    <span className={clsx(
                      'w-1 self-stretch rounded-full flex-shrink-0',
                      t.pagamento_recebido ? 'bg-green-400' : 'bg-amber-400'
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p
                          className="text-sm font-semibold text-slate-800 truncate flex-1"
                          onClick={(e) => { e.stopPropagation(); router.push(`/admin/chamado/${t.id}`) }}
                        >
                          {t.title}
                        </p>
                        <span className="text-sm font-bold text-slate-800 whitespace-nowrap">{formatBRL(t.budget_value!)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                        <span className="text-slate-400">{t.client_name}</span>
                        <span className="text-slate-200">·</span>
                        {t.pagamento_recebido ? (
                          <span className="text-green-600 font-medium">✓ Recebido</span>
                        ) : (
                          <span className="text-amber-600">⏳ Pendente</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* DESPESAS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Header desktop */}
          <div className="hidden md:flex px-6 py-4 border-b border-slate-100 items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Despesas</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pessoais {formatBRL(saidasPessoais)} · Corporativas {formatBRL(saidasCorp)} · <span className="text-green-600 font-medium">Pago {formatBRL(saidasPagas)}</span> · <span className="text-amber-600 font-medium">A pagar {formatBRL(saidasAPagar)}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-red-500">{formatBRL(saidasTotal)}</span>
              <button
                onClick={() => setShowDespForm(v => !v)}
                className="text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity"
                style={{ background: '#C5A880' }}
              >
                {showDespForm ? 'Cancelar' : '+ Adicionar'}
              </button>
            </div>
          </div>

          {/* Header mobile compacto */}
          <div className="md:hidden px-4 py-3 border-b border-slate-100">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Despesas</h2>
              <span className="text-base font-bold text-red-500">{formatBRL(saidasTotal)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-[11px]">
              <span className="text-green-600 font-medium">Pago {formatBRL(saidasPagas)}</span>
              <span className="text-slate-300">·</span>
              <span className="text-amber-600 font-medium">A pagar {formatBRL(saidasAPagar)}</span>
            </div>
          </div>

          {showDespForm && (
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div className="sm:col-span-2">
                  <select
                    value={despForm.tipo}
                    onChange={e => setDespForm(f => ({ ...f, tipo: e.target.value as DespesaTipo }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                  >
                    <option value="corporativa">Corporativa</option>
                    <option value="pessoal">Pessoal</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
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
                  <input
                    type="date"
                    value={despForm.vencimento}
                    onChange={e => setDespForm(f => ({ ...f, vencimento: e.target.value }))}
                    title="Vencimento (opcional)"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                  />
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
              <div className="flex items-center gap-3 mt-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={despForm.recorrente}
                    onChange={e => setDespForm(f => ({ ...f, recorrente: e.target.checked }))}
                    className="rounded border-slate-300 text-[#C5A880] focus:ring-[#C5A880]"
                  />
                  Despesa recorrente
                </label>
                {despForm.recorrente && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">por quantos meses</span>
                    <input
                      type="number"
                      min="2"
                      max="60"
                      value={despForm.recorrencia_meses}
                      onChange={e => setDespForm(f => ({ ...f, recorrencia_meses: e.target.value }))}
                      className="w-16 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                A data de vencimento é opcional — quando preenchida, a despesa aparece na Agenda. Se marcar recorrente, a despesa já é criada em todos os meses seguintes (cada mês fica controlável separadamente).
              </p>
            </div>
          )}

          <div className="max-h-[480px] overflow-y-auto">
            {despesas.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">Nenhuma despesa este mês.</div>
            ) : (
              <>
              <table className="hidden md:table w-full">
                <thead className="sticky top-0 bg-white border-b border-slate-100">
                  <tr className="text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Vencimento</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {despesas.map(d => {
                    const venc = d.vencimento ? new Date(d.vencimento + 'T12:00:00') : null
                    const atrasado = venc && !d.pago && venc < new Date()
                    return (
                      <tr key={d.id} className={clsx('hover:bg-slate-50 transition-colors', d.pago && 'opacity-70')}>
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
                          <div className="flex items-center gap-1.5">
                            <p className={clsx('text-sm', d.pago ? 'text-slate-500' : 'text-slate-800')}>{d.descricao}</p>
                            {d.recorrente && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500" title={`Recorrente · ${d.recorrencia_meses} meses`}>
                                🔁 {d.recorrencia_meses}x
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">criada {format(new Date(d.created_at), "d 'de' MMM", { locale: ptBR })}</p>
                        </td>
                        <td className="px-6 py-3">
                          {venc ? (
                            <span className={clsx('text-sm', atrasado ? 'text-red-500 font-semibold' : 'text-slate-600')}>
                              {format(venc, "d 'de' MMM", { locale: ptBR })}
                              {atrasado && <span className="block text-[10px] uppercase tracking-wider">atrasado</span>}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <span className={clsx('text-sm font-semibold', d.pago ? 'text-slate-400 line-through' : 'text-red-500')}>
                            - {formatBRL(Number(d.valor))}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          {d.pago ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                                ✓ Pago
                              </span>
                              {d.pago_em && (
                                <p className="text-xs text-slate-400 mt-1">
                                  {format(new Date(d.pago_em), "d 'de' MMM", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full">
                              ⏳ A pagar
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => togglePago(d)}
                              className={clsx(
                                'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap',
                                d.pago
                                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              )}
                            >
                              {d.pago ? 'Desfazer' : 'Marcar pago'}
                            </button>
                            <button
                              onClick={() => deleteDespesa(d)}
                              className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none"
                              title="Excluir"
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Mobile: cards compactos */}
              <div className="md:hidden divide-y divide-slate-50">
                {despesas.map(d => {
                  const venc = d.vencimento ? new Date(d.vencimento + 'T12:00:00') : null
                  const atrasado = venc && !d.pago && venc < new Date()
                  return (
                    <button
                      key={d.id}
                      onClick={() => togglePago(d)}
                      className={clsx(
                        'w-full text-left px-4 py-3 flex items-center gap-3 active:bg-slate-50 transition-colors',
                        d.pago && 'opacity-60'
                      )}
                    >
                      {/* Marcador colorido lateral por tipo */}
                      <span
                        className={clsx(
                          'w-1 self-stretch rounded-full flex-shrink-0',
                          d.tipo === 'pessoal' ? 'bg-blue-400' : 'bg-purple-400'
                        )}
                      />

                      {/* Conteúdo principal */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className={clsx('text-sm font-medium truncate flex-1', d.pago ? 'text-slate-500' : 'text-slate-800')}>
                            {d.descricao}{d.recorrente && <span className="ml-1 text-[10px] text-slate-400">🔁{d.recorrencia_meses}x</span>}
                          </p>
                          <span className={clsx('text-sm font-bold whitespace-nowrap', d.pago ? 'text-slate-400 line-through' : 'text-red-500')}>
                            {formatBRL(Number(d.valor))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>{d.tipo === 'pessoal' ? 'Pessoal' : 'Corporativa'}</span>
                          <span className="text-slate-200">·</span>
                          {d.pago ? (
                            <span className="text-green-600 font-medium">✓ Pago</span>
                          ) : atrasado ? (
                            <span className="text-red-500 font-semibold">⚠ Atrasado</span>
                          ) : (
                            <span className="text-amber-600">⏳ A pagar</span>
                          )}
                          {venc && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span>vence {format(venc, "d MMM", { locale: ptBR })}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Lixeira pequena */}
                      <span
                        onClick={(e) => { e.stopPropagation(); deleteDespesa(d) }}
                        className="w-7 h-7 rounded-md text-slate-300 hover:text-red-500 flex items-center justify-center text-lg flex-shrink-0 -mr-1"
                      >
                        ×
                      </span>
                    </button>
                  )
                })}
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FAB mobile — adicionar despesa em 1 toque */}
      <button
        onClick={() => setShowDespForm(true)}
        className="md:hidden fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full shadow-xl text-white flex items-center justify-center hover:opacity-90 transition-opacity active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #C5A880 0%, #8B6840 100%)',
          boxShadow: '0 8px 24px rgba(197,168,128,0.4)',
        }}
        aria-label="Adicionar despesa"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
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
