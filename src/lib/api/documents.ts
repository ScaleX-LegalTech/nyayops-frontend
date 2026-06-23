import type { DocumentRecord, DocumentSearchFilters, DocumentUploadResponse } from '@/types'
import { API_ORIGIN, get, post, toQuery } from './client'
import { getAccessToken } from './tokens'

export interface UploadUrlPayload {
  case_id: string
  title: string
  doc_type: string
  filename: string
  mime_type: string
  file_size_bytes: number
  change_note?: string
  metadata?: Record<string, unknown>
}

export interface VersionPayload {
  filename: string
  mime_type: string
  file_size_bytes: number
  change_note?: string
  metadata?: Record<string, unknown>
}

export function listDocuments(filters: DocumentSearchFilters = {}): Promise<DocumentRecord[]> {
  return get<DocumentRecord[]>(`/documents${toQuery(filters)}`)
}

export function createUploadUrl(payload: UploadUrlPayload): Promise<DocumentUploadResponse> {
  return post<DocumentUploadResponse>('/documents/upload-url', payload)
}

export function createDocumentVersion(
  documentId: string,
  payload: VersionPayload,
): Promise<DocumentUploadResponse> {
  return post<DocumentUploadResponse>(`/documents/${documentId}/version`, payload)
}

export function confirmUpload(documentId: string, idempotencyKey: string): Promise<DocumentRecord> {
  return post<DocumentRecord>(`/documents/${documentId}/confirm`, {
    idempotency_key: idempotencyKey,
  })
}

export function rollbackVersion(documentId: string, versionId: string): Promise<DocumentRecord> {
  return post<DocumentRecord>(`/documents/${documentId}/versions/${versionId}/rollback`)
}

function encodeStorageKey(storageKey: string): string {
  return storageKey.split('/').map(encodeURIComponent).join('/')
}

/** PUT raw file bytes to the storage upload URL returned by createUploadUrl. */
export async function uploadFileBytes(uploadUrl: string, file: File): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(`${API_ORIGIN}${uploadUrl}`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: file,
  })
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`)
  }
}

/** Fetch a document version's bytes and trigger a browser download. */
export async function downloadDocument(storageKey: string): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(`${API_ORIGIN}/api/v1/documents/files/${encodeStorageKey(storageKey)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = storageKey.split('/').pop() ?? 'document'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
