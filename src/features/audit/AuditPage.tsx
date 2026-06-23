import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, ScrollText } from 'lucide-react'
import { exportAuditLogsCsv, listAuditLogs } from '@/lib/api/audit'
import { qk } from '@/lib/queryKeys'
import { formatDateTime, humanize } from '@/lib/format'
import { useUsers } from '@/lib/useUsers'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'

export default function AuditPage() {
  const { toast } = useToast()
  const { nameOf } = useUsers()
  const [search, setSearch] = useState('')
  const [resource, setResource] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.auditLogs,
    queryFn: listAuditLogs,
  })

  const logs = useMemo(() => data ?? [], [data])
  const resourceTypes = useMemo(
    () => [...new Set(logs.map((l) => l.resource_type))].sort(),
    [logs],
  )

  const filtered = logs.filter((l) => {
    if (resource && l.resource_type !== resource) return false
    if (search) {
      const hay = `${l.action_type} ${l.resource_type} ${l.resource_id} ${l.comment ?? ''}`.toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  })

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
          {resourceTypes.map((r) => (
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
      ) : filtered.length === 0 ? (
        <TableWrap>
          <EmptyState icon={ScrollText} title="No audit entries" />
        </TableWrap>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th className="w-8" />
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Resource</Th>
                <Th>Comment</Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.map((log) => {
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
                      <Td className="text-ink">{nameOf(log.actor_id)}</Td>
                      <Td>
                        <Badge tone="brand">{humanize(log.action_type)}</Badge>
                      </Td>
                      <Td className="text-ink-muted">
                        {humanize(log.resource_type)}
                        <span className="ml-1 font-mono text-xs text-ink-faint">
                          {log.resource_id.slice(0, 8)}
                        </span>
                      </Td>
                      <Td className="max-w-xs truncate text-ink-muted">{log.comment ?? '—'}</Td>
                    </Tr>
                    {isOpen && hasState && (
                      <Tr className="bg-surface-muted/50">
                        <Td colSpan={6} className="px-4 py-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <StateBlock label="Previous" state={log.previous_state} />
                            <StateBlock label="New" state={log.new_state} />
                          </div>
                        </Td>
                      </Tr>
                    )}
                  </Fragment>
                )
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  )
}

function StateBlock({ label, state }: { label: string; state: Record<string, unknown> | null }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <pre className="overflow-x-auto rounded-control bg-surface p-3 font-mono text-xs text-ink scrollbar-thin">
        {state ? JSON.stringify(state, null, 2) : '—'}
      </pre>
    </div>
  )
}
