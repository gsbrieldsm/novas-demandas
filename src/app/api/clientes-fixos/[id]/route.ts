import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { CAMPOS_FINANCEIROS, clienteVisivel, removerCampos } from '@/lib/acesso'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const recebido: Record<string, unknown> = await req.json()
  // Quem tem só Social media pode vincular o Instagram; o resto da ficha é do módulo Clientes.
  const soInstagram = Object.keys(recebido).every(k => k === 'instagram_user_id')
  if (!auth.pode('clientes') && !(soInstagram && auth.pode('social'))) {
    return NextResponse.json({ error: 'Sem permissão para este módulo.' }, { status: 403 })
  }
  const financeiro = auth.pode('financeiro')
  const body = removerCampos(financeiro ? recebido : removerCampos(recebido, CAMPOS_FINANCEIROS.clientes_fixos), ['portal_senha_hash'])
  const { data, error } = await auth.db
    .from('clientes_fixos')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(clienteVisivel(data, financeiro))
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, { modulo: 'clientes' })
  if ('error' in auth) return auth.error

  const { id } = await params
  const { error } = await auth.db.from('clientes_fixos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
