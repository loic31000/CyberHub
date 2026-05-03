export interface WMNMeta {
  last_updated: string
  site_count: number
  categories: string[]
}

export interface OSINTJobSummary {
  id: number
  username: string
  status: 'pending' | 'running' | 'done' | 'error'
  total_sites: number
  checked_sites: number
  found_count: number
  filter_category: string
  duration: number
  launched_by: string
  created_at: string
}

export interface OSINTResult {
  site_name: string
  category: string
  url: string
  status: 'found' | 'not_found' | 'error' | 'timeout'
  response_time: number
}

export interface OSINTJobDetail extends OSINTJobSummary {
  results: OSINTResult[]
}

export interface SSEProgress {
  checked_sites: number
  total_sites: number
  found_count: number
  status: string
  latest_results: OSINTResult[]
}

export interface DBVersions {
  mitre: { technique_count: number; last_updated: string; seeded: boolean }
  cloak: { technique_count: number; last_updated: string }
  wmn: { site_count: number; last_updated: string }
}
