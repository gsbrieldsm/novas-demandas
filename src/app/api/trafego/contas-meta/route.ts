import { requireAuth } from '@/lib/supabase'
import { MetaErro, contasDisponiveis, metaConfigurado } from '@/lib/meta'
import { NextResponse } from 'next/server'

/** Contas de anúncios que o System User do Meta enxerga. */
export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  if (!metaConfigurado()) return NextResponse.json({ configurado: false, contas: [] })
  try {
    return NextResponse.json({ configurado: true, contas: await contasDisponiveis() })
  } catch (e) {
    const status = e instanceof MetaErro ? e.status : 500
    return NextResponse.json({ configurado: true, contas: [], error: e instanceof Error ? e.message : 'Falha' }, { status })
  }
}
