import Anthropic from '@anthropic-ai/sdk'
import { getPortalSystemPrompt } from '@/lib/system-prompt'
import { getServiceClient } from '@/lib/supabase'
import { getPortalSession } from '@/lib/portalAuth'
import { sendNewTicketEmail } from '@/lib/email'
import type { ChatMessage, BriefingData } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: Request) {
  const session = getPortalSession(req)
  if (!session) {
    return new Response('unauthorized', { status: 401 })
  }

  const db = getServiceClient()
  const { data: cliente } = await db
    .from('clientes_fixos')
    .select('id, nome, email, portal_ativo')
    .eq('id', session.clienteFixoId)
    .single()

  if (!cliente || !cliente.portal_ativo) {
    return new Response('unauthorized', { status: 401 })
  }

  const { messages }: { messages: ChatMessage[] } = await req.json()

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: getPortalSystemPrompt(cliente.nome),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  let fullText = ''

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const text = chunk.delta.text
          fullText += text
          controller.enqueue(new TextEncoder().encode(text))
        }
      }

      if (fullText.includes('[BRIEFING_COMPLETO]')) {
        const matches = [...fullText.matchAll(/```json\s*\n([\s\S]*?)\n\s*```/g)]
        for (const match of matches) {
          try {
            const briefing: BriefingData = JSON.parse(match[1])
            const { data } = await db
              .from('tickets')
              .insert({
                ...briefing,
                client_name: cliente.nome,
                client_email: cliente.email ?? null,
                company: cliente.nome,
                is_fixed_client: true,
                cliente_fixo_id: cliente.id,
                visivel_portal: true,
                chat_transcript: messages,
              })
              .select('*')
              .single()

            if (data) {
              const ticketIdMarker = `\n[TICKET_ID:${data.id}]`
              controller.enqueue(new TextEncoder().encode(ticketIdMarker))
              sendNewTicketEmail(data).catch(err => console.error('email error:', err))
            }
          } catch (e) {
            console.error('Erro ao criar ticket via portal:', e)
          }
        }
      }

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
