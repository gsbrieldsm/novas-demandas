import { getServiceClient } from '@/lib/supabase'
import { verificarSenha, criarSessionToken, PORTAL_COOKIE_NAME, PORTAL_COOKIE_MAX_AGE } from '@/lib/portalAuth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const email = body?.email?.trim()?.toLowerCase()
  const senha = body?.senha

  if (!email || !senha) {
    return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })
  }

  const db = getServiceClient()
  const { data: cliente } = await db
    .from('clientes_fixos')
    .select('id, nome, portal_email, portal_senha_hash, portal_ativo')
    .eq('portal_email', email)
    .single()

  if (!cliente || !cliente.portal_ativo || !cliente.portal_senha_hash) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })
  }

  if (!verificarSenha(senha, cliente.portal_senha_hash)) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })
  }

  const token = criarSessionToken(cliente.id)
  const res = NextResponse.json({ ok: true, nome: cliente.nome })
  res.cookies.set(PORTAL_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PORTAL_COOKIE_MAX_AGE,
  })
  return res
}
