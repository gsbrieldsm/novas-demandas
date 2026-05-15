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
  const { data, error } = await auth.db
    .from('pagamentos')
    .update({ ...body, recebido_em: body.recebido ? new Date().toISOString() : null })
    .eq('id', id)
    .select('*, cliente:clientes_fixos(id, nome, email, valor_mensal, dia_vencimento)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
