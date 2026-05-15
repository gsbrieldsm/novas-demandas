import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Ticket } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Verifica se a requisição tem um token válido de usuário autenticado.
 * Retorna o client Supabase com contexto do usuário, ou NextResponse 401.
 */
export async function requireAuth(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (!token) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data, error } = await client.auth.getUser(token)

  if (error || !data?.user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  return { db: client, user: data.user }
}

export type { Ticket }
