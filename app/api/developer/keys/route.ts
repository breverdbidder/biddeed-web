import { NextRequest } from 'next/server'

import { BLOCK_MESSAGES, isSameOrigin, json, loadListing, requireDeveloperContext, type BlockReason, type CreatedKey } from '@/lib/developer-keys/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** List this account's MCP API keys (prefix and metadata only; never the key). */
export async function GET() {
  // The list RPC's only write is the one-time email link, which is idempotent.
  const context = await requireDeveloperContext('full')
  if (!context.ok) return json({ error: context.error }, context.status)
  const listing = await loadListing(context.supabase, context.userId, context.email)
  if (!listing) return json({ error: 'Could not load your API keys. Try again in a moment.' }, 502)
  return json(listing)
}

/**
 * Create a key. There is one active key per account, so this replaces the
 * current key (it stops working within 5 minutes). The response is the only
 * place the full key ever appears.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: 'Cross-site request refused.' }, 403)
  // A JSON body forces a CORS preflight for any cross-site caller.
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json({ error: 'Send a JSON body.' }, 415)
  }
  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null
  if (!body || body.confirm !== 'create_key') return json({ error: 'Missing confirmation.' }, 400)

  // Minting a key is not idempotent: retry only when the request never reached Postgres.
  const context = await requireDeveloperContext('connect-only')
  if (!context.ok) return json({ error: context.error }, context.status)

  const { data, error } = await context.supabase.rpc('mcp_self_serve_create_key', {
    p_clerk_user_id: context.userId,
    p_verified_email: context.email,
  })
  if (error || !data || typeof data !== 'object') return json({ error: 'Could not create a key. Nothing was changed; try again.' }, 502)

  const result = data as Partial<CreatedKey> & { error?: BlockReason }
  if (result.error) {
    const status = result.error === 'rate_limited' ? 429 : 403
    return json({ error: BLOCK_MESSAGES[result.error] ?? 'You cannot create a key right now.', reason: result.error }, status)
  }
  return json({ created: result }, 201)
}
