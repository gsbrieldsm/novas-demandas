import { requireAuth } from '@/lib/supabase'
import { hashSenha } from '@/lib/portalAuth'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await req.json()
  const senha = body?.senha as string | undefined

  if (!senha || senha.length < 6) {
    return NextResponse.json({ error: 'Senha precisa ter ao menos 6 caracteres' }, { status: 400 })
  }

  const { data, error } = await auth.db
    .from('clientes_fixos')
    .update({ portal_senha_hash: hashSenha(senha) })
    .eq('id', id)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
