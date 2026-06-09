import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { getServiceClient } from '@/lib/supabase'
import { sendNewTicketEmail, sendClientTicketCreated } from '@/lib/email'
import type { ChatMessage, BriefingData } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: Request) {
  const { messages }: { messages: ChatMessage[] } = await req.json()

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
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
        const db = getServiceClient()
        for (const match of matches) {
          try {
            const briefing: BriefingData = JSON.parse(match[1])
            const { data } = await db
              .from('tickets')
              .insert({
                ...briefing,
                chat_transcript: messages,
              })
              .select('*')
              .single()

            if (data) {
              const ticketIdMarker = `\n[TICKET_ID:${data.id}]`
              controller.enqueue(new TextEncoder().encode(ticketIdMarker))
              // Notificação interna pro Gabriel (fire-and-forget)
              sendNewTicketEmail(data).catch(err => console.error('email error:', err))
              // Confirmação pro cliente (fire-and-forget)
              if (data.client_email) {
                sendClientTicketCreated({
                  ticketId: data.id,
                  clientName: data.client_name,
                  clientEmail: data.client_email,
                  ticketTitle: data.title,
                }).catch(err => console.error('email cliente error:', err))
              }
            }
          } catch (e) {
            console.error('Erro ao criar ticket:', e)
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
