import type { Case } from './cases'

export interface CauseListHearingEntry {
  case: Case
  item_number: number
  case_number_raw: string | null
  party_names_raw: string | null
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
