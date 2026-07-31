import { useEffect, useRef, useState, type RefObject } from 'react'

const BOTTOM_THRESHOLD_PX = 48

/** Shared by AskNyayOpsPage and AskNyayOpsLauncher's message panes - tracks
 * whether the user is scrolled to the bottom of `containerRef` and exposes a
 * `scrollToBottom` action, so both surfaces render the same floating
 * scroll-down affordance without duplicating the scroll math.
 *
 * `watchLength` is the entry count (ChatEntry[].length) - when it grows
 * (a new turn lands) and the user is already at the bottom, this
 * auto-scrolls to reveal it; if the user has scrolled up to read earlier
 * messages, it instead flips `hasNew` so the caller can show a "new
 * messages" indicator instead of yanking their scroll position.
 *
 * `resetKey` (e.g. the active conversation id) forces an unconditional,
 * instant jump to the bottom whenever it changes - opening or switching to a
 * conversation should always land on its latest message, never top-of-thread,
 * regardless of where `isAtBottom()` happens to read mid-render. */
export function useScrollToBottom(
  containerRef: RefObject<HTMLDivElement | null>,
  watchLength: number,
  resetKey?: unknown,
) {
  const [atBottom, setAtBottom] = useState(true)
  const [hasNew, setHasNew] = useState(false)
  const prevLength = useRef(watchLength)

  function isAtBottom() {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX
  }

  function handleScroll() {
    const bottom = isAtBottom()
    setAtBottom(bottom)
    if (bottom) setHasNew(false)
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    setAtBottom(true)
    setHasNew(false)
  }

  useEffect(() => {
    if (watchLength === prevLength.current) return
    prevLength.current = watchLength
    // Deferred to a rAF callback (not called synchronously in the effect
    // body) both so the new entry paints first (scrollHeight needs to
    // reflect it) and so the resulting setState calls happen outside the
    // effect's own commit phase.
    requestAnimationFrame(() => {
      if (isAtBottom()) scrollToBottom('smooth')
      else setHasNew(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchLength])

  useEffect(() => {
    // Runs on mount too (opening a conversation with existing history should
    // never start scrolled to top), not just on later switches.
    requestAnimationFrame(() => scrollToBottom('auto'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  return { atBottom, hasNew, handleScroll, scrollToBottom }
}
