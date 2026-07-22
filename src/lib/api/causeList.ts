import type { CauseListResponse } from '@/types'
import { get, toQuery } from './client'

/** Only the tenant's own CNR-linked cases that appear on a court's cause list for
 * `date` (defaults to today, server-side) - never a court's full daily list.
 * `scope: 'mine'` restricts to cases the caller created/is assigned to; `'all'`
 * (default) is every CNR-linked case across the tenant. */
export function getCauseList(date?: string, scope?: 'mine' | 'all'): Promise<CauseListResponse> {
  return get<CauseListResponse>(
    `/cause-list${toQuery({
      ...(date ? { target_date: date } : {}),
      ...(scope ? { scope } : {}),
    })}`,
  )
}

interface DownloadCauseListDocumentResponse {
  status: 'ready' | 'queued'
  download_url?: string
  expires_in_seconds?: number
}

/** Presigned URL for the source cause-list PDF a hearing entry was parsed from - lets
 * a user cross-check a row against the real document when something looks off. */
export function downloadCauseListDocument(
  documentId: string,
): Promise<DownloadCauseListDocumentResponse> {
  return get<DownloadCauseListDocumentResponse>(`/cause-list/${documentId}/download`)
}
