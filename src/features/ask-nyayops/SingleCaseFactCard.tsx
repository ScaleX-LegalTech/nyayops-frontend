import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, FileText, Users } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { getCase } from '@/lib/api/cases'
import { qk } from '@/lib/queryKeys'
import { formatDate } from '@/lib/format'

/** Compact structured fact card for a single-case lookup answer (F-02) -
 * same field set as CaseContextPanel, at message-bubble scale, so a plain
 * "what's the status of X" answer gets a scannable card instead of only
 * prose + a bare link. Renders alongside the assistant's text reply, not
 * instead of it - the prose still carries whatever the model actually said. */
export function SingleCaseFactCard({ caseId }: { caseId: string }) {
  const { data: caseData, isLoading } = useQuery({
    queryKey: qk.caseDetail(caseId),
    queryFn: () => getCase(caseId),
  })

  if (isLoading || !caseData) {
    return (
      <div className="mt-1.5 max-w-xs animate-skeleton-pulse rounded-card border border-border bg-surface-muted p-3">
        <div className="h-3.5 w-2/3 rounded-full bg-surface" />
      </div>
    )
  }

  return (
    <div className="mt-1.5 flex max-w-xs flex-col gap-2 rounded-card border border-border bg-surface p-3">
      <div>
        <p className="truncate text-sm font-medium text-ink">{caseData.title}</p>
        <p className="truncate text-xs text-ink-muted">{caseData.client_name}</p>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-muted">Status</span>
        <StatusBadge status={caseData.status} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-ink-muted">
          <Calendar className="size-3" /> Next hearing
        </span>
        <span className="font-medium text-ink">
          {caseData.hearing_date ? formatDate(caseData.hearing_date) : 'Not scheduled'}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-ink-muted">
          <Users className="size-3" /> Assigned
        </span>
        <span className="max-w-[7.5rem] truncate text-right font-medium text-ink">
          {caseData.assignee_names.length > 0 ? caseData.assignee_names.join(', ') : 'Unassigned'}
        </span>
      </div>
      <Link
        to={`/cases/${caseId}`}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-control border border-border-strong px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
      >
        <FileText className="size-3" /> Open case <ArrowRight className="size-3" />
      </Link>
    </div>
  )
}
