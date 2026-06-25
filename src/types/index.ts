export type RequestType = 'estrategia' | 'gravacao' | 'conteudo' | 'arte' | 'edicao' | 'outro'
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
  budget_value: number | null
  is_fixed_client: boolean
  cliente_fixo_id: string | null
  pagamento_recebido: boolean
  chat_transcript: ChatMessage[]
  visivel_portal: boolean
}

export interface BlocoDocumento {
  id: string
  titulo: string
  conteudo: string
}

export interface DocumentoCliente {
  id: string
  created_at: string
  updated_at: string
  cliente_fixo_id: string
  titulo: string
  blocos: BlocoDocumento[]
  visivel_portal: boolean
}

export type PropostaModalidade = 'mensal' | 'pontual'
export type PropostaStatus = 'rascunho' | 'enviada' | 'aceita' | 'recusada' | 'expirada'
export type PropostaDadosFiscaisStatus = 'pendente' | 'preenchido' | 'nao_necessario'

export interface Proposta {
  id: string
  created_at: string
  updated_at: string
  cliente_fixo_id: string | null
  lead_id: string | null
  cliente_nome: string
  cliente_empresa: string | null
  cliente_email: string | null
  titulo: string
  modalidade: PropostaModalidade
  apresentacao: string | null
  escopo: string | null
  valor: number | null
  prazo_dias: number | null
  observacoes: string | null
  validade: string | null
  status: PropostaStatus
  enviada_em: string | null
  resposta_em: string | null
  visto_em: string | null
  aceito_por_nome: string | null
  aceito_por_email: string | null
  dados_fiscais_status: PropostaDadosFiscaisStatus
  cliente_cnpj: string | null
  cliente_razao_social: string | null
  cliente_telefone: string | null
  dados_fiscais_em: string | null
}

export const PROPOSTA_STATUS_LABELS: Record<PropostaStatus, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
}

export interface TempoApontamento {
  id: string
  created_at: string
  ticket_id: string
  minutos: number | null
  descricao: string | null
  data: string
  started_at: string | null
  ativo: boolean
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
  estrategia: 'Estratégia',
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
