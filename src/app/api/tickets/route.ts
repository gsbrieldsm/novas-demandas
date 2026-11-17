import { requireAuth } from '@/lib/supabase'
import { sendNewTicketEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import { CAMPOS_FINANCEIROS, removerCampos, semCampos } from '@/lib/acesso'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { data, error } = await auth.db
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (auth.pode('financeiro')) return NextResponse.json(data)
  return NextResponse.json((data ?? []).map(t => semCampos(t, CAMPOS_FINANCEIROS.tickets)))
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, { modulo: ['demandas', 'social'] })
  if ('error' in auth) return auth.error

  const financeiro = auth.pode('financeiro')
  const recebido = await req.json()
  const body = financeiro ? recebido : removerCampos(recebido, CAMPOS_FINANCEIROS.tickets)
  const { data, error } = await auth.db
    .from('tickets')
    .insert({ chat_transcript: [], ...body })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  sendNewTicketEmail(data).catch(err => console.error('email error:', err))
  return NextResponse.json(financeiro ? data : semCampos(data, CAMPOS_FINANCEIROS.tickets))
}
