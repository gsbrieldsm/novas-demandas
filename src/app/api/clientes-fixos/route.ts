import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { CAMPOS_FINANCEIROS, clienteVisivel, removerCampos } from '@/lib/acesso'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { data, error } = await auth.db
    .from('clientes_fixos')
    .select('*')
    .order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const financeiro = auth.pode('financeiro')
  return NextResponse.json((data ?? []).map(c => clienteVisivel(c, financeiro)))
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, { modulo: 'clientes' })
  if ('error' in auth) return auth.error

  const financeiro = auth.pode('financeiro')
  const recebido = await req.json()
  // Sem Financeiro, o cliente nasce com valor zerado para o dono preencher depois.
  const body = financeiro ? recebido : { ...removerCampos(recebido, CAMPOS_FINANCEIROS.clientes_fixos), valor_mensal: 0 }
  const { data, error } = await auth.db
    .from('clientes_fixos')
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(clienteVisivel(data, financeiro))
}
