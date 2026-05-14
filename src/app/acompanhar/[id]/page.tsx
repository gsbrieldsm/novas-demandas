import { getServiceClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Ticket, TicketStatus } from '@/types'
import { REQUEST_TYPE_LABELS } from '@/types'

const STEPS: { id: TicketStatus; label: string }[] = [
  { id: 'novo', label: 'Recebido' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'em_revisao', label: 'Em revisão' },
  { id: 'concluido', label: 'Concluído' },
]

const STEP_INDEX: Partial<Record<TicketStatus, number>> = {
  novo: 0,
  em_andamento: 1,
  em_revisao: 2,
  concluido: 3,
}

async function getTicket(id: string): Promise<Ticket | null> {
  const db = getServiceClient()
  const { data } = await db.from('tickets').select('*').eq('id', id).single()
  return data
}

export default async function AcompanharPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ticket = await getTicket(id)

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white text-xl font-semibold">Chamado não encontrado</p>
          <a href="/chat" className="text-indigo-300 text-sm mt-2 inline-block hover:text-white">
            Abrir novo chamado →
          </a>
        </div>
      </div>
    )
  }

  const currentStep = STEP_INDEX[ticket.status] ?? 0
  const isCanceled = ticket.status === 'cancelado'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <p className="text-indigo-300 text-sm mb-1">Acompanhamento do chamado</p>
          <p className="text-white/40 font-mono text-xs">#{ticket.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-indigo-600 px-6 py-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-indigo-200 text-xs font-medium uppercase tracking-wider">
                {REQUEST_TYPE_LABELS[ticket.request_type]}
              </span>
              <span className="text-indigo-200 text-xs">
                {format(new Date(ticket.created_at), "d 'de' MMM", { locale: ptBR })}
              </span>
            </div>
            <h1 className="text-white font-bold text-lg leading-snug">{ticket.title}</h1>
            <p className="text-indigo-200 text-sm mt-1">{ticket.client_name}</p>
          </div>

          {/* Status tracker */}
          <div className="px-6 py-6">
            {isCanceled ? (
              <div className="bg-slate-100 rounded-xl p-4 text-center">
                <p className="text-slate-500 text-sm font-medium">Este chamado foi cancelado.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
                  />
                </div>
                <div className="relative flex justify-between">
                  {STEPS.map((step, i) => {
                    const isCompleted = i < currentStep
                    const isCurrent = i === currentStep
                    return (
                      <div key={step.id} className="flex flex-col items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                            isCompleted
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : isCurrent
                              ? 'bg-white border-indigo-600 text-indigo-600'
                              : 'bg-white border-slate-200 text-slate-300'
                          }`}
                        >
                          {isCompleted ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span
                          className={`text-xs text-center leading-tight ${
                            isCurrent ? 'text-indigo-700 font-semibold' : isCompleted ? 'text-slate-500' : 'text-slate-300'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Briefing summary */}
          <div className="px-6 pb-6 space-y-3">
            {ticket.purpose && (
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-indigo-600 mb-1">Propósito do pedido</p>
                <p className="text-sm text-indigo-900">{ticket.purpose}</p>
              </div>
            )}
            {ticket.where_used && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Onde vai ser usado</span>
                <span className="text-slate-700 font-medium">{ticket.where_used}</span>
              </div>
            )}
            {ticket.deadline && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Prazo</span>
                <span className="text-slate-700 font-medium">
                  {format(new Date(ticket.deadline), "d 'de' MMMM", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            <a
              href="/chat"
              className="block text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium py-3 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              Abrir novo chamado
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
