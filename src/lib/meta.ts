import type { Campanha, DadosTrafego, Intervalo, Metricas, Periodo, SerieDia, SituacaoCampanha } from './trafego'

// Cliente da Marketing API do Meta. Só roda no servidor: o token do System
// User fica em META_ACCESS_TOKEN e nunca vai para o navegador.

const VERSAO = process.env.META_API_VERSION || 'v27.0'
const BASE = `https://graph.facebook.com/${VERSAO}`
// Cache curto para não estourar o limite de chamadas quando o cliente
// atualiza a página várias vezes.
const CACHE_SEGUNDOS = 300

export class MetaErro extends Error {
  constructor(message: string, public status = 502) {
    super(message)
  }
}

export function metaConfigurado() {
  return !!process.env.META_ACCESS_TOKEN
}

export function normalizarContaId(id: string) {
  const limpo = id.trim().replace(/^act_/, '')
  return /^\d+$/.test(limpo) ? `act_${limpo}` : null
}

export async function graph<T>(caminho: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new MetaErro('META_ACCESS_TOKEN não configurado no servidor.', 503)

  const url = new URL(`${BASE}/${caminho}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  // O token vai no header para não aparecer em logs de URL.
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: CACHE_SEGUNDOS },
  })
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok || corpo.error) {
    const msg = corpo?.error?.error_user_msg || corpo?.error?.message || `Erro ${res.status} na API do Meta`
    throw new MetaErro(msg, res.status === 400 || res.status === 403 ? 502 : res.status)
  }
  return corpo as T
}

interface Acao { action_type: string; value: string }

interface InsightBruto {
  spend?: string
  impressions?: string
  reach?: string
  frequency?: string
  clicks?: string
  ctr?: string
  cpm?: string
  actions?: Acao[]
  action_values?: Acao[]
  date_start?: string
  campaign_id?: string
}

const CAMPOS_INSIGHT = 'spend,impressions,reach,frequency,clicks,ctr,cpm,actions,action_values'

function acao(lista: Acao[] | undefined, ...tipos: string[]) {
  for (const t of tipos) {
    const a = lista?.find(x => x.action_type === t)
    if (a) return Number(a.value) || 0
  }
  return 0
}

function normalizar(i: InsightBruto): Metricas {
  const n = (v?: string) => Number(v) || 0
  return {
    investimento: n(i.spend),
    impressoes: n(i.impressions),
    alcance: n(i.reach),
    frequencia: n(i.frequency),
    cliques: n(i.clicks),
    ctr: n(i.ctr),
    cpm: n(i.cpm),
    cliquesLink: acao(i.actions, 'link_click'),
    visitas: acao(i.actions, 'landing_page_view', 'omni_landing_page_view'),
    verConteudo: acao(i.actions, 'view_content', 'omni_view_content'),
    carrinho: acao(i.actions, 'add_to_cart', 'omni_add_to_cart'),
    checkout: acao(i.actions, 'initiate_checkout', 'omni_initiated_checkout'),
    compras: acao(i.actions, 'purchase', 'omni_purchase'),
    receita: acao(i.action_values, 'purchase', 'omni_purchase'),
    conversas: acao(i.actions, 'onsite_conversion.messaging_conversation_started_7d'),
    videoViews: acao(i.actions, 'video_view'),
    engajamento: acao(i.actions, 'post_engagement'),
  }
}

interface CampanhaBruta {
  id: string
  name: string
  objective: string
  status: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
}

function situacao(c: CampanhaBruta, entregou: boolean): SituacaoCampanha {
  if (c.stop_time && new Date(c.stop_time) < new Date()) return 'encerrada'
  if (c.status !== 'ACTIVE' || c.effective_status === 'PAUSED' || c.effective_status === 'CAMPAIGN_PAUSED') return 'pausada'
  if (c.start_time && new Date(c.start_time) > new Date()) return 'pausada'
  return entregou && c.effective_status === 'ACTIVE' ? 'rodando' : 'sem_entrega'
}

// ─── Datas ───────────────────────────────────────────────────────────────────

/** Data de hoje no fuso de Brasília, como AAAA-MM-DD. */
function hojeBR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const dataUTC = (s: string) => new Date(`${s}T00:00:00Z`)
function somaDias(s: string, n: number) {
  const d = dataUTC(s)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
function diasNoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
}

/**
 * Período de comparação: o mesmo tamanho, logo antes do período escolhido.
 * "Este mês" compara com os mesmos dias do mês passado (1 a hoje).
 */
export function intervaloAnterior(periodo: Periodo, hoje = hojeBR()): Intervalo {
  const dias = { last_7d: 7, last_14d: 14, last_30d: 30 } as const
  if (periodo in dias) {
    const n = dias[periodo as keyof typeof dias]
    const inicioAtual = somaDias(hoje, -n) // os presets do Meta terminam ontem
    return { inicio: somaDias(inicioAtual, -n), fim: somaDias(inicioAtual, -1) }
  }
  const h = dataUTC(hoje)
  const ano = h.getUTCFullYear()
  const mes = h.getUTCMonth()
  if (periodo === 'this_month') {
    const a = mes === 0 ? ano - 1 : ano
    const m = mes === 0 ? 11 : mes - 1
    const dia = Math.min(h.getUTCDate(), diasNoMes(a, m))
    return { inicio: iso(new Date(Date.UTC(a, m, 1))), fim: iso(new Date(Date.UTC(a, m, dia))) }
  }
  // last_month → o mês anterior a ele
  const alvo = new Date(Date.UTC(ano, mes - 2, 1))
  return { inicio: iso(alvo), fim: iso(new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0))) }
}

/** Orçamentos vêm em centavos. */
const centavos = (v?: string) => (v ? Number(v) / 100 : null)

export async function contasDisponiveis() {
  const r = await graph<{ data: { id: string; name: string; account_status: number }[] }>('me/adaccounts', {
    fields: 'name,account_status',
    limit: '100',
  })
  return r.data.map(c => ({ id: c.id, nome: c.name, ativa: c.account_status === 1 }))
}

export async function dadosTrafego(contaId: string, periodo: Periodo): Promise<DadosTrafego> {
  const act = normalizarContaId(contaId)
  if (!act) throw new MetaErro('ID da conta de anúncios inválido.', 400)

  const hoje = hojeBR()
  const intervaloAnt = intervaloAnterior(periodo, hoje)

  const [conta, resumo, anterior, doMes, serie, porCampanha, campanhas, recentes] = await Promise.all([
    graph<{ name: string; currency: string }>(act, { fields: 'name,currency' }),
    graph<{ data: InsightBruto[] }>(`${act}/insights`, { fields: CAMPOS_INSIGHT, date_preset: periodo }),
    graph<{ data: InsightBruto[] }>(`${act}/insights`, {
      fields: CAMPOS_INSIGHT,
      time_range: JSON.stringify({ since: intervaloAnt.inicio, until: intervaloAnt.fim }),
    }),
    graph<{ data: InsightBruto[] }>(`${act}/insights`, { fields: 'spend', date_preset: 'this_month' }),
    graph<{ data: InsightBruto[] }>(`${act}/insights`, {
      fields: `${CAMPOS_INSIGHT},date_start`,
      date_preset: periodo,
      time_increment: '1',
      limit: '100',
    }),
    graph<{ data: InsightBruto[] }>(`${act}/insights`, {
      fields: `campaign_id,${CAMPOS_INSIGHT}`,
      level: 'campaign',
      date_preset: periodo,
      limit: '200',
    }),
    graph<{ data: CampanhaBruta[] }>(`${act}/campaigns`, {
      fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time',
      effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED']),
      limit: '100',
    }),
    // Para saber se uma campanha ativa está entregando agora, olha os últimos 3 dias.
    graph<{ data: InsightBruto[] }>(`${act}/insights`, {
      fields: 'campaign_id,impressions',
      level: 'campaign',
      date_preset: 'last_3d',
      limit: '200',
    }),
  ])

  const metricasPorId = new Map(porCampanha.data.map(i => [i.campaign_id!, normalizar(i)]))
  const entregando = new Set(recentes.data.filter(i => Number(i.impressions) > 0).map(i => i.campaign_id!))

  const lista: Campanha[] = campanhas.data
    .map(c => ({
      id: c.id,
      nome: c.name,
      objetivo: c.objective,
      situacao: situacao(c, entregando.has(c.id)),
      orcamentoDiario: centavos(c.daily_budget),
      orcamentoTotal: centavos(c.lifetime_budget),
      inicio: c.start_time ?? null,
      fim: c.stop_time ?? null,
      metricas: metricasPorId.get(c.id) ?? null,
    }))
    // Mostra o que está no ar e o que teve investimento no período.
    .filter(c => c.situacao === 'rodando' || c.situacao === 'sem_entrega' || (c.metricas?.investimento ?? 0) > 0)
    .sort((a, b) => {
      const ordem: Record<SituacaoCampanha, number> = { sem_entrega: 0, rodando: 1, pausada: 2, encerrada: 3 }
      return ordem[a.situacao] - ordem[b.situacao] || (b.metricas?.investimento ?? 0) - (a.metricas?.investimento ?? 0)
    })

  const dias: SerieDia[] = serie.data.map(d => ({ data: d.date_start!, ...normalizar(d) }))
  const h = dataUTC(hoje)

  return {
    periodo,
    atualizadoEm: new Date().toISOString(),
    conta: { nome: conta.name, moeda: conta.currency },
    resumo: resumo.data[0] ? normalizar(resumo.data[0]) : null,
    anterior: anterior.data[0] ? normalizar(anterior.data[0]) : null,
    intervaloAnterior: intervaloAnt,
    mes: {
      investimento: Number(doMes.data[0]?.spend) || 0,
      dia: h.getUTCDate(),
      diasNoMes: diasNoMes(h.getUTCFullYear(), h.getUTCMonth()),
    },
    serie: dias,
    campanhas: lista,
  }
}
