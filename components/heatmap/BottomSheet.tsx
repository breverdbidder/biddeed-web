'use client'

import { useState, type ReactNode } from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  peek: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}

/**
 * Phone bottom sheet for the scorecard (issue #75 Amendment 1: "popups die
 * ... on phones"). Deliberately NOT the Radix Sheet in components/ui/sheet.tsx
 * — that renders a full modal overlay that blocks the map underneath; this
 * sheet stays docked at the bottom with the map still visible and pannable
 * above it, collapsed to a peek row by default.
 */
export default function BottomSheet({ peek, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-[max-height] duration-300 ease-in-out',
        open ? 'max-h-[55vh]' : 'max-h-16'
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full shrink-0 items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-sm">{peek}</span>
        <ChevronUp className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">{children}</div>
    </div>
  )
}
