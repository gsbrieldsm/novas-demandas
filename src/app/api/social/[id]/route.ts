import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const EDITAVEIS = ['titulo', 'conteudo', 'status', 'demandas'] as const

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await req.json()
  const update = Object.fromEntries(EDITAVEIS.filter(k => k in body).map(k => [k, body[k]]))

  const { data, error } = await auth.db
    .from('social_conteudos')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const { error } = await auth.db.from('social_conteudos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
