'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import type { Ticket, TicketStatus, Priority, RequestType } from '@/types'
import { REQUEST_TYPE_LABELS, PRIORITY_LABELS } from '@/types'
import { AdminNav } from '@/components/AdminNav'

interface ClienteFixo {
  id: string
  nome: string
  email: string | null
  valor_mensal: number
  ativo: boolean
}

const COLUMNS: { id: TicketStatus; label: string; color: string; bg: string }[] = [
  { id: 'novo', label: 'Novo', color: 'text-blue-700', bg: 'bg-blue-50' },
  { id: 'em_andamento', label: 'Em Andamento', color: 'text-amber-700', bg: 'bg-amber-50' },
  { id: 'em_revisao', label: 'Em Revisão', color: 'text-purple-700', bg: 'bg-purple-50' },
  { id: 'concluido', label: 'Concluído', color: 'text-green-700', bg: 'bg-green-50' },
]

const PRIORITY_COLORS: Record<Priority, string> = {
  normal: 'bg-slate-100 text-slate-600',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
}

const TYPE_COLORS: Record<RequestType, string> = {
  estrategia: 'bg-indigo-100 text-indigo-700',
  gravacao: 'bg-pink-100 text-pink-700',
  conteudo: 'bg-cyan-100 text-cyan-700',
  arte: 'bg-violet-100 text-violet-700',
  edicao: 'bg-teal-100 text-teal-700',
  outro: 'bg-slate-100 text-slate-600',
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function TicketCard({ ticket, index }: { ticket: Ticket; index: number }) {
  const router = useRouter()

  return (
    <Draggable draggableId={ticket.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => router.push(`/admin/chamado/${ticket.id}`)}
          className={clsx(
            'bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all',
            snapshot.isDragging && 'shadow-xl rotate-1 scale-105'
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', TYPE_COLORS[ticket.request_type])}>
              {REQUEST_TYPE_LABELS[ticket.request_type]}
            </span>
            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', PRIORITY_COLORS[ticket.priority])}>
              {PRIORITY_LABELS[ticket.priority]}
            </span>
          </div>

          <p className="text-sm font-semibold text-slate-800 mb-1 line-clamp-2">{ticket.title}</p>
          <p className="text-xs text-slate-500 mb-3">{ticket.client_name}{ticket.company ? ` · ${ticket.company}` : ''}</p>

          {ticket.purpose && (
            <p className="text-xs text-slate-400 italic line-clamp-2 mb-3">"{ticket.purpose}"</p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {format(new Date(ticket.created_at), 'd MMM', { locale: ptBR })}
            </p>
            <div className="flex items-center gap-2">
              {ticket.deadline && (
                <p className="text-xs font-medium text-slate-500">
                  Prazo: {format(new Date(ticket.deadline), 'd MMM', { locale: ptBR })}
                </p>
              )}
              {ticket.is_fixed_client && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Fixo</span>
              )}
              {!ticket.is_fixed_client && ticket.budget_value != null && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {formatBRL(ticket.budget_value)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}

export default function DemandasPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientesFixos, setClientesFixos] = useState<ClienteFixo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RequestType | 'todos'>('todos')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    modo: 'avulso' as 'avulso' | 'fixo',
    cliente_fixo_id: '',
    client_name: '',
    company: '',
    title: '',
    description: '',
    request_type: 'estrategia' as RequestType,
    priority: 'normal' as Priority,
    deadline: '',
    budget_value: '',
    where_used: '',
    purpose: '',
  })
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    Promise.all([
      api('/api/tickets').then(r => r.json()),
      api('/api/clientes-fixos').then(r => r.json()),
    ]).then(([t, c]) => {
      setTickets(t)
      setClientesFixos(c)
      setLoading(false)
    })
  }, [router])

  async function handleCreate() {
    if (!form.title.trim()) return
    if (form.modo === 'fixo' && !form.cliente_fixo_id) return
    if (form.modo === 'avulso' && !form.client_name.trim()) return

    setSaving(true)
    const cf = clientesFixos.find(c => c.id === form.cliente_fixo_id)

    const body: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      request_type: form.request_type,
      priority: form.priority,
      status: 'novo',
      deadline: form.deadline || null,
      where_used: form.where_used.trim() || null,
      purpose: form.purpose.trim() || null,
      client_email: '',
      pagamento_recebido: false,
      chat_transcript: [],
    }

    if (form.modo === 'fixo' && cf) {
      body.is_fixed_client = true
      body.cliente_fixo_id = cf.id
      body.client_name = cf.nome
      body.company = null
      body.budget_value = null
    } else {
      body.is_fixed_client = false
      body.cliente_fixo_id = null
      body.client_name = form.client_name.trim()
      body.company = form.company.trim() || null
      body.budget_value = form.budget_value ? parseFloat(form.budget_value.replace(',', '.')) : null
    }

    const res = await api('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const novo = await res.json()
      setTickets(prev => [novo, ...prev])
      setShowForm(false)
      setForm({
        modo: 'avulso', cliente_fixo_id: '', client_name: '', company: '',
        title: '', description: '', request_type: 'estrategia',
        priority: 'normal', deadline: '', budget_value: '',
        where_used: '', purpose: '',
      })
    }
    setSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const ticketId = result.draggableId
    const newStatus = result.destination.droppableId as TicketStatus
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t))
    await api(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  const filtered = tickets.filter(t => filter === 'todos' || t.request_type === filter)

  const countByStatus = useCallback(
    (status: TicketStatus) => filtered.filter(t => t.status === status).length,
    [filtered]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} extra={
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as RequestType | 'todos')}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
          >
            <option value="todos">Todos os tipos</option>
            {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity"
            style={{ background: '#C5A880' }}
          >
            + Nova demanda
          </button>
        </div>
      } />

      <div className="flex-1 overflow-x-auto p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map(col => {
              const colTickets = filtered.filter(t => t.status === col.id)
              return (
                <div key={col.id} className="w-72 flex flex-col">
                  <div className={clsx('flex items-center justify-between px-3 py-2 rounded-xl mb-3', col.bg)}>
                    <span className={clsx('text-sm font-semibold', col.color)}>{col.label}</span>
                    <span className={clsx('text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center bg-white', col.color)}>
                      {countByStatus(col.id)}
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
                        {colTickets.map((ticket, i) => (
                          <TicketCard key={ticket.id} ticket={ticket} index={i} />
                        ))}
                        {provided.placeholder}
                        {colTickets.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex items-center justify-center h-24 text-slate-300 text-xs border-2 border-dashed border-slate-200 rounded-xl">
                            Nenhum chamado
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

      {/* Modal Nova Demanda */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Nova demanda</h2>
                <p className="text-xs text-slate-400">Criação manual (sem IA)</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Modo: Avulso ou Fixo */}
              <div className="flex rounded-xl overflow-hidden border border-slate-200 text-sm">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, modo: 'avulso' }))}
                  className={clsx(
                    'flex-1 py-2 font-medium transition-colors',
                    form.modo === 'avulso' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                  )}
                >
                  Avulso
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, modo: 'fixo' }))}
                  className={clsx(
                    'flex-1 py-2 font-medium transition-colors',
                    form.modo === 'fixo' ? 'bg-amber-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                  )}
                >
                  Cliente Fixo
                </button>
              </div>

              {/* Cliente */}
              {form.modo === 'fixo' ? (
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Cliente fixo *</label>
                  <select
                    value={form.cliente_fixo_id}
                    onChange={e => setForm(f => ({ ...f, cliente_fixo_id: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                  >
                    <option value="">— Selecione —</option>
                    {clientesFixos.filter(c => c.ativo).map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Cliente *</label>
                    <input
                      value={form.client_name}
                      onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                      placeholder="Nome"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Empresa</label>
                    <input
                      value={form.company}
                      onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                      placeholder="Opcional"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                    />
                  </div>
                </div>
              )}

              {/* Título */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Título *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Gravação institucional na praia"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                />
              </div>

              {/* Tipo + Prioridade + Prazo */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Tipo</label>
                  <select
                    value={form.request_type}
                    onChange={e => setForm(f => ({ ...f, request_type: e.target.value as RequestType }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                  >
                    {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Prioridade</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Prazo</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                  />
                </div>
              </div>

              {/* Valor (só avulso) */}
              {form.modo === 'avulso' && (
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Valor (R$)</label>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#C5A880]">
                    <span className="px-3 text-sm text-slate-400 bg-slate-100 border-r border-slate-200 py-2">R$</span>
                    <input
                      value={form.budget_value}
                      onChange={e => setForm(f => ({ ...f, budget_value: e.target.value }))}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="flex-1 text-sm px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Onde + Propósito */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Onde será usado</label>
                  <input
                    value={form.where_used}
                    onChange={e => setForm(f => ({ ...f, where_used: e.target.value }))}
                    placeholder="Instagram, site..."
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Propósito</label>
                  <input
                    value={form.purpose}
                    onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                    placeholder="Objetivo estratégico"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Detalhes da demanda (opcional)"
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.title.trim() || (form.modo === 'fixo' ? !form.cliente_fixo_id : !form.client_name.trim())}
                  className="flex-1 text-sm py-2 rounded-lg text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ background: '#C5A880' }}
                >
                  {saving ? 'Criando...' : 'Criar demanda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
