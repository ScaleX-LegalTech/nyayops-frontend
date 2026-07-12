import type { AuditLog } from '@/types'
import { API_BASE_URL, get } from './client'
import { getAccessToken } from './tokens'

export function listAuditLogs(): Promise<AuditLog[]> {
  return get<AuditLog[]>('/audit-logs')
}

export function listCaseActivity(caseId: string): Promise<AuditLog[]> {
  return get<AuditLog[]>(`/cases/${caseId}/activity`)
}

/** Download the audit log CSV export with the bearer token attached. */
export async function exportAuditLogsCsv(): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE_URL}/audit-logs/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
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
