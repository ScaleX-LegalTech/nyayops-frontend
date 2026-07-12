import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react'
import { listCaseActivity } from '@/lib/api/audit'
import { getCase } from '@/lib/api/cases'
import { qk } from '@/lib/queryKeys'
import { courtLabel, formatDateTime, humanize } from '@/lib/format'
import { ACTION_ICONS, ACTION_LABELS } from '@/lib/caseActivity'
import { useUsers } from '@/lib/useUsers'
import { useCasePeople } from '@/lib/useCasePeople'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, STATUS_TONE } from '@/components/ui/Badge'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import type { AuditLog, CaseStatus } from '@/types'

function StatusChip({ status }: { status: string }) {
  const tone = STATUS_TONE[status as CaseStatus] ?? 'neutral'
  return <Badge tone={tone}>{humanize(status)}</Badge>
}

/** Renders one field that changed from previous_state to new_state, if it actually
 * did - shared by every action type that just carries a plain before/after value. */
function FieldTransition({
  label,
  before,
  after,
  render = (v: unknown) => String(v ?? '—'),
}: {
  label: string
  before: unknown
  after: unknown
  render?: (v: unknown) => React.ReactNode
}) {
  if (after === undefined) return null
  if (before !== undefined && before === after) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-faint">{label}</span>
      {before !== undefined && before !== null && (
        <>
          {render(before)}
          <ArrowRight className="size-3.5 text-ink-faint" />
        </>
      )}
      {render(after)}
    </div>
  )
}

function AssigneeDiff({
  label,
  before,
  after,
  nameOf,
}: {
  label: string
  before: string[] | undefined
  after: string[] | undefined
  nameOf: (id: string) => string
}) {
  if (!after) return null
  const beforeSet = new Set(before ?? [])
  const afterSet = new Set(after)
  const added = after.filter((id) => !beforeSet.has(id))
  const removed = (before ?? []).filter((id) => !afterSet.has(id))
  if (added.length === 0 && removed.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        {label}: {after.length ? after.map(nameOf).join(', ') : 'no one'}
      </p>
    )
  }
  return (
    <div className="space-y-1 text-sm">
      {added.length > 0 && (
        <p className="text-ink-muted">
          <span className="text-ink-faint">Added:</span> {added.map(nameOf).join(', ')}
        </p>
      )}
      {removed.length > 0 && (
        <p className="text-ink-muted">
          <span className="text-ink-faint">Removed:</span> {removed.map(nameOf).join(', ')}
        </p>
      )}
    </div>
  )
}

function EventBody({ log, nameOf }: { log: AuditLog; nameOf: (id: string) => string }) {
  const prev = log.previous_state ?? {}
  const next = log.new_state ?? {}

  switch (log.action_type) {
    case 'CASE_STATUS_UPDATED':
      return (
        <div className="flex flex-wrap items-center gap-2">
          {typeof prev.status === 'string' && <StatusChip status={prev.status} />}
          {typeof prev.status === 'string' && <ArrowRight className="size-3.5 text-ink-faint" />}
          {typeof next.status === 'string' && <StatusChip status={next.status} />}
        </div>
      )
    case 'CASE_ASSIGNED':
    case 'CASE_BULK_ASSIGNED':
      return (
        <AssigneeDiff
          label="Assignees"
          before={prev.assigned_user_ids as string[] | undefined}
          after={next.assigned_user_ids as string[] | undefined}
          nameOf={nameOf}
        />
      )
    case 'CASE_REASSIGNED':
      return (
        <AssigneeDiff
          label="Reassigned to"
          before={prev.assigned_user_ids as string[] | undefined}
          after={next.assigned_user_ids as string[] | undefined}
          nameOf={nameOf}
        />
      )
    case 'CASE_DETAILS_SET':
      return (
        <p className="text-sm text-ink-muted">
          {[
            typeof next.case_type === 'string' && next.case_type,
            typeof next.court_jurisdiction === 'string' && courtLabel(next.court_jurisdiction),
            typeof next.cnr === 'string' && next.cnr && `CNR ${next.cnr}`,
          ]
            .filter(Boolean)
            .join(' · ') || `Source: ${humanize(String(next.source ?? 'manual'))}`}
        </p>
      )
    case 'CASE_CNR_REFRESHED':
      return (
        <div className="space-y-1.5">
          <FieldTransition
            label="Stage"
            before={prev.case_stage}
            after={next.case_stage}
            render={(v) => <StatusChip status={String(v)} />}
          />
          <FieldTransition
            label="Hearing date"
            before={prev.hearing_date}
            after={next.hearing_date}
          />
          {prev.case_stage === next.case_stage && prev.hearing_date === next.hearing_date && (
            <p className="text-sm text-ink-muted">No change since the last refresh.</p>
          )}
        </div>
      )
    case 'CASE_UPDATED':
      return (
        <div className="space-y-1.5">
          <FieldTransition label="Title" before={prev.title} after={next.title} />
          <FieldTransition
            label="Status"
            before={prev.status}
            after={next.status}
            render={(v) => <StatusChip status={String(v)} />}
          />
        </div>
      )
    default:
      return null
  }
}

export default function CaseHistoryPage() {
  const { caseId = '' } = useParams()
  const { nameOf: globalNameOf } = useUsers()
  const { nameOf: caseNameOf } = useCasePeople(caseId)
  const nameOf = (id: string) => caseNameOf(id) ?? globalNameOf(id)

  const { data: c } = useQuery({ queryKey: qk.caseDetail(caseId), queryFn: () => getCase(caseId) })
  const { data: logs, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.caseActivity(caseId),
    queryFn: () => listCaseActivity(caseId),
  })

  const events = [...(logs ?? [])].reverse()

  return (
    <div className="animate-rise">
      <Link
        to={`/cases/${caseId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" /> Case
      </Link>

      <PageHeader
        title="Case history"
        description={c ? `Immutable log of every action on “${c.title}”.` : 'Immutable log of every action on this case.'}
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : events.length === 0 ? (
        <p className="text-sm text-ink-muted">No activity recorded yet.</p>
      ) : (
        <div className="mx-auto max-w-3xl">
          <ol className="relative">
            {events.map((log, i) => {
              const Icon = ACTION_ICONS[log.action_type] ?? FileText
              const isLast = i === events.length - 1
              return (
                <li key={log.id} className="relative flex gap-4 pb-7 last:pb-0">
                  {!isLast && (
                    <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />
                  )}
                  <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-muted">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-card border border-border bg-surface px-4 py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-semibold text-ink">
                        {ACTION_LABELS[log.action_type] ?? humanize(log.action_type)}
                      </p>
                      <p className="text-xs text-ink-faint">{formatDateTime(log.occurred_at)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{nameOf(log.actor_id)}</p>
                    <div className="mt-2.5">
                      <EventBody log={log} nameOf={nameOf} />
                    </div>
                    {log.comment && (
                      <blockquote className="mt-2.5 border-l-2 border-border-strong pl-3 text-sm italic text-ink-muted">
                        “{log.comment}”
                      </blockquote>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
