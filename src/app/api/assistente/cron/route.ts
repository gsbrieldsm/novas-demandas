import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { briefingManha, fechamentoDia } from '@/lib/assistente'
import { enviarTelegram, telegramConfigurado } from '@/lib/telegram'

// Chamado pelo Vercel Cron (vercel.json): ?tipo=manha às 7h30 e ?tipo=noite às 18h (Brasília).
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  if (!telegramConfigurado()) return NextResponse.json({ error: 'Telegram não configurado' }, { status: 503 })

  const tipo = new URL(req.url).searchParams.get('tipo') === 'noite' ? 'noite' : 'manha'
  const db = getServiceClient()
  const texto = tipo === 'noite' ? await fechamentoDia(db) : await briefingManha(db)
  await enviarTelegram(texto)
  return NextResponse.json({ ok: true, tipo })
}
