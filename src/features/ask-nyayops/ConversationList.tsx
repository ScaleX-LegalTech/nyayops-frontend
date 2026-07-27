import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  MessageSquarePlus,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Field'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import {
  deleteAskNyayOpsConversation,
  hardDeleteAskNyayOpsConversation,
  listArchivedAskNyayOpsConversations,
  listAskNyayOpsConversations,
  renameAskNyayOpsConversation,
  restoreAskNyayOpsConversation,
} from '@/lib/api/askNyayOps'
import type { AskNyayOpsConversationSummary } from '@/types'
import { ArchivedConversationPreview } from './ArchivedConversationPreview'
import { DateFilter, ModuleFilter } from './ConversationFilters'
import { MODULE_ICONS, moduleOf, type DateFilterValue, type ModuleFilterValue } from './filterHelpers'

interface ConversationListProps {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  /** 'sidebar' (default): fixed-width, right-bordered, for sitting next to
   * the chat panel (AskNyayOpsPage). 'panel': fills its container - the
   * compact launcher swaps its whole body for this view instead of running
   * it side-by-side, there's no room for a fixed 16rem column in a 24rem
   * popover. */
  variant?: 'sidebar' | 'panel'
}

const COLLAPSE_STORAGE_KEY = 'ask-nyayops:sidebar-collapsed'
const SEARCH_DEBOUNCE_MS = 300

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Buckets an already-updated_at-sorted list into Today/Yesterday/Previous 7
 * days/Older sections (client-side only - the backend still returns one
 * flat, sorted list). Chronological only, by design - module/category is a
 * filter (ConversationFilters.tsx), never a grouping axis, so a request
 * doesn't jump sections as its title gets edited. Only meaningful on an
 * unfiltered sidebar view - grouping a search result set adds noise, not
 * clarity, so callers skip this while searching. */
function groupByRecency(
  conversations: AskNyayOpsConversationSummary[],
): { label: string; items: AskNyayOpsConversationSummary[] }[] {
  const today = startOfDay(new Date())
  const yesterday = today - 86_400_000
  const sevenDaysAgo = today - 7 * 86_400_000
  const buckets: Record<
    'Today' | 'Yesterday' | 'Previous 7 days' | 'Older',
    AskNyayOpsConversationSummary[]
  > = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    Older: [],
  }
  for (const c of conversations) {
    const day = startOfDay(new Date(c.updated_at))
    if (day === today) buckets.Today.push(c)
    else if (day === yesterday) buckets.Yesterday.push(c)
    else if (day >= sevenDaysAgo) buckets['Previous 7 days'].push(c)
    else buckets.Older.push(c)
  }
  return (['Today', 'Yesterday', 'Previous 7 days', 'Older'] as const)
    .map((label) => ({ label, items: buckets[label] }))
    .filter((group) => group.items.length > 0)
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-1 px-1 py-1" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-control px-3 py-2">
          <div
            className="h-3 w-[70%] animate-skeleton-pulse rounded-full bg-surface-muted"
            style={{ animationDelay: `${i * 80}ms` }}
          />
          <div
            className="h-2.5 w-[40%] animate-skeleton-pulse rounded-full bg-surface-muted"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        </div>
      ))}
    </div>
  )
}

/** Strictly own-scope by design - the backend never returns anyone else's
 * conversations, so there's no per-user filtering to do here. One unified
 * list, no per-agent filtering: since the routed chat surface ("auto") can
 * continue any conversation - the intent router re-decides the specialist on
 * every turn - every conversation is clickable-and-continuable again,
 * including ones persisted under the old single-agent modes. */
export function ConversationList({
  activeId,
  onSelect,
  onNew,
  variant = 'sidebar',
}: ConversationListProps) {
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState(
    () => variant === 'sidebar' && localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1',
  )
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [moduleFilter, setModuleFilter] = useState<ModuleFilterValue>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterValue | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [viewingArchived, setViewingArchived] = useState(false)
  const [purging, setPurging] = useState<{ id: string; title: string } | null>(null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [renamingId])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  const { data: conversations, isLoading } = useQuery({
    queryKey: qk.askNyayOpsConversations(query || undefined),
    queryFn: () => listAskNyayOpsConversations(query || undefined),
  })

  // Module/date are filters, not a grouping axis (product decision - see
  // groupByRecency's doc comment) - applied client-side since the backend
  // only tags a conversation's agent, not its module or a date range.
  const filteredConversations = (conversations ?? []).filter((c) => {
    if (moduleFilter !== 'all' && moduleOf(c) !== moduleFilter) return false
    if (dateFilter) {
      const day = startOfDay(new Date(c.updated_at))
      if (day < startOfDay(new Date(dateFilter.from)) || day > startOfDay(new Date(dateFilter.to))) {
        return false
      }
    }
    return true
  })

  async function handleDelete(e: ReactMouseEvent, id: string) {
    e.stopPropagation()
    await deleteAskNyayOpsConversation(id)
    await queryClient.invalidateQueries({ queryKey: qk.askNyayOpsConversationsAll })
    await queryClient.invalidateQueries({ queryKey: qk.askNyayOpsArchivedConversations })
    if (id === activeId) onNew()
  }

  const archivedQuery = useQuery({
    queryKey: qk.askNyayOpsArchivedConversations,
    queryFn: listArchivedAskNyayOpsConversations,
    enabled: viewingArchived,
  })

  const restoreMutation = useMutationWithToast({
    mutationFn: (id: string) => restoreAskNyayOpsConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.askNyayOpsConversationsAll })
      queryClient.invalidateQueries({ queryKey: qk.askNyayOpsArchivedConversations })
    },
    errorFallback: 'Could not recover this request.',
  })

  const hardDeleteMutation = useMutationWithToast({
    mutationFn: (id: string) => hardDeleteAskNyayOpsConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.askNyayOpsArchivedConversations })
      setPurging(null)
    },
    errorFallback: 'Could not permanently delete this request.',
  })

  function startRename(e: ReactMouseEvent, id: string, currentTitle: string | null) {
    e.stopPropagation()
    setRenamingId(id)
    setRenameValue(currentTitle ?? '')
  }

  async function commitRename(id: string) {
    const title = renameValue.trim()
    setRenamingId(null)
    if (!title) return
    await renameAskNyayOpsConversation(id, title)
    await queryClient.invalidateQueries({ queryKey: qk.askNyayOpsConversationsAll })
  }

  function handleRenameKeyDown(e: ReactKeyboardEvent<HTMLInputElement>, id: string) {
    e.stopPropagation()
    if (e.key === 'Enter') void commitRename(id)
    if (e.key === 'Escape') setRenamingId(null)
  }

  if (collapsed) {
    return (
      <div className="flex h-full w-12 shrink-0 flex-col items-center gap-2 border-r border-border py-3">
        <button
          type="button"
          aria-label="Expand request list"
          title="Expand request list"
          onClick={toggleCollapsed}
          className="grid size-9 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <PanelLeftOpen className="size-4.5" />
        </button>
        <button
          type="button"
          aria-label="New request"
          title="New request"
          onClick={onNew}
          className="grid size-9 place-items-center rounded-control text-brand hover:bg-brand-soft"
        >
          <MessageSquarePlus className="size-4.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col',
        variant === 'sidebar' ? 'w-64 shrink-0 border-r border-border' : 'w-full',
      )}
    >
      <div className="flex items-center gap-1 p-3 pb-2">
        <button
          type="button"
          onClick={onNew}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
        >
          <MessageSquarePlus className="size-4" /> New request
        </button>
        {variant === 'sidebar' && (
          <button
            type="button"
            aria-label="Collapse request list"
            onClick={toggleCollapsed}
            className="flex shrink-0 items-center gap-1 rounded-control px-2 py-2 text-xs font-medium text-ink-faint hover:bg-surface-muted hover:text-ink"
          >
            <PanelLeftClose className="size-4" /> Requests
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search requests..."
            aria-label="Search requests"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <ModuleFilter value={moduleFilter} onChange={setModuleFilter} />
          <DateFilter value={dateFilter} onChange={setDateFilter} />
          <button
            type="button"
            aria-label="Archived requests"
            title="Archived requests"
            onClick={() => setViewingArchived(true)}
            className="ml-auto shrink-0 rounded-control p-1.5 text-ink-faint hover:bg-surface-muted hover:text-ink"
          >
            <Archive className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <SkeletonRows />
        ) : filteredConversations.length > 0 ? (
          query ? (
            <div className="flex flex-col gap-0.5">{filteredConversations.map(renderRow)}</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {groupByRecency(filteredConversations).map((group) => (
                <div key={group.label}>
                  <p className="type-label px-3 pb-1 text-[0.6875rem] font-semibold text-ink-faint">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">{group.items.map(renderRow)}</div>
                </div>
              ))}
            </div>
          )
        ) : (
          <p className="px-3 py-8 text-center text-xs text-ink-muted">
            {query
              ? 'No requests match your search.'
              : moduleFilter !== 'all' || dateFilter
                ? 'No requests match your filters.'
                : 'No requests yet.'}
          </p>
        )}
      </div>

      <Dialog
        open={viewingArchived}
        onClose={() => setViewingArchived(false)}
        title="Archived requests"
        description="Recover to bring one back, or delete it for good."
        size="lg"
      >
        {archivedQuery.isLoading ? (
          <LoadingState />
        ) : archivedQuery.isError ? (
          <ErrorState error={archivedQuery.error} onRetry={archivedQuery.refetch} />
        ) : !archivedQuery.data || archivedQuery.data.length === 0 ? (
          <p className="text-sm text-ink-muted">No archived requests.</p>
        ) : (
          <ul className="space-y-2">
            {archivedQuery.data.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-3.5 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => setPreviewingId(c.id)}
                  className="min-w-0 truncate text-left text-sm font-medium text-ink hover:text-brand hover:underline"
                >
                  {c.title ?? 'New request'}
                </button>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate(c.id)}
                  >
                    <RotateCcw className="size-4" /> Recover
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Permanently delete ${c.title ?? 'this request'}`}
                    onClick={() => setPurging({ id: c.id, title: c.title ?? 'New request' })}
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <Dialog
        open={purging !== null}
        onClose={() => setPurging(null)}
        title="Permanently delete request"
        description="This cannot be undone - the conversation and its history will be gone for good."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPurging(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={hardDeleteMutation.isPending}
              onClick={() => purging && hardDeleteMutation.mutate(purging.id)}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Permanently delete <span className="font-medium text-ink">{purging?.title}</span>?
        </p>
      </Dialog>

      {previewingId && (
        <ArchivedConversationPreview
          conversationId={previewingId}
          onClose={() => setPreviewingId(null)}
          recovering={restoreMutation.isPending}
          onRecover={() =>
            restoreMutation.mutate(previewingId, { onSuccess: () => setPreviewingId(null) })
          }
        />
      )}
    </div>
  )

  function renderRow(c: AskNyayOpsConversationSummary) {
    const ModuleIcon = MODULE_ICONS[moduleOf(c)]
    return (
      <div
        key={c.id}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(c.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(c.id)
          }
        }}
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-control px-3 py-1.5 text-left text-sm transition-colors',
          c.id === activeId
            ? 'bg-brand-soft text-brand-strong'
            : 'text-ink hover:bg-surface-muted',
        )}
      >
        <ModuleIcon className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
        <div className="min-w-0 flex-1">
          {renamingId === c.id ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => handleRenameKeyDown(e, c.id)}
              onBlur={() => void commitRename(c.id)}
              maxLength={255}
              className="w-full rounded-control border border-brand bg-surface px-1.5 py-0.5 text-sm text-ink outline-none"
            />
          ) : (
            <p className="truncate text-[0.8125rem] font-medium" title={c.title ?? 'New request'}>
              {c.title ?? 'New request'}
            </p>
          )}
          <p className="text-[0.6875rem] text-ink-muted">{formatRelative(c.updated_at)}</p>
        </div>
        <button
          type="button"
          aria-label="Rename request"
          onClick={(e) => startRename(e, c.id, c.title)}
          className="shrink-0 rounded-control p-1 text-ink-faint opacity-0 hover:bg-surface hover:text-ink group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Archive conversation"
          title="Archive conversation"
          onClick={(e) => handleDelete(e, c.id)}
          className="shrink-0 rounded-control p-1 text-ink-faint opacity-0 hover:bg-surface hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    )
  }
}
