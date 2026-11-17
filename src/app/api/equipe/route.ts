import { requireAuth } from '@/lib/supabase'
import { moduloValido } from '@/lib/acesso'
import { NextResponse } from 'next/server'

const SENHA_MINIMA = 8

/** Equipe completa, com os logins que ainda não têm acesso ao painel. */
export async function GET(req: Request) {
  const auth = await requireAuth(req, { modulo: 'dono' })
  if ('error' in auth) return auth.error

  const [membros, usuarios] = await Promise.all([
    auth.db.from('equipe_membros').select('*').order('created_at'),
    auth.db.auth.admin.listUsers({ perPage: 200 }),
  ])
  if (membros.error) return NextResponse.json({ error: membros.error.message, code: membros.error.code }, { status: 500 })
  if (usuarios.error) return NextResponse.json({ error: usuarios.error.message }, { status: 500 })

  const porId = new Map(usuarios.data.users.map(u => [u.id, u]))
  const lista = (membros.data ?? []).map(m => ({
    ...m,
    ultimo_login: porId.get(m.user_id)?.last_sign_in_at ?? null,
    voce: m.user_id === auth.user.id,
  }))
  const comAcesso = new Set(lista.map(m => m.user_id))
  const semAcesso = usuarios.data.users
    .filter(u => !comAcesso.has(u.id))
    .map(u => ({ user_id: u.id, email: u.email ?? '', ultimo_login: u.last_sign_in_at ?? null }))

  return NextResponse.json({ membros: lista, semAcesso })
}

/** Cria o login (ou usa um que já existe) e dá acesso ao painel. */
export async function POST(req: Request) {
  const auth = await requireAuth(req, { modulo: 'dono' })
  if ('error' in auth) return auth.error

  const { nome, email, cargo, senha, permissoes, user_id } = await req.json()
  const mods: string[] = Array.isArray(permissoes) ? permissoes.filter(moduloValido) : []
  if (!String(nome ?? '').trim()) return NextResponse.json({ error: 'Informe o nome.' }, { status: 400 })

  let userId: string = user_id
  let mail = String(email ?? '').trim().toLowerCase()

  if (userId) {
    // Login que já existe (ex.: criado no Supabase) recebendo acesso agora.
    const { data, error } = await auth.db.auth.admin.getUserById(userId)
    if (error || !data.user) return NextResponse.json({ error: 'Login não encontrado.' }, { status: 404 })
    mail = data.user.email ?? mail
    if (senha) {
      if (String(senha).length < SENHA_MINIMA) return NextResponse.json({ error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` }, { status: 400 })
      const up = await auth.db.auth.admin.updateUserById(userId, { password: senha })
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 })
    }
  } else {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    if (String(senha ?? '').length < SENHA_MINIMA) return NextResponse.json({ error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` }, { status: 400 })
    const { data, error } = await auth.db.auth.admin.createUser({
      email: mail,
      password: senha,
      email_confirm: true,
      user_metadata: { name: String(nome).trim() },
    })
    if (error) {
      const msg = /already|registered|exists/i.test(error.message) ? 'Já existe um login com este e-mail. Ele aparece em “Logins sem acesso”.' : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    userId = data.user.id
  }

  const { data, error } = await auth.db
    .from('equipe_membros')
    .insert({ user_id: userId, nome: String(nome).trim(), email: mail, cargo: cargo?.trim() || null, papel: 'membro', permissoes: mods })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
