'use client'

import DeedRobotMark from '@/components/deed/DeedRobotMark'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onToggle: () => void
}

export default function StickyDeedCta({ open, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'Close Deed assistant' : 'Talk to Deed - voice AI assistant'}
      aria-expanded={open}
      aria-controls="deed-panel"
      className={cn(
        // P1-4 (2026-09-11 audit): the 251x70 card covered working content on
        // every mobile route (calendar cells, form fields, pricing text). Below
        // sm it is now a 56px round launcher - icon only, same tap affordance,
        // nothing covered. The full labelled card returns at sm and up.
        'fixed z-50 flex items-center justify-center border',
        'bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 size-14 rounded-full p-0',
        'shadow-2xl shadow-black/40 outline-none transition-all duration-200',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'motion-reduce:transition-none sm:bottom-6 sm:right-6 sm:size-auto sm:min-h-[68px] sm:min-w-[238px] sm:justify-start sm:gap-3 sm:rounded-2xl sm:px-3.5 sm:py-2.5',
        open
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-primary/70 bg-card text-foreground hover:-translate-y-0.5 hover:border-primary hover:bg-secondary'
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border sm:size-12 sm:rounded-xl',
          open ? 'border-primary-foreground/30 bg-primary-foreground/15' : 'border-primary/50 bg-secondary'
        )}
      >
        <DeedRobotMark size={40} decorative={false} />
      </span>
      <span className="hidden min-w-0 text-left leading-tight sm:grid">
        <span className="text-sm font-extrabold tracking-tight">{open ? 'Deed is open' : 'Talk to Deed'}</span>
        <span className={cn('mt-0.5 text-xs font-medium', open ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          Voice AI · 70+ languages
        </span>
      </span>
      <span aria-hidden className={cn('ml-auto hidden text-lg sm:block', open ? 'text-primary-foreground' : 'text-primary')}>
        {open ? '×' : '›'}
      </span>
      <span className="sr-only">Natural-language voice chatbot for auction intelligence</span>
    </button>
  )
}
