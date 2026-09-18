import { NextRequest, NextResponse } from 'next/server'

import {
  PROJECT_FIELDS,
  PROJECT_LIST_FIELDS,
  PROJECT_LIST_LIMIT,
  cleanProjectInput,
  defaultProjectName,
  type ProjectRow,
} from '@/lib/deed/projects'
import { dbErrorResponse, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Projects (PARITY CP-4, #19847) for a signed-in customer.
 *
 *   GET  /api/deed/projects   the customer's projects, most recently updated first
 *   POST /api/deed/projects   create one — {name?, county?, case_number?, parcel_id?,
 *                             sale_date?, notes?, first_touch?}. When county + case
 *                             name a sale in the auctions SSOT, the sale date and
 *                             parcel are filled from it and the sale is attached as
 *                             the project's first item (S1 context, S2/S5 first_touch).
 *
 * Every row is written with, and every read is filtered by, the Clerk `sub`
 * from requireDeedContext(). 503 until the CP-4 migration is applied.
 */

interface SaleRow {
  id: string
  auction_date: string | null
  parcel_id: string | null
  property_address: string | null
}

export async function GET() {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx

  const { data, error } = await supabase
    .from('deed_projects')
    .select(PROJECT_LIST_FIELDS)
    .eq('owner_user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(PROJECT_LIST_LIMIT)
  if (error) return dbErrorResponse(error, 'Unable to load your projects.')
  return NextResponse.json({ projects: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = cleanProjectInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const input = parsed.input

  // The sale behind the hook, when there is one: fills what the customer
  // would otherwise type and becomes the first item the project references.
  let sale: SaleRow | null = null
  if (input.county && input.case_number) {
    const { data } = await supabase
      .from('multi_county_auctions')
      .select('id,auction_date,parcel_id,property_address')
      .ilike('county', input.county)
      .eq('case_number', input.case_number)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<SaleRow>()
    sale = data ?? null
  }

  const row = {
    owner_user_id: userId,
    name: input.name || defaultProjectName(input),
    county: input.county ?? null,
    case_number: input.case_number ?? null,
    parcel_id: input.parcel_id ?? sale?.parcel_id ?? null,
    sale_date: input.sale_date ?? sale?.auction_date ?? null,
    notes: input.notes ?? '',
    first_touch: input.first_touch ?? {},
  }
  const { data: project, error } = await supabase.from('deed_projects').insert(row).select(PROJECT_FIELDS).single<ProjectRow>()
  if (error) return dbErrorResponse(error, 'Unable to create the project.')

  if (sale) {
    await supabase.from('deed_project_items').insert({
      project_id: project.id,
      owner_user_id: userId,
      kind: 'sale',
      ref_id: sale.id,
      label: [input.case_number, sale.property_address].filter(Boolean).join(' · ').slice(0, 200),
    })
  }
  return NextResponse.json({ project }, { status: 201 })
}
