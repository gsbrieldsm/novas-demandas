import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { briefingManha, contasDoMes, fechamentoDia } from '@/lib/assistente'
import { enviarTelegram } from '@/lib/telegram'

// Webhook do bot: responde comandos, e só para a conversa do Gabriel.
// O Telegram manda o cabeçalho X-Telegram-Bot-Api-Secret-Token definido no setWebhook.
export const dynamic = 'force-dynamic'

const AJUDA = [
  '🤖 <b>Assistente GM&amp;Co</b>',
  '/hoje — o plano do dia',
  '/amanha — o que vem amanhã',
  '/contas — contas a pagar do mês',
  '',
  'Todo dia às 7h30 eu mando o plano e às 18h o fechamento.',
].join('\n')

export async function POST(req: Request) {
  const segredo = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!segredo || req.headers.get('x-telegram-bot-api-secret-token') !== segredo) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const update = (await req.json().catch(() => null)) as { message?: { chat?: { id?: number }; text?: string } } | null
  const chatId = String(update?.message?.chat?.id ?? '')
  // Qualquer outra pessoa que achar o bot é ignorada em silêncio.
  if (!chatId || chatId !== process.env.TELEGRAM_CHAT_ID) return NextResponse.json({ ok: true })

  const comando = (update?.message?.text ?? '').trim().split(/[\s@]/)[0].toLowerCase()
  const db = getServiceClient()
  try {
    if (comando === '/hoje') await enviarTelegram(await briefingManha(db))
    else if (comando === '/amanha') await enviarTelegram(await fechamentoDia(db))
    else if (comando === '/contas') await enviarTelegram(await contasDoMes(db))
    else await enviarTelegram(AJUDA)
  } catch (e) {
    console.error('[assistente] falhou:', e instanceof Error ? e.message : e)
  }
  return NextResponse.json({ ok: true })
}
