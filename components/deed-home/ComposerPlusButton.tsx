'use client'

import { forwardRef } from 'react'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The composer's "+" button. Shared by the on-demand Radix menu
 * (ComposerPlusMenu, which wraps it in DropdownMenuTrigger) and the plain
 * stand-in Composer renders before that menu has loaded, so both look and
 * measure the same.
 */
const ComposerPlusButton = forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'> & { menuActive: boolean }>(
  function ComposerPlusButton({ menuActive, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'relative inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          className
        )}
        aria-label="Add an attachment or research option"
        {...props}
      >
        <Plus className="size-[18px]" aria-hidden />
        {menuActive ? <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" aria-hidden /> : null}
        <span className="sr-only">Add an attachment or research option</span>
      </button>
    )
  }
)

export default ComposerPlusButton
