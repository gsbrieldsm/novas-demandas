'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { REQUEST_TYPE_LABELS } from '@/types'
import type { RequestType, TicketStatus, DocumentoCliente } from '@/types'

interface PortalTicket {
  id: string
  title: string
  description: string | null
  request_type: RequestType
  status: TicketStatus
  priority: string
  created_at: string
  where_used: string | null
  deadline: string | null
  purpose: string | null
  expected_result: string | null
  admin_notes: string | null
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  novo: 'Recebido',
  em_andamento: 'Em andamento',
  em_revisao: 'Em revisão',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

interface Metrica {
  mes: number
  ano: number
  seguidores: number | null
  engajamento_percent: number | null
  alcance: number | null
  visualizacoes: number | null
}

interface PortalData {
  cliente: { id: string; nome: string; logo_url: string | null; escopo_mensal: string | null }
  tickets: PortalTicket[]
  documentos: DocumentoCliente[]
  metricaAtual: Metrica | null
  metricaAnterior: Metrica | null
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatNum(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR')
}

function Delta({ atual, anterior }: { atual: number | null; anterior: number | null | undefined }) {
  if (atual == null || anterior == null || anterior === 0) return null
  const diff = atual - anterior
  if (diff === 0) return null
  const pct = Math.round((diff / anterior) * 100)
  const positivo = diff > 0
  return (
    <span className={clsx('text-[11px] font-bold ml-1.5', positivo ? 'text-green-400' : 'text-red-400')}>
      {positivo ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

const COLUNAS: { id: TicketStatus; label: string }[] = [
  { id: 'novo', label: 'Recebido' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'em_revisao', label: 'Em revisão' },
  { id: 'concluido', label: 'Concluído' },
]

export default function PortalPage() {
  const router = useRouter()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<'andamento' | 'documentos'>('andamento')
  const [ticketSelecionado, setTicketSelecionado] = useState<PortalTicket | null>(null)

  useEffect(() => {
    fetch('/api/portal/me')
      .then(async r => {
        if (!r.ok) { router.push('/portal/login'); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => router.push('/portal/login'))
  }, [router])

  async function handleLogout() {
    await fetch('/api/portal/logout', { method: 'POST' })
    router.push('/portal/login')
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c10' }}>
        <p className="text-white/50 text-sm">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* HEADER */}
      <header
        className="px-4 md:px-6 py-4 flex items-center justify-between"
        style={{ background: 'radial-gradient(ellipse 60% 150% at 95% 50%, #C5A880 0%, #6B4C28 40%, transparent 70%), #100E0B' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {data.cliente.logo_url && (
            <>
              <img src={data.cliente.logo_url} alt={data.cliente.nome} className="h-8 w-auto max-w-[100px] object-contain bg-white rounded-md p-1" />
              <span className="text-white/30 text-lg">×</span>
            </>
          )}
          <Image src="/logo-symbol.png" alt="GM&Co" width={28} height={28} style={{ filter: 'brightness(0) invert(1)' }} />
          <div className="min-w-0">
            <p className="text-white text-sm font-bold truncate">{data.cliente.nome}</p>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Portal do Cliente · Gabriel Moraes &amp; Co</p>
          </div>
        </div>
        <button onClick={handleLogout} className="text-white/60 hover:text-white text-xs flex-shrink-0">Sair</button>
      </header>

      {/* VISÃO GERAL — painel de impacto */}
      <div
        className="px-4 md:px-6 py-6"
        style={{ background: 'radial-gradient(ellipse 80% 150% at 95% 50%, #C5A880 0%, #6B4C28 40%, #1c1a18 80%), #100E0B' }}
      >
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">Visão Geral</p>
              <p className="text-sm text-white/80 mt-0.5">
                {data.metricaAtual ? `${MESES[data.metricaAtual.mes - 1]} de ${data.metricaAtual.ano}` : 'Acompanhamento ao vivo'}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> ao vivo
            </span>
          </div>

          {data.metricaAtual ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl p-4 bg-white/5 border border-white/10 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">Seguidores</p>
                <p className="text-2xl font-bold text-white leading-none">
                  {formatNum(data.metricaAtual.seguidores)}
                  <Delta atual={data.metricaAtual.seguidores} anterior={data.metricaAnterior?.seguidores} />
                </p>
              </div>
              <div className="rounded-xl p-4 bg-white/5 border border-white/10 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">Engajamento</p>
                <p className="text-2xl font-bold text-white leading-none">
                  {data.metricaAtual.engajamento_percent != null ? `${data.metricaAtual.engajamento_percent}%` : '—'}
                  <Delta atual={data.metricaAtual.engajamento_percent} anterior={data.metricaAnterior?.engajamento_percent} />
                </p>
              </div>
              <div className="rounded-xl p-4 bg-white/5 border border-white/10 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">Alcance</p>
                <p className="text-2xl font-bold text-white leading-none">
                  {formatNum(data.metricaAtual.alcance)}
                  <Delta atual={data.metricaAtual.alcance} anterior={data.metricaAnterior?.alcance} />
                </p>
              </div>
              <div className="rounded-xl p-4 bg-white/5 border border-white/10 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">Visualizações</p>
                <p className="text-2xl font-bold text-white leading-none">
                  {formatNum(data.metricaAtual.visualizacoes)}
                  <Delta atual={data.metricaAtual.visualizacoes} anterior={data.metricaAnterior?.visualizacoes} />
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/40 mb-5">Métricas ainda não registradas este mês.</p>
          )}

          {data.cliente.escopo_mensal && (
            <div className="rounded-xl p-4 bg-white/5 border border-white/10 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-white/50 mb-2 font-bold">Escopo do trabalho</p>
              <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">{data.cliente.escopo_mensal}</p>
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="px-4 md:px-6 pt-4 border-b border-slate-200 bg-white">
        <div className="flex gap-1 max-w-5xl mx-auto">
          <button
            onClick={() => setAba('andamento')}
            className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', aba === 'andamento' ? 'text-slate-900 border-[#C5A880]' : 'text-slate-400 border-transparent')}
          >
            Andamento dos trabalhos
          </button>
          <button
            onClick={() => setAba('documentos')}
            className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', aba === 'documentos' ? 'text-slate-900 border-[#C5A880]' : 'text-slate-400 border-transparent')}
          >
            Documentos {data.documentos.length > 0 && `(${data.documentos.length})`}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 md:px-6 py-6 space-y-6">
        {aba === 'andamento' ? (
          <div className="overflow-x-auto">
            <div className="flex gap-3 min-w-max md:min-w-0 md:grid md:grid-cols-4">
              {COLUNAS.map(col => {
                const itens = data.tickets.filter(t => t.status === col.id)
                return (
                  <div key={col.id} className="w-64 md:w-auto flex-shrink-0">
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl mb-3 bg-white border border-slate-100">
                      <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                      <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">{itens.length}</span>
                    </div>
                    <div className="space-y-2 min-h-[80px]">
                      {itens.length === 0 ? (
                        <div className="flex items-center justify-center h-16 text-slate-300 text-xs border-2 border-dashed border-slate-200 rounded-xl">—</div>
                      ) : itens.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTicketSelecionado(t)}
                          className="w-full text-left bg-white rounded-xl p-3 border border-slate-100 shadow-sm hover:border-[#C5A880] hover:shadow-md transition-all"
                        >
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{REQUEST_TYPE_LABELS[t.request_type]}</span>
                          <p className="text-sm font-medium text-slate-800 mt-2">{t.title}</p>
                          {t.deadline && (
                            <p className="text-[11px] text-slate-400 mt-1">prazo {format(new Date(t.deadline + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {data.documentos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                <p className="text-sm text-slate-400">Nenhum documento disponível ainda.</p>
              </div>
            ) : data.documentos.map(doc => (
              <article key={doc.id} className="bg-white shadow-sm border border-slate-100 rounded-2xl overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100">
                  <h1 className="text-xl font-bold text-slate-900">{doc.titulo}</h1>
                </div>
                <div className="px-8 py-8 space-y-10">
                  {doc.blocos.map((bloco, i) => (
                    <section key={bloco.id}>
                      <div className="flex items-baseline gap-3 mb-4">
                        <span className="text-[10px] font-bold tracking-[0.22em] uppercase tabular-nums" style={{ color: '#c9a96e' }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="h-px flex-1" style={{ background: '#e8ebf0' }} />
                        <h2 className="text-[11px] font-bold tracking-[0.22em] uppercase text-slate-700">{bloco.titulo}</h2>
                      </div>
                      {bloco.conteudo ? (
                        <div className="text-[15px] leading-[1.85] whitespace-pre-wrap text-slate-700">{bloco.conteudo}</div>
                      ) : (
                        <p className="text-sm text-slate-300 italic">Em construção...</p>
                      )}
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE DETALHE DA DEMANDA */}
      {ticketSelecionado && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setTicketSelecionado(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{REQUEST_TYPE_LABELS[ticketSelecionado.request_type]}</span>
                <h2 className="text-base font-bold text-slate-900 mt-2">{ticketSelecionado.title}</h2>
              </div>
              <button onClick={() => setTicketSelecionado(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none flex-shrink-0">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">{STATUS_LABELS[ticketSelecionado.status]}</span>
                {ticketSelecionado.deadline && (
                  <span className="text-slate-400">prazo {format(new Date(ticketSelecionado.deadline + 'T12:00:00'), "d 'de' MMM 'de' yyyy", { locale: ptBR })}</span>
                )}
              </div>

              {ticketSelecionado.description && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Descrição</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticketSelecionado.description}</p>
                </div>
              )}
              {ticketSelecionado.where_used && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Onde será usado</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticketSelecionado.where_used}</p>
                </div>
              )}
              {ticketSelecionado.purpose && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Finalidade</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticketSelecionado.purpose}</p>
                </div>
              )}
              {ticketSelecionado.expected_result && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Resultado esperado</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticketSelecionado.expected_result}</p>
                </div>
              )}
              {ticketSelecionado.admin_notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Notas do Gabriel</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{ticketSelecionado.admin_notes}</p>
                </div>
              )}
              {!ticketSelecionado.description && !ticketSelecionado.where_used && !ticketSelecionado.purpose && !ticketSelecionado.expected_result && !ticketSelecionado.admin_notes && (
                <p className="text-sm text-slate-400 italic">Sem detalhes adicionais por aqui ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
