import { getPortalSession } from '@/lib/portalAuth'
import { getServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getPortalSession(req)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data, error } = await db
    .from('estrategias')
    .select('id, titulo, descricao, nodes, edges, created_at, updated_at')
    .eq('cliente_fixo_id', session.clienteId)
    .eq('visivel_portal', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
