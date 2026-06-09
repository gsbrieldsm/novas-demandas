import { requireAuth } from '@/lib/supabase'
import { sendClientStatusChanged } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const { data, error } = await auth.db
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await req.json()

  // Se status mudou, buscamos o anterior pra comparar
  let statusAnterior: string | null = null
  if (body.status) {
    const { data: prev } = await auth.db
      .from('tickets')
      .select('status')
      .eq('id', id)
      .single()
    statusAnterior = prev?.status ?? null
  }

  const { data, error } = await auth.db
    .from('tickets')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dispara email pro cliente se status mudou pra um relevante
  if (
    data &&
    data.client_email &&
    body.status &&
    body.status !== statusAnterior &&
    ['em_andamento', 'em_revisao', 'concluido', 'cancelado'].includes(body.status)
  ) {
    sendClientStatusChanged(
      {
        ticketId: data.id,
        clientName: data.client_name,
        clientEmail: data.client_email,
        ticketTitle: data.title,
      },
      body.status as 'em_andamento' | 'em_revisao' | 'concluido' | 'cancelado'
    ).catch(err => console.error('email cliente status:', err))
  }

  return NextResponse.json(data)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const { error } = await auth.db.from('tickets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
