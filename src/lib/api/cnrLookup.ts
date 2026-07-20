import type { CnrBusinessDetailResponse, CnrLookupResponse, CnrOrderDownloadResponse } from '@/types'
import { get, getBlob, toQuery } from './client'

/** Standalone CNR lookup, not tied to any Case - see CnrLookupPage. */
export function lookupCnr(cnr: string, courtType?: string): Promise<CnrLookupResponse> {
  return get<CnrLookupResponse>(
    `/cnr-lookup/${encodeURIComponent(cnr)}${toQuery(courtType ? { court_type: courtType } : {})}`,
  )
}

export function downloadCnrLookupOrder(orderId: string): Promise<CnrOrderDownloadResponse> {
  return get<CnrOrderDownloadResponse>(`/cnr-lookup/orders/${orderId}/download`)
}

/** Streams the order PDF's bytes through our own API, same reasoning as the
 * case-linked loadCnrOrderBlob (the extractor's download_url is a different origin/
 * auth scheme, unusable for an inline preview). */
export function loadCnrLookupOrderBlob(orderId: string): Promise<Blob> {
  return getBlob(`/cnr-lookup/orders/${orderId}/preview`)
}

export function getCnrLookupBusinessDetail(
  cnr: string,
  section: string,
  row: number,
): Promise<CnrBusinessDetailResponse> {
  return get<CnrBusinessDetailResponse>(`/cnr-lookup/business${toQuery({ cnr, section, row })}`)
}
