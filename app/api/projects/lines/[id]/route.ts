import { NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'
import { budgetIdForLine, callerOwnsBudget } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// DELETE /api/projects/lines/[id] — remove a budget line.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const check = await requireCapability('build_rehab_budget')
  if (!check.allowed || !check.email) {
    return NextResponse.json(
      { error: 'Rehab budget building requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const id = (await context.params).id
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid line identifier.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()
  const budgetId = await budgetIdForLine(supabase, id)
  if (!budgetId || !(await callerOwnsBudget(supabase, budgetId, check.email))) {
    return NextResponse.json({ error: 'Line not found.' }, { status: 404 })
  }

  const { data, error } = await supabase.rpc('cm_line_delete', { p_line_id: id })
  if (error) return NextResponse.json({ error: 'Unable to delete this line.' }, { status: 502 })
  return NextResponse.json({ deleted: data === true })
}
