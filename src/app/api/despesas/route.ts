import { requireAuth } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const ano = searchParams.get('ano')

  let query = auth.db.from('despesas').select('*')
  if (mes) query = query.eq('mes', mes)
  if (ano) query = query.eq('ano', ano)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const body = await req.json()

  // Despesa recorrente: gera uma linha por mês, cada uma controlável (paga/não paga) independentemente
  if (body.recorrente && body.recorrencia_meses && body.recorrencia_meses > 1) {
    const meses = Number(body.recorrencia_meses)
    const grupoId = crypto.randomUUID()
    const diaVencimento = body.vencimento ? Number(String(body.vencimento).slice(8, 10)) : null
    const linhas = Array.from({ length: meses }, (_, i) => {
      const data = new Date(body.ano, body.mes - 1 + i, 1)
      const mesData = data.getMonth() + 1
      const anoData = data.getFullYear()
      let vencimento = body.vencimento ?? null
      if (diaVencimento) {
        const ultimoDia = new Date(anoData, mesData, 0).getDate()
        const dia = Math.min(diaVencimento, ultimoDia)
        vencimento = `${anoData}-${String(mesData).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      }
      return {
        ...body,
        mes: mesData,
        ano: anoData,
        vencimento,
        recorrencia_grupo_id: grupoId,
      }
    })
    const { data, error } = await auth.db.from('despesas').insert(linhas).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data[0])
  }

  const { data, error } = await auth.db.from('despesas').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
