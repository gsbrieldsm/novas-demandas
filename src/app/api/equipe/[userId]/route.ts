import { requireAuth } from '@/lib/supabase'
import { moduloValido } from '@/lib/acesso'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const SENHA_MINIMA = 8

async function donosAtivos(db: SupabaseClient) {
  const { count } = await db.from('equipe_membros').select('user_id', { count: 'exact', head: true }).eq('papel', 'dono').eq('ativo', true)
  return count ?? 0
}

/** Muda módulos, cargo, papel, ativo e/ou a senha de um membro. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth(req, { modulo: 'dono' })
  if ('error' in auth) return auth.error

  const { userId } = await params
  const body = await req.json()

  const { data: atual } = await auth.db.from('equipe_membros').select('papel, ativo').eq('user_id', userId).single()
  if (!atual) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })

  // Nunca deixa o painel sem nenhum dono ativo.
  const perdeDono = atual.papel === 'dono' && atual.ativo && (body.papel === 'membro' || body.ativo === false)
  if (perdeDono && (await donosAtivos(auth.db)) <= 1) {
    return NextResponse.json({ error: 'É preciso manter pelo menos um dono ativo.' }, { status: 400 })
  }

  if (body.senha !== undefined) {
    if (String(body.senha).length < SENHA_MINIMA) return NextResponse.json({ error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` }, { status: 400 })
    const { error } = await auth.db.auth.admin.updateUserById(userId, { password: String(body.senha) })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (typeof body.ativo === 'boolean') {
    // Desativado não consegue nem fazer login; reativado volta na hora.
    const { error } = await auth.db.auth.admin.updateUserById(userId, { ban_duration: body.ativo ? 'none' : '876000h' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof body.nome === 'string' && body.nome.trim()) update.nome = body.nome.trim()
  if (typeof body.cargo === 'string') update.cargo = body.cargo.trim() || null
  if (Array.isArray(body.permissoes)) update.permissoes = body.permissoes.filter(moduloValido)
  if (body.papel === 'dono' || body.papel === 'membro') update.papel = body.papel
  if (typeof body.ativo === 'boolean') update.ativo = body.ativo

  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true })
  const { data, error } = await auth.db.from('equipe_membros').update(update).eq('user_id', userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** Remove o acesso ao painel e apaga o login. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth(req, { modulo: 'dono' })
  if ('error' in auth) return auth.error

  const { userId } = await params
  if (userId === auth.user.id) return NextResponse.json({ error: 'Você não pode remover o seu próprio acesso.' }, { status: 400 })

  const { data: atual } = await auth.db.from('equipe_membros').select('papel, ativo').eq('user_id', userId).maybeSingle()
  if (atual?.papel === 'dono' && atual.ativo && (await donosAtivos(auth.db)) <= 1) {
    return NextResponse.json({ error: 'É preciso manter pelo menos um dono ativo.' }, { status: 400 })
  }

  const { error } = await auth.db.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
