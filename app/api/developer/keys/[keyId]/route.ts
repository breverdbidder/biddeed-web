import { NextRequest } from 'next/server'

import { isSameOrigin, json, requireDeveloperContext } from '@/lib/developer-keys/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Revoke one of this account's keys. The RPC scopes the update to the caller's
 * own customer, so another account's key id returns 404, never a revoke.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ keyId: string }> }) {
  if (!isSameOrigin(request)) return json({ error: 'Cross-site request refused.' }, 403)
  const keyId = (await context.params).keyId
  if (!UUID_RE.test(keyId)) return json({ error: 'Key not found.' }, 404)

  // Revoking is idempotent (revoked_at is kept on a repeat), so full retry is safe.
  const developer = await requireDeveloperContext('full')
  if (!developer.ok) return json({ error: developer.error }, developer.status)

  const { data, error } = await developer.supabase.rpc('mcp_self_serve_revoke_key', {
    p_clerk_user_id: developer.userId,
    p_verified_email: developer.email,
    p_key_id: keyId,
  })
  if (error || !data || typeof data !== 'object') return json({ error: 'Could not revoke the key. Try again.' }, 502)
  if ((data as { error?: string }).error) return json({ error: 'Key not found.' }, 404)
  return json({ revoked: true, key_id: keyId })
}
