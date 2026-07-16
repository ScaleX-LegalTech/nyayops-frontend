import type { QueryClient } from '@tanstack/react-query'
import type { CaseSearchFilters, DocumentSearchFilters, UserSearchFilters } from '@/types'

/** Central query-key registry so invalidation stays consistent. */
export const qk = {
  kpis: ['dashboard', 'kpis'] as const,
  casesByStatus: ['dashboard', 'cases-by-status'] as const,
  topCourts: ['dashboard', 'top-courts'] as const,
  activity: ['dashboard', 'activity'] as const,
  overdue: ['dashboard', 'overdue'] as const,
  myWork: ['dashboard', 'my-work'] as const,
  cases: (filters: CaseSearchFilters = {}) => ['cases', 'list', filters] as const,
  caseOptions: (filters: CaseSearchFilters = {}) => ['cases', 'options', filters] as const,
  caseDetail: (id: string) => ['cases', 'detail', id] as const,
  caseFullDetails: (id: string) => ['cases', 'full-details', id] as const,
  cnrBusinessDetail: (id: string, section: string, row: number) =>
    ['cases', 'cnr-business', id, section, row] as const,
  caseTransitions: ['cases', 'transitions'] as const,
  caseActivity: (id: string) => ['cases', 'activity', id] as const,
  casePeople: (id: string) => ['cases', 'people', id] as const,
  assignablePeople: (caseIds: string[]) =>
    ['cases', 'assignable-people', [...caseIds].sort()] as const,
  deletedCases: ['cases', 'deleted'] as const,
  reviewQueue: ['review', 'queue'] as const,
  documents: (filters: DocumentSearchFilters = {}) => ['documents', 'list', filters] as const,
  documentDetail: (id: string) => ['documents', 'detail', id] as const,
  // Bare ['users'] is the directory-wide lookup (useUsers, id->name resolution);
  // usersPage is the paginated admin Users list - kept distinct so an infinite
  // query and a regular query never share a cache key.
  users: ['users'] as const,
  usersPage: (filters: UserSearchFilters = {}) => ['users', 'page', filters] as const,
  myPermissions: ['me', 'permissions'] as const,
  myProfile: ['me', 'profile'] as const,
  branches: ['branches'] as const,
  branchDetail: (id: string) => ['branches', 'detail', id] as const,
  roles: ['roles'] as const,
  permissions: ['permissions'] as const,
  auditLogs: ['audit-logs'] as const,
  notifications: ['notifications'] as const,
  organization: ['organization'] as const,
  organizationName: ['organization', 'name'] as const,
  branchAdmins: ['branch-admins'] as const,
  globalSearch: (q: string) => ['search', q] as const,
}

/** Invalidate everything case-related (lists, detail, review queue, dashboard). */
export const CASE_SCOPES = [['cases'], ['review'], ['dashboard']] as const

export function invalidateCaseScopes(queryClient: QueryClient) {
  CASE_SCOPES.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
}
