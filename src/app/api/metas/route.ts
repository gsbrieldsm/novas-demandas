import { getServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const ano = searchParams.get('ano')
  const db = getServiceClient()

  if (mes && ano) {
    const { data, error } = await db
      .from('metas')
      .select('*')
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? { mes: Number(mes), ano: Number(ano), meta_fixo: 0, meta_avulso: 0 })
  }

  const { data, error } = await db.from('metas').select('*').order('ano', { ascending: false }).order('mes', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const db = getServiceClient()
  const { data, error } = await db
    .from('metas')
    .upsert({ ...body, updated_at: new Date().toISOString() }, { onConflict: 'mes,ano' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
