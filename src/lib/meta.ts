import { AsyncLocalStorage } from 'node:async_hooks'
import { ufDaRegiao } from './trafego'
import type {
  Campanha,
  CelulaHora,
  Criativo,
  DadosTrafego,
  Fadiga,
  Intervalo,
  Metricas,
  Periodo,
  Regiao,
  SerieDia,
  SituacaoCampanha,
} from './trafego'

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

/**
 * Chaves disponíveis, da preferida para a reserva. A GM&Co tem o próprio app
 * e usuário do sistema (META_ACCESS_TOKEN_GMECO); a chave antiga, do portfólio
 * da Ever4u (META_ACCESS_TOKEN), segue valendo para o que só ela enxerga.
 */
function tokensMeta() {
  return [process.env.META_ACCESS_TOKEN_GMECO, process.env.META_ACCESS_TOKEN].filter((t): t is string => !!t)
}

export function metaConfigurado() {
  return tokensMeta().length > 0
}

// Chave usada pelas chamadas dentro de `comTokenDe` (sem precisar passar adiante).
const tokenAtual = new AsyncLocalStorage<string>()
// Qual chave enxerga cada conta de anúncios / Instagram (descoberto uma vez).
const tokenPorAlvo = new Map<string, string>()

/** Roda `fn` com a primeira chave que tem acesso a `alvo` (act_… ou ID do Instagram). */
export async function comTokenDe<T>(alvo: string, fn: () => Promise<T>): Promise<T> {
  const tokens = tokensMeta()
  if (tokens.length <= 1) return fn()
  let token = tokenPorAlvo.get(alvo)
  if (!token) {
    for (const t of tokens) {
      const ok = await fetch(`${BASE}/${alvo}?fields=id`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' })
        .then(r => r.ok)
        .catch(() => false)
      if (ok) {
        token = t
        break
      }
    }
    token ??= tokens[0]
    tokenPorAlvo.set(alvo, token)
  }
  return tokenAtual.run(token, fn)
}

/** Roda `fn` uma vez com cada chave e junta os resultados (listas de contas). */
export async function comCadaToken<T>(fn: () => Promise<T[]>): Promise<T[]> {
  const tokens = tokensMeta()
  if (tokens.length <= 1) return fn()
  const partes = await Promise.all(tokens.map(t => tokenAtual.run(t, fn).catch(() => [] as T[])))
  return partes.flat()
}

export function normalizarContaId(id: string) {
  const limpo = id.trim().replace(/^act_/, '')
  return /^\d+$/.test(limpo) ? `act_${limpo}` : null
}

export async function graph<T>(caminho: string, params: Record<string, string> = {}): Promise<T> {
  const token = tokenAtual.getStore() ?? tokensMeta()[0]
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
  ad_id?: string
  ad_name?: string
  campaign_name?: string
  inline_link_click_ctr?: string
  video_thruplay_watched_actions?: Acao[]
  region?: string
  hourly_stats_aggregated_by_advertiser_time_zone?: string
}

interface Pagina<T> { data: T[]; paging?: { next?: string; cursors?: { after?: string } } }

/** Segue a paginação do Meta até `maxPaginas`. */
async function graphTodas<T>(caminho: string, params: Record<string, string>, maxPaginas = 4): Promise<T[]> {
  const todos: T[] = []
  let after: string | undefined
  for (let i = 0; i < maxPaginas; i++) {
    const r = await graph<Pagina<T>>(caminho, after ? { ...params, after } : params)
    todos.push(...r.data)
    after = r.paging?.next ? r.paging.cursors?.after : undefined
    if (!after) break
  }
  return todos
}

/** Bloco opcional do painel: se falhar, registra e segue sem ele. */
async function talvez<T>(p: Promise<T>): Promise<T | undefined> {
  try {
    return await p
  } catch (e) {
    console.warn('[meta] bloco opcional falhou:', e instanceof Error ? e.message : e)
    return undefined
  }
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
  const todas = await comCadaToken(async () => {
    const r = await graph<{ data: { id: string; name: string; account_status: number }[] }>('me/adaccounts', {
      fields: 'name,account_status',
      limit: '100',
    })
    return r.data.map(c => ({ id: c.id, nome: c.name, ativa: c.account_status === 1 }))
  })
  return [...new Map(todas.map(c => [c.id, c])).values()]
}

// ─── Criativos e fadiga ──────────────────────────────────────────────────────

interface AnuncioBruto {
  id: string
  effective_status?: string
  creative?: {
    thumbnail_url?: string
    image_url?: string
    object_type?: string
    instagram_permalink_url?: string
    video_id?: string
    effective_instagram_media_id?: string
  }
}

/**
 * Anúncio de imagem às vezes volta com uma miniatura genérica do Meta; a mídia
 * original do post no Instagram resolve. Vídeos ficam com a miniatura normal.
 */
async function imagemDoInstagram(mediaId: string) {
  const m = await graph<{ media_type?: string; media_url?: string; children?: { data: { media_url?: string; media_type?: string }[] } }>(
    mediaId,
    { fields: 'media_type,media_url,children{media_url,media_type}' }
  )
  if (m.media_type === 'IMAGE') return m.media_url ?? null
  if (m.media_type === 'CAROUSEL_ALBUM') return m.children?.data.find(c => c.media_type === 'IMAGE')?.media_url ?? null
  return null
}

const MIN_IMPRESSOES_FADIGA = 1000

/**
 * Cansaço do criativo: compara a taxa de cliques no link dos últimos 7 dias
 * com a dos 7 anteriores e olha quantas vezes cada pessoa já viu o anúncio.
 */
function avaliarFadiga(agora?: InsightBruto, antes?: InsightBruto): Fadiga | null {
  if (!agora || (Number(agora.impressions) || 0) < MIN_IMPRESSOES_FADIGA) return null
  const frequencia = Number(agora.frequency) || 0
  const ctrAgora = Number(agora.inline_link_click_ctr) || 0
  const ctrAntes = antes && (Number(antes.impressions) || 0) >= MIN_IMPRESSOES_FADIGA ? Number(antes.inline_link_click_ctr) || 0 : null
  const queda = ctrAntes ? (ctrAntes - ctrAgora) / ctrAntes : 0
  const vezes = frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const base = { frequencia, ctrAgora, ctrAntes }

  if ((frequencia >= 3 && queda >= 0.2) || (frequencia >= 2 && queda >= 0.35)) {
    return { ...base, nivel: 'trocar', motivo: `Cliques caíram ${Math.round(queda * 100)}% na semana e cada pessoa já viu ${vezes}×` }
  }
  if (frequencia >= 3) return { ...base, nivel: 'atencao', motivo: `Público saturando: cada pessoa viu ${vezes}× em 7 dias` }
  if (queda >= 0.25) return { ...base, nivel: 'atencao', motivo: `Cliques caíram ${Math.round(queda * 100)}% em relação à semana anterior` }
  return null
}

function tipoCriativo(c: AnuncioBruto['creative']): Criativo['tipo'] {
  if (!c) return 'outro'
  if (c.video_id || c.object_type === 'VIDEO') return 'video'
  if (c.object_type === 'PHOTO' || c.image_url) return 'imagem'
  return 'outro'
}

async function buscarCriativos(act: string, periodo: Periodo, hoje: string): Promise<Criativo[]> {
  const comGasto = JSON.stringify([{ field: 'spend', operator: 'GREATER_THAN', value: 0 }])
  const [porAnuncio, semana, semanaAntes] = await Promise.all([
    graphTodas<InsightBruto>(`${act}/insights`, {
      level: 'ad',
      fields: `ad_id,ad_name,campaign_name,inline_link_click_ctr,video_thruplay_watched_actions,${CAMPOS_INSIGHT}`,
      date_preset: periodo,
      filtering: comGasto,
      limit: '200',
    }, 2),
    graphTodas<InsightBruto>(`${act}/insights`, {
      level: 'ad',
      fields: 'ad_id,impressions,frequency,inline_link_click_ctr',
      time_range: JSON.stringify({ since: somaDias(hoje, -7), until: somaDias(hoje, -1) }),
      filtering: comGasto,
      limit: '200',
    }, 2),
    graphTodas<InsightBruto>(`${act}/insights`, {
      level: 'ad',
      fields: 'ad_id,impressions,inline_link_click_ctr',
      time_range: JSON.stringify({ since: somaDias(hoje, -14), until: somaDias(hoje, -8) }),
      filtering: comGasto,
      limit: '200',
    }, 2),
  ])

  const top = porAnuncio.sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)).slice(0, 12)
  if (top.length === 0) return []

  const anuncios = await graph<{ data: AnuncioBruto[] }>(`${act}/ads`, {
    fields: 'id,effective_status,creative.thumbnail_width(480).thumbnail_height(480){thumbnail_url,image_url,object_type,instagram_permalink_url,video_id,effective_instagram_media_id}',
    filtering: JSON.stringify([{ field: 'id', operator: 'IN', value: top.map(a => a.ad_id) }]),
    limit: '50',
  }).catch(() => ({ data: [] as AnuncioBruto[] }))

  const info = new Map(anuncios.data.map(a => [a.id, a]))
  const agora = new Map(semana.map(i => [i.ad_id!, i]))
  const antes = new Map(semanaAntes.map(i => [i.ad_id!, i]))

  const imagensIg = new Map(
    await Promise.all(
      anuncios.data
        .filter(a => a.creative?.effective_instagram_media_id && tipoCriativo(a.creative) !== 'video')
        .map(async a => [a.id, await imagemDoInstagram(a.creative!.effective_instagram_media_id!).catch(() => null)] as const)
    )
  )

  return top.map(i => {
    const a = info.get(i.ad_id!)
    const tipo = tipoCriativo(a?.creative)
    return {
      id: i.ad_id!,
      nome: i.ad_name ?? 'Anúncio',
      campanha: i.campaign_name ?? '',
      ativo: a?.effective_status === 'ACTIVE',
      tipo,
      // A miniatura (já pedida em 480px) abre fora do Facebook; o image_url às vezes não.
      thumb: imagensIg.get(i.ad_id!) ?? a?.creative?.thumbnail_url ?? a?.creative?.image_url ?? null,
      link: a?.creative?.instagram_permalink_url ?? null,
      metricas: normalizar(i),
      ctrLink: Number(i.inline_link_click_ctr) || 0,
      thruplays: acao(i.video_thruplay_watched_actions, 'video_view'),
      fadiga: a?.effective_status === 'ACTIVE' ? avaliarFadiga(agora.get(i.ad_id!), antes.get(i.ad_id!)) : null,
    }
  })
}

// ─── Regiões e horários ──────────────────────────────────────────────────────

async function buscarRegioes(act: string, periodo: Periodo): Promise<Regiao[]> {
  const linhas = await graphTodas<InsightBruto>(`${act}/insights`, {
    fields: CAMPOS_INSIGHT,
    breakdowns: 'region',
    date_preset: periodo,
    limit: '100',
  }, 2)
  return linhas
    .map(l => ({ nome: (l.region ?? '—').replace(/\s*\(state\)\s*/i, ''), uf: ufDaRegiao(l.region ?? ''), metricas: normalizar(l) }))
    .filter(r => r.metricas.investimento > 0)
    .sort((a, b) => b.metricas.investimento - a.metricas.investimento)
}

/** Brasília não tem horário de verão desde 2019: UTC−3 fixo. */
const OFFSET_BRASILIA = -3

async function buscarHoras(act: string, periodo: Periodo, offsetConta: number): Promise<CelulaHora[]> {
  const linhas = await graphTodas<InsightBruto>(`${act}/insights`, {
    fields: 'spend,impressions,actions,action_values',
    breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone',
    date_preset: periodo,
    time_increment: '1',
    limit: '500',
  }, 4)

  // O Meta entrega a hora no fuso da conta; convertemos para Brasília.
  const ajuste = OFFSET_BRASILIA - offsetConta
  const grade = new Map<string, CelulaHora>()
  for (const l of linhas) {
    const h = parseInt(l.hourly_stats_aggregated_by_advertiser_time_zone ?? '', 10)
    if (!l.date_start || isNaN(h)) continue
    const quando = dataUTC(l.date_start)
    quando.setUTCHours(h + ajuste)
    const dia = quando.getUTCDay()
    const hora = quando.getUTCHours()
    const chave = `${dia}-${hora}`
    const m = normalizar(l)
    const c = grade.get(chave) ?? { dia, hora, investimento: 0, impressoes: 0, cliquesLink: 0, visitas: 0, compras: 0, conversas: 0, receita: 0 }
    c.investimento += m.investimento
    c.impressoes += m.impressoes
    c.cliquesLink += m.cliquesLink
    c.visitas += m.visitas
    c.compras += m.compras
    c.conversas += m.conversas
    c.receita += m.receita
    grade.set(chave, c)
  }
  return [...grade.values()]
}

export async function dadosTrafego(contaId: string, periodo: Periodo): Promise<DadosTrafego> {
  const act = normalizarContaId(contaId)
  if (!act) throw new MetaErro('ID da conta de anúncios inválido.', 400)
  return comTokenDe(act, () => montarDadosTrafego(act, periodo))
}

async function montarDadosTrafego(act: string, periodo: Periodo): Promise<DadosTrafego> {
  const hoje = hojeBR()
  const intervaloAnt = intervaloAnterior(periodo, hoje)

  // Blocos extras correm em paralelo com o principal e nunca derrubam o painel.
  const extras = Promise.all([
    talvez(buscarCriativos(act, periodo, hoje)),
    talvez(buscarRegioes(act, periodo)),
    talvez(
      graph<{ timezone_offset_hours_utc?: number }>(act, { fields: 'timezone_offset_hours_utc' })
        .then(c => {
          const offset = Number(c.timezone_offset_hours_utc)
          return buscarHoras(act, periodo, Number.isFinite(offset) ? offset : OFFSET_BRASILIA)
        })
    ),
  ])

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
  const [criativos, regioes, horas] = await extras

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
    criativos,
    regioes,
    horas,
  }
}
