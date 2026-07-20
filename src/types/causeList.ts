import type { Case } from './cases'

export interface ConnectedCaseRef {
  case_number_raw: string | null
  party_names_raw: string | null
  // Only set when this connected/companion matter is ALSO one of the firm's own
  // CNR-linked cases - being clubbed on the same cause-list item does not imply that.
  cnr: string | null
  case_type: string | null
}

export interface CauseListHearingEntry {
  case: Case
  document_id: string
  item_number: number
  case_number_raw: string | null
  party_names_raw: string | null
  advocates_raw: string[]
  connected_cases: ConnectedCaseRef[]
  court_number: string | null
  judge: string | null
  sitting_time: string | null
  list_type: string | null
  remark: string | null
  source_bench_key: string
  bench_name: string | null
}

export interface CauseListResponse {
  date: string
  entries: CauseListHearingEntry[]
}
