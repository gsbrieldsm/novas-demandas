import { getServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * Endpoint público — não requer auth.
 * Permite que o cliente abra o link da proposta direto.
 * Marca `visto_em` na primeira visualização.
 *
 * Retorna apenas campos seguros (esconde observações internas, ids relacionados, etc).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getServiceClient()

  const { data, error } = await db
    .from('propostas')
    .select('id, created_at, cliente_nome, cliente_empresa, cliente_email, titulo, modalidade, apresentacao, escopo, valor, prazo_dias, observacoes, validade, status, enviada_em, resposta_em, visto_em, aceito_por_nome, aceito_por_email, dados_fiscais_status, cliente_cnpj, cliente_razao_social, cliente_telefone')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
  }

  // Marca primeira visualização (silenciosamente)
  if (!data.visto_em) {
    await db
      .from('propostas')
      .update({ visto_em: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json(data)
}
