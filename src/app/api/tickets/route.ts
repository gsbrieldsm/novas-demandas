import { getServiceClient } from '@/lib/supabase'
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
