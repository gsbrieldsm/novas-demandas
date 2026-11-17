import { requireAuth } from '@/lib/supabase'
import { normalizarContaId } from '@/lib/meta'
import { NextResponse } from 'next/server'

const EDITAVEIS = ['plano', 'link_ativo', 'recado', 'meta_ad_account_id'] as const

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await req.json()
  const update: Record<string, unknown> = Object.fromEntries(EDITAVEIS.filter(k => k in body).map(k => [k, body[k]]))

  if ('meta_ad_account_id' in update) {
    const act = normalizarContaId(String(update.meta_ad_account_id ?? ''))
    if (!act) return NextResponse.json({ error: 'ID de conta inválido.' }, { status: 400 })
    update.meta_ad_account_id = act
  }
  // Gera um link novo; o antigo deixa de funcionar na hora.
  if (body.novo_link) update.link_token = crypto.randomUUID().replace(/-/g, '')

  const { data, error } = await auth.db
    .from('trafego_contas')
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
  const { error } = await auth.db.from('trafego_contas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
