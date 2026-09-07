import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'
import { callerOwnsBudget } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NAME_MAX = 200
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ScopeCreateBody {
  budgetId: string
  name: string
  lineIds: string[] | null
  contractorName: string | null
  contractorEmail: string | null
}

function parseScopeCreateBody(value: unknown): ScopeCreateBody | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const budgetId = typeof input.budgetId === 'string' && UUID_RE.test(input.budgetId) ? input.budgetId : null
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!budgetId || !name || name.length > NAME_MAX) return null
  const lineIds = Array.isArray(input.lineIds)
    ? input.lineIds.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v))
    : null
  const contractorName = typeof input.contractorName === 'string' && input.contractorName.trim() ? input.contractorName.trim() : null
  const contractorEmail = typeof input.contractorEmail === 'string' && EMAIL_RE.test(input.contractorEmail.trim()) ? input.contractorEmail.trim() : null
  return { budgetId, name, lineIds: lineIds && lineIds.length ? lineIds : null, contractorName, contractorEmail }
}

// POST /api/projects/scopes — create a scope of work from selected budget lines.
export async function POST(request: NextRequest) {
  const check = await requireCapability('build_scope_of_work')
  if (!check.allowed || !check.email) {
    return NextResponse.json(
      { error: 'Scopes of work require an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const body = parseScopeCreateBody(await request.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Invalid scope request.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()
  if (!(await callerOwnsBudget(supabase, body.budgetId, check.email))) {
    return NextResponse.json({ error: 'Budget not found.' }, { status: 404 })
  }

  const { data, error } = await supabase.rpc('cm_scope_create', {
    p_budget_id: body.budgetId,
    p_name: body.name,
    p_line_ids: body.lineIds,
    p_contractor_name: body.contractorName,
    p_contractor_email: body.contractorEmail,
  })
  if (error) return NextResponse.json({ error: 'Unable to create this scope.' }, { status: 502 })
  return NextResponse.json({ scopeId: data })
}
