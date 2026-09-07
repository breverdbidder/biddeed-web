/**
 * Tier / capability gate — biddeed-web's first tier plumbing (issue #20100).
 *
 * Single source of truth is the `user_has_capability(p_clerk_user_id,
 * p_capability, p_email)` RPC in mocerqjnksmhcjzxrewo (public.mcp_subscription_tiers
 * + public.resolve_user_tier). This file never invents a second copy of tier
 * data — it maps that RPC's JSON response onto CapabilityCheck and nothing more.
 *
 * user_has_capability is declared STABLE but its dependency resolve_user_tier
 * conditionally backfills mcp_customers.clerk_user_id (an UPDATE) the first
 * time a Stripe-created customer row links to a Clerk session by email.
 * PostgREST always runs STABLE-tagged RPCs in a read-only transaction, so
 * that backfill 25006s on the rare account it fires for. requireCapability
 * treats any RPC error the same as "not entitled" rather than throwing —
 * consistent with the signed-out contract below, and the safer failure mode
 * for a paywall gate than a 500.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'

export type Capability =
  | 'build_d4d_route'
  | 'get_d4d_route'
  | 'log_d4d_field'
  | 'get_d4d_discoveries'

export interface CapabilityCheck {
  allowed: boolean
  tierId: string
  tierName: string
  upgradeTier: string | null
  upgradePrice: number | null
  userId: string | null
}

const DENIED_BASE: Omit<CapabilityCheck, 'userId'> = {
  allowed: false,
  tierId: 'free',
  tierName: 'Free',
  upgradeTier: null,
  upgradePrice: null,
}

export async function requireCapability(cap: Capability): Promise<CapabilityCheck> {
  let userId: string | null = null
  let email: string | null = null
  try {
    const session = await auth()
    userId = session.userId
    if (userId) {
      const user = await currentUser()
      email =
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses?.[0]?.emailAddress ??
        null
    }
  } catch {
    userId = null
    email = null
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { ...DENIED_BASE, userId }

  try {
    // The RPC has no non-idempotent side effect a caller needs to protect
    // (see file header) and PostgREST forces it into a read-only transaction
    // regardless of HTTP method, so the strong 'full' retry policy is safe.
    const supabase = getRetryingSupabaseClient(key, { retryMode: 'full' })
    const { data, error } = await supabase.rpc('user_has_capability', {
      p_clerk_user_id: userId,
      p_capability: cap,
      p_email: email,
    })
    if (error || !data || typeof data !== 'object') return { ...DENIED_BASE, userId }

    const result = data as Record<string, unknown>
    return {
      allowed: result.allowed === true,
      tierId: typeof result.tier_id === 'string' ? result.tier_id : 'free',
      tierName: typeof result.tier_name === 'string' ? result.tier_name : 'Free',
      upgradeTier: typeof result.upgrade_tier === 'string' ? result.upgrade_tier : null,
      upgradePrice: typeof result.upgrade_price === 'number' ? result.upgrade_price : null,
      userId,
    }
  } catch {
    return { ...DENIED_BASE, userId }
  }
}
