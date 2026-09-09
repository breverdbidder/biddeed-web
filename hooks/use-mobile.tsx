import * as React from "react"

const MOBILE_BREAKPOINT = 640
const TABLET_TOP = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

// 2026-09-09 (Ariel's pick): 640-1024px is the TABLET band - the rail renders
// as a persistent icon strip (shadcn collapsible="icon") instead of either the
// full 16rem rail or the sub-640 hamburger Sheet. Ariel's daily browser zoom
// lands his viewport at ~700px, where the hamburger-only design read as
// "the sidebar is gone again".
export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_TOP - 1}px)`)
    const onChange = () => {
      setIsTablet(window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_TOP)
    }
    mql.addEventListener("change", onChange)
    setIsTablet(window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_TOP)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isTablet
}
