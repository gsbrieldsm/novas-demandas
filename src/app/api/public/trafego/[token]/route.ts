import { getServiceClient } from '@/lib/supabase'
import { MetaErro, dadosTrafego } from '@/lib/meta'
import { periodoValido, planoPublico, type PlanoItem } from '@/lib/trafego'
import { NextResponse } from 'next/server'

/**
 * Endpoint público do link do cliente — não requer login.
 * Só responde para links ativos e devolve apenas o que o cliente pode ver:
 * métricas, campanhas e os itens do plano já aprovados.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!/^[a-f0-9]{32}$/.test(token)) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })

  const db = getServiceClient()
  const { data: conta } = await db
    .from('trafego_contas')
    .select('meta_ad_account_id, link_ativo, recado, plano, updated_at, clientes_fixos(nome)')
    .eq('link_token', token)
    .single()

  if (!conta || !conta.link_ativo) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 })

  const periodo = periodoValido(new URL(req.url).searchParams.get('periodo'))
  const cliente = (conta.clientes_fixos as unknown as { nome: string } | null)?.nome ?? ''
  const base = { cliente, recado: conta.recado, plano: planoPublico((conta.plano ?? []) as PlanoItem[]) }

  try {
    return NextResponse.json({ ...base, dados: await dadosTrafego(conta.meta_ad_account_id, periodo) })
  } catch (e) {
    // Mesmo se o Meta falhar, o cliente ainda vê o plano e o recado.
    const msg = e instanceof MetaErro && e.status === 503 ? 'Métricas indisponíveis no momento.' : 'Não foi possível carregar as métricas agora.'
    return NextResponse.json({ ...base, dados: null, aviso: msg })
  }
}
