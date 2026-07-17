import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'

interface Pos {
  top: number
  left: number
}

/** Positions a portaled panel below its trigger, then — once mounted and its real
 * size is known — flips it above the trigger if it would run off the bottom of the
 * viewport, and clamps it horizontally. Needed because anything portaled to
 * document.body escapes normal layout and any ancestor's overflow clipping, so
 * nothing keeps it on-screen or unclipped by default; without this, a panel
 * taller/wider than the remaining viewport is silently cut off and, inside a Dialog
 * (which locks page scroll), unreachable. */
export function useFloatingPanel<Trigger extends HTMLElement, Panel extends HTMLElement = HTMLDivElement>(
  open: boolean,
) {
  const triggerRef = useRef<Trigger>(null)
  const panelRef = useRef<Panel>(null)
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left })
  }, [open])

  const recompute = useCallback(() => {
    if (!panelRef.current || !triggerRef.current) return
    const panelRect = panelRef.current.getBoundingClientRect()
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const margin = 8

    const overflowsBottom = triggerRect.bottom + 4 + panelRect.height > window.innerHeight - margin
    const fitsAbove = triggerRect.top - 4 - panelRect.height >= margin
    let top: number
    if (overflowsBottom && fitsAbove) {
      top = triggerRect.top - 4 - panelRect.height
    } else if (overflowsBottom) {
      top = Math.max(margin, window.innerHeight - margin - panelRect.height)
    } else {
      top = triggerRect.bottom + 4
    }

    let left = triggerRect.left
    if (left + panelRect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - margin - panelRect.width)
    }
    if (left < margin) left = margin

    setPos((prev) => (prev.top === top && prev.left === left ? prev : { top, left }))
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    recompute()
  })

  // A re-render-triggered recompute (above) doesn't fire on a pure scroll/resize with
  // no other state change, so the panel would visually detach from its trigger while
  // the page (or a Dialog's scrollable body) scrolls. Capture phase catches scroll on
  // any nested scrollable ancestor, not just window.
  useLayoutEffect(() => {
    if (!open) return
    document.addEventListener('scroll', recompute, true)
    window.addEventListener('resize', recompute)
    return () => {
      document.removeEventListener('scroll', recompute, true)
      window.removeEventListener('resize', recompute)
    }
  }, [open, recompute])

  return { triggerRef, panelRef, pos }
}

/** Closes on an outside mousedown or Escape. `refs` should list every element that
 * counts as "inside" (trigger + portaled panel — they aren't DOM-nested once
 * portaled, so a single containment check on one of them isn't enough). */
export function useOutsideClose(open: boolean, refs: RefObject<HTMLElement | null>[], onClose: () => void) {
  // Callers pass an inline `() => setOpen(false)`, a new function every render -
  // keeping it out of the effect deps (via this ref) means the listeners are only
  // torn down and re-registered when `open` actually flips, not on every unrelated
  // re-render of the parent.
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useLayoutEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (refs.every((r) => r.current && !r.current.contains(e.target as Node))) onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
