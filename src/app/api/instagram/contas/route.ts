import { requireAuth } from '@/lib/supabase'
import { MetaErro, metaConfigurado } from '@/lib/meta'
import { contasInstagram } from '@/lib/instagram'
import { NextResponse } from 'next/server'

/** Contas do Instagram que o System User enxerga (via páginas do Facebook). */
export async function GET(req: Request) {
  const auth = await requireAuth(req, { modulo: 'social' })
  if ('error' in auth) return auth.error

  if (!metaConfigurado()) return NextResponse.json({ configurado: false, contas: [] })
  try {
    return NextResponse.json({ configurado: true, contas: await contasInstagram() })
  } catch (e) {
    const status = e instanceof MetaErro ? e.status : 500
    return NextResponse.json({ configurado: true, contas: [], error: e instanceof Error ? e.message : 'Falha' }, { status })
  }
}
