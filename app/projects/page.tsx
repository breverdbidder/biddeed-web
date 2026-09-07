import type { Metadata } from 'next'
import { requireCapability } from '@/lib/tier/server'
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
}

export default async function ProjectsPage() {
  const check = await requireCapability('get_rehab_budget')

  if (!check.allowed) {
    return <ProjectsLocked check={check} />
  }

  return <ProjectsWorkspace />
}
