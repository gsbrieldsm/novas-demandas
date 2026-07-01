import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await req.json()
  const { data, error } = await auth.db.from('receitas_avulsas').update(body).eq('id', id).select().single()
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
  const { error } = await auth.db.from('receitas_avulsas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
