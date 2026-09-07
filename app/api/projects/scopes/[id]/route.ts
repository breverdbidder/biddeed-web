import { NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'
import { budgetIdForScope, callerOwnsBudget } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// GET /api/projects/scopes/[id] — scope detail: lines, budgeted total, bid.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const check = await requireCapability('build_scope_of_work')
  if (!check.allowed || !check.email) {
    return NextResponse.json(
      { error: 'Scopes of work require an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const id = (await context.params).id
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid scope identifier.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()
  const budgetId = await budgetIdForScope(supabase, id)
  if (!budgetId || !(await callerOwnsBudget(supabase, budgetId, check.email))) {
    return NextResponse.json({ error: 'Scope not found.' }, { status: 404 })
  }

  const { data, error } = await supabase.rpc('cm_scope_detail', { p_scope_id: id })
  if (error) return NextResponse.json({ error: 'Unable to load this scope.' }, { status: 502 })
  return NextResponse.json(data)
}
