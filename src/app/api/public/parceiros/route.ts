import { getServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * Endpoint público — qualquer pessoa pode se cadastrar pro programa de parceiros.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })

  const { nome, email, whatsapp, cidade, como } = body as {
    nome?: string; email?: string; whatsapp?: string; cidade?: string; como?: string
  }

  if (!nome?.trim() || !email?.trim() || !whatsapp?.trim()) {
    return NextResponse.json({ error: 'Nome, e-mail e WhatsApp são obrigatórios' }, { status: 422 })
  }

  const db = getServiceClient()
  const { error } = await db
    .from('parceiros')
    .insert({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp.trim(),
      cidade: cidade?.trim() || null,
      como: como?.trim() || null,
      status: 'novo',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
