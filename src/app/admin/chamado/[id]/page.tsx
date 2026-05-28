'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import type { Ticket, TicketStatus, Priority } from '@/types'
import { REQUEST_TYPE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from '@/types'

const STATUS_STYLES: Record<TicketStatus, string> = {
  novo: 'bg-blue-100 text-blue-700',
  em_andamento: 'bg-amber-100 text-amber-700',
  em_revisao: 'bg-purple-100 text-purple-700',
  concluido: 'bg-green-100 text-green-700',
  cancelado: 'bg-slate-100 text-slate-600',
}

const PRIORITY_STYLES: Record<Priority, string> = {
  normal: 'bg-slate-100 text-slate-600',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  )
}

export default function TicketDetailPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    loadTicket()
  }, [id, router])

  async function loadTicket() {
    const res = await api(`/api/tickets/${id}`)
    if (res.ok) {
      const data = await res.json()
      setTicket(data)
      setNotes(data.admin_notes || '')
    }
  }

  async function updateField(field: string, value: string) {
    if (!ticket) return
    const parsed = value === 'true' ? true : value === 'false' ? false : value === 'null' ? null : value
    setTicket((prev) => prev ? { ...prev, [field]: parsed } : null)
    await api(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
  }

  async function deleteTicket() {
    if (!confirm('Tem certeza que deseja excluir este chamado? Essa ação não pode ser desfeita.')) return
    setDeleting(true)
    await api(`/api/tickets/${id}`, { method: 'DELETE' })
    router.push('/admin/demandas')
  }

  async function saveNotes() {
    setSaving(true)
    await api(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: notes }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Voltar
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-mono text-slate-400">#{ticket.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <a
            href={`/acompanhar/${ticket.id}`}
            target="_blank"
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Ver como cliente →
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="text-lg font-bold text-slate-900">{ticket.title}</h1>
              <span className={clsx('text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0', STATUS_STYLES[ticket.status])}>
                {STATUS_LABELS[ticket.status]}
              </span>
            </div>
            {ticket.description && (
              <p className="text-sm text-slate-600 leading-relaxed">{ticket.description}</p>
            )}
          </div>

          <Section title="Briefing Estratégico">
            <div className="space-y-4">
              {ticket.purpose && (
                <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
                  <p className="text-xs font-semibold text-indigo-600 mb-1">Por quê — Propósito</p>
                  <p className="text-sm text-indigo-900">{ticket.purpose}</p>
                </div>
              )}
              {ticket.expected_result && (
                <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
                  <p className="text-xs font-semibold text-green-600 mb-1">Resultado Esperado</p>
                  <p className="text-sm text-green-900">{ticket.expected_result}</p>
                </div>
              )}
              {ticket.scheduled_at && (
                <div className="bg-amber-50 rounded-xl p-4 border-l-4 border-amber-500">
                  <p className="text-xs font-semibold text-amber-600 mb-1">Data e Horário da Gravação</p>
                  <p className="text-sm font-bold text-amber-900">
                    {format(new Date(ticket.scheduled_at), "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
              <Field label="Onde será usado" value={ticket.where_used} />
              <Field label="Prazo" value={ticket.deadline ? format(new Date(ticket.deadline), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : null} />
            </div>
          </Section>

          {/* Conversa completa */}
          {ticket.chat_transcript && ticket.chat_transcript.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => setShowChat(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Conversa Completa</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {ticket.chat_transcript.length} mensagens — clique para {showChat ? 'esconder' : 'ver tudo que o cliente disse'}
                  </p>
                </div>
                <span className={clsx('text-slate-400 transition-transform text-lg', showChat && 'rotate-180')}>⌄</span>
              </button>

              {showChat && (
                <div
                  className="border-t border-slate-100 px-5 py-5 space-y-3 max-h-[500px] overflow-y-auto"
                  style={{
                    background: 'linear-gradient(180deg, #fafafa 0%, #ffffff 100%)',
                  }}
                >
                  {ticket.chat_transcript.map((msg, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'flex',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={clsx(
                          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-[#C5A880]/20 text-slate-800 rounded-br-sm'
                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                        )}
                      >
                        <p className={clsx(
                          'text-[10px] uppercase tracking-wider mb-1 font-semibold',
                          msg.role === 'user' ? 'text-[#8B6840]' : 'text-slate-400'
                        )}>
                          {msg.role === 'user' ? ticket.client_name || 'Cliente' : 'IA'}
                        </p>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Section title="Notas Internas (visível só para você)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione suas anotações, estratégia, referências..."
              className="w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar notas'}
            </button>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Section title="Cliente">
            <Field label="Nome" value={ticket.client_name} />
            <Field label="Empresa" value={ticket.company} />
            <Field label="E-mail" value={ticket.client_email} />
            {ticket.client_email && (
              <a
                href={`mailto:${ticket.client_email}`}
                className="inline-block mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Enviar e-mail →
              </a>
            )}
          </Section>

          <Section title="Orçamento">
            <div className="space-y-3">
              <div className="flex rounded-xl overflow-hidden border border-slate-200 text-sm">
                <button
                  onClick={() => updateField('is_fixed_client', 'false')}
                  className={clsx(
                    'flex-1 py-2 font-medium transition-colors',
                    !ticket.is_fixed_client ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                  )}
                >
                  Avulso
                </button>
                <button
                  onClick={() => updateField('is_fixed_client', 'true')}
                  className={clsx(
                    'flex-1 py-2 font-medium transition-colors',
                    ticket.is_fixed_client ? 'bg-amber-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                  )}
                >
                  Cliente Fixo
                </button>
              </div>

              {ticket.is_fixed_client ? (
                <div className="bg-amber-50 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-amber-600 font-semibold">Incluso no pacote</p>
                  <p className="text-xs text-amber-500 mt-0.5">Demanda de cliente fixo</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Valor do serviço</p>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                    <span className="px-3 text-sm text-slate-400 bg-slate-50 border-r border-slate-200 py-2">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={ticket.budget_value ?? ''}
                      onChange={(e) => setTicket((prev) => prev ? { ...prev, budget_value: e.target.value ? Number(e.target.value) : null } : null)}
                      onBlur={(e) => updateField('budget_value', e.target.value || 'null')}
                      className="flex-1 px-3 py-2 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>
                  {ticket.budget_value != null && (
                    <p className="text-xs text-green-600 font-semibold mt-1.5 text-right">
                      {ticket.budget_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>

          <Section title="Detalhes">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">Status</p>
                <select
                  value={ticket.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Prioridade</p>
                <select
                  value={ticket.priority}
                  onChange={(e) => updateField('priority', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Tipo</p>
                <span className="text-sm text-slate-700">{REQUEST_TYPE_LABELS[ticket.request_type]}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Aberto em</p>
                <span className="text-sm text-slate-700">
                  {format(new Date(ticket.created_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>
          </Section>
          <button
            onClick={deleteTicket}
            disabled={deleting}
            className="w-full text-xs text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-100 rounded-xl py-2.5 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Excluindo...' : 'Excluir chamado'}
          </button>
        </div>
      </div>
    </div>
  )
}
