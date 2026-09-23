import { NextResponse } from 'next/server'

import { publicOrigin } from '@/lib/public-origin'

/**
 * Deed Skills routes (PARITY CP-6). Identity is requireDeedContext() — the
 * Clerk `sub` from the session cookie, nothing the visitor typed — and every
 * RPC takes that id as its first argument. The skill functions and tables
 * (migration cp6_skills) are service-role only.
 *
 * Running a skill is a paid feature (Investor and above), the same line the
 * auction detail and report surfaces draw: the tools return report-grade
 * data (title stack, comps, zoning standards).
 */

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export function skillsJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

const TRUSTED_ORIGINS = new Set(['https://biddeed.ai', 'https://www.biddeed.ai'])

/** A browser always sends Origin on POST/PATCH/DELETE; when present it must be ours. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  return origin === publicOrigin(request) || TRUSTED_ORIGINS.has(origin)
}

export function isJson(request: Request): boolean {
  return (request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
