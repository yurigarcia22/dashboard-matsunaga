import { NextResponse } from 'next/server'
import { fetchLeads } from '@/lib/sheets'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const leads = await fetchLeads()
    return NextResponse.json(
      { leads, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('Erro ao buscar leads:', err)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
