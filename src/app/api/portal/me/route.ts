import { getServiceClient } from '@/lib/supabase'
import { getPortalSession } from '@/lib/portalAuth'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = getPortalSession(req)
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  const { data: cliente } = await db
    .from('clientes_fixos')
    .select('id, nome, logo_url, escopo_mensal, portal_ativo')
    .eq('id', session.clienteFixoId)
    .single()

  if (!cliente || !cliente.portal_ativo) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cfNome = cliente.nome?.toLowerCase().trim()

  const { data: ticketsPorId } = await db
    .from('tickets')
    .select('id, title, description, request_type, status, priority, created_at, where_used, deadline')
    .eq('cliente_fixo_id', cliente.id)
    .eq('visivel_portal', true)

  const { data: ticketsPorNome } = await db
    .from('tickets')
    .select('id, title, description, request_type, status, priority, created_at, where_used, deadline')
    .eq('is_fixed_client', true)
    .eq('visivel_portal', true)
    .or(`client_name.ilike.${cfNome},company.ilike.${cfNome}`)

  const vistos = new Set<string>()
  const tickets = [...(ticketsPorId ?? []), ...(ticketsPorNome ?? [])].filter(t => {
    if (vistos.has(t.id)) return false
    vistos.add(t.id)
    return true
  })

  const { data: documentos } = await db
    .from('documentos_cliente')
    .select('id, titulo, blocos, updated_at')
    .eq('cliente_fixo_id', cliente.id)
    .eq('visivel_portal', true)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    cliente: { id: cliente.id, nome: cliente.nome, logo_url: cliente.logo_url, escopo_mensal: cliente.escopo_mensal },
    tickets,
    documentos: documentos ?? [],
  })
}
