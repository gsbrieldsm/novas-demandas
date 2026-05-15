import { supabase } from './supabase'

/**
 * Wrapper de fetch que injeta automaticamente o token de autenticação
 * do usuário logado no header Authorization.
 *
 * Use em todas as chamadas para /api/* (exceto rotas públicas como /api/chat).
 */
export async function api(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return fetch(input, { ...init, headers })
}
