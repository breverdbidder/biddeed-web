import { NextRequest, NextResponse } from 'next/server'
import { requireAlertContext } from '@/lib/alerts/server'
import { alertsCsv, exportFilename, mergeCalendars, sentAlert, singleCalendar, type NotificationRow, type WatchHealth } from '@/lib/alerts/history'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PARITY CP-5: the alerts a customer's watches have sent, read from Supabase
// and scoped to the signed-in account (same trust model as /api/alerts/watches:
// customer_id comes from the Clerk session only). The recipient address is
// never selected.
//   ?format=json (default)  the list the Scheduled page shows, plus job health
//   ?format=csv             every alert, as a spreadsheet
//   ?format=ics[&id=N]      the current sale dates (or one alert's date) as a calendar file
const FIELDS = 'id,watch_id,alert_type,subject,body_text,ics,send_status,resend_id,last_error,created_at,sent_at,auction_watches!inner(case_number,county,customer_id)'
const LIMIT = 500
const NO_STORE = { 'Cache-Control': 'private, no-store' }

function download(body: string, type: string, filename: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function GET(request: NextRequest) {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) return NextResponse.json({ error: context.error }, { status: 401, headers: NO_STORE })
  const params = request.nextUrl.searchParams
  const format = params.get('format') ?? 'json'
  if (format !== 'json' && format !== 'csv' && format !== 'ics') return NextResponse.json({ error: 'Unknown export format.' }, { status: 400, headers: NO_STORE })
  const id = params.get('id')
  if (id !== null && (format !== 'ics' || !/^\d{1,18}$/.test(id))) return NextResponse.json({ error: 'Invalid alert identifier.' }, { status: 400, headers: NO_STORE })

  let query = context.supabase
    .from('auction_watch_notifications')
    .select(FIELDS)
    .eq('auction_watches.customer_id', context.userId)
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (id) query = query.eq('id', id)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load your sent alerts.' }, { status: 502, headers: NO_STORE })
  const rows = (data ?? []) as unknown as NotificationRow[]
  const now = new Date()

  if (format === 'csv') return download(alertsCsv(rows.map(sentAlert)), 'text/csv; charset=utf-8', exportFilename('csv', now))

  if (format === 'ics') {
    if (id) {
      const ics = rows[0]?.ics
      if (!ics) return NextResponse.json({ error: 'Alert not found.' }, { status: 404, headers: NO_STORE })
      return download(singleCalendar(ics), 'text/calendar; charset=utf-8', exportFilename('ics', now, id))
    }
    return download(mergeCalendars(rows), 'text/calendar; charset=utf-8', exportFilename('ics', now))
  }

  // Job health for the page's status line. Absent (null) until the
  // deed_watch_health() function exists; the page then shows no status line.
  let health: WatchHealth | null = null
  const rpc = await context.supabase.rpc('deed_watch_health')
  if (!rpc.error && rpc.data && typeof rpc.data === 'object') health = rpc.data as WatchHealth

  return NextResponse.json({ alerts: rows.map(sentAlert), health, truncated: rows.length === LIMIT }, { headers: NO_STORE })
}
