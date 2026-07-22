import { Fragment, useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, ScrollText } from 'lucide-react'
import { exportAuditLogsCsv, listAuditLogs } from '@/lib/api/audit'
import { qk } from '@/lib/queryKeys'
import { formatDateTime, humanize } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/Feedback'
import type { AuditLogSearchFilters } from '@/types'

const PAGE_SIZE = 50

const RESOURCE_TYPES = [
  'cases',
  'documents',
  'users',
  'branches',
  'roles',
  'bills',
  'payment_milestones',
  'issues',
  'organization',
]

export default function AuditPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [resource, setResource] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(timer)
  }, [search])

  const filters: AuditLogSearchFilters = {
    resource_type: resource || undefined,
    q: debouncedSearch.trim() || undefined,
  }

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: qk.auditLogsPage(filters),
    queryFn: ({ pageParam }) =>
      listAuditLogs({ ...filters, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.reduce((sum, page) => sum + page.items.length, 0) : undefined,
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const logs = data?.pages.flatMap((page) => page.items) ?? []

  async function handleExport() {
    setExporting(true)
    try {
      await exportAuditLogsCsv()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Audit log"
        description="An immutable record of actions across your organization."
        actions={
          <Button variant="secondary" onClick={handleExport} loading={exporting}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search actions, resources, comments…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={resource} onChange={(e) => setResource(e.target.value)} className="sm:w-56">
          <option value="">All resource types</option>
          {RESOURCE_TYPES.map((r) => (
            <option key={r} value={r}>
              {humanize(r)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : logs.length === 0 ? (
        <TableWrap>
          <EmptyState icon={ScrollText} title="No audit entries" />
        </TableWrap>
      ) : (
        <>
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th className="w-8" />
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Access</Th>
                <Th>Action</Th>
                <Th>Resource</Th>
                <Th>Comment</Th>
              </Tr>
            </THead>
            <TBody>
              {logs.map((log) => {
                const isOpen = expanded === log.id
                const hasState = log.previous_state || log.new_state
                return (
                  <Fragment key={log.id}>
                    <Tr className="hover:bg-surface-muted">
                      <Td>
                        {hasState && (
                          <button
                            onClick={() => setExpanded(isOpen ? null : log.id)}
                            className="text-ink-muted hover:text-ink"
                            aria-label="Toggle state"
                          >
                            {isOpen ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-ink-muted tabular">
                        {formatDateTime(log.occurred_at)}
                      </Td>
                      <Td className="text-ink">{log.actor_name}</Td>
                      <Td className="text-ink-muted">
                        {log.actor_access ? (
                          <Badge tone="neutral">{log.actor_access}</Badge>
                        ) : (
                          <span className="text-ink-faint">Member</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone="brand">{humanize(log.action_type)}</Badge>
                      </Td>
                      <Td className="text-ink-muted">
                        {/* A raw uuid fragment means nothing to a reader - if no
                            human label resolved server-side, just name the resource
                            type rather than showing an id nobody can act on. */}
                        {log.resource_label ?? humanize(log.resource_type)}
                      </Td>
                      <Td className="max-w-xs truncate text-ink-muted">{log.comment ?? '—'}</Td>
                    </Tr>
                    {isOpen && hasState && (
                      <Tr className="bg-surface-muted/50">
                        <Td colSpan={7} className="px-4 py-3">
                          <StateChanges previous={log.previous_state} next={log.new_state} />
                        </Td>
                      </Tr>
                    )}
                  </Fragment>
                )
              })}
            </TBody>
          </Table>
        </TableWrap>
        <div ref={sentinelRef} className="flex justify-center py-4">
          {isFetchingNextPage && <Spinner />}
        </div>
        </>
      )}
    </div>
  )
}

/** A field-by-field diff instead of raw JSON - "Login access: Yes → No" reads
 * instantly, unlike two side-by-side {"is_active": true}/{"is_active": false}
 * blocks. Falls back to a plain field list (no Previous/New columns) for creation
 * events, which only ever populate new_state. */
function StateChanges({
  previous,
  next,
}: {
  previous: Record<string, unknown> | null
  next: Record<string, unknown> | null
}) {
  // A raw uuid ("case_id": "069cc4e1-...") is internal plumbing, not something a
  // reader can act on - the resource this event is about already has its own
  // human label in the Resource column, so drop id-shaped fields entirely rather
  // than surface a value nobody can interpret.
  const keys = Array.from(new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})]))
    .filter((key) => !isUuidField(key, previous?.[key] ?? next?.[key]))
  if (keys.length === 0) return null
  const isCreation = !previous

  return (
    <div className="rounded-control border border-border bg-surface p-3">
      <div
        className={cn(
          'grid gap-x-4 gap-y-1.5 text-sm',
          isCreation ? 'grid-cols-[auto_1fr]' : 'grid-cols-[auto_1fr_1fr]',
        )}
      >
        {!isCreation && (
          <>
            <span />
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Previous
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              New
            </span>
          </>
        )}
        {keys.map((key) => (
          <Fragment key={key}>
            <span className="font-medium text-ink">{humanize(key)}</span>
            {isCreation ? (
              <span className="text-ink">{formatStateValue(next?.[key])}</span>
            ) : (
              <>
                <span className="text-ink-muted">{formatStateValue(previous?.[key])}</span>
                <span className="text-ink">{formatStateValue(next?.[key])}</span>
              </>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function formatStateValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuidField(key: string, value: unknown): boolean {
  return key.endsWith('_id') && typeof value === 'string' && UUID_PATTERN.test(value)
}
