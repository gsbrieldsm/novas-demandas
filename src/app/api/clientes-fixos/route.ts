import { getServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const db = getServiceClient()
  const { data, error } = await db
    .from('clientes_fixos')
    .select('*')
    .order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const db = getServiceClient()
  const { data, error } = await db
    .from('clientes_fixos')
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
