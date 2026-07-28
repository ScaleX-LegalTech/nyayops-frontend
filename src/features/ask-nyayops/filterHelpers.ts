import { format, parseISO } from 'date-fns'
import { Briefcase, Building2, Calendar, FileText, IndianRupee, Users, type LucideIcon } from 'lucide-react'
import type { AskNyayOpsConversationSummary } from '@/types'

export type ModuleFilterValue =
  | 'all'
  | 'cases'
  | 'billing'
  | 'hearings'
  | 'documents'
  | 'team_access'
  | 'organization'

export const MODULE_OPTIONS: { value: ModuleFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cases', label: 'Cases' },
  { value: 'billing', label: 'Billing' },
  { value: 'hearings', label: 'Hearings' },
  { value: 'documents', label: 'Documents' },
  { value: 'team_access', label: 'Team & Access' },
  { value: 'organization', label: 'Organization' },
]

/** One icon per real module (never for 'all') - shared by the sidebar row prefix,
 * the active-thread type indicator, and the module filter dropdown, so a module
 * reads the same way everywhere it appears. */
export const MODULE_ICONS: Record<Exclude<ModuleFilterValue, 'all'>, LucideIcon> = {
  cases: Briefcase,
  billing: IndianRupee,
  hearings: Calendar,
  documents: FileText,
  team_access: Users,
  organization: Building2,
}

const BILLING_PATTERN = /bill|invoice|payment|fee/i
const HEARING_PATTERN = /hearing|court date|adjourn/i
const DOCUMENT_PATTERN = /document|upload|draft|file/i
const TEAM_PATTERN = /invite|member|team|user/i
const ORG_PATTERN = /branch|role|permission|organization|admin/i

/** Client-side-only module classification for the sidebar filter - the backend only
 * tags a conversation with one of two agents (case_billing/org_access), not six
 * modules, so this is a heuristic on top of that plus the title, never a routing
 * signal. Used for filtering only (per product decision, never for grouping). */
export function moduleOf(c: AskNyayOpsConversationSummary): Exclude<ModuleFilterValue, 'all'> {
  const title = c.title ?? ''
  if (c.agent === 'case_billing') {
    if (BILLING_PATTERN.test(title)) return 'billing'
    if (HEARING_PATTERN.test(title)) return 'hearings'
    if (DOCUMENT_PATTERN.test(title)) return 'documents'
    return 'cases'
  }
  if (c.agent === 'org_access') {
    return TEAM_PATTERN.test(title) ? 'team_access' : 'organization'
  }
  if (BILLING_PATTERN.test(title)) return 'billing'
  if (HEARING_PATTERN.test(title)) return 'hearings'
  if (DOCUMENT_PATTERN.test(title)) return 'documents'
  if (TEAM_PATTERN.test(title)) return 'team_access'
  if (ORG_PATTERN.test(title)) return 'organization'
  return 'cases'
}

interface EntryLike {
  sources?: { type: string; id: string }[]
  pendingAction?: { action_type: string }
}

/** Best-effort module tag for the *active thread* (conversation-type
 * indicator), scanned newest-first over already-loaded entries - unlike
 * moduleOf() (which classifies a sidebar row from its title), this reads the
 * actual tool activity of the turn (a pending action's action_type prefix, or
 * a source's type) since that's the more reliable signal once a thread has
 * real messages in it. Returns null when nothing in the thread has committed
 * to a module yet (e.g. a brand new, still-empty conversation) - the caller
 * should render nothing rather than guess. */
export function inferModuleFromEntries(
  entries: EntryLike[],
): Exclude<ModuleFilterValue, 'all'> | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    const actionType = entry.pendingAction?.action_type
    if (actionType?.startsWith('bill.')) return 'billing'
    if (actionType?.startsWith('case.')) return 'cases'
    if (actionType?.startsWith('role.') || actionType?.startsWith('branch.')) return 'organization'
    if (actionType?.startsWith('user.')) return 'team_access'
    const sourceType = entry.sources?.[0]?.type
    if (sourceType === 'bill') return 'billing'
    if (sourceType === 'case') return 'cases'
    if (sourceType === 'document') return 'documents'
    if (sourceType === 'user') return 'team_access'
  }
  return null
}

/** Most recent case a thread has touched, for the context side panel
 * (redesign doc ask #6) - same newest-first scan as inferModuleFromEntries,
 * but looking specifically for a 'case' source id rather than a module
 * bucket. Returns null once the thread moves on to a different case or has
 * no case source at all, so the panel never shows stale context. */
export function latestCaseSourceId(entries: EntryLike[]): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const source = entries[i].sources?.find((s) => s.type === 'case')
    if (source) return source.id
  }
  return null
}

export interface DateFilterValue {
  from: string
  to: string
}

export function formatDateFilterLabel(value: DateFilterValue): string {
  if (value.from === value.to) return format(parseISO(value.from), 'dd MMM')
  return `${format(parseISO(value.from), 'dd MMM')} – ${format(parseISO(value.to), 'dd MMM')}`
}
