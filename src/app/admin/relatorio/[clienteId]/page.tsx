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
  const concluidas = entregas.filter(t => t.status === 'concluido').length

  function calcGrowth(atual: number | null | undefined, anterior: number | null | undefined): { pct: number; isPositive: boolean; arrow: string } | null {
    if (atual == null || anterior == null || anterior === 0) return null
    const pct = ((atual - anterior) / anterior) * 100
    if (pct > 0) return { pct, isPositive: true, arrow: '↑' }
    if (pct < 0) return { pct, isPositive: false, arrow: '↓' }
    return { pct: 0, isPositive: true, arrow: '—' }
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
    <>
      {/* Header admin (escondido no print) */}
      <div className="print:hidden">
        <AdminNav onLogout={handleLogout} />
      </div>

      <div className="bg-[#f5f6f8] min-h-screen print:bg-white print:min-h-0">

        {/* Toolbar (escondida no print) */}
        <div className="print:hidden max-w-[860px] mx-auto px-4 md:px-6 pt-4 md:pt-6 flex items-center justify-between gap-3 flex-wrap">
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
              className="text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90 font-medium"
              style={{ background: '#C5A880' }}
            >
              🖨 Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Form de edição (escondido no print) */}
        {editando && (
          <div className="print:hidden max-w-[860px] mx-auto px-4 md:px-6 pt-4 space-y-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <label className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase block mb-2">Escopo mensal</label>
              <textarea
                value={escopoInput}
                onChange={e => setEscopoInput(e.target.value)}
                rows={4}
                className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                placeholder={'• 2 posts no Instagram por semana\n• 3 diárias gravadas no mês\n• 1 reunião estratégica mensal'}
              />
              <label className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase block mb-2 mt-3">
                Observações internas
                <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">(não vai pro relatório)</span>
              </label>
              <textarea
                value={obsInput}
                onChange={e => setObsInput(e.target.value)}
                rows={2}
                className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                placeholder="Coisas que só você precisa saber..."
              />
              <button
                onClick={salvarEscopo}
                className="mt-3 text-sm px-4 py-2 rounded-lg text-white"
                style={{ background: '#C5A880' }}
              >
                Salvar escopo + observações
              </button>
            </div>
          </div>
        )}

        {/* Form de métricas (escondido no print) */}
        <div className="print:hidden max-w-[860px] mx-auto px-4 md:px-6 pt-4 pb-2">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">Métricas de {mesLabel}</p>
              <button
                onClick={salvarMetrica}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
              >
                Salvar métricas
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricaInput label="Seguidores" value={metricaForm.seguidores} onChange={v => setMetricaForm(f => ({ ...f, seguidores: v }))} type="number" />
              <MetricaInput label="Engajamento (%)" value={metricaForm.engajamento_percent} onChange={v => setMetricaForm(f => ({ ...f, engajamento_percent: v }))} type="decimal" />
              <MetricaInput label="Alcance" value={metricaForm.alcance} onChange={v => setMetricaForm(f => ({ ...f, alcance: v }))} type="number" />
              <MetricaInput label="Visualizações" value={metricaForm.visualizacoes} onChange={v => setMetricaForm(f => ({ ...f, visualizacoes: v }))} type="number" />
            </div>
            <textarea
              value={metricaForm.observacoes}
              onChange={e => setMetricaForm(f => ({ ...f, observacoes: e.target.value }))}
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 mt-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
              placeholder="Observações estratégicas do mês (opcional)..."
            />
          </div>
        </div>

        {/* ========== RELATÓRIO (visível no PDF) ========== */}
        <div className="report-document max-w-[860px] mx-auto px-4 md:px-6 py-4 md:py-6 print:px-0 print:py-0 print:max-w-full">
          <article
            className="report-paper bg-white shadow-[0_8px_32px_rgba(8,12,16,0.12)] overflow-hidden print:shadow-none"
            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
          >

            {/* ===== CAPA / HEADER ===== */}
            <header
              className="relative px-8 md:px-14 py-12 md:py-16 text-white overflow-hidden"
              style={{
                background: '#080c10',
              }}
            >
              {/* Glow dourado de fundo (como o hero do site) */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 65% 90% at 85% 0%, rgba(201,169,110,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 70% at 10% 100%, rgba(107,76,40,0.25) 0%, transparent 50%)',
                }}
              />

              {/* Grid sutil */}
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />

              <div className="relative">
                {/* Marca */}
                <div className="flex items-center gap-3 mb-12 md:mb-16">
                  <Image
                    src="/logo-symbol.png"
                    alt="GM&Co"
                    width={32}
                    height={32}
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.22em] text-white uppercase leading-none">
                      Gabriel Moraes <span style={{ color: '#c9a96e' }}>&amp;</span> Co
                    </p>
                    <p className="text-[9px] tracking-[0.18em] text-white/40 uppercase mt-1">
                      Marketing &amp; Estratégia
                    </p>
                  </div>
                </div>

                {/* Etiqueta */}
                <div
                  className="inline-block px-3 py-1.5 rounded-full mb-6"
                  style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)' }}
                >
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase" style={{ color: '#e8c987' }}>
                    Relatório Mensal · {format(mes, 'MM/yyyy')}
                  </p>
                </div>

                {/* Título — estilo hero */}
                <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-2 capitalize tracking-tight">
                  {cliente.nome}
                </h1>
                <p className="text-lg md:text-xl text-white/60 capitalize">
                  <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>
                    {format(mes, "MMMM", { locale: ptBR })}
                  </em> de {format(mes, 'yyyy')}
                </p>

                {/* Linha de stats no rodapé do header */}
                <div className="mt-10 md:mt-12 pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
                  <HeaderStat label="Contrato" value={formatBRL(Number(cliente.valor_mensal))} />
                  <HeaderStat label="Entregas" value={String(concluidas)} sub={`de ${entregas.length}`} />
                  <HeaderStat label="Tempo investido" value={formatMinutos(tempoTotal)} />
                </div>
              </div>
            </header>

            {/* ===== CORPO ===== */}
            <div className="px-8 md:px-14 py-10 md:py-14 space-y-12">

              {/* ESCOPO */}
              <section>
                <SectionHeader number="01" label="Escopo Contratado" />
                {cliente.escopo_mensal ? (
                  <div
                    className="text-[15px] leading-[1.85] whitespace-pre-wrap"
                    style={{ color: '#2a3340' }}
                  >
                    {cliente.escopo_mensal}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    Escopo ainda não definido. Use o botão &quot;Editar escopo&quot; pra preencher.
                  </p>
                )}
              </section>

              {/* MÉTRICAS / RESULTADOS */}
              <section>
                <SectionHeader number="02" label="Resultados do Mês" />

                <div className="space-y-3">
                  <MetricaRow label="Seguidores" prev={metricaAnterior?.seguidores} curr={metricaAtual?.seguidores} format={formatNum} growth={calcGrowth} mesAnteriorLabel={mesAnteriorLabel} />
                  <MetricaRow label="Engajamento" prev={metricaAnterior?.engajamento_percent} curr={metricaAtual?.engajamento_percent} format={(v) => v == null ? '—' : `${Number(v).toFixed(2)}%`} growth={calcGrowth} mesAnteriorLabel={mesAnteriorLabel} />
                  <MetricaRow label="Alcance" prev={metricaAnterior?.alcance} curr={metricaAtual?.alcance} format={formatNum} growth={calcGrowth} mesAnteriorLabel={mesAnteriorLabel} />
                  <MetricaRow label="Visualizações" prev={metricaAnterior?.visualizacoes} curr={metricaAtual?.visualizacoes} format={formatNum} growth={calcGrowth} mesAnteriorLabel={mesAnteriorLabel} />
                </div>

                {metricaAtual?.observacoes && (
                  <div
                    className="mt-6 px-5 py-4 border-l-2 italic text-[15px] leading-relaxed"
                    style={{ borderColor: '#c9a96e', color: '#5a6e84' }}
                  >
                    {metricaAtual.observacoes}
                  </div>
                )}
              </section>

              {/* ENTREGAS */}
              <section>
                <SectionHeader number="03" label="Entregas Realizadas" />

                {entregas.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Nenhuma demanda registrada para este cliente no mês.</p>
                ) : (
                  <div className="space-y-0">
                    {entregas.map((t, i) => {
                      const min = minutosPorTicket.get(t.id) ?? 0
                      const concluido = t.status === 'concluido'
                      return (
                        <div
                          key={t.id}
                          className={clsx(
                            'flex items-baseline gap-4 py-3',
                            i !== entregas.length - 1 && 'border-b border-slate-100'
                          )}
                        >
                          <span
                            className="text-[10px] font-bold tracking-[0.15em] uppercase w-12 flex-shrink-0 tabular-nums"
                            style={{ color: '#c9a96e' }}
                          >
                            {format(new Date(t.created_at), "d 'mai'", { locale: ptBR }).replace(/mai$/, format(new Date(t.created_at), 'MMM', { locale: ptBR }))}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-medium leading-tight" style={{ color: '#2a3340' }}>
                              {t.title}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {REQUEST_TYPE_LABELS[t.request_type]}
                              {min > 0 && ` · ${formatMinutos(min)}`}
                            </p>
                          </div>
                          <span
                            className={clsx(
                              'text-[10px] font-bold tracking-[0.15em] uppercase flex-shrink-0',
                              concluido ? 'text-emerald-600' : 'text-amber-500'
                            )}
                          >
                            {concluido ? '✓ Entregue' : '· em curso'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* ===== RODAPÉ ===== */}
            <footer
              className="px-8 md:px-14 py-8 text-center border-t"
              style={{ borderColor: '#eef0f3', background: '#fafbfc' }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="h-px w-12" style={{ background: '#c9a96e' }} />
                <Image
                  src="/logo-symbol.png"
                  alt=""
                  width={20}
                  height={20}
                  style={{ filter: 'invert(60%) sepia(28%) saturate(488%) hue-rotate(2deg) brightness(91%) contrast(90%)' }}
                />
                <div className="h-px w-12" style={{ background: '#c9a96e' }} />
              </div>
              <p className="text-[11px] font-bold tracking-[0.22em] uppercase" style={{ color: '#2a3340' }}>
                Gabriel Moraes <span style={{ color: '#c9a96e' }}>&amp;</span> Co
              </p>
              <p className="text-[9px] tracking-[0.18em] text-slate-400 uppercase mt-1">
                Próximo relatório · {format(addMonths(mes, 1), 'MM/yyyy')}
              </p>
            </footer>
          </article>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .report-document { padding: 0 !important; max-width: 100% !important; }
          .report-paper { box-shadow: none !important; border-radius: 0 !important; }
          /* Garante que as cores de fundo apareçam no PDF */
          .report-paper, .report-paper * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </>
  )
}

// ============ Subcomponentes ============

function MetricaInput({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type: 'number' | 'decimal' }) {
  return (
    <div>
      <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400 block mb-1.5">{label}</label>
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

function HeaderStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-[0.22em] uppercase text-white/40 mb-1.5">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-white leading-none tabular-nums">{value}</p>
      {sub && <p className="text-[10px] tracking-wider text-white/40 mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-6">
      <span
        className="text-[10px] font-bold tracking-[0.22em] uppercase tabular-nums"
        style={{ color: '#c9a96e' }}
      >
        {number}
      </span>
      <div className="h-px flex-1" style={{ background: '#e8ebf0' }} />
      <h2
        className="text-[11px] font-bold tracking-[0.22em] uppercase"
        style={{ color: '#2a3340' }}
      >
        {label}
      </h2>
    </div>
  )
}

function MetricaRow({
  label, prev, curr, format: fmt, growth, mesAnteriorLabel,
}: {
  label: string
  prev: number | null | undefined
  curr: number | null | undefined
  format: (v: number | null | undefined) => string
  growth: (a: number | null | undefined, b: number | null | undefined) => { pct: number; isPositive: boolean; arrow: string } | null
  mesAnteriorLabel: string
}) {
  const g = growth(curr, prev)
  return (
    <div
      className="flex items-end justify-between gap-4 py-3 border-b"
      style={{ borderColor: '#f0f2f5' }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: '#2a3340' }}>
          {fmt(curr)}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[9px] tracking-wider text-slate-300 uppercase mb-1 capitalize">
          vs {mesAnteriorLabel}: <span className="tabular-nums">{fmt(prev)}</span>
        </p>
        {g ? (
          <span
            className={clsx(
              'inline-flex items-center gap-1 text-xs font-bold tabular-nums px-2 py-1 rounded-md',
              g.isPositive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600'
            )}
          >
            {g.arrow} {Math.abs(g.pct).toFixed(1)}%
          </span>
        ) : (
          <span className="text-xs text-slate-300 tabular-nums">—</span>
        )}
      </div>
    </div>
  )
}
