import { requireAuth } from '@/lib/supabase'
import { MetaErro } from '@/lib/meta'
import { snapshotInstagram } from '@/lib/instagram'
import { NextResponse } from 'next/server'

/** Retrato ao vivo do Instagram vinculado ao cliente. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, { modulo: 'social' })
  if ('error' in auth) return auth.error

  const { id } = await params
  const { data, error } = await auth.db.from('clientes_fixos').select('instagram_user_id').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  const igId = (data as { instagram_user_id?: string | null }).instagram_user_id
  if (!igId) return NextResponse.json({ vinculado: false })

  try {
    return NextResponse.json({ vinculado: true, snapshot: await snapshotInstagram(igId) })
  } catch (e) {
    const status = e instanceof MetaErro ? e.status : 500
    return NextResponse.json({ vinculado: true, error: e instanceof Error ? e.message : 'Falha ao consultar o Instagram.' }, { status })
  }
}
