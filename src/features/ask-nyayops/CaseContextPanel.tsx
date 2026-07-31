import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  FileText,
  IndianRupee,
  PanelRightClose,
  PanelRightOpen,
  Users,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { getCase } from '@/lib/api/cases'
import { listBillsForCase } from '@/lib/api/bills'
import { qk } from '@/lib/queryKeys'
import { formatDate } from '@/lib/format'

const COLLAPSE_STORAGE_KEY = 'ask-nyayops:context-panel-collapsed'

/** Side-by-side canvas for the case the active thread is about (redesign
 * doc ask #6) - the most-cited pattern in current agent-UX research for this
 * genre of product: chat stays narrow and turn-based, a second pane holds
 * whatever the conversation is "about" and updates as that shifts. Built
 * entirely from data other screens already fetch (Case, Bill[]) - no new
 * endpoint. Document count is deliberately omitted: it isn't a field on
 * `Case` anywhere in the API, and this panel doesn't invent one.
 *
 * Collapsible, same pattern as ConversationList's sidebar rail - persisted in
 * localStorage so it stays out of the way once a user closes it once. */
export function CaseContextPanel({ caseId }: { caseId: string }) {
  // Tracked live, and always wins over a stored preference on phones/tablets -
  // same reasoning as ConversationList's sidebar: a stale "expanded" value
  // saved from a desktop session must never make this panel push the chat pane
  // around on a narrow screen. Below lg it opens as an overlay instead.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024,
  )
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return true
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
  })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      if (!isMobile) localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: qk.caseDetail(caseId),
    queryFn: () => getCase(caseId),
    enabled: !collapsed,
  })
  const { data: bills } = useQuery({
    queryKey: qk.caseBills(caseId),
    queryFn: () => listBillsForCase(caseId),
    enabled: !collapsed,
  })

  const pendingTotal = (bills ?? [])
    .filter((b) => b.status !== 'approved' && b.amount != null)
    .reduce((sum, b) => sum + (b.amount ?? 0), 0)

  const rail = (
    <div className="flex w-12 shrink-0 flex-col items-center border-l border-border py-3">
      <button
        type="button"
        aria-label="Show case context"
        title="Show case context"
        onClick={toggleCollapsed}
        className="grid size-9 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        <PanelRightOpen className="size-4.5" />
      </button>
    </div>
  )

  const panel =
    caseLoading || !caseData ? (
      <div className="h-full w-72 shrink-0 border-l border-border bg-surface p-4">
        <div className="h-3 w-24 animate-skeleton-pulse rounded-full bg-surface-muted" />
        <div className="mt-3 h-4 w-full animate-skeleton-pulse rounded-full bg-surface-muted" />
        <div className="mt-2 h-4 w-2/3 animate-skeleton-pulse rounded-full bg-surface-muted" />
      </div>
    ) : (
      <div className="flex h-full w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="type-label text-[0.6875rem] font-semibold text-ink-faint">Case context</p>
          <button
            type="button"
            aria-label="Hide case context"
            title="Hide case context"
            onClick={toggleCollapsed}
            className="grid size-6 place-items-center rounded-control text-ink-faint hover:bg-surface-muted hover:text-ink"
          >
            <PanelRightClose className="size-3.5" />
          </button>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">{caseData.title}</p>
          <p className="text-xs text-ink-muted">{caseData.client_name}</p>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">Status</span>
          <StatusBadge status={caseData.status} />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <Calendar className="size-3.5" /> Next hearing
          </span>
          <span className="font-medium text-ink">
            {caseData.hearing_date ? formatDate(caseData.hearing_date) : 'Not scheduled'}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <Users className="size-3.5" /> Assigned
          </span>
          <span className="max-w-[9.5rem] truncate text-right font-medium text-ink">
            {caseData.assignee_names.length > 0 ? caseData.assignee_names.join(', ') : 'Unassigned'}
          </span>
        </div>

        {bills && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <IndianRupee className="size-3.5" /> Bills pending
            </span>
            <span className="font-medium text-ink">
              {pendingTotal > 0 ? `₹${pendingTotal.toLocaleString('en-IN')}` : 'None'}
            </span>
          </div>
        )}

        <Link
          to={`/cases/${caseId}`}
          className="mt-1 flex items-center justify-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
        >
          <FileText className="size-3.5" /> Open case <ArrowRight className="size-3.5" />
        </Link>
      </div>
    )

  // On phones/tablets the panel never pushes the chat pane - the rail stays
  // inline (mirrors ConversationList's sidebar rail on the left) and the full
  // panel opens as a fixed right-side overlay on top instead.
  if (isMobile) {
    return (
      <>
        {rail}
        {!collapsed &&
          createPortal(
            <div className="lg:hidden" style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-drawer)' }}>
              <div className="absolute inset-0 bg-black/40" onClick={toggleCollapsed} aria-hidden />
              <div className="absolute inset-y-0 right-0 max-w-[85vw] animate-rise shadow-pop">
                {panel}
              </div>
            </div>,
            document.body,
          )}
      </>
    )
  }

  return collapsed ? rail : panel
}
