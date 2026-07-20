import type { Issue } from '@/types'
import { post } from './client'

export interface IssueCreatePayload {
  issue_type: string
  description: string
  routed_to: string
}

export interface IssueResolvePayload {
  resolution_note?: string
}

export function raiseIssue(caseId: string, payload: IssueCreatePayload): Promise<Issue> {
  return post<Issue>(`/cases/${caseId}/issues`, payload)
}

export function resolveIssue(issueId: string, payload: IssueResolvePayload): Promise<Issue> {
  return post<Issue>(`/issues/${issueId}/resolve`, payload)
}
