import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const ticketId = searchParams.get('ticket_id')
  const ativo = searchParams.get('ativo')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = auth.db.from('tempo_apontamentos').select('*')
  if (ticketId) query = query.eq('ticket_id', ticketId)
  if (ativo === 'true') query = query.eq('ativo', true)
  if (from) query = query.gte('data', from)
  if (to) query = query.lte('data', to)

  const { data, error } = await query.order('data', { ascending: false }).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const body = await req.json()
  const { data, error } = await auth.db.from('tempo_apontamentos').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
