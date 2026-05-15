'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'

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

export default function ComercialPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NovoLeadForm>({ nome: '', empresa: '', telefone: '', canal: 'pessoal', valor_estimado: '' })
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    fetch('/api/leads').then(r => r.json()).then(data => {
      setLeads(data)
      setLoading(false)
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const leadId = result.draggableId
    const newStatus = result.destination.droppableId as LeadStatus
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    await fetch(`/api/leads/${leadId}`, {
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

    const res = await fetch('/api/leads', {
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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} extra={
        <button
          onClick={() => setShowForm(true)}
          className="text-sm font-medium px-3 py-1.5 rounded-lg bg-[#C5A880] text-white hover:bg-[#b39470] transition-colors"
        >
          + Novo Lead
        </button>
      } />

      {/* Pipeline value bar */}
      <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-6">
        <p className="text-xs text-slate-400">
          Pipeline ativo: <span className="font-semibold text-slate-700">{formatBRL(totalEstimado)}</span>
        </p>
        <p className="text-xs text-slate-400">
          {leads.filter(l => l.status !== 'perdido' && !l.convertido_em).length} leads ativos
        </p>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map(col => {
              const colLeads = leads.filter(l => l.status === col.id)
              return (
                <div key={col.id} className="w-72 flex flex-col">
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
