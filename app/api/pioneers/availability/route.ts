import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  try {
    const supabase = admin()
    const { data, error } = await supabase
      .from('pioneer_seats')
      .select('sold, cap')
      .eq('id', true)
      .maybeSingle()

    if (error) {
      console.error('pioneer_seats read failed', error.message)
      return NextResponse.json({ error: 'availability unavailable' }, { status: 503 })
    }

    const sold = data?.sold ?? 0
    const cap = data?.cap ?? 100
    const remaining = Math.max(cap - sold, 0)

    return NextResponse.json({
      sold,
      cap,
      remaining,
      soldOut: remaining <= 0,
      offer: {
        priceAnnualUsd: 990,
        tier: 'pro',
        rateLock: 'forever_while_subscribed',
        listProAnnualUsd: 1990,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'availability unavailable' }, { status: 503 })
  }
}
