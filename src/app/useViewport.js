/**
 * useViewport — single source of truth for responsive breakpoints.
 *
 * Drives JSX layout decisions (split vs. toggle, palette inline vs. bottom-sheet) that CSS
 * media queries can't express. Pure styling stays in CSS (@media + @media (pointer: coarse)).
 *
 * Breakpoints (see docs/app/specs/SPEC-responsive-mobile.md):
 *   mobile  < 640px
 *   tablet  640–1024px
 *   desktop > 1024px
 */
import { useSyncExternalStore } from 'react'

export const BP = { mobile: 640, tablet: 1024 }

function readWidth() {
  return typeof window === 'undefined' ? 1280 : window.innerWidth
}

function subscribe(cb) {
  window.addEventListener('resize', cb)
  window.addEventListener('orientationchange', cb)
  return () => {
    window.removeEventListener('resize', cb)
    window.removeEventListener('orientationchange', cb)
  }
}

/** Coarse pointer (touch) — informational; prefer CSS @media (pointer: coarse) for styling. */
export function isCoarsePointer() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
}

/**
 * @returns {{ width:number, isMobile:boolean, isTablet:boolean, isDesktop:boolean,
 *            isMobileOrTablet:boolean }}
 */
export function useViewport() {
  const width = useSyncExternalStore(subscribe, readWidth, () => 1280)
  const isMobile = width < BP.mobile
  const isTablet = width >= BP.mobile && width < BP.tablet
  const isDesktop = width >= BP.tablet
  return { width, isMobile, isTablet, isDesktop, isMobileOrTablet: !isDesktop }
}
