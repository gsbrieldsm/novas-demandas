import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = auth.db.from('eventos').select('*')
  if (from) query = query.gte('start_at', from)
  if (to) query = query.lte('start_at', to)

  const { data, error } = await query.order('start_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const body = await req.json()
  const { data, error } = await auth.db.from('eventos').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
