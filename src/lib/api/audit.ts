import type { AuditLog, AuditLogPageResponse, AuditLogSearchFilters } from '@/types'
import { API_BASE_URL, get, toQuery } from './client'

export function listAuditLogs(
  filters: AuditLogSearchFilters = {},
): Promise<AuditLogPageResponse> {
  return get<AuditLogPageResponse>(`/audit-logs${toQuery(filters)}`)
}

export function listCaseActivity(caseId: string): Promise<AuditLog[]> {
  return get<AuditLog[]>(`/cases/${caseId}/activity`)
}

/** Download the audit log CSV export - cookie-authenticated. */
export async function exportAuditLogsCsv(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/audit-logs/export`, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'audit-logs.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
