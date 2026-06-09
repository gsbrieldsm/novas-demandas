import { getServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * Endpoint público pra cliente aceitar a proposta.
 * Só permite se a proposta estiver com status 'enviada' ou 'rascunho'.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { nome, email } = body as { nome?: string; email?: string }

  if (!nome || !nome.trim()) {
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  }

  const db = getServiceClient()

  // Confirma que a proposta existe e não foi respondida ainda
  const { data: atual } = await db
    .from('propostas')
    .select('id, status, validade, cliente_fixo_id, modalidade, valor, cliente_nome, cliente_email, escopo')
    .eq('id', id)
    .single()

  if (!atual) {
    return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
  }

  if (atual.status === 'aceita') {
    return NextResponse.json({ error: 'Proposta já foi aceita' }, { status: 400 })
  }
  if (atual.status === 'recusada') {
    return NextResponse.json({ error: 'Proposta foi recusada' }, { status: 400 })
  }
  if (atual.status === 'expirada') {
    return NextResponse.json({ error: 'Proposta expirou' }, { status: 400 })
  }

  // Checa se passou da validade
  if (atual.validade) {
    const validade = new Date(atual.validade + 'T23:59:59')
    if (validade < new Date()) {
      await db.from('propostas').update({ status: 'expirada' }).eq('id', id)
      return NextResponse.json({ error: 'Esta proposta expirou' }, { status: 400 })
    }
  }

  const now = new Date().toISOString()
  const { error } = await db
    .from('propostas')
    .update({
      status: 'aceita',
      resposta_em: now,
      aceito_por_nome: nome.trim(),
      aceito_por_email: email?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
