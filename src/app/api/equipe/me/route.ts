import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/** Quem está logado e o que pode ver — usado pelo menu e pelo bloqueio das telas. */
export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  return NextResponse.json(auth.acesso)
}
