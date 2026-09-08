import { NextResponse } from 'next/server'

/**
 * Opaque server-error responses.
 *
 * WHY THIS EXISTS. On 2026-09-08 `GET /api/auctions` answered every request
 * with HTTP 500 and this body:
 *
 *   {"error":"invalid value for parameter \"work_mem\": \"8mb\""}
 *
 * That is a raw Postgres error handed to anonymous callers. It disclosed the
 * engine, that request handlers tune session GUCs, and the exact literal that
 * was failing — all reconnaissance value, none of it useful to a customer,
 * who cannot act on any of it. An external security review scored the whole
 * public surface down on this one string.
 *
 * The rule is therefore: upstream failure detail goes to the logs, never to
 * the client. What the client gets is a stable sentence and an `error_id`
 * they can quote to support; that id is what ties the two together. It is a
 * random hex token, not a hash of the message, so it leaks nothing by itself
 * and cannot be used to fingerprint which failure occurred.
 *
 * Use `serverError()` for anything that came back from Postgres, PostgREST or
 * another upstream. Keep returning literal strings for genuine client errors
 * (400s over bad query params) — those are the caller's own input and telling
 * them exactly what was wrong is the entire point.
 */

export type ErrorLike = { message?: string; code?: string; details?: string; hint?: string } | Error | null | undefined

function newErrorId(): string {
  // 12 hex chars: short enough for a customer to read down a phone line,
  // wide enough (48 bits) not to collide across a day of logs.
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function describe(err: ErrorLike): string {
  if (!err) return 'unknown'
  if (err instanceof Error) return err.message
  const parts = [err.code, err.message, err.details, err.hint].filter(Boolean)
  return parts.length ? parts.join(' | ') : 'unknown'
}

/**
 * Log the real failure, return a response that says nothing about it.
 *
 * @param scope  where it happened, e.g. 'auctions.list' — this is what makes
 *               the log line greppable; it is never sent to the client.
 * @param err    the upstream error object.
 * @param status HTTP status. 500 by default; pass 503 when the dependency is
 *               down rather than wrong, so callers know to retry.
 */
export function serverError(scope: string, err: ErrorLike, status = 500) {
  const errorId = newErrorId()

  // Server-side only. Structured so a log search on error_id lands directly
  // on the failing call.
  console.error(
    JSON.stringify({
      level: 'error',
      scope,
      error_id: errorId,
      detail: describe(err),
      ts: new Date().toISOString(),
    })
  )

  const body =
    status === 503
      ? { error: 'Temporarily unavailable. Please retry shortly.', error_id: errorId }
      : { error: 'Something went wrong on our end.', error_id: errorId }

  const headers: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (status === 503) headers['Retry-After'] = '3'

  return NextResponse.json(body, { status, headers })
}

/**
 * A dependency is unreachable rather than broken — same contract, 503 so the
 * caller (and any uptime check) can tell "retry" from "this request is wrong".
 */
export function upstreamUnavailable(scope: string, err: ErrorLike) {
  return serverError(scope, err, 503)
}
