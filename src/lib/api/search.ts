import { get, toQuery } from './client'

export type SearchResultType = 'case' | 'document' | 'user' | 'issue' | 'payment'

export interface SearchResultItem {
  type: SearchResultType
  id: string
  title: string
  subtitle: string | null
  case_id: string | null
  score: number
}

export interface GlobalSearchResponse {
  results: SearchResultItem[]
}

export function globalSearch(q: string): Promise<GlobalSearchResponse> {
  return get<GlobalSearchResponse>(`/search${toQuery({ q })}`)
}
