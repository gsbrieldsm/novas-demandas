import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const ano = searchParams.get('ano')

  let query = auth.db.from('receitas_avulsas').select('*')
  if (mes) query = query.eq('mes', mes)
  if (ano) query = query.eq('ano', ano)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const body = await req.json()
  const { data, error } = await auth.db.from('receitas_avulsas').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
