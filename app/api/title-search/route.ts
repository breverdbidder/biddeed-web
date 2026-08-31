import { NextRequest, NextResponse } from 'next/server'
import { requireAlertContext } from '@/lib/alerts/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) return NextResponse.json({ error: context.error }, { status: 401 })
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (query.length < 2 || query.length > 120) return NextResponse.json({ error: 'Enter at least two characters and no more than 120 characters.' }, { status: 400 })
  const type = request.nextUrl.searchParams.get('type')?.trim()
  const county = request.nextUrl.searchParams.get('county')?.trim()
  let builder = context.supabase.from('v_search_all').select('id,item_type,item_name,project,location_path,created_at,item_date,content_summary,tags').or(`item_name.ilike.%${query}%,location_path.ilike.%${query}%,content_summary.ilike.%${query}%`).limit(50)
  if (type && type.length <= 40) builder = builder.eq('item_type', type)
  if (county && county.length <= 80) builder = builder.ilike('location_path', `%${county}%`)
  const { data, error } = await builder
  if (error) return NextResponse.json({ error: 'Title search is temporarily unavailable.' }, { status: 502 })
  return NextResponse.json({
    results: data ?? [],
    source: { view: 'public.v_search_all', retrieved_at: new Date().toISOString() },
    disclaimer: 'This is source-backed property intelligence, not a title opinion, legal determination, or guarantee of ownership, liens, encumbrances, or priority. Verify with the official county records and qualified counsel.',
  })
}
