import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Persists one piece of UI state (a filter, a search box, a form field) to the URL's
 * query string instead of plain useState - survives refresh/back-forward/bookmarking,
 * fixing "filters/inputs reset on refresh" across every list/search page. `replace:
 * true` on every write so typing into a search box doesn't spam browser history with
 * one entry per keystroke; omitting the param entirely when it equals `defaultValue`
 * keeps URLs clean for the common case. */
export function useUrlState(
  key: string,
  defaultValue = '',
): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? defaultValue

  const setValue = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const merged = new URLSearchParams(prev)
          if (next && next !== defaultValue) merged.set(key, next)
          else merged.delete(key)
          return merged
        },
        { replace: true },
      )
    },
    [key, defaultValue, setParams],
  )

  return [value, setValue]
}
