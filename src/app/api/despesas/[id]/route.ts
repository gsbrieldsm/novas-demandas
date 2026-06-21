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
  const { data, error } = await auth.db.from('despesas').update(body).eq('id', id).select().single()
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
  const { searchParams } = new URL(req.url)
  const serie = searchParams.get('serie') === 'true'

  if (serie) {
    const { data: atual } = await auth.db.from('despesas').select('recorrencia_grupo_id, mes, ano').eq('id', id).single()
    if (atual?.recorrencia_grupo_id) {
      const { error } = await auth.db
        .from('despesas')
        .delete()
        .eq('recorrencia_grupo_id', atual.recorrencia_grupo_id)
        .or(`ano.gt.${atual.ano},and(ano.eq.${atual.ano},mes.gte.${atual.mes})`)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
  }

  const { error } = await auth.db.from('despesas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
