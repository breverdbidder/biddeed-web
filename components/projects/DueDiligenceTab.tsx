'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, PlaneTakeoff } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import ComingSoonPanel from './ComingSoonPanel'
import DueDiligenceLocked from './DueDiligenceLocked'
import MapillaryViewer from './MapillaryViewer'
import type { CmBudgetDetail, GevCapture } from './types'

interface Props {
  detail: CmBudgetDetail | null
  detailLoading: boolean
  access: boolean
  tierId: string
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DueDiligenceTab({ detail, detailLoading, access, tierId }: Props) {
  const [capture, setCapture] = useState<GevCapture | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const budgetId = detail?.budget.budget_id ?? null

  useEffect(() => {
    if (!access || !budgetId) {
      setCapture(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(apiUrl(`/api/projects/diligence?budgetId=${budgetId}`))
      .then((res) => {
        if (!res.ok) throw new Error(`diligence request failed (${res.status})`)
        return res.json() as Promise<{ capture: GevCapture | null }>
      })
      .then((json) => {
        if (!cancelled) setCapture(json.capture)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the aerial assessment.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [access, budgetId])

  if (!access) {
    return <DueDiligenceLocked tierId={tierId} />
  }

  if (!detail) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        {detailLoading ? 'Loading budget…' : 'Open a budget on the Budget tab first.'}
      </p>
    )
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the aerial assessment…
      </div>
    )
  }

  if (error) {
    return <p className="mt-6 text-sm text-destructive">{error}</p>
  }

  if (!capture) {
    return (
      <ComingSoonPanel
        title="Aerial assessment not captured yet"
        body="No aerial tour has been captured for this property yet. Once the capture pipeline runs, the flyover video and condition read will appear here."
      />
    )
  }

  const assessment = capture.assessment
  const captureDate = formatDate(capture.captured_at)
  const streetDate = formatDate(capture.mapillary_captured_at ?? capture.street_view_captured_at)

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <PlaneTakeoff className="size-4 text-primary" aria-hidden />
          Aerial tour
        </p>
        {capture.video_url ? (
          <video className="mt-3 aspect-video w-full rounded-xl border border-border bg-black" controls playsInline src={capture.video_url}>
            Your browser does not support embedded video.
          </video>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No aerial video for this capture.</p>
        )}
        {(captureDate || capture.framing) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {captureDate ? `Captured ${captureDate}` : null}
            {captureDate && capture.framing ? ' · ' : null}
            {capture.framing}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">Street-level imagery</p>
        {capture.mapillary_image_id ? (
          <>
            <MapillaryViewer imageId={capture.mapillary_image_id} />
            <p className="mt-2 text-xs text-muted-foreground">Street-level imagery: {streetDate ?? 'date unknown'}</p>
          </>
        ) : capture.street_view_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capture.street_view_url}
              alt="Street View capture of the property"
              className="mt-3 aspect-video w-full rounded-xl border border-border object-cover"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              No Mapillary coverage near this parcel — showing the Street View capture instead: {streetDate ?? 'date unknown'}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No street-level imagery available for this property yet.</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Property assessment</p>
          {assessment?.imagery_stale && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-3" aria-hidden />
              Imagery may be out of date
            </Badge>
          )}
        </div>
        {assessment ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Roof</dt>
              <dd className="mt-1 text-sm text-foreground">{assessment.roof ?? 'Not assessed'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Structure</dt>
              <dd className="mt-1 text-sm text-foreground">{assessment.structure ?? 'Not assessed'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Lot</dt>
              <dd className="mt-1 text-sm text-foreground">{assessment.lot ?? 'Not assessed'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Visible defects</dt>
              <dd className="mt-1 text-sm text-foreground">
                {assessment.visible_defects?.length ? assessment.visible_defects.join(', ') : 'None flagged'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No structured assessment for this capture yet.</p>
        )}
      </div>
    </div>
  )
}
