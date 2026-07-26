import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  ClipboardList,
  FileText,
  Landmark,
  User,
} from 'lucide-react'
import { downloadCauseListDocument, getCauseList } from '@/lib/api/causeList'
import { qk } from '@/lib/queryKeys'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { DatePicker } from '@/components/ui/DatePicker'
import { EntityAvatar } from '@/components/ui/Avatar'
import { EmptyState, LoadingState } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import type { CauseListHearingEntry } from '@/types'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function InfoCell({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Landmark
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-faint" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
        <p className="text-sm font-medium text-ink">{children}</p>
      </div>
    </div>
  )
}

function CauseListEntryCard({
  entry,
  onViewSource,
  viewSourcePending,
}: {
  entry: CauseListHearingEntry
  onViewSource: (documentId: string) => void
  viewSourcePending: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
        className="flex w-full cursor-pointer items-start justify-between gap-3 px-5 py-4 text-left hover:bg-surface-muted/40"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-start gap-3">
          {open ? (
            <ChevronDown className="mt-1 size-4 shrink-0 text-ink-faint" />
          ) : (
            <ChevronRight className="mt-1 size-4 shrink-0 text-ink-faint" />
          )}
          <EntityAvatar label={entry.case.title} size="sm" />
          <div className="min-w-0">
            <Link
              to={`/cases/${entry.case.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-base font-semibold text-ink hover:underline"
            >
              {entry.case.title}
            </Link>
            <p className="text-xs text-ink-faint">
              <Link
                to={`/cases/${entry.case.id}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline"
              >
                {entry.case.case_code}
              </Link>
              {entry.case.cnr && <> &middot; CNR: {entry.case.cnr}</>}
            </p>
            {entry.case_number && (
              <p className="mt-1 text-sm font-medium text-ink">{entry.case_number}</p>
            )}
            <p className="text-sm text-ink-muted">{entry.case.client_name}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          loading={viewSourcePending}
          onClick={(e) => {
            e.stopPropagation()
            onViewSource(entry.document_id)
          }}
        >
          <FileText className="size-3.5" /> View source PDF
        </Button>
      </div>

      {open && (
        <CardBody className="space-y-3 border-t border-border">
          <div className="overflow-hidden rounded-card border border-border divide-y divide-border">
            <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 sm:divide-y-0">
              <InfoCell icon={Landmark} label="Court / Bench">
                {entry.bench_name ?? entry.source_bench_key}
              </InfoCell>
              <InfoCell icon={Clock} label="Time">
                {entry.sitting_time ?? '—'}
              </InfoCell>
              <InfoCell icon={ClipboardList} label="List type">
                {entry.list_type ? entry.list_type.replace(/_/g, ' ') : '—'}
              </InfoCell>
            </div>

            <div className="flex items-start gap-2 p-3">
              <User className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-ink-faint">Judges</p>
                <p className="text-sm font-medium text-ink">{entry.judge ?? '—'}</p>
              </div>
            </div>
          </div>
        </CardBody>
      )}
    </Card>
  )
}

export default function CauseListPage() {
  const [scope, setScope] = useState<'mine' | 'all'>('all')
  const [date, setDate] = useState(todayIso())

  const { data, isLoading } = useQuery({
    queryKey: qk.causeList(date, scope),
    queryFn: () => getCauseList(date, scope),
  })
  const entries = data?.entries ?? []

  // A row's parsed fields can occasionally be misread off the source PDF (the whole
  // reason this button exists) - view the actual document to cross-check rather than
  // trusting the parse blindly.
  const viewSourceMutation = useMutationWithToast({
    mutationFn: (documentId: string) => downloadCauseListDocument(documentId),
    onSuccess: (resp) => {
      if (resp.status === 'ready' && resp.download_url) {
        window.open(resp.download_url, '_blank', 'noopener')
      }
    },
    errorFallback: 'Could not open the source cause-list PDF.',
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cause list"
        description="Your firm's CNR-linked cases appearing on a court's cause list for the selected date."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { value: 'all', label: 'All cause list' },
            { value: 'mine', label: 'My cause list' },
          ]}
          value={scope}
          onChange={(v) => setScope(v as 'mine' | 'all')}
        />
        <DatePicker value={date} onChange={setDate} placeholder="Date" />
      </div>

      {isLoading ? (
        <Card>
          <CardBody>
            <LoadingState />
          </CardBody>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Nothing listed"
              description={
                scope === 'mine'
                  ? "None of your cases appear on this date's cause list."
                  : "None of the firm's CNR-linked cases appear on this date's cause list."
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <CauseListEntryCard
              key={`${entry.case.id}-${i}`}
              entry={entry}
              onViewSource={(documentId) => viewSourceMutation.mutate(documentId)}
              viewSourcePending={
                viewSourceMutation.isPending &&
                viewSourceMutation.variables === entry.document_id
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
