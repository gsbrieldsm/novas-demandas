import { getServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const ano = searchParams.get('ano')
  const db = getServiceClient()

  let query = db.from('pagamentos').select('*, cliente:clientes_fixos(id, nome, email, valor_mensal, dia_vencimento)')
  if (mes) query = query.eq('mes', mes)
  if (ano) query = query.eq('ano', ano)

  const { data, error } = await query.order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const db = getServiceClient()
  const { data, error } = await db
    .from('pagamentos')
    .upsert(body, { onConflict: 'cliente_id,mes,ano' })
    .select('*, cliente:clientes_fixos(id, nome, email, valor_mensal, dia_vencimento)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
