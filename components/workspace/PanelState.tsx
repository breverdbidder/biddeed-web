'use client'

import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export type PanelStateKind = 'loading' | 'empty' | 'auth' | 'provider' | 'success' | 'error'

type PanelStateProps = {
  kind: PanelStateKind
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  children?: ReactNode
}

const tone: Record<PanelStateKind, string> = {
  loading: 'border-border bg-muted/40 text-muted-foreground',
  empty: 'border-dashed border-border bg-background text-muted-foreground',
  auth: 'border-primary/30 bg-primary/10 text-foreground',
  provider: 'border-primary/30 bg-primary/10 text-foreground',
  success: 'border-primary/30 bg-primary/10 text-foreground',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
}

export default function PanelState({ kind, title, message, actionLabel, onAction, children }: PanelStateProps) {
  // PARITY CP-9: loading is a skeleton in the shape of the list it is waiting
  // for; the words stay for screen readers only.
  if (kind === 'loading') {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
        <span className="sr-only">{title}. {message}</span>
        {[0, 1].map((i) => (
          <div key={i} className="border border-border bg-background p-4" aria-hidden="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={`border p-4 ${tone[kind]}`} role={kind === 'error' ? 'alert' : undefined} aria-live={kind === 'success' ? 'polite' : undefined}>
      <p className="text-base font-bold">{title}</p>
      <p className="mt-1 text-base opacity-90">{message}</p>
      {children}
      {actionLabel && onAction ? <button type="button" onClick={onAction} className="mt-3 min-h-10 bg-primary px-3 text-sm font-bold text-primary-foreground">{actionLabel}</button> : null}
    </div>
  )
}
