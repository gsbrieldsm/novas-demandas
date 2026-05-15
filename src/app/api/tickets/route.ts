import { requireAuth } from '@/lib/supabase'
import { sendNewTicketEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { data, error } = await auth.db
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const body = await req.json()
  const { data, error } = await auth.db
    .from('tickets')
    .insert({ chat_transcript: [], ...body })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  sendNewTicketEmail(data).catch(err => console.error('email error:', err))
  return NextResponse.json(data)
}
