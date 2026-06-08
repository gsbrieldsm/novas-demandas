import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { data, error } = await auth.db.from('configuracoes').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const obj: Record<string, string> = {}
  for (const row of data ?? []) obj[row.chave] = row.valor
  return NextResponse.json(obj)
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { chave, valor } = await req.json()
  if (!chave) return NextResponse.json({ error: 'chave required' }, { status: 400 })

  const { data, error } = await auth.db
    .from('configuracoes')
    .upsert({ chave, valor: String(valor), updated_at: new Date().toISOString() }, { onConflict: 'chave' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
