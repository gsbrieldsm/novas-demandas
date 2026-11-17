import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { contextoAoVivo } from '@/lib/contexto'
import { AGENTES, AtaSchema, type AgenteId, type EventoReuniao, type MensagemAgente } from '@/lib/agentes'

// Quatro falas + a ata passam do limite padrão das funções serverless.
export const maxDuration = 300

const MODELO = 'claude-opus-5-5'

// Cada agente usa a própria chave da Anthropic, para separar custo e limite.
// Sem chave própria, cai na chave geral do sistema.
const clientes: Record<AgenteId | 'ata', Anthropic> = {
  trafego: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_TRAFEGO || process.env.ANTHROPIC_API_KEY }),
  social: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_SOCIAL || process.env.ANTHROPIC_API_KEY }),
  ata: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
}

const COMUM = `Você está numa reunião interna da agência Gabriel Moraes & Co com outro agente de IA, sobre um cliente da agência. A conversa é lida pelo dono da agência, que decide o que aprovar.

Fale em português do Brasil, como um colega de agência experiente: direto, específico, sem jargão vazio. Cada fala tem no máximo 180 palavras, em texto corrido ou com uma lista curta; sem títulos e sem negrito. Use os números do contexto quando eles sustentarem o que você diz. Nunca invente um dado que não está no contexto; se um dado faltar, diga que falta e o que ele mudaria. Responda ao que o outro agente disse em vez de repetir o seu cenário.`

const SISTEMA: Record<AgenteId, string> = {
  trafego: `Você é o agente de tráfego pago. Você enxerga as campanhas do cliente no Meta Ads: investimento, entrega, custo por resultado e o funil até a compra. O outro agente cuida do Instagram orgânico e da produção de conteúdo.

Seu papel: passar o cenário atual dos anúncios, apontar o que falta e o que você precisa do conteúdo (criativos, formatos, ganchos, provas sociais) e propor o que vai melhorar nas campanhas.

${COMUM}`,
  social: `Você é o agente de social media. Você enxerga o Instagram do cliente (alcance, engajamento, formatos e os posts que mais e menos funcionaram) e o histórico de conteúdo produzido. O outro agente cuida das campanhas pagas no Meta Ads.

Seu papel: passar o cenário atual do Instagram, conectar os dados orgânicos com o que os anúncios mostram, dizer o que você precisa do tráfego (públicos, orçamento para impulsionar, testes de criativo) e comprometer-se com o conteúdo que vai produzir.

${COMUM}`,
}

const TURNOS: { agente: AgenteId; instrucao: string }[] = [
  { agente: 'trafego', instrucao: 'Abra a reunião: o cenário atual dos anúncios, o que está funcionando, o que preocupa e o que você precisa do social media.' },
  { agente: 'social', instrucao: 'Responda ao agente de tráfego: o cenário do Instagram, como esses dados se conectam com o que ele trouxe e o que você precisa do tráfego.' },
  { agente: 'trafego', instrucao: 'Feche o seu lado: o que vai mudar nas campanhas, em ordem de prioridade, e quais criativos você pede ao social media.' },
  { agente: 'social', instrucao: 'Feche a reunião: o conteúdo que você se compromete a produzir nas próximas duas semanas (temas e formatos) e o que vamos medir para saber se funcionou.' },
]

function transcricao(mensagens: MensagemAgente[]) {
  return mensagens.map(m => `[${AGENTES[m.agente].nome}]: ${m.texto}`).join('\n\n')
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, { modulo: 'agentes' })
  if ('error' in auth) return auth.error

  const { cliente_id, foco }: { cliente_id?: string; foco?: string } = await req.json()
  if (!cliente_id) return NextResponse.json({ error: 'Informe o cliente.' }, { status: 400 })

  const { data: cliente } = await auth.db
    .from('clientes_fixos')
    .select('nome, escopo_mensal, observacoes_internas')
    .eq('id', cliente_id)
    .single()
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const encoder = new TextEncoder()
  const corpo = new ReadableStream({
    async start(controller) {
      const enviar = (e: EventoReuniao) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
      const mensagens: MensagemAgente[] = []

      try {
        const [aoVivo, conteudos, tickets] = await Promise.all([
          contextoAoVivo(auth.db, cliente_id),
          auth.db.from('social_conteudos').select('tipo, titulo, status, created_at').eq('cliente_fixo_id', cliente_id).order('created_at', { ascending: false }).limit(8),
          auth.db.from('tickets').select('title, request_type, status').eq('cliente_fixo_id', cliente_id).order('created_at', { ascending: false }).limit(12),
        ])
        enviar({ tipo: 'contexto', trafego: !!aoVivo.trafego, instagram: !!aoVivo.instagram, avisos: aoVivo.avisos })

        const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        const base = [
          `Cliente: ${cliente.nome}`,
          cliente.escopo_mensal && `Escopo contratado:\n${cliente.escopo_mensal}`,
          cliente.observacoes_internas && `Observações internas:\n${cliente.observacoes_internas}`,
          `Hoje é ${hoje}.`,
        ].filter(Boolean).join('\n\n')

        // Cada agente só recebe os dados da própria área, como numa reunião de verdade.
        const dados: Record<AgenteId, string> = {
          trafego: aoVivo.trafego ? `Meta Ads (dados de hoje):\n${aoVivo.trafego}` : 'Meta Ads: sem conta vinculada ou sem dados disponíveis.',
          social: [
            aoVivo.instagram ? `Instagram (dados de hoje):\n${aoVivo.instagram}` : 'Instagram: sem conta vinculada ou sem dados disponíveis.',
            conteudos.data?.length && `Pautas, roteiros e planos recentes no Estúdio:\n${conteudos.data.map(c => `- ${c.titulo} (${c.tipo}, ${c.status})`).join('\n')}`,
            tickets.data?.length && `Demandas recentes da equipe:\n${tickets.data.map(t => `- ${t.title} (${t.request_type}, ${t.status})`).join('\n')}`,
          ].filter(Boolean).join('\n\n'),
        }

        for (const turno of TURNOS) {
          enviar({ tipo: 'turno', agente: turno.agente })
          const pedido = [
            `<contexto>\n${base}\n\n${dados[turno.agente]}\n</contexto>`,
            foco?.trim() && `Pauta que a agência pediu para esta reunião: ${foco.trim()}`,
            mensagens.length ? `<reuniao_ate_agora>\n${transcricao(mensagens)}\n</reuniao_ate_agora>` : 'A reunião está começando agora.',
            `Sua vez. ${turno.instrucao}`,
          ].filter(Boolean).join('\n\n')

          const stream = clientes[turno.agente].beta.messages.stream({
            model: MODELO,
            max_tokens: 8000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            output_config: { effort: 'low' },
            system: SISTEMA[turno.agente],
            messages: [{ role: 'user', content: pedido }],
          })

          let texto = ''
          for await (const ev of stream) {
            if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
              texto += ev.delta.text
              enviar({ tipo: 'texto', agente: turno.agente, delta: ev.delta.text })
            }
          }
          const final = await stream.finalMessage()
          if (final.stop_reason === 'refusal') throw new Error('Um dos agentes recusou continuar. Ajuste o foco da reunião e tente de novo.')
          mensagens.push({ agente: turno.agente, texto: texto.trim() })
          enviar({ tipo: 'fim_turno', agente: turno.agente })
        }

        enviar({ tipo: 'ata_inicio' })
        const resposta = await clientes.ata.beta.messages.parse({
          model: MODELO,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: betaZodOutputFormat(AtaSchema) },
          system: 'Você escreve a ata de reuniões internas de uma agência de marketing brasileira. Registre só o que foi dito ou acordado na reunião, de forma objetiva, em português do Brasil.',
          messages: [{
            role: 'user',
            content: `Cliente: ${cliente.nome}. Hoje é ${hoje}.\n\n<reuniao>\n${transcricao(mensagens)}\n</reuniao>\n\nEscreva a ata desta reunião.`,
          }],
        })
        if (!resposta.parsed_output) throw new Error('A ata veio incompleta. Rode a reunião de novo.')
        const ata = resposta.parsed_output
        enviar({ tipo: 'ata', ata })

        const { data: salvo, error } = await auth.db
          .from('agentes_reunioes')
          .insert({ cliente_fixo_id: cliente_id, foco: foco?.trim() || null, mensagens, resumo: ata })
          .select()
          .single()
        enviar(error
          ? { tipo: 'salvo', reuniao: null, aviso: 'A reunião não foi salva: rode a migração “Agentes” do final de supabase/schema.sql.' }
          : { tipo: 'salvo', reuniao: salvo })
      } catch (e) {
        let mensagem = e instanceof Error ? e.message : 'Falha na reunião.'
        if (e instanceof Anthropic.AuthenticationError) mensagem = 'Chave da API do Claude inválida ou ausente para um dos agentes.'
        else if (e instanceof Anthropic.RateLimitError) mensagem = 'Limite de uso do Claude atingido. Tente de novo em instantes.'
        else if (e instanceof Anthropic.APIError) mensagem = `Falha na API do Claude (${e.status ?? 'rede'}).`
        console.error('agentes/reuniao:', e)
        enviar({ tipo: 'erro', mensagem })
      }
      controller.close()
    },
  })

  return new Response(corpo, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
