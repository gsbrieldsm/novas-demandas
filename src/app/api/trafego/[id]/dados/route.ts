import { requireAuth } from '@/lib/supabase'
import { MetaErro, dadosTrafego } from '@/lib/meta'
import { periodoValido } from '@/lib/trafego'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const periodo = periodoValido(new URL(req.url).searchParams.get('periodo'))

  const { data: conta, error } = await auth.db
    .from('trafego_contas')
    .select('meta_ad_account_id')
    .eq('id', id)
    .single()
  if (error || !conta) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 })

  try {
    return NextResponse.json(await dadosTrafego(conta.meta_ad_account_id, periodo))
  } catch (e) {
    const status = e instanceof MetaErro ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao consultar o Meta.' }, { status })
  }
}
