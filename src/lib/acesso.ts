// Módulos do painel e o que cada membro da equipe pode ver.
// Compartilhado entre servidor (bloqueio das rotas) e navegador (menu e telas).

export const MODULOS = [
  { id: 'gestao', label: 'Gestão', descricao: 'Painel com receita, metas e pagamentos do mês' },
  { id: 'demandas', label: 'Demandas', descricao: 'Quadro de demandas e detalhes de cada uma' },
  { id: 'agenda', label: 'Agenda', descricao: 'Calendário de eventos e prazos' },
  { id: 'clientes', label: 'Clientes', descricao: 'Fichas, documentos, estratégias e relatórios' },
  { id: 'social', label: 'Social media', descricao: 'Estúdio de conteúdo e Instagram' },
  { id: 'trafego', label: 'Tráfego pago', descricao: 'Meta Ads, plano de ação e link do cliente' },
  { id: 'agentes', label: 'Agentes', descricao: 'Reuniões entre as IAs de tráfego e social' },
  { id: 'comercial', label: 'Comercial', descricao: 'Leads, propostas e parceiros' },
  { id: 'financeiro', label: 'Financeiro', descricao: 'Pagamentos, despesas e todos os valores em R$' },
] as const

export type Modulo = (typeof MODULOS)[number]['id']
export type Papel = 'dono' | 'membro'

export const MODULO_LABEL = Object.fromEntries(MODULOS.map(m => [m.id, m.label])) as Record<Modulo, string>

export function moduloValido(m: string): m is Modulo {
  return MODULOS.some(x => x.id === m)
}

/** Atalhos ao criar um acesso. */
export const PERFIS: { nome: string; modulos: Modulo[] }[] = [
  { nome: 'Social media', modulos: ['demandas', 'agenda', 'clientes', 'social', 'agentes'] },
  { nome: 'Tráfego', modulos: ['demandas', 'agenda', 'clientes', 'trafego', 'agentes'] },
  { nome: 'Produção', modulos: ['demandas', 'agenda'] },
  { nome: 'Comercial', modulos: ['agenda', 'comercial'] },
]

export interface Acesso {
  userId: string
  nome: string
  email: string
  papel: Papel
  permissoes: Modulo[]
}

export function pode(acesso: Pick<Acesso, 'papel' | 'permissoes'> | null | undefined, modulo: Modulo | Modulo[]) {
  if (!acesso) return false
  if (acesso.papel === 'dono') return true
  const lista = Array.isArray(modulo) ? modulo : [modulo]
  return lista.some(m => acesso.permissoes.includes(m))
}

/** Módulo de cada tela do admin (ordem importa: o primeiro prefixo que casar vence). */
const TELAS: [RegExp, Modulo | 'dono' | null][] = [
  [/^\/admin\/login/, null],
  [/^\/admin\/equipes/, 'dono'],
  [/^\/admin\/demandas|^\/admin\/chamado/, 'demandas'],
  [/^\/admin\/agenda/, 'agenda'],
  [/^\/admin\/(clientes|cliente\/|documento|relatorio|estrategia)/, 'clientes'],
  [/^\/admin\/social/, 'social'],
  [/^\/admin\/trafego/, 'trafego'],
  [/^\/admin\/agentes/, 'agentes'],
  [/^\/admin\/(comercial|lead|proposta)/, 'comercial'],
  [/^\/admin\/(financeiro|recibo)/, 'financeiro'],
  [/^\/admin\/?$/, 'gestao'],
]

export function moduloDaTela(pathname: string): Modulo | 'dono' | null {
  return TELAS.find(([re]) => re.test(pathname))?.[1] ?? null
}

export function podeVerTela(acesso: Acesso | null, pathname: string) {
  const m = moduloDaTela(pathname)
  if (m === null) return true
  if (!acesso) return false
  if (m === 'dono') return acesso.papel === 'dono'
  return pode(acesso, m)
}

/** Para onde mandar quem abriu uma tela sem permissão. */
export const INICIO: Record<Modulo, string> = {
  gestao: '/admin',
  demandas: '/admin/demandas',
  agenda: '/admin/agenda',
  clientes: '/admin/clientes',
  social: '/admin/social',
  trafego: '/admin/trafego',
  agentes: '/admin/agentes',
  comercial: '/admin/comercial',
  financeiro: '/admin/financeiro',
}

export function telaInicial(acesso: Acesso | null) {
  if (!acesso) return null
  if (acesso.papel === 'dono') return '/admin'
  const primeiro = MODULOS.find(m => acesso.permissoes.includes(m.id))
  return primeiro ? INICIO[primeiro.id] : null
}

// ─── Campos de dinheiro ─────────────────────────────────────────────────────
// Quem não tem o módulo Financeiro não recebe nem altera estes campos.

export const CAMPOS_FINANCEIROS: Record<'clientes_fixos' | 'tickets', string[]> = {
  clientes_fixos: ['valor_mensal', 'dia_vencimento'],
  tickets: ['budget_value', 'pagamento_recebido'],
}

export function semCampos<T extends Record<string, unknown>>(obj: T, campos: string[]): T {
  const copia: Record<string, unknown> = { ...obj }
  for (const c of campos) if (c in copia) copia[c] = null
  return copia as T
}

export function removerCampos(obj: Record<string, unknown>, campos: string[]) {
  const copia = { ...obj }
  for (const c of campos) delete copia[c]
  return copia
}

/** Nunca sai do servidor; quem não tem Financeiro também não recebe os valores. */
export function clienteVisivel(c: Record<string, unknown>, financeiro: boolean) {
  const limpo = removerCampos(c, ['portal_senha_hash'])
  if (financeiro) return limpo
  for (const campo of CAMPOS_FINANCEIROS.clientes_fixos) limpo[campo] = null
  return limpo
}
