'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiUrl } from '@/lib/api'
import D4DBuildTab from './D4DBuildTab'
import D4DRouteTab from './D4DRouteTab'
import D4DDriveTab from './D4DDriveTab'
import type { D4DRouteDetail } from './types'

type Tab = 'build' | 'route' | 'drive'

export default function D4DWorkspace() {
  const [tab, setTab] = useState<Tab>('build')
  const [routeId, setRouteId] = useState<string | null>(null)
  const [routeDetail, setRouteDetail] = useState<D4DRouteDetail | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

  const refreshRoute = useCallback(async (id: string) => {
    setRouteLoading(true)
    setRouteError(null)
    try {
      const res = await fetch(apiUrl(`/api/d4d/routes/${id}`))
      if (!res.ok) throw new Error(`route request failed (${res.status})`)
      const json = (await res.json()) as D4DRouteDetail
      setRouteDetail(json)
    } catch {
      setRouteError('Could not load this route.')
    } finally {
      setRouteLoading(false)
    }
  }, [])

  useEffect(() => {
    if (routeId) refreshRoute(routeId)
  }, [routeId, refreshRoute])

  const handleBuilt = useCallback((id: string) => {
    setRouteId(id)
    setTab('route')
  }, [])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Drive for Dollars</p>
      <h1 className="font-display mt-2 text-[1.7rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-3xl">
        Build a route, drive it, log what you find.
      </h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="build">1. Build</TabsTrigger>
          <TabsTrigger value="route" disabled={!routeDetail}>
            2. Route
          </TabsTrigger>
          <TabsTrigger value="drive" disabled={!routeDetail}>
            3. Drive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="build">
          <D4DBuildTab onBuilt={handleBuilt} />
        </TabsContent>

        <TabsContent value="route">
          {routeError && <p className="mt-4 text-sm text-destructive">{routeError}</p>}
          {routeDetail && <D4DRouteTab detail={routeDetail} loading={routeLoading} />}
        </TabsContent>

        <TabsContent value="drive">
          {routeDetail && routeId && (
            <D4DDriveTab detail={routeDetail} routeId={routeId} onStopUpdated={() => refreshRoute(routeId)} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
