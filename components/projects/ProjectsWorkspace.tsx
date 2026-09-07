'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiUrl } from '@/lib/api'
import BudgetTab from './BudgetTab'
import ScopesTab from './ScopesTab'
import ComingSoonPanel from './ComingSoonPanel'
import type { CmBudgetDetail, CmBudgetSummary } from './types'

type Tab = 'budget' | 'scopes' | 'schedule' | 'draws' | 'exit'

export default function ProjectsWorkspace() {
  const [tab, setTab] = useState<Tab>('budget')
  const [budgets, setBudgets] = useState<CmBudgetSummary[]>([])
  const [budgetsLoading, setBudgetsLoading] = useState(true)
  const [budgetsError, setBudgetsError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CmBudgetDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const refreshBudgets = useCallback(async (): Promise<CmBudgetSummary[]> => {
    setBudgetsLoading(true)
    setBudgetsError(null)
    try {
      const res = await fetch(apiUrl('/api/projects/budgets'))
      if (!res.ok) throw new Error(`budgets request failed (${res.status})`)
      const json = (await res.json()) as { budgets: CmBudgetSummary[] }
      setBudgets(json.budgets)
      return json.budgets
    } catch {
      setBudgetsError('Could not load your budgets.')
      return []
    } finally {
      setBudgetsLoading(false)
    }
  }, [])

  const refreshDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const res = await fetch(apiUrl(`/api/projects/budgets/${id}`))
      if (!res.ok) throw new Error(`budget request failed (${res.status})`)
      const json = (await res.json()) as CmBudgetDetail
      setDetail(json)
    } catch {
      setDetailError('Could not load this budget.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // First load: pull the budget list, then land on whichever budget is first
  // (most recently created) so the seeded/demo budget renders without a
  // manual pick.
  useEffect(() => {
    refreshBudgets().then((list) => {
      if (list.length) setSelectedId(list[0].budget_id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedId) refreshDetail(selectedId)
  }, [selectedId, refreshDetail])

  const handleCreated = useCallback(
    async (id: string) => {
      await refreshBudgets()
      setSelectedId(id)
    },
    [refreshBudgets]
  )

  const refreshCurrentDetail = useCallback(() => {
    if (selectedId) refreshDetail(selectedId)
  }, [selectedId, refreshDetail])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Projects</p>
      <h1 className="font-display mt-2 text-[1.7rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-3xl">
        Budget the rehab, price the scopes, track spend against budget.
      </h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="scopes">Scopes</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="draws">Draws</TabsTrigger>
          <TabsTrigger value="exit">Exit pack</TabsTrigger>
        </TabsList>

        <TabsContent value="budget">
          <BudgetTab
            budgets={budgets}
            budgetsLoading={budgetsLoading}
            budgetsError={budgetsError}
            selectedId={selectedId}
            onSelect={setSelectedId}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            onCreated={handleCreated}
            onRefreshDetail={refreshCurrentDetail}
          />
        </TabsContent>

        <TabsContent value="scopes">
          <ScopesTab detail={detail} detailLoading={detailLoading} onRefreshDetail={refreshCurrentDetail} />
        </TabsContent>

        <TabsContent value="schedule">
          <ComingSoonPanel
            title="Schedule"
            body="Task-level construction scheduling — trades, sequencing, milestones — is not built yet."
          />
        </TabsContent>

        <TabsContent value="draws">
          <ComingSoonPanel title="Draws" body="Lender draw requests tied to the budget are not built yet." />
        </TabsContent>

        <TabsContent value="exit">
          <ComingSoonPanel
            title="Exit pack"
            body="A closing / exit documentation package generated from this budget is not built yet."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
