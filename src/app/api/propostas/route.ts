import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const clienteFixoId = searchParams.get('cliente_fixo_id')
  const leadId = searchParams.get('lead_id')
  const status = searchParams.get('status')

  let query = auth.db.from('propostas').select('*')
  if (clienteFixoId) query = query.eq('cliente_fixo_id', clienteFixoId)
  if (leadId) query = query.eq('lead_id', leadId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const body = await req.json()
  const { data, error } = await auth.db.from('propostas').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
