'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'
import type { Proposta, PropostaStatus } from '@/types'
import { PROPOSTA_STATUS_LABELS } from '@/types'

type AbaComercial = 'pipeline' | 'propostas' | 'parceiros'

export type ParceiroStatus = 'novo' | 'aprovado' | 'ativo' | 'inativo' | 'rejeitado'

export interface Parceiro {
  id: string
  created_at: string
  nome: string
  email: string
  whatsapp: string
  cidade: string | null
  como: string | null
  status: ParceiroStatus
  observacoes_internas: string | null
}

const PARCEIRO_STATUS_LABELS: Record<ParceiroStatus, string> = {
  novo: 'Novo',
  aprovado: 'Aprovado',
  ativo: 'Ativo',
  inativo: 'Inativo',
  rejeitado: 'Rejeitado',
}

const PARCEIRO_STATUS_COLORS: Record<ParceiroStatus, string> = {
  novo: 'bg-blue-100 text-blue-700',
  aprovado: 'bg-amber-100 text-amber-700',
  ativo: 'bg-green-100 text-green-700',
  inativo: 'bg-slate-100 text-slate-500',
  rejeitado: 'bg-red-100 text-red-700',
}

const COMO_LABELS: Record<string, string> = {
  rede_pessoal: 'Rede de contatos pessoal',
  redes_sociais: 'Redes sociais / conteúdo',
  consultor: 'Consultor de negócios',
  agencia: 'Agência / profissional de marketing',
  outro: 'Outro',
}

const PROPOSTA_STATUS_DOTS: Record<PropostaStatus, string> = {
  rascunho: 'bg-slate-400',
  enviada: 'bg-blue-500',
  aceita: 'bg-green-500',
  recusada: 'bg-red-500',
  expirada: 'bg-amber-500',
}

const PROPOSTA_STATUS_BG: Record<PropostaStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-100 text-blue-700',
  aceita: 'bg-green-100 text-green-700',
  recusada: 'bg-red-100 text-red-700',
  expirada: 'bg-amber-100 text-amber-700',
}

export type LeadStatus = 'contato' | 'proposta' | 'negociacao' | 'fechado' | 'perdido'
export type LeadCanal = 'whatsapp' | 'pessoal' | 'indicacao' | 'outro'

export interface Lead {
  id: string
  created_at: string
  nome: string
  empresa: string | null
  telefone: string | null
  canal: LeadCanal
  valor_estimado: number | null
  anotacoes: string | null
  status: LeadStatus
  convertido_em: string | null
  ticket_id: string | null
}

const COLUMNS: { id: LeadStatus; label: string; color: string; bg: string }[] = [
  { id: 'contato', label: 'Contato', color: 'text-blue-700', bg: 'bg-blue-50' },
  { id: 'proposta', label: 'Proposta', color: 'text-amber-700', bg: 'bg-amber-50' },
  { id: 'negociacao', label: 'Negociação', color: 'text-purple-700', bg: 'bg-purple-50' },
  { id: 'fechado', label: 'Fechado', color: 'text-green-700', bg: 'bg-green-50' },
  { id: 'perdido', label: 'Perdido', color: 'text-slate-500', bg: 'bg-slate-100' },
]

const CANAL_LABELS: Record<LeadCanal, string> = {
  whatsapp: 'WhatsApp',
  pessoal: 'Pessoal',
  indicacao: 'Indicação',
  outro: 'Outro',
}

const CANAL_COLORS: Record<LeadCanal, string> = {
  whatsapp: 'bg-green-100 text-green-700',
  pessoal: 'bg-blue-100 text-blue-700',
  indicacao: 'bg-violet-100 text-violet-700',
  outro: 'bg-slate-100 text-slate-600',
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface NovoLeadForm {
  nome: string
  empresa: string
  telefone: string
  canal: LeadCanal
  valor_estimado: string
}

function LeadCard({ lead, index }: { lead: Lead; index: number }) {
  const router = useRouter()

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => router.push(`/admin/lead/${lead.id}`)}
          className={clsx(
            'bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all',
            snapshot.isDragging && 'shadow-xl rotate-1 scale-105'
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', CANAL_COLORS[lead.canal])}>
              {CANAL_LABELS[lead.canal]}
            </span>
            {lead.convertido_em && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                ✓ Convertido
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-slate-800 mb-0.5">{lead.nome}</p>
          {lead.empresa && <p className="text-xs text-slate-400 mb-2">{lead.empresa}</p>}

          {lead.anotacoes && (
            <p className="text-xs text-slate-400 italic line-clamp-2 mb-2">"{lead.anotacoes}"</p>
          )}

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-300">
              {format(new Date(lead.created_at), 'd MMM', { locale: ptBR })}
            </p>
            {lead.valor_estimado != null && (
              <span className="text-xs font-semibold text-slate-600">
                {formatBRL(lead.valor_estimado)}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}

function ComercialContent() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NovoLeadForm>({ nome: '', empresa: '', telefone: '', canal: 'pessoal', valor_estimado: '' })
  const [filterStatus, setFilterStatus] = useState<PropostaStatus | 'todas'>('todas')
  const router = useRouter()
  const search = useSearchParams()
  const tabParam = search.get('tab')
  const aba: AbaComercial = tabParam === 'propostas' ? 'propostas' : tabParam === 'parceiros' ? 'parceiros' : 'pipeline'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    Promise.all([
      api('/api/leads').then(r => r.json()),
      api('/api/propostas').then(r => r.json()),
      api('/api/parceiros').then(r => r.json()),
    ]).then(([ls, ps, prs]) => {
      setLeads(ls)
      setPropostas(ps)
      setParceiros(prs)
      setLoading(false)
    })
  }, [router])

  async function atualizarParceiro(id: string, body: Record<string, unknown>) {
    const res = await api(`/api/parceiros/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const atualizado = await res.json()
      setParceiros(prev => prev.map(p => p.id === id ? atualizado : p))
    }
  }

  function setAba(novo: AbaComercial) {
    const params = new URLSearchParams(search.toString())
    if (novo !== 'pipeline') params.set('tab', novo)
    else params.delete('tab')
    router.replace(`/admin/comercial${params.toString() ? '?' + params.toString() : ''}`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const leadId = result.draggableId
    const newStatus = result.destination.droppableId as LeadStatus
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    await api(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body: Record<string, unknown> = {
      nome: form.nome,
      canal: form.canal,
      status: 'contato',
    }
    if (form.empresa) body.empresa = form.empresa
    if (form.telefone) body.telefone = form.telefone
    if (form.valor_estimado) body.valor_estimado = parseFloat(form.valor_estimado.replace(',', '.'))

    const res = await api('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const novo = await res.json()
    setLeads(prev => [novo, ...prev])
    setForm({ nome: '', empresa: '', telefone: '', canal: 'pessoal', valor_estimado: '' })
    setShowForm(false)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  const totalEstimado = leads
    .filter(l => l.status !== 'perdido' && l.valor_estimado)
    .reduce((s, l) => s + (l.valor_estimado ?? 0), 0)

  const propostasPipeline = propostas.filter(p => p.status === 'enviada' && p.valor).reduce((s, p) => s + Number(p.valor), 0)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} extra={
        aba === 'pipeline' ? (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg bg-[#C5A880] text-white hover:bg-[#b39470] transition-colors"
          >
            + Novo Lead
          </button>
        ) : (
          <button
            onClick={() => router.push('/admin/proposta/nova')}
            className="text-sm font-medium px-3 py-1.5 rounded-lg bg-[#C5A880] text-white hover:bg-[#b39470] transition-colors"
          >
            + Nova Proposta
          </button>
        )
      } />

      {/* TABS */}
      <div className="px-4 md:px-6 pt-3 md:pt-4 pb-0 border-b border-slate-100">
        <div className="flex gap-1">
          <button
            onClick={() => setAba('pipeline')}
            className={clsx(
              'px-4 md:px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              aba === 'pipeline' ? 'text-slate-900 border-[#C5A880]' : 'text-slate-400 border-transparent hover:text-slate-600'
            )}
          >
            Pipeline
            <span className="ml-2 text-[10px] tabular-nums">{leads.filter(l => l.status !== 'perdido' && !l.convertido_em).length}</span>
          </button>
          <button
            onClick={() => setAba('propostas')}
            className={clsx(
              'px-4 md:px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              aba === 'propostas' ? 'text-slate-900 border-[#C5A880]' : 'text-slate-400 border-transparent hover:text-slate-600'
            )}
          >
            Propostas
            <span className="ml-2 text-[10px] tabular-nums">{propostas.length}</span>
          </button>
          <button
            onClick={() => setAba('parceiros')}
            className={clsx(
              'px-4 md:px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              aba === 'parceiros' ? 'text-slate-900 border-[#C5A880]' : 'text-slate-400 border-transparent hover:text-slate-600'
            )}
          >
            Parceiros
            {parceiros.filter(p => p.status === 'novo').length > 0 && (
              <span className="ml-2 text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {parceiros.filter(p => p.status === 'novo').length} novo{parceiros.filter(p => p.status === 'novo').length > 1 ? 's' : ''}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Pipeline value bar */}
      <div className="px-4 md:px-6 py-2.5 md:py-3 border-b border-slate-100 flex items-center gap-4 md:gap-6 flex-wrap">
        {aba === 'pipeline' ? (
          <>
            <p className="text-[11px] md:text-xs text-slate-400">
              Pipeline: <span className="font-semibold text-slate-700">{formatBRL(totalEstimado)}</span>
            </p>
            <p className="text-[11px] md:text-xs text-slate-400">
              {leads.filter(l => l.status !== 'perdido' && !l.convertido_em).length} leads ativos
            </p>
          </>
        ) : aba === 'propostas' ? (
          <>
            <p className="text-[11px] md:text-xs text-slate-400">
              Em negociação: <span className="font-semibold text-amber-600">{formatBRL(propostasPipeline)}</span>
            </p>
            <p className="text-[11px] md:text-xs text-slate-400">
              {propostas.filter(p => p.status === 'aceita').length} aceitas · {propostas.filter(p => p.status === 'enviada').length} enviadas
            </p>
          </>
        ) : (
          <>
            <p className="text-[11px] md:text-xs text-slate-400">
              {parceiros.length} cadastrados
            </p>
            <p className="text-[11px] md:text-xs text-slate-400">
              {parceiros.filter(p => p.status === 'ativo').length} ativos
            </p>
            <button
              onClick={() => window.open('/parceiros.html', '_blank')}
              className="text-[11px] md:text-xs text-[#C5A880] hover:underline ml-auto"
            >
              ↗ Ver página pública
            </button>
          </>
        )}
      </div>

      {/* CONTEÚDO POR ABA */}
      {aba === 'pipeline' ? (
        <div className="flex-1 overflow-x-auto p-4 md:p-6">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 md:gap-4 min-w-max">
              {COLUMNS.map(col => {
                const colLeads = leads.filter(l => l.status === col.id)
                return (
                  <div key={col.id} className="w-64 md:w-72 flex flex-col">
                    <div className={clsx('flex items-center justify-between px-3 py-2 rounded-xl mb-3', col.bg)}>
                      <span className={clsx('text-sm font-semibold', col.color)}>{col.label}</span>
                      <span className={clsx('text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center bg-white', col.color)}>
                        {colLeads.length}
                      </span>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={clsx(
                            'flex-1 space-y-3 min-h-[200px] rounded-2xl p-2 transition-colors',
                            snapshot.isDraggingOver && 'bg-indigo-50/50'
                          )}
                        >
                          {colLeads.map((lead, i) => (
                            <LeadCard key={lead.id} lead={lead} index={i} />
                          ))}
                          {provided.placeholder}
                          {colLeads.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex items-center justify-center h-24 text-slate-300 text-xs border-2 border-dashed border-slate-200 rounded-xl">
                              Nenhum lead
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        </div>
      ) : aba === 'propostas' ? (
        <PropostasView
          propostas={propostas}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          onOpen={(id) => router.push(`/admin/proposta/${id}`)}
          onNova={() => router.push('/admin/proposta/nova')}
        />
      ) : (
        <ParceirosView parceiros={parceiros} onUpdate={atualizarParceiro} />
      )}

      {/* Modal novo lead */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Novo Lead</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Nome *</label>
                <input
                  required
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  placeholder="Nome do contato"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Empresa</label>
                  <input
                    value={form.empresa}
                    onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">WhatsApp</label>
                  <input
                    value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Canal</label>
                  <select
                    value={form.canal}
                    onChange={e => setForm(f => ({ ...f, canal: e.target.value as LeadCanal }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                  >
                    <option value="pessoal">Pessoal</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="indicacao">Indicação</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Valor estimado</label>
                  <input
                    value={form.valor_estimado}
                    onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 text-sm py-2 rounded-lg bg-[#C5A880] text-white hover:bg-[#b39470] transition-colors disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Criar lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== Lista de Propostas (aba interna) =====
function PropostasView({
  propostas, filterStatus, setFilterStatus, onOpen, onNova,
}: {
  propostas: Proposta[]
  filterStatus: PropostaStatus | 'todas'
  setFilterStatus: (s: PropostaStatus | 'todas') => void
  onOpen: (id: string) => void
  onNova: () => void
}) {
  const filtered = useMemo(() => {
    if (filterStatus === 'todas') return propostas
    return propostas.filter(p => p.status === filterStatus)
  }, [propostas, filterStatus])

  return (
    <div className="flex-1 p-4 md:p-6 space-y-4 max-w-5xl mx-auto w-full">
      {/* Filtros */}
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
            <span className={clsx('w-1.5 h-1.5 rounded-full', PROPOSTA_STATUS_DOTS[s])} />
            {PROPOSTA_STATUS_LABELS[s]} ({propostas.filter(p => p.status === s).length})
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-400">
              Nenhuma proposta {filterStatus !== 'todas' ? PROPOSTA_STATUS_LABELS[filterStatus].toLowerCase() : ''}.
            </p>
            <button
              onClick={onNova}
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
                onClick={() => onOpen(p.id)}
                className="w-full text-left px-4 md:px-6 py-3 md:py-4 hover:bg-slate-50 transition-colors flex items-center gap-3 md:gap-4"
              >
                <span className={clsx('w-1 self-stretch rounded-full flex-shrink-0', PROPOSTA_STATUS_DOTS[p.status])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.titulo}</p>
                    <span className={clsx('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', PROPOSTA_STATUS_BG[p.status])}>
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
                  <p className="text-sm font-bold text-slate-800 tabular-nums">
                    {p.valor != null ? formatBRL(Number(p.valor)) : '—'}
                  </p>
                  <p className="text-[10px] text-slate-400">{p.modalidade === 'mensal' ? '/mês' : 'total'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== Lista de Parceiros (aba interna) =====
function ParceirosView({
  parceiros, onUpdate,
}: {
  parceiros: Parceiro[]
  onUpdate: (id: string, body: Record<string, unknown>) => void
}) {
  const [obsDraft, setObsDraft] = useState<Record<string, string>>({})

  if (parceiros.length === 0) {
    return (
      <div className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-slate-400">Nenhum cadastro de parceiro ainda.</p>
          <p className="text-xs text-slate-300 mt-1">Cadastros feitos em /parceiros.html aparecem aqui automaticamente.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 md:p-6 space-y-3 max-w-5xl mx-auto w-full">
      {parceiros.map(p => (
        <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{p.nome}</p>
                <span className={clsx('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', PARCEIRO_STATUS_COLORS[p.status])}>
                  {PARCEIRO_STATUS_LABELS[p.status]}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[12px] text-slate-500 flex-wrap">
                <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>
                <span className="text-slate-300">·</span>
                <a href={`https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="hover:underline text-green-600">
                  {p.whatsapp}
                </a>
                {p.cidade && <><span className="text-slate-300">·</span><span>{p.cidade}</span></>}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                <span>{format(new Date(p.created_at), "d 'de' MMM yyyy", { locale: ptBR })}</span>
                {p.como && <><span className="text-slate-300">·</span><span>{COMO_LABELS[p.como] ?? p.como}</span></>}
              </div>
            </div>
            <select
              value={p.status}
              onChange={e => onUpdate(p.id, { status: e.target.value })}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white flex-shrink-0"
            >
              {(['novo', 'aprovado', 'ativo', 'inativo', 'rejeitado'] as ParceiroStatus[]).map(s => (
                <option key={s} value={s}>{PARCEIRO_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <textarea
              value={obsDraft[p.id] ?? p.observacoes_internas ?? ''}
              onChange={e => setObsDraft(d => ({ ...d, [p.id]: e.target.value }))}
              onBlur={e => {
                if (e.target.value !== (p.observacoes_internas ?? '')) {
                  onUpdate(p.id, { observacoes_internas: e.target.value.trim() || null })
                }
              }}
              placeholder="Observações internas (só você vê)..."
              rows={2}
              className="w-full text-xs border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none placeholder:text-slate-400"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ComercialPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Carregando...</div>}>
      <ComercialContent />
    </Suspense>
  )
}
