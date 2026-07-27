import type { Case } from './cases'

// Minimal by the extractor's own 2026-07-26 schema redesign - party/advocate/
// connected-case/court-number/remark data no longer exists on its entries at all
// (moved onto its own linked Case, which we don't read); `case` here is already OUR
// tenant's own Case (parties, client_name, etc.), so nothing is actually lost for
// this tenant-scoped view.
export interface CauseListHearingEntry {
  case: Case
  document_id: string
  item_number: number | null
  case_number: string | null
  judge: string | null
  sitting_time: string | null
  list_type: string | null
  source_bench_key: string
  bench_name: string | null
}

export interface CauseListResponse {
  date: string
  entries: CauseListHearingEntry[]
}
