import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const clienteId = new URL(req.url).searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'Informe o cliente.' }, { status: 400 })

  const { data, error } = await auth.db
    .from('agentes_reunioes')
    .select('*')
    .eq('cliente_fixo_id', clienteId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  return NextResponse.json(data)
}
