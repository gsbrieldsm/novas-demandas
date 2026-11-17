import { requireAuth } from '@/lib/supabase'
import { novoId, type PlanoItem } from '@/lib/trafego'
import type { Ata } from '@/lib/agentes'
import { NextResponse } from 'next/server'

/** Envia as ações de tráfego da ata para o plano de ação do cliente, como "Proposto". */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, { modulo: ['agentes', 'trafego'] })
  if ('error' in auth) return auth.error

  const { id } = await params
  const { data: reuniao } = await auth.db.from('agentes_reunioes').select('cliente_fixo_id, resumo, enviados').eq('id', id).single()
  if (!reuniao?.resumo) return NextResponse.json({ error: 'Reunião sem ata.' }, { status: 404 })

  const { data: conta } = await auth.db.from('trafego_contas').select('id, plano').eq('cliente_fixo_id', reuniao.cliente_fixo_id).maybeSingle()
  if (!conta) return NextResponse.json({ error: 'Vincule a conta de anúncios do cliente na tela Tráfego pago antes.' }, { status: 409 })

  const hoje = Date.now()
  const novos: PlanoItem[] = (reuniao.resumo as Ata).acoes_trafego.map(a => ({
    id: novoId(),
    titulo: a.titulo,
    descricao: a.descricao,
    prazo: new Date(hoje + Math.max(a.prazo_dias, 0) * 86400_000).toISOString().slice(0, 10),
    status: 'proposto',
  }))

  const { error } = await auth.db.from('trafego_contas').update({ plano: [...((conta.plano ?? []) as PlanoItem[]), ...novos] }).eq('id', conta.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enviados = { ...(reuniao.enviados ?? {}), plano_trafego: true }
  await auth.db.from('agentes_reunioes').update({ enviados }).eq('id', id)
  return NextResponse.json({ adicionados: novos.length, enviados })
}
