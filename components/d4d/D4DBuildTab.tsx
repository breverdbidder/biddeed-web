'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { FL_COUNTIES, formatCountyLabel } from '@/lib/counties'
import { apiUrl } from '@/lib/api'
import { MAX_STOPS, type D4DCandidate } from './types'

interface Props {
  onBuilt: (routeId: string) => void
}

function formatMoney(value: number | null): string {
  if (value == null) return '—'
  return `$${Math.round(value).toLocaleString()}`
}

export default function D4DBuildTab({ onBuilt }: Props) {
  const [county, setCounty] = useState('brevard')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [candidates, setCandidates] = useState<D4DCandidate[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [originLat, setOriginLat] = useState<number | null>(null)
  const [originLng, setOriginLng] = useState<number | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'ok' | 'denied'>('idle')
  const [name, setName] = useState('')
  const [building, setBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOriginLat(pos.coords.latitude)
        setOriginLng(pos.coords.longitude)
        setGeoStatus('ok')
      },
      () => setGeoStatus('denied'),
      { timeout: 8000 }
    )
  }, [])

  useEffect(() => {
    setCandidatesLoading(true)
    setCandidatesError(null)
    const params = new URLSearchParams()
    if (county) params.set('county', county)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(apiUrl(`/api/d4d/candidates?${params}`))
      .then((res) => {
        if (!res.ok) throw new Error(`candidates request failed (${res.status})`)
        return res.json()
      })
      .then((json: { candidates: D4DCandidate[] }) => {
        setCandidates(json.candidates)
        setSelected(new Set())
      })
      .catch(() => setCandidatesError('Could not load auction lots for this county.'))
      .finally(() => setCandidatesLoading(false))
  }, [county, from, to])

  const toggleSelect = (mcaId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(mcaId)) {
        next.delete(mcaId)
      } else if (next.size < MAX_STOPS) {
        next.add(mcaId)
      }
      return next
    })
  }

  const atCap = selected.size >= MAX_STOPS

  const defaultName = useMemo(() => {
    const label = county ? formatCountyLabel(county) : 'Florida'
    return `${label} run — ${new Date().toISOString().slice(0, 10)}`
  }, [county])

  const handleBuild = async () => {
    if (!selected.size || originLat == null || originLng == null) return
    setBuilding(true)
    setBuildError(null)
    try {
      const res = await fetch(apiUrl('/api/d4d/routes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || defaultName,
          county,
          auctionDate: to || from || null,
          mcaIds: Array.from(selected),
          originLat,
          originLng,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBuildError(json.error || `Could not build this route (${res.status}).`)
        return
      }
      onBuilt(json.routeId)
    } catch {
      setBuildError('Could not build this route. Check your connection and try again.')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">County</span>
            <select
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="min-h-11 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {FL_COUNTIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Sale date from</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="min-h-11 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Sale date to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="min-h-11 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="font-medium text-foreground">
            {selected.size} / {MAX_STOPS} lots selected
          </p>
          {atCap && <p className="text-xs font-semibold text-primary">40-stop limit reached — deselect a lot to add another.</p>}
        </div>

        <div className="mt-2 max-h-[520px] overflow-y-auto rounded-lg border border-border">
          {candidatesLoading && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading lots…
            </div>
          )}
          {candidatesError && <p className="p-4 text-sm text-destructive">{candidatesError}</p>}
          {!candidatesLoading && !candidatesError && candidates.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No upcoming lots with coordinates for this filter.</p>
          )}
          <ul className="divide-y divide-border">
            {candidates.map((c) => {
              const checked = selected.has(c.mca_id)
              const disabled = !checked && atCap
              return (
                <li key={c.mca_id}>
                  <label
                    className={`flex min-h-11 cursor-pointer items-center gap-3 px-4 py-3 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-secondary'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleSelect(c.mca_id)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="flex-1">
                      <span className="block font-medium text-foreground">{c.property_address ?? `Case ${c.case_number}`}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatCountyLabel(c.county)} · {c.auction_date}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatMoney(c.judgment_amount ?? c.opening_bid)}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Route name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultName}
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Starting point</p>
          {geoStatus === 'locating' && <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Finding your location…</p>}
          {geoStatus === 'ok' && originLat != null && originLng != null && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
              <MapPin className="size-3.5 text-primary" aria-hidden />
              {originLat.toFixed(4)}, {originLng.toFixed(4)}
            </p>
          )}
          {geoStatus === 'denied' && <p className="mt-1 text-sm text-destructive">Location unavailable — enter coordinates manually below.</p>}
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              step="any"
              value={originLat ?? ''}
              onChange={(e) => setOriginLat(e.target.value ? Number(e.target.value) : null)}
              placeholder="Latitude"
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="number"
              step="any"
              value={originLng ?? ''}
              onChange={(e) => setOriginLng(e.target.value ? Number(e.target.value) : null)}
              placeholder="Longitude"
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {buildError && <p className="text-sm text-destructive">{buildError}</p>}

        <button
          type="button"
          disabled={building || !selected.size || originLat == null || originLng == null}
          onClick={handleBuild}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {building && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Build route
        </button>
      </div>
    </div>
  )
}
