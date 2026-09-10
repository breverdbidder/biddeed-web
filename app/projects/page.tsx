import type { Metadata } from 'next'
import { requireCapability, tierAtLeast } from '@/lib/tier/server'
import ProjectsLocked from '@/components/projects/ProjectsLocked'
import ProjectsWorkspace from '@/components/projects/ProjectsWorkspace'

// force-dynamic: middleware mints a per-request CSP nonce (see middleware.ts)
// and requireCapability() reads the live Clerk session on every load — a
// signed-in Pro Plus user and a signed-out visitor must never share a cached
// page. Same reasoning as app/d4d/page.tsx.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Projects — BidDeed.AI',
  description:
    'Budget the rehab, price the scopes of work, and track spend against budget for every property you win.',
  alternates: {
    canonical: 'https://biddeed.ai/projects',
  },
}

export default async function ProjectsPage() {
  const check = await requireCapability('get_rehab_budget')

  if (!check.allowed) {
    return <ProjectsLocked check={check} />
  }

  // Due Diligence (aerial tour + assessment) is a Pro Plus-and-above
  // advantage, gated independently of get_rehab_budget so a future loosening
  // of the budget capability's tier floor cannot accidentally unlock it.
  return <ProjectsWorkspace dueDiligenceAllowed={tierAtLeast(check.tierId, 'proplus')} dueDiligenceTierId={check.tierId} />
}
