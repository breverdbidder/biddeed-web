import type { NextRequest } from 'next/server'

/** Browser POSTs carry Origin; refuse one that is not this site. Absent Origin (server-to-server) is allowed only with no cookies' worth of ambient authority, so it is refused too. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  try {
    const host = new URL(origin).host
    const own = req.headers.get('host') || req.nextUrl.host
    return host === own || host === 'biddeed.ai' || host === 'www.biddeed.ai'
  } catch {
    return false
  }
}
