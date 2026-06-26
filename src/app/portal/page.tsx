'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { REQUEST_TYPE_LABELS } from '@/types'
import type { RequestType, TicketStatus, DocumentoCliente, ChatMessage } from '@/types'

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
  nota_cliente: string | null
  nota_cliente_em: string | null
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
  const [notaDraft, setNotaDraft] = useState('')
  const [salvandoNota, setSalvandoNota] = useState(false)
  const [notaSalva, setNotaSalva] = useState(false)

  const [showNovaDemanda, setShowNovaDemanda] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatStarted, setChatStarted] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [novoTicketId, setNovoTicketId] = useState<string | null>(null)

  function carregarPortal() {
    return fetch('/api/portal/me')
      .then(async r => {
        if (!r.ok) { router.push('/portal/login'); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => router.push('/portal/login'))
  }

  useEffect(() => {
    carregarPortal()
  }, [router])

  async function handleLogout() {
    await fetch('/api/portal/logout', { method: 'POST' })
    router.push('/portal/login')
  }

  function abrirTicket(t: PortalTicket) {
    setTicketSelecionado(t)
    setNotaDraft(t.nota_cliente ?? '')
    setNotaSalva(false)
  }

  async function salvarNota() {
    if (!ticketSelecionado || !data) return
    setSalvandoNota(true)
    const res = await fetch(`/api/portal/tickets/${ticketSelecionado.id}/nota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nota: notaDraft }),
    })
    if (res.ok) {
      const agora = new Date().toISOString()
      const notaFinal = notaDraft.trim() || null
      setData(d => d && {
        ...d,
        tickets: d.tickets.map(t => t.id === ticketSelecionado.id ? { ...t, nota_cliente: notaFinal, nota_cliente_em: notaFinal ? agora : null } : t),
      })
      setTicketSelecionado(t => t && { ...t, nota_cliente: notaFinal, nota_cliente_em: notaFinal ? agora : null })
      setNotaSalva(true)
      setTimeout(() => setNotaSalva(false), 2000)
    }
    setSalvandoNota(false)
  }

  function abrirNovaDemanda() {
    setShowNovaDemanda(true)
    setChatMessages([])
    setChatStarted(false)
    setNovoTicketId(null)
    iniciarConversa()
  }

  async function iniciarConversa() {
    setChatStarted(true)
    await enviarParaIA([{ role: 'user', content: '__INIT__' }])
  }

  async function enviarParaIA(msgs: ChatMessage[]) {
    setChatLoading(true)
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    setChatMessages(prev => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/portal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value)

        const ticketMatch = accumulated.match(/\[TICKET_ID:([^\]]+)\]/)
        if (ticketMatch) setNovoTicketId(ticketMatch[1])

        setChatMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: accumulated }
          return updated
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setChatLoading(false)
    }
  }

  async function enviarMensagemChat() {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    const userMsg: ChatMessage = { role: 'user', content: text }
    const novasMensagens = [...chatMessages.filter(m => m.content.trim()), userMsg]
    setChatMessages(novasMensagens)
    setChatInput('')
    await enviarParaIA(novasMensagens)
  }

  function fecharNovaDemanda() {
    setShowNovaDemanda(false)
    if (novoTicketId) carregarPortal()
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
        <div className="flex items-center justify-between gap-2 max-w-5xl mx-auto flex-wrap">
          <div className="flex gap-1">
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
          <button
            onClick={abrirNovaDemanda}
            className="text-xs font-bold px-3.5 py-2 rounded-lg text-white mb-2 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #8B6840 100%)' }}
          >
            + Nova Demanda
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
                          onClick={() => abrirTicket(t)}
                          className="w-full text-left bg-white rounded-xl p-3 border border-slate-100 shadow-sm hover:border-[#C5A880] hover:shadow-md transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{REQUEST_TYPE_LABELS[t.request_type]}</span>
                            {t.nota_cliente && <span className="text-xs flex-shrink-0" title="Você deixou uma nota">💬</span>}
                          </div>
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

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sua nota — complemente essa demanda</p>
                <textarea
                  value={notaDraft}
                  onChange={e => setNotaDraft(e.target.value)}
                  rows={3}
                  placeholder="Escreva aqui qualquer informação que ajude o Gabriel — referências, ajustes, observações..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none placeholder:text-slate-400"
                />
                <div className="flex items-center justify-between mt-2">
                  {ticketSelecionado.nota_cliente_em && (
                    <p className="text-[11px] text-slate-400">
                      Salvo em {format(new Date(ticketSelecionado.nota_cliente_em), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                  <button
                    onClick={salvarNota}
                    disabled={salvandoNota}
                    className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 ml-auto"
                    style={{ background: '#C5A880' }}
                  >
                    {salvandoNota ? 'Salvando...' : notaSalva ? '✓ Salvo!' : 'Salvar nota'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA DEMANDA — chat com a IA */}
      {showNovaDemanda && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#100E0B] rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <div>
                <p className="text-white text-sm font-bold">Nova Demanda</p>
                <p className="text-white/40 text-[11px]">Conte o que você precisa — a equipe registra pra você</p>
              </div>
              <button onClick={fecharNovaDemanda} className="text-white/40 hover:text-white text-lg leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
              {chatMessages
                .filter(m => m.content !== '__INIT__')
                .map((m, i) => {
                  const conteudo = m.content.replace(/\[BRIEFING_COMPLETO\][\s\S]*/g, '').replace(/\[TICKET_ID:[^\]]+\]/g, '').trim()
                  if (!conteudo) return null
                  const isUser = m.role === 'user'
                  return (
                    <div key={i} className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
                      <div
                        className={clsx('max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap', isUser ? 'text-[#1C1A18] rounded-br-sm' : 'bg-white/10 text-white/90 rounded-bl-sm')}
                        style={isUser ? { background: '#C5A880' } : {}}
                      >
                        {conteudo}
                      </div>
                    </div>
                  )
                })}
              {chatLoading && chatMessages[chatMessages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#C5A880] animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}

              {novoTicketId && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center mt-4">
                  <p className="text-green-300 text-sm font-bold">✓ Demanda registrada!</p>
                  <p className="text-white/50 text-xs mt-1">Já aparece no seu quadro de andamento.</p>
                </div>
              )}
            </div>

            {!novoTicketId && (
              <div className="px-4 py-3 border-t border-white/10 flex items-end gap-2 flex-shrink-0">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagemChat() } }}
                  placeholder="Digite sua mensagem..."
                  rows={1}
                  disabled={chatLoading || !chatStarted}
                  className="flex-1 bg-white/5 text-white placeholder-white/25 border border-white/10 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none disabled:opacity-50"
                  style={{ minHeight: '40px', maxHeight: '100px' }}
                />
                <button
                  onClick={enviarMensagemChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[#1C1A18] disabled:opacity-30 flex-shrink-0"
                  style={{ background: '#C5A880' }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                </button>
              </div>
            )}
            {novoTicketId && (
              <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
                <button onClick={fecharNovaDemanda} className="w-full text-sm py-2.5 rounded-xl text-[#1C1A18] font-bold" style={{ background: '#C5A880' }}>
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
