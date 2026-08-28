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
      aria-expanded={open}
      aria-controls="deed-panel"
      className={cn(
        'fixed bottom-4 right-4 z-50 flex min-h-[68px] items-center gap-3 rounded-2xl border px-3.5 py-2.5',
        'shadow-2xl shadow-black/40 outline-none transition-all duration-200',
        'focus-visible:ring-2 focus-visible:ring-bd-orange focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]',
        'motion-reduce:transition-none sm:bottom-6 sm:right-6 sm:min-w-[238px]',
        open
          ? 'border-bd-orange bg-bd-orange text-slate-950'
          : 'border-bd-orange/70 bg-[#0b1220] text-white hover:-translate-y-0.5 hover:border-bd-orange hover:bg-[#111b2f]'
      )}
    >
      <span
        className={cn(
          'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border',
          open ? 'border-slate-950/15 bg-slate-950/10' : 'border-bd-orange/50 bg-slate-950'
        )}
      >
        <DeedRobotMark size={46} decorative={false} />
      </span>
      <span className="grid min-w-0 text-left leading-tight">
        <span className="text-sm font-extrabold tracking-tight">{open ? 'Deed is open' : 'Talk to Deed'}</span>
        <span className={cn('mt-0.5 text-[11px] font-medium', open ? 'text-slate-950/70' : 'text-slate-400')}>
          Voice AI · 70+ languages
        </span>
      </span>
      <span aria-hidden className={cn('ml-auto text-lg', open ? 'text-slate-950' : 'text-bd-orange')}>
        {open ? '×' : '›'}
      </span>
      <span className="sr-only">Natural-language voice chatbot for auction intelligence</span>
    </button>
  )
}
