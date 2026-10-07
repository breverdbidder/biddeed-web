"use client"

import * as React from "react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Icon-rail tooltip for SidebarMenuButton, loaded the first time the rail
 * collapses (see sidebar.tsx). The tooltip text is only ever visible on the
 * collapsed desktop rail, so Radix Tooltip and its positioning code no longer
 * ship with every page (PageSpeed pass 3, 2026-10-07).
 */
export default function SidebarButtonTooltip({
  tooltip,
  hidden,
  children,
}: {
  tooltip: React.ComponentProps<typeof TooltipContent>
  hidden: boolean
  children: React.ReactElement
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="right" align="center" hidden={hidden} {...tooltip} />
      </Tooltip>
    </TooltipProvider>
  )
}
