import { NextRequest, NextResponse } from 'next/server'
import { requireAlertContext } from '@/lib/alerts/server'
import { lookupSkipTrace, parseSkipTraceRequest, skipTraceProviderEnabled } from '@/lib/skiptrace/provider'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) return NextResponse.json({ error: context.error }, { status: 401 })
  const input = parseSkipTraceRequest(await request.json().catch(() => null))
  if (!input) return NextResponse.json({ error: 'Invalid skip-trace request.' }, { status: 400 })
  if (!skipTraceProviderEnabled()) return NextResponse.json({ error: 'Skip-trace provider is not enabled for this account.' }, { status: 503, headers: { 'Retry-After': '3600' } })
  try {
    const result = await lookupSkipTrace(input)
    return NextResponse.json(result)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SKIPTRACE_UNAVAILABLE'
    if (code.startsWith('SKIPTRACE_PROVIDER_ADAPTER_PENDING')) return NextResponse.json({ error: 'Skip-trace provider integration is pending compliance approval.' }, { status: 503, headers: { 'Retry-After': '3600' } })
    return NextResponse.json({ error: 'Skip-trace service is temporarily unavailable.' }, { status: 503, headers: { 'Retry-After': '300' } })
  }
}
