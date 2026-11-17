import { MetaErro, graph } from './meta'

// Instagram Graph API (contas Comerciais/Criador ligadas a uma página do
// Facebook que o System User enxerga). Só servidor — usa META_ACCESS_TOKEN.
// O token precisa de instagram_basic, instagram_manage_insights e
// pages_read_engagement.

export interface ContaInstagram {
  id: string
  username: string
  nome: string
  foto: string | null
  seguidores: number
  pagina: string
}

export interface PostInstagram {
  id: string
  legenda: string
  formato: 'Reels' | 'Carrossel' | 'Imagem' | 'Vídeo' | 'Stories'
  data: string
  link: string
  imagem: string | null
  curtidas: number
  comentarios: number
  alcance: number | null
  salvamentos: number | null
  compartilhamentos: number | null
  visualizacoes: number | null
  interacoes: number
}

export interface FormatoResumo {
  formato: PostInstagram['formato']
  posts: number
  alcanceMedio: number | null
  interacoesMedias: number
}

export interface SnapshotInstagram {
  atualizadoEm: string
  perfil: {
    id: string
    username: string
    nome: string
    bio: string
    foto: string | null
    seguidores: number
    seguindo: number
    totalPosts: number
  }
  conta28d: { alcance: number | null; contasEngajadas: number | null; interacoes: number | null; visitasPerfil: number | null }
  posts: PostInstagram[]
  postsUltimos30d: number
  alcanceMedio: number | null
  /** interações ÷ alcance, média dos posts com alcance (%) */
  taxaEngajamento: number | null
  porFormato: FormatoResumo[]
  melhores: PostInstagram[]
  piores: PostInstagram[]
  avisos: string[]
}

export async function contasInstagram(): Promise<ContaInstagram[]> {
  const r = await graph<{
    data: {
      name: string
      instagram_business_account?: { id: string; username: string; name?: string; profile_picture_url?: string; followers_count?: number }
    }[]
  }>('me/accounts', {
    fields: 'name,instagram_business_account{id,username,name,profile_picture_url,followers_count}',
    limit: '100',
  })
  return r.data
    .filter(p => p.instagram_business_account)
    .map(p => {
      const ig = p.instagram_business_account!
      return {
        id: ig.id,
        username: ig.username,
        nome: ig.name ?? ig.username,
        foto: ig.profile_picture_url ?? null,
        seguidores: ig.followers_count ?? 0,
        pagina: p.name,
      }
    })
}

function formatoDe(m: { media_type: string; media_product_type?: string }): PostInstagram['formato'] {
  if (m.media_product_type === 'REELS') return 'Reels'
  if (m.media_product_type === 'STORY') return 'Stories'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'Carrossel'
  if (m.media_type === 'VIDEO') return 'Vídeo'
  return 'Imagem'
}

type Insights = { data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }

function valor(ins: Insights | null, nome: string) {
  const m = ins?.data.find(d => d.name === nome)
  if (!m) return null
  return m.total_value?.value ?? m.values?.[0]?.value ?? null
}

/** Métricas por post. Os nomes aceitos mudam por tipo de mídia e versão da API, então tenta do mais completo ao mínimo. */
async function insightsPost(id: string): Promise<Insights | null> {
  for (const metric of ['reach,saved,shares,views,total_interactions', 'reach,saved,shares,total_interactions', 'reach']) {
    try {
      return await graph<Insights>(`${id}/insights`, { metric })
    } catch {
      // tenta o próximo conjunto
    }
  }
  return null
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export async function snapshotInstagram(igId: string): Promise<SnapshotInstagram> {
  if (!/^\d+$/.test(igId)) throw new MetaErro('ID do Instagram inválido.', 400)
  const avisos: string[] = []

  const agora = Math.floor(Date.now() / 1000)
  const [perfil, midias, conta] = await Promise.all([
    graph<{ id: string; username: string; name?: string; biography?: string; profile_picture_url?: string; followers_count?: number; follows_count?: number; media_count?: number }>(
      igId,
      { fields: 'username,name,biography,profile_picture_url,followers_count,follows_count,media_count' }
    ),
    graph<{ data: { id: string; caption?: string; media_type: string; media_product_type?: string; timestamp: string; permalink: string; thumbnail_url?: string; media_url?: string; like_count?: number; comments_count?: number }[] }>(
      `${igId}/media`,
      { fields: 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count', limit: '24' }
    ),
    graph<Insights>(`${igId}/insights`, {
      metric: 'reach,accounts_engaged,total_interactions,profile_views',
      period: 'day',
      metric_type: 'total_value',
      since: String(agora - 28 * 86400),
      until: String(agora),
    }).catch(() => {
      avisos.push('Sem acesso às métricas da conta (falta a permissão instagram_manage_insights).')
      return null
    }),
  ])

  const insights = await Promise.all(midias.data.map(m => insightsPost(m.id)))
  if (midias.data.length > 0 && insights.every(i => i === null)) {
    avisos.push('Sem acesso ao alcance dos posts (falta a permissão instagram_manage_insights).')
  }

  const posts: PostInstagram[] = midias.data.map((m, i) => {
    const ins = insights[i]
    const curtidas = m.like_count ?? 0
    const comentarios = m.comments_count ?? 0
    const salvamentos = valor(ins, 'saved')
    const compartilhamentos = valor(ins, 'shares')
    return {
      id: m.id,
      legenda: (m.caption ?? '').slice(0, 280),
      formato: formatoDe(m),
      data: m.timestamp,
      link: m.permalink,
      imagem: m.thumbnail_url ?? m.media_url ?? null,
      curtidas,
      comentarios,
      alcance: valor(ins, 'reach'),
      salvamentos,
      compartilhamentos,
      visualizacoes: valor(ins, 'views'),
      interacoes: valor(ins, 'total_interactions') ?? curtidas + comentarios + (salvamentos ?? 0) + (compartilhamentos ?? 0),
    }
  })

  const comAlcance = posts.filter(p => p.alcance && p.alcance > 0)
  const limite30 = Date.now() - 30 * 86400_000
  const formatos = [...new Set(posts.map(p => p.formato))]
  const ordenados = [...posts].sort((a, b) => b.interacoes - a.interacoes)

  return {
    atualizadoEm: new Date().toISOString(),
    perfil: {
      id: perfil.id,
      username: perfil.username,
      nome: perfil.name ?? perfil.username,
      bio: perfil.biography ?? '',
      foto: perfil.profile_picture_url ?? null,
      seguidores: perfil.followers_count ?? 0,
      seguindo: perfil.follows_count ?? 0,
      totalPosts: perfil.media_count ?? 0,
    },
    conta28d: {
      alcance: valor(conta, 'reach'),
      contasEngajadas: valor(conta, 'accounts_engaged'),
      interacoes: valor(conta, 'total_interactions'),
      visitasPerfil: valor(conta, 'profile_views'),
    },
    posts,
    postsUltimos30d: posts.filter(p => new Date(p.data).getTime() >= limite30).length,
    alcanceMedio: media(comAlcance.map(p => p.alcance!)),
    taxaEngajamento: comAlcance.length ? media(comAlcance.map(p => (p.interacoes / p.alcance!) * 100)) : null,
    porFormato: formatos
      .map(f => {
        const doFormato = posts.filter(p => p.formato === f)
        return {
          formato: f,
          posts: doFormato.length,
          alcanceMedio: media(doFormato.filter(p => p.alcance).map(p => p.alcance!)),
          interacoesMedias: media(doFormato.map(p => p.interacoes)) ?? 0,
        }
      })
      .sort((a, b) => b.interacoesMedias - a.interacoesMedias),
    melhores: ordenados.slice(0, 3),
    piores: posts.length > 5 ? ordenados.slice(-3).reverse() : [],
    avisos,
  }
}
