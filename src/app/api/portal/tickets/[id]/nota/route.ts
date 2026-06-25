import { getServiceClient } from '@/lib/supabase'
import { getPortalSession } from '@/lib/portalAuth'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getPortalSession(req)
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const nota = typeof body?.nota === 'string' ? body.nota.trim() : ''

  const db = getServiceClient()

  const { data: cliente } = await db
    .from('clientes_fixos')
    .select('id, nome, portal_ativo')
    .eq('id', session.clienteFixoId)
    .single()

  if (!cliente || !cliente.portal_ativo) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cfNome = cliente.nome?.toLowerCase().trim()

  const { data: ticket } = await db
    .from('tickets')
    .select('id, cliente_fixo_id, is_fixed_client, client_name, company, visivel_portal')
    .eq('id', id)
    .single()

  const pertenceAoCliente = ticket && ticket.visivel_portal && (
    ticket.cliente_fixo_id === cliente.id ||
    (ticket.is_fixed_client && (
      ticket.client_name?.toLowerCase().trim() === cfNome ||
      ticket.company?.toLowerCase().trim() === cfNome
    ))
  )

  if (!pertenceAoCliente) {
    return NextResponse.json({ error: 'Demanda não encontrada' }, { status: 404 })
  }

  const { error } = await db
    .from('tickets')
    .update({ nota_cliente: nota || null, nota_cliente_em: nota ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
