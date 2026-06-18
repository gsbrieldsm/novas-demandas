import { getServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * Endpoint público pra cliente preencher dados fiscais (CNPJ/Razão Social/Telefone)
 * pra emissão de NF e boleto. Só permite depois que a proposta foi aceita.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { tipo, cnpj, razao_social, telefone } = body as {
    tipo?: 'preenchido' | 'nao_necessario'
    cnpj?: string
    razao_social?: string
    telefone?: string
  }

  if (tipo !== 'preenchido' && tipo !== 'nao_necessario') {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  if (tipo === 'preenchido' && (!cnpj?.trim() || !razao_social?.trim())) {
    return NextResponse.json({ error: 'CNPJ e Razão Social são obrigatórios' }, { status: 400 })
  }

  const db = getServiceClient()

  const { data: atual } = await db
    .from('propostas')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!atual) {
    return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
  }
  if (atual.status !== 'aceita') {
    return NextResponse.json({ error: 'Esta proposta ainda não foi aceita' }, { status: 400 })
  }

  const { error } = await db
    .from('propostas')
    .update({
      dados_fiscais_status: tipo,
      cliente_cnpj: tipo === 'preenchido' ? cnpj!.trim() : null,
      cliente_razao_social: tipo === 'preenchido' ? razao_social!.trim() : null,
      cliente_telefone: tipo === 'preenchido' ? (telefone?.trim() || null) : null,
      dados_fiscais_em: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
