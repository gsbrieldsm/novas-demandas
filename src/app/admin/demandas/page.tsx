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
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RequestType | 'todos'>('todos')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    api('/api/tickets').then(r => r.json()).then(data => {
      setTickets(data)
      setLoading(false)
    })
  }, [router])

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
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as RequestType | 'todos')}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="todos">Todos os tipos</option>
          {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
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

    </div>
  )
}
