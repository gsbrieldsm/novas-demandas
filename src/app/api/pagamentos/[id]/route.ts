import { getServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const db = getServiceClient()
  const { data, error } = await db
    .from('pagamentos')
    .update({ ...body, recebido_em: body.recebido ? new Date().toISOString() : null })
    .eq('id', id)
    .select('*, cliente:clientes_fixos(id, nome, email, valor_mensal, dia_vencimento)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
