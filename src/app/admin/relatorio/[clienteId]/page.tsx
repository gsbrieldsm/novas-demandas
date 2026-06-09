'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'
import { formatMinutos } from '@/lib/tempo'
import type { Ticket, TempoApontamento } from '@/types'
import { REQUEST_TYPE_LABELS } from '@/types'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatNum(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR')
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
  created_at: string
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

export default function RelatorioPage() {
  const router = useRouter()
  const params = useParams()
  const search = useSearchParams()
  const clienteId = params.clienteId as string
  const mesInicial = search.get('mes')
  const anoInicial = search.get('ano')

  const now = new Date()
  const [mes, setMes] = useState(new Date(
    Number(anoInicial) || now.getFullYear(),
    (Number(mesInicial) || (now.getMonth() + 1)) - 1,
    1
  ))

  const [cliente, setCliente] = useState<ClienteFixo | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [tempo, setTempo] = useState<TempoApontamento[]>([])
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [escopoInput, setEscopoInput] = useState('')
  const [obsInput, setObsInput] = useState('')

  const [metricaForm, setMetricaForm] = useState({
    seguidores: '',
    engajamento_percent: '',
    alcance: '',
    visualizacoes: '',
    observacoes: '',
  })

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
      api('/api/tickets').then(r => r.json()),
      api('/api/tempo').then(r => r.json()),
      api(`/api/metricas?cliente_id=${clienteId}`).then(r => r.json()),
    ]).then(([cs, ts, tm, ms]) => {
      const cf = (cs as ClienteFixo[]).find(c => c.id === clienteId)
      setCliente(cf ?? null)
      setEscopoInput(cf?.escopo_mensal ?? '')
      setObsInput(cf?.observacoes_internas ?? '')
      setTickets(ts)
      setTempo(tm)
      setMetricas(ms)

      // Preenche o form com a métrica do mês selecionado, se existir
      const atual = (ms as Metrica[]).find(x => x.mes === m && x.ano === a)
      setMetricaForm({
        seguidores: atual?.seguidores?.toString() ?? '',
        engajamento_percent: atual?.engajamento_percent?.toString() ?? '',
        alcance: atual?.alcance?.toString() ?? '',
        visualizacoes: atual?.visualizacoes?.toString() ?? '',
        observacoes: atual?.observacoes ?? '',
      })
      setLoading(false)
    })
  }, [clienteId, mes])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function salvarEscopo() {
    await api(`/api/clientes-fixos/${clienteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        escopo_mensal: escopoInput.trim() || null,
        observacoes_internas: obsInput.trim() || null,
      }),
    })
    if (cliente) {
      setCliente({ ...cliente, escopo_mensal: escopoInput.trim() || null, observacoes_internas: obsInput.trim() || null })
    }
    setEditando(false)
  }

  async function salvarMetrica() {
    const m = mes.getMonth() + 1
    const a = mes.getFullYear()
    const body = {
      cliente_fixo_id: clienteId,
      mes: m,
      ano: a,
      seguidores: metricaForm.seguidores ? parseInt(metricaForm.seguidores, 10) : null,
      engajamento_percent: metricaForm.engajamento_percent ? parseFloat(metricaForm.engajamento_percent.replace(',', '.')) : null,
      alcance: metricaForm.alcance ? parseInt(metricaForm.alcance, 10) : null,
      visualizacoes: metricaForm.visualizacoes ? parseInt(metricaForm.visualizacoes, 10) : null,
      observacoes: metricaForm.observacoes.trim() || null,
    }
    const res = await api('/api/metricas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const saved = await res.json()
      setMetricas(prev => {
        const without = prev.filter(x => !(x.mes === m && x.ano === a))
        return [...without, saved]
      })
    }
  }

  // ============ Cálculos ============
  const m = mes.getMonth() + 1
  const a = mes.getFullYear()
  const mesAnterior = subMonths(mes, 1)
  const monthStart = startOfMonth(mes)
  const monthEnd = endOfMonth(mes)

  const metricaAtual = useMemo(
    () => metricas.find(x => x.mes === m && x.ano === a) ?? null,
    [metricas, m, a]
  )
  const metricaAnterior = useMemo(
    () => metricas.find(x => x.mes === mesAnterior.getMonth() + 1 && x.ano === mesAnterior.getFullYear()) ?? null,
    [metricas, mesAnterior]
  )

  // Entregas do cliente no mês
  const entregas = useMemo(() => {
    return tickets.filter(t => {
      const created = new Date(t.created_at)
      const inMonth = created >= monthStart && created <= monthEnd
      const pertence = t.cliente_fixo_id === clienteId
        || (t.is_fixed_client && cliente && t.client_name?.toLowerCase().trim() === cliente.nome?.toLowerCase().trim())
      return inMonth && pertence
    }).sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime())
  }, [tickets, cliente, clienteId, monthStart, monthEnd])

  const minutosPorTicket = useMemo(() => {
    const map = new Map<string, number>()
    tempo.forEach(a => {
      if (a.minutos != null && !a.ativo) {
        map.set(a.ticket_id, (map.get(a.ticket_id) ?? 0) + a.minutos)
      }
    })
    return map
  }, [tempo])

  const tempoTotal = entregas.reduce((s, t) => s + (minutosPorTicket.get(t.id) ?? 0), 0)

  function calcGrowth(atual: number | null | undefined, anterior: number | null | undefined): { pct: number; color: string; arrow: string } | null {
    if (atual == null || anterior == null || anterior === 0) return null
    const pct = ((atual - anterior) / anterior) * 100
    if (pct > 0) return { pct, color: 'text-green-600', arrow: '▲' }
    if (pct < 0) return { pct, color: 'text-red-500', arrow: '▼' }
    return { pct: 0, color: 'text-slate-400', arrow: '•' }
  }

  if (loading || !cliente) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  const mesLabel = format(mes, "MMMM 'de' yyyy", { locale: ptBR })
  const mesAnteriorLabel = format(mesAnterior, "MMM", { locale: ptBR })

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col print:bg-white">
      {/* Header (escondido no print) */}
      <div className="print:hidden">
        <AdminNav onLogout={handleLogout} />
      </div>

      <div className="max-w-4xl mx-auto w-full px-4 md:px-6 py-4 md:py-8 print:px-0 print:py-0 print:max-w-full">

        {/* Toolbar (escondida no print) */}
        <div className="print:hidden flex items-center justify-between gap-3 flex-wrap mb-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            ← Voltar
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2">
              <button onClick={() => setMes(d => subMonths(d, 1))} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500">‹</button>
              <span className="text-sm text-slate-600 px-2 capitalize whitespace-nowrap">{mesLabel}</span>
              <button onClick={() => setMes(d => addMonths(d, 1))} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500">›</button>
            </div>
            <button
              onClick={() => setEditando(v => !v)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              {editando ? 'Concluir edição' : 'Editar escopo'}
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90"
              style={{ background: '#C5A880' }}
            >
              🖨 Imprimir / PDF
            </button>
          </div>
        </div>

        {/* RELATÓRIO */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print:shadow-none print:border-none print:rounded-none">

          {/* Cabeçalho */}
          <div
            className="px-6 md:px-10 py-6 md:py-8 text-white"
            style={{
              background: 'radial-gradient(ellipse 70% 100% at 90% 50%, #C5A880 0%, #6B4C28 45%, #1c1a18 80%), #100E0B',
            }}
          >
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <Image
                src="/logo-symbol.png"
                alt="GM&Co"
                width={36}
                height={36}
                style={{ filter: 'brightness(0) invert(1)' }}
              />
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">Gabriel Moraes & Co</p>
                <p className="text-[10px] tracking-wider text-white/40">Marketing &amp; Estratégia</p>
              </div>
            </div>
            <p className="text-[10px] md:text-xs font-semibold tracking-[0.2em] text-[#C5A880] uppercase mb-1">Relatório Mensal</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white capitalize">{cliente.nome}</h1>
            <p className="text-base md:text-lg text-white/70 mt-1 capitalize">{mesLabel}</p>
          </div>

          <div className="px-6 md:px-10 py-6 md:py-8 space-y-7">

            {/* ESCOPO CONTRATADO */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Escopo Contratado</h2>
                <span className="text-xs text-slate-400">{formatBRL(Number(cliente.valor_mensal))}/mês</span>
              </div>
              {editando ? (
                <textarea
                  value={escopoInput}
                  onChange={e => setEscopoInput(e.target.value)}
                  rows={5}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                  placeholder={'• 2 posts no Instagram por semana\n• 3 diárias gravadas no mês\n• 1 reunião estratégica mensal'}
                />
              ) : cliente.escopo_mensal ? (
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {cliente.escopo_mensal}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                  ⚠️ Escopo ainda não definido. Clica em &quot;Editar escopo&quot; pra preencher.
                </div>
              )}
            </section>

            {/* MÉTRICAS / CRESCIMENTO */}
            <section>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Resultados do mês</h2>
                <div className="print:hidden">
                  <button
                    onClick={salvarMetrica}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
                  >
                    Salvar métricas
                  </button>
                </div>
              </div>

              {/* Form de métricas (oculto no print) */}
              <div className="print:hidden bg-slate-50 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricaInput
                  label="Seguidores"
                  value={metricaForm.seguidores}
                  onChange={v => setMetricaForm(f => ({ ...f, seguidores: v }))}
                  type="number"
                />
                <MetricaInput
                  label="Engajamento (%)"
                  value={metricaForm.engajamento_percent}
                  onChange={v => setMetricaForm(f => ({ ...f, engajamento_percent: v }))}
                  type="decimal"
                />
                <MetricaInput
                  label="Alcance"
                  value={metricaForm.alcance}
                  onChange={v => setMetricaForm(f => ({ ...f, alcance: v }))}
                  type="number"
                />
                <MetricaInput
                  label="Visualizações"
                  value={metricaForm.visualizacoes}
                  onChange={v => setMetricaForm(f => ({ ...f, visualizacoes: v }))}
                  type="number"
                />
                <div className="col-span-2 md:col-span-4">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Observações estratégicas</label>
                  <textarea
                    value={metricaForm.observacoes}
                    onChange={e => setMetricaForm(f => ({ ...f, observacoes: e.target.value }))}
                    rows={2}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none bg-white"
                    placeholder="Contexto do crescimento, destaques, próximos passos..."
                  />
                </div>
              </div>

              {/* Tabela de crescimento */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Métrica</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider capitalize">{mesAnteriorLabel}</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agora</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Crescimento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <MetricaRow label="Seguidores" prev={metricaAnterior?.seguidores} curr={metricaAtual?.seguidores} format={formatNum} growth={calcGrowth} />
                  <MetricaRow label="Engajamento" prev={metricaAnterior?.engajamento_percent} curr={metricaAtual?.engajamento_percent} format={(v) => v == null ? '—' : `${Number(v).toFixed(2)}%`} growth={calcGrowth} />
                  <MetricaRow label="Alcance" prev={metricaAnterior?.alcance} curr={metricaAtual?.alcance} format={formatNum} growth={calcGrowth} />
                  <MetricaRow label="Visualizações" prev={metricaAnterior?.visualizacoes} curr={metricaAtual?.visualizacoes} format={formatNum} growth={calcGrowth} />
                </tbody>
              </table>

              {metricaAtual?.observacoes && (
                <div className="bg-slate-50 rounded-xl p-3 mt-3 text-xs text-slate-600 italic leading-relaxed">
                  &ldquo;{metricaAtual.observacoes}&rdquo;
                </div>
              )}
            </section>

            {/* ENTREGAS DO MÊS */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Entregas Realizadas</h2>
                <span className="text-xs text-slate-400">{entregas.length} demandas · {formatMinutos(tempoTotal)}</span>
              </div>
              {entregas.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhuma demanda criada para este cliente no mês.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {entregas.map(t => {
                    const min = minutosPorTicket.get(t.id) ?? 0
                    const concluido = t.status === 'concluido'
                    return (
                      <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', concluido ? 'bg-green-500' : 'bg-amber-400')} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{format(new Date(t.created_at), "d 'de' MMM", { locale: ptBR })}</span>
                            <span className="text-slate-200">·</span>
                            <span>{REQUEST_TYPE_LABELS[t.request_type]}</span>
                            {min > 0 && <>
                              <span className="text-slate-200">·</span>
                              <span>{formatMinutos(min)}</span>
                            </>}
                          </div>
                        </div>
                        {concluido ? (
                          <span className="text-[10px] uppercase tracking-wider text-green-600 font-semibold">✓ Entregue</span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Em curso</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* OBSERVAÇÕES INTERNAS (só você vê) */}
            {editando && (
              <section className="print:hidden">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Observações internas
                  <span className="ml-2 text-[10px] font-normal text-slate-400 normal-case">(não aparece no relatório do cliente)</span>
                </h2>
                <textarea
                  value={obsInput}
                  onChange={e => setObsInput(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                  placeholder="Coisas que só você precisa saber sobre este cliente..."
                />
                <button
                  onClick={salvarEscopo}
                  className="mt-2 text-sm px-4 py-2 rounded-lg text-white hover:opacity-90"
                  style={{ background: '#C5A880' }}
                >
                  Salvar escopo + observações
                </button>
              </section>
            )}

            {/* RODAPÉ */}
            <div className="border-t border-slate-100 pt-5 mt-2 text-center">
              <p className="text-xs text-slate-400">
                Próximo relatório: {format(addMonths(mes, 1), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p className="text-[10px] text-slate-300 mt-2 tracking-wider uppercase">Gabriel Moraes &amp; Co · Marketing &amp; Estratégia</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 1.5cm; }
          body { background: white !important; }
          .min-h-screen { min-height: 0 !important; }
        }
      `}</style>
    </div>
  )
}

function MetricaInput({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type: 'number' | 'decimal' }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        inputMode={type === 'decimal' ? 'decimal' : 'numeric'}
        placeholder="—"
        className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white tabular-nums"
      />
    </div>
  )
}

function MetricaRow({
  label, prev, curr, format: fmt, growth,
}: {
  label: string
  prev: number | null | undefined
  curr: number | null | undefined
  format: (v: number | null | undefined) => string
  growth: (a: number | null | undefined, b: number | null | undefined) => { pct: number; color: string; arrow: string } | null
}) {
  const g = growth(curr, prev)
  return (
    <tr>
      <td className="py-2.5 text-slate-700">{label}</td>
      <td className="py-2.5 text-right text-slate-500 tabular-nums">{fmt(prev)}</td>
      <td className="py-2.5 text-right font-semibold text-slate-800 tabular-nums">{fmt(curr)}</td>
      <td className="py-2.5 text-right tabular-nums">
        {g ? (
          <span className={clsx('font-semibold', g.color)}>
            {g.arrow} {Math.abs(g.pct).toFixed(1)}%
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  )
}
