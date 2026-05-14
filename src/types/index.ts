export type RequestType = 'gravacao' | 'conteudo' | 'arte' | 'edicao' | 'outro'
export type TicketStatus = 'novo' | 'em_andamento' | 'em_revisao' | 'concluido' | 'cancelado'
export type Priority = 'normal' | 'alta' | 'urgente'

export interface Ticket {
  id: string
  created_at: string
  updated_at: string
  client_name: string
  client_email: string
  company: string | null
  request_type: RequestType
  title: string
  description: string | null
  where_used: string | null
  deadline: string | null
  purpose: string | null
  expected_result: string | null
  status: TicketStatus
  priority: Priority
  admin_notes: string | null
  scheduled_at: string | null
  chat_transcript: ChatMessage[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface BriefingData {
  client_name: string
  client_email: string | null
  company: string | null
  request_type: RequestType
  title: string
  description: string | null
  where_used: string | null
  deadline: string | null
  purpose: string | null
  expected_result: string | null
  priority: Priority
  scheduled_at: string | null
}

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  gravacao: 'Gravação',
  conteudo: 'Conteúdo',
  arte: 'Arte',
  edicao: 'Edição de Vídeo',
  outro: 'Outro',
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  novo: 'Novo',
  em_andamento: 'Em Andamento',
  em_revisao: 'Em Revisão',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}
