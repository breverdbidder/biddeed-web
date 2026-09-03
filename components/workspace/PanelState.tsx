'use client'

import type { ReactNode } from 'react'

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
  return (
    <div className={`border p-4 ${tone[kind]}`} role={kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined} aria-live={kind === 'loading' || kind === 'success' ? 'polite' : undefined}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{message}</p>
      {children}
      {actionLabel && onAction ? <button type="button" onClick={onAction} className="mt-3 min-h-10 bg-primary px-3 text-sm font-bold text-primary-foreground">{actionLabel}</button> : null}
    </div>
  )
}
