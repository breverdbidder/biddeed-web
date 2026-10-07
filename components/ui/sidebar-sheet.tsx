"use client"

import * as React from "react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/**
 * The phone navigation drawer (Radix Dialog), loaded the first time it opens
 * (see Sidebar in sidebar.tsx). It is closed on every page load, so its code
 * no longer ships with every page (PageSpeed pass 3, 2026-10-07).
 */
export default function SidebarSheet({
  open,
  onOpenChange,
  side,
  width,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: "left" | "right"
  width: string
  children: React.ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-sidebar="sidebar"
        data-mobile="true"
        className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
        style={
          {
            "--sidebar-width": width,
          } as React.CSSProperties
        }
        side={side}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Sidebar</SheetTitle>
          <SheetDescription>Displays the mobile sidebar.</SheetDescription>
        </SheetHeader>
        <div className="flex h-full w-full flex-col">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
