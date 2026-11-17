import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req, { modulo: 'social' })
  if ('error' in auth) return auth.error

  const clienteId = new URL(req.url).searchParams.get('cliente_id')

  let query = auth.db.from('social_conteudos').select('*')
  if (clienteId) query = query.eq('cliente_fixo_id', clienteId)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, { modulo: 'social' })
  if ('error' in auth) return auth.error

  const { cliente_fixo_id, tipo, titulo, briefing, conteudo } = await req.json()
  const { data, error } = await auth.db
    .from('social_conteudos')
    .insert({ cliente_fixo_id, tipo, titulo, briefing, conteudo })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  return NextResponse.json(data)
}
