// Tipos e formatação do módulo de tráfego pago. Sem segredos: usado no
// navegador (admin e página pública) e no servidor.

export const PERIODOS = [
  { id: 'last_7d', label: '7 dias' },
  { id: 'last_14d', label: '14 dias' },
  { id: 'last_30d', label: '30 dias' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'last_month', label: 'Mês passado' },
] as const

export type Periodo = (typeof PERIODOS)[number]['id']

export function periodoValido(p: string | null | undefined): Periodo {
  return PERIODOS.some(x => x.id === p) ? (p as Periodo) : 'last_30d'
}

export type PlanoStatus = 'proposto' | 'aprovado' | 'em_andamento' | 'concluido'

export const PLANO_STATUS: { id: PlanoStatus; label: string }[] = [
  { id: 'proposto', label: 'Proposto' },
  { id: 'aprovado', label: 'Aprovado' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'concluido', label: 'Concluído' },
]

export const PLANO_STATUS_LABEL: Record<PlanoStatus, string> = Object.fromEntries(
  PLANO_STATUS.map(s => [s.id, s.label])
) as Record<PlanoStatus, string>

export interface PlanoItem {
  id: string
  titulo: string
  descricao: string
  prazo: string | null // AAAA-MM-DD
  status: PlanoStatus
}

/** O cliente só vê o que já foi aprovado. */
export function planoPublico(plano: PlanoItem[]) {
  return plano.filter(p => p.status !== 'proposto')
}

export interface TrafegoConta {
  id: string
  created_at: string
  updated_at: string
  cliente_fixo_id: string
  meta_ad_account_id: string
  link_token: string
  link_ativo: boolean
  recado: string | null
  plano: PlanoItem[]
}

/** Métricas já normalizadas a partir dos "actions" do Meta. */
export interface Metricas {
  investimento: number
  impressoes: number
  alcance: number
  frequencia: number
  cliques: number
  ctr: number
  cpm: number
  cliquesLink: number
  visitas: number // landing_page_view
  verConteudo: number
  carrinho: number
  checkout: number
  compras: number
  receita: number
  conversas: number
  videoViews: number
  engajamento: number
}

export interface SerieDia {
  data: string // AAAA-MM-DD
  investimento: number
  cliquesLink: number
  visitas: number
  carrinho: number
  compras: number
}

export type SituacaoCampanha = 'rodando' | 'sem_entrega' | 'pausada' | 'encerrada'

export interface Campanha {
  id: string
  nome: string
  objetivo: string
  situacao: SituacaoCampanha
  orcamentoDiario: number | null
  orcamentoTotal: number | null
  inicio: string | null
  fim: string | null
  metricas: Metricas | null // null = não veiculou no período
}

export interface DadosTrafego {
  periodo: Periodo
  atualizadoEm: string
  conta: { nome: string; moeda: string }
  resumo: Metricas | null
  serie: SerieDia[]
  campanhas: Campanha[]
}

export const OBJETIVO_LABEL: Record<string, string> = {
  OUTCOME_SALES: 'Vendas',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_AWARENESS: 'Reconhecimento',
  OUTCOME_LEADS: 'Cadastros',
  OUTCOME_APP_PROMOTION: 'App',
  LINK_CLICKS: 'Cliques',
  MESSAGES: 'Mensagens',
  POST_ENGAGEMENT: 'Engajamento',
  CONVERSIONS: 'Conversões',
  REACH: 'Alcance',
  VIDEO_VIEWS: 'Vídeo',
}

export const SITUACAO_LABEL: Record<SituacaoCampanha, string> = {
  rodando: 'Rodando',
  sem_entrega: 'Ativa sem entrega',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
}

// ─── Formatação ──────────────────────────────────────────────────────────────

export function brl(v: number, casas = 2) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export function num(v: number) {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export function compacto(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (v >= 10_000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return num(v)
}

export function pct(v: number, casas = 1) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

/** Custo por resultado, ou "—" quando não houve resultado. */
export function custoPor(investimento: number, resultado: number) {
  return resultado > 0 ? brl(investimento / resultado) : '—'
}

export function dataBR(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function novoId() {
  return Math.random().toString(36).slice(2, 10)
}
