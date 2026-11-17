import { z } from 'zod'
import type { RequestType } from '@/types'

export type SocialTipo = 'pauta' | 'roteiro' | 'plano'
export type SocialStatus = 'rascunho' | 'aprovado'

export const SOCIAL_TIPO_LABELS: Record<SocialTipo, string> = {
  pauta: 'Pauta de postagens',
  roteiro: 'Roteiro',
  plano: 'Plano de marketing',
}

const FORMATOS_POST = ['Reels', 'Carrossel', 'Post estático', 'Stories'] as const
const FORMATOS_ROTEIRO = ['Reels', 'Stories', 'Vídeo longo', 'Anúncio'] as const
const TIPOS_DEMANDA = ['estrategia', 'gravacao', 'conteudo', 'arte', 'edicao', 'outro'] as const

export const PautaSchema = z.object({
  titulo: z.string().describe('Título curto da pauta, ex: "Pauta de dezembro — Black Friday"'),
  resumo: z.string().describe('Linha editorial do período em 2 a 3 frases'),
  posts: z.array(
    z.object({
      data: z.string().describe('Data de publicação no formato AAAA-MM-DD'),
      formato: z.enum(FORMATOS_POST),
      pilar: z.string().describe('Pilar de conteúdo a que o post pertence'),
      tema: z.string().describe('Tema do post em uma frase'),
      gancho: z.string().describe('Primeira frase ou cena que prende a atenção'),
      roteiro_visual: z.array(z.string()).describe('Texto de cada slide (carrossel) ou descrição de cada cena (Reels/Stories), um item por slide ou cena; vazio em post estático de imagem única'),
      legenda: z.string().describe('Legenda completa, pronta para publicar — só o texto da legenda, sem o conteúdo dos slides'),
      cta: z.string().describe('Chamada para ação'),
      hashtags: z.array(z.string()).describe('Hashtags sem o símbolo #'),
    })
  ),
})

export const RoteiroSchema = z.object({
  titulo: z.string(),
  formato: z.enum(FORMATOS_ROTEIRO),
  duracao: z.string().describe('Duração estimada, ex: "45 segundos"'),
  objetivo: z.string().describe('O que o vídeo precisa causar em quem assiste'),
  gancho: z.string().describe('Os 3 primeiros segundos: fala e imagem'),
  cenas: z.array(
    z.object({
      tempo: z.string().describe('Intervalo, ex: "0:03–0:10"'),
      visual: z.string().describe('O que aparece na tela: plano, ação, cenário'),
      fala: z.string().describe('Fala exata ou locução; vazio se não houver'),
      texto_tela: z.string().describe('Texto sobreposto; vazio se não houver'),
    })
  ),
  cta: z.string(),
  legenda: z.string().describe('Legenda para publicação'),
  dicas_gravacao: z.array(z.string()).describe('Orientações práticas para o dia da gravação'),
})

export const PlanoSchema = z.object({
  titulo: z.string(),
  diagnostico: z.string().describe('Leitura do momento atual do cliente'),
  publico_alvo: z.string(),
  posicionamento: z.string(),
  objetivos: z.array(z.string()).describe('Objetivos mensuráveis'),
  pilares: z.array(
    z.object({
      nome: z.string(),
      descricao: z.string(),
      exemplos: z.array(z.string()).describe('Ideias concretas de conteúdo deste pilar'),
    })
  ),
  canais: z.array(
    z.object({
      canal: z.string(),
      frequencia: z.string(),
      papel: z.string().describe('Função do canal na estratégia'),
    })
  ),
  cronograma: z.array(
    z.object({
      periodo: z.string().describe('Ex: "Semana 1" ou "Mês 2"'),
      foco: z.string(),
      entregas: z.array(z.string()),
    })
  ),
  kpis: z.array(z.string()),
  acoes: z.array(
    z.object({
      titulo: z.string().describe('Ação executável, escrita como título de demanda'),
      descricao: z.string(),
      tipo: z.enum(TIPOS_DEMANDA),
      prazo_dias: z.number().describe('Prazo em dias corridos a partir de hoje'),
    })
  ).describe('Primeiras ações para tirar o plano do papel'),
})

export type Pauta = z.infer<typeof PautaSchema>
export type Roteiro = z.infer<typeof RoteiroSchema>
export type Plano = z.infer<typeof PlanoSchema>

export const SOCIAL_SCHEMAS = { pauta: PautaSchema, roteiro: RoteiroSchema, plano: PlanoSchema }

export interface DemandaVinculada {
  /** "post:3", "roteiro" ou "acao:1" */
  chave: string
  ticket_id: string
}

interface SocialBase {
  id: string
  created_at: string
  updated_at: string
  cliente_fixo_id: string
  titulo: string
  briefing: string | null
  status: SocialStatus
  demandas: DemandaVinculada[]
}

export type SocialConteudo =
  | (SocialBase & { tipo: 'pauta'; conteudo: Pauta })
  | (SocialBase & { tipo: 'roteiro'; conteudo: Roteiro })
  | (SocialBase & { tipo: 'plano'; conteudo: Plano })

export interface DemandaProposta {
  chave: string
  rotulo: string
  title: string
  description: string
  request_type: RequestType
  deadline: string | null
  where_used: string | null
  purpose: string | null
}

function isoEmDias(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + Math.max(0, Math.round(dias)))
  return d.toISOString().slice(0, 10)
}

export function roteiroComoTexto(r: Roteiro) {
  const cenas = r.cenas
    .map(c =>
      [
        `[${c.tempo}]`,
        `Visual: ${c.visual}`,
        c.fala && `Fala: ${c.fala}`,
        c.texto_tela && `Texto na tela: ${c.texto_tela}`,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n')
  return [
    `Formato: ${r.formato} · ${r.duracao}`,
    `Objetivo: ${r.objetivo}`,
    `GANCHO\n${r.gancho}`,
    `CENAS\n${cenas}`,
    `CTA\n${r.cta}`,
    `LEGENDA\n${r.legenda}`,
    r.dicas_gravacao.length > 0 && `DICAS DE GRAVAÇÃO\n${r.dicas_gravacao.map(d => `- ${d}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Tudo que um conteúdo aprovado pode virar no quadro de demandas. */
export function demandasPropostas(item: SocialConteudo): DemandaProposta[] {
  if (item.tipo === 'pauta') {
    return item.conteudo.posts.map((p, i) => ({
      chave: `post:${i}`,
      rotulo: p.tema,
      title: `${p.formato}: ${p.tema}`,
      description: [
        `Gancho: ${p.gancho}`,
        p.roteiro_visual.length > 0 && `Slides / cenas:\n${p.roteiro_visual.map((s, n) => `${n + 1}. ${s}`).join('\n')}`,
        `Legenda:\n${p.legenda}`,
        `CTA: ${p.cta}`,
        p.hashtags.length > 0 && p.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' '),
        `Origem: ${item.titulo}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      request_type: p.formato === 'Carrossel' || p.formato === 'Post estático' ? 'arte' : 'conteudo',
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(p.data) ? p.data : null,
      where_used: 'Instagram',
      purpose: p.pilar,
    }))
  }

  if (item.tipo === 'roteiro') {
    return [
      {
        chave: 'roteiro',
        rotulo: item.conteudo.titulo,
        title: `Gravação: ${item.conteudo.titulo}`,
        description: roteiroComoTexto(item.conteudo),
        request_type: 'gravacao',
        deadline: null,
        where_used: 'Instagram',
        purpose: item.conteudo.objetivo,
      },
    ]
  }

  return item.conteudo.acoes.map((a, i) => ({
    chave: `acao:${i}`,
    rotulo: a.titulo,
    title: a.titulo,
    description: `${a.descricao}\n\nOrigem: ${item.titulo}`,
    request_type: a.tipo,
    deadline: isoEmDias(a.prazo_dias),
    where_used: null,
    purpose: null,
  }))
}
