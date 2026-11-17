import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { SOCIAL_SCHEMAS, SOCIAL_TIPO_LABELS, type SocialTipo } from '@/lib/social'
import { contextoAoVivo } from '@/lib/contexto'

// Planos e pautas longas passam do limite padrão das funções serverless.
export const maxDuration = 300

const anthropic = new Anthropic()

const SYSTEM = `Você é o estrategista de conteúdo de uma agência de marketing brasileira. Escreve pautas de postagens, roteiros de vídeo e planos de marketing para os clientes da agência.

O que você entrega vai direto para aprovação e depois vira demanda para a equipe executar, então precisa estar pronto para uso: legendas completas, falas exatas, ações que alguém consegue começar amanhã. Tudo deve ser específico para o cliente descrito no contexto — o segmento, o escopo contratado e o que já foi produzido. Um texto que serviria para qualquer empresa não serve.

Escreva em português do Brasil, no tom de quem fala com o público do cliente, sem jargão de marketing nas legendas e falas. Não repita temas que já aparecem na lista de demandas recentes. Quando o contexto não trouxer uma informação (público, diferenciais, números), parta do que o segmento indica e deixe a suposição evidente no próprio texto do diagnóstico ou do resumo, em vez de inventar fatos sobre o cliente.

Quando o contexto trouxer dados ao vivo do Instagram e do tráfego pago, baseie as escolhas neles: repita os formatos e temas que mais engajaram, evite o padrão dos posts que menos engajaram e alinhe o conteúdo orgânico com o que as campanhas pagas estão promovendo. Cite o número que justificou a escolha quando ele ajudar a agência a aprovar.`

interface GerarBody {
  cliente_id: string
  tipo: SocialTipo
  briefing?: string
  opcoes?: Record<string, string>
  ajuste?: { conteudo: unknown; instrucao: string }
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function pedido(tipo: SocialTipo, o: Record<string, string>) {
  if (tipo === 'pauta') {
    return `Monte uma pauta com ${o.quantidade || '8'} postagens, com datas a partir de ${o.inicio || 'hoje'}, distribuídas ao longo do período e variando os formatos conforme o que cada tema pede.`
  }
  if (tipo === 'roteiro') {
    return `Escreva um roteiro de ${o.formato || 'Reels'} com duração em torno de ${o.duracao || '45 segundos'}, cena a cena, com falas exatas.`
  }
  return `Monte um plano de marketing para ${o.periodo || 'os próximos 3 meses'}, terminando com as primeiras ações que a agência deve executar.`
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { cliente_id, tipo, briefing, opcoes = {}, ajuste }: GerarBody = await req.json()
  const schema = SOCIAL_SCHEMAS[tipo]
  if (!cliente_id || !schema) {
    return NextResponse.json({ error: 'Informe cliente e tipo de conteúdo.' }, { status: 400 })
  }

  const [cliente, metricas, tickets, documentos, aoVivo] = await Promise.all([
    auth.db.from('clientes_fixos').select('nome, escopo_mensal, observacoes_internas').eq('id', cliente_id).single(),
    auth.db.from('metricas_mensais').select('mes, ano, seguidores, engajamento_percent, alcance, visualizacoes, observacoes')
      .eq('cliente_fixo_id', cliente_id).order('ano', { ascending: false }).order('mes', { ascending: false }).limit(3),
    auth.db.from('tickets').select('title, request_type, created_at')
      .eq('cliente_fixo_id', cliente_id).order('created_at', { ascending: false }).limit(20),
    auth.db.from('documentos_cliente').select('titulo, blocos').eq('cliente_fixo_id', cliente_id),
    // Instagram e Meta Ads ao vivo; se falhar, gera só com o resto do contexto.
    contextoAoVivo(auth.db, cliente_id).catch(() => null),
  ])

  if (cliente.error || !cliente.data) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  const c = cliente.data
  const contexto = [
    `Cliente: ${c.nome}`,
    c.escopo_mensal && `Escopo contratado:\n${c.escopo_mensal}`,
    c.observacoes_internas && `Observações internas da agência:\n${c.observacoes_internas}`,
    metricas.data?.length &&
      `Métricas recentes das redes:\n${metricas.data
        .map(m => `- ${MESES[m.mes - 1]}/${m.ano}: ${m.seguidores ?? '?'} seguidores, ${m.engajamento_percent ?? '?'}% de engajamento, ${m.alcance ?? '?'} de alcance, ${m.visualizacoes ?? '?'} visualizações${m.observacoes ? ` — ${m.observacoes}` : ''}`)
        .join('\n')}`,
    aoVivo?.instagram && `Instagram ao vivo (dados de hoje):\n${aoVivo.instagram}`,
    aoVivo?.trafego && `Tráfego pago no Meta Ads (dados de hoje):\n${aoVivo.trafego}`,
    tickets.data?.length &&
      `Demandas recentes já produzidas ou em produção:\n${tickets.data.map(t => `- ${t.title} (${t.request_type})`).join('\n')}`,
    ...(documentos.data ?? []).map(d => {
      const blocos = (d.blocos as { titulo: string; conteudo: string }[] | null) ?? []
      return `Documento "${d.titulo}":\n${blocos.map(b => `${b.titulo}\n${b.conteudo}`).join('\n\n')}`
    }),
  ]
    .filter(Boolean)
    .join('\n\n')

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const tarefa = ajuste
    ? `Esta é a versão atual de um(a) ${SOCIAL_TIPO_LABELS[tipo].toLowerCase()} deste cliente:\n\n${JSON.stringify(ajuste.conteudo, null, 2)}\n\nReescreva aplicando este ajuste pedido pela agência, mantendo o que não foi citado:\n${ajuste.instrucao}`
    : `${pedido(tipo, opcoes)}${briefing?.trim() ? `\n\nDirecionamento da agência:\n${briefing.trim()}` : ''}`

  try {
    const response = await anthropic.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `<contexto_do_cliente>\n${contexto}\n</contexto_do_cliente>\n\nHoje é ${hoje}.\n\n${tarefa}`,
        },
      ],
      output_config: { format: betaZodOutputFormat(schema) },
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'O modelo recusou este pedido. Reformule o direcionamento.' }, { status: 422 })
    }
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      return NextResponse.json({ error: 'A resposta veio incompleta. Tente pedir menos itens de uma vez.' }, { status: 502 })
    }

    return NextResponse.json({ conteudo: response.parsed_output })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'Chave da API do Claude inválida ou ausente.' }, { status: 500 })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Limite de uso do Claude atingido. Tente de novo em instantes.' }, { status: 429 })
    }
    if (error instanceof Anthropic.APIError) {
      console.error('social/gerar:', error.status, error.message)
      return NextResponse.json({ error: `Falha ao gerar (${error.status ?? 'rede'}).` }, { status: 502 })
    }
    throw error
  }
}
