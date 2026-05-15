import { getServiceClient } from '@/lib/supabase'
import { sendNewTicketEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function GET() {
  const db = getServiceClient()
  const { data, error } = await db
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const db = getServiceClient()
  const { data, error } = await db
    .from('tickets')
    .insert({ chat_transcript: [], ...body })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Notificação por email (fire-and-forget)
  sendNewTicketEmail(data).catch(err => console.error('email error:', err))
  return NextResponse.json(data)
}
