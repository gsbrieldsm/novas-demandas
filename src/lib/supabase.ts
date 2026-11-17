import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Ticket } from '@/types'
import { moduloValido, pode, type Acesso, type Modulo } from '@/lib/acesso'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface OpcoesAcesso {
  /** Módulo exigido. Com uma lista, basta ter um deles. 'dono' = só donos. Sem valor = qualquer membro ativo. */
  modulo?: Modulo | Modulo[] | 'dono'
  /** Em vez de 403, responde 200 com este valor (ex.: [] em listas usadas por várias telas). */
  vazio?: unknown
}

function negar(opcoes: OpcoesAcesso, mensagem = 'Sem permissão para este módulo.') {
  return 'vazio' in opcoes
    ? NextResponse.json(opcoes.vazio)
    : NextResponse.json({ error: mensagem }, { status: 403 })
}

/**
 * Verifica o login e a permissão do membro da equipe.
 * Devolve o client do banco com a service role: o acesso já foi conferido
 * aqui, e o banco bloqueia o acesso direto de quem não é dono.
 */
export async function requireAuth(req: Request, opcoes: OpcoesAcesso = {}) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (!token) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  const db = getServiceClient()
  const { data, error } = await db.auth.getUser(token)

  if (error || !data?.user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  const user = data.user
  const membro = await db
    .from('equipe_membros')
    .select('nome, email, papel, permissoes, ativo')
    .eq('user_id', user.id)
    .maybeSingle()

  let acesso: Acesso
  if (membro.error && /equipe_membros|PGRST205|42P01/.test(`${membro.error.code} ${membro.error.message}`)) {
    // Tabela de equipe ainda não criada: mantém o comportamento antigo (todo login é dono).
    acesso = { userId: user.id, nome: user.email ?? '', email: user.email ?? '', papel: 'dono', permissoes: [] }
  } else if (!membro.data || !membro.data.ativo) {
    return { error: NextResponse.json({ error: 'Seu acesso ao painel não está ativo.' }, { status: 403 }) }
  } else {
    acesso = {
      userId: user.id,
      nome: membro.data.nome,
      email: membro.data.email,
      papel: membro.data.papel,
      permissoes: (membro.data.permissoes ?? []).filter(moduloValido),
    }
  }

  if (opcoes.modulo === 'dono' && acesso.papel !== 'dono') return { error: negar(opcoes, 'Só o dono acessa esta área.') }
  if (opcoes.modulo && opcoes.modulo !== 'dono' && !pode(acesso, opcoes.modulo)) return { error: negar(opcoes) }

  return { db, user, acesso, pode: (m: Modulo | Modulo[]) => pode(acesso, m) }
}

export type { Ticket }
