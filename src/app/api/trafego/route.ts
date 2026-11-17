import { requireAuth } from '@/lib/supabase'
import { normalizarContaId } from '@/lib/meta'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { data, error } = await auth.db.from('trafego_contas').select('*')
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  return NextResponse.json(data)
}

/** Vincula (ou troca) a conta de anúncios de um cliente. */
export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { cliente_fixo_id, meta_ad_account_id } = await req.json()
  const act = normalizarContaId(String(meta_ad_account_id ?? ''))
  if (!cliente_fixo_id || !act) {
    return NextResponse.json({ error: 'Informe o cliente e um ID de conta válido (ex.: act_123456789).' }, { status: 400 })
  }

  const { data, error } = await auth.db
    .from('trafego_contas')
    .upsert({ cliente_fixo_id, meta_ad_account_id: act }, { onConflict: 'cliente_fixo_id' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  return NextResponse.json(data)
}
