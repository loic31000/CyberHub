export interface CISAKEVEntry {
  id: number
  cve_id: string
  vendor_project: string
  product: string
  vulnerability_name: string
  date_added: string
  short_description: string
  required_action: string
  due_date: string
  notes: string
}

export interface EPSSScore {
  cve_id: string
  score: number
  percentile: number
  date: string
}

export interface ThreatFeedSync {
  id: number
  feed_name: string
  last_sync: string
  item_count: number
  new_items: number
}

export interface ThreatFeedsStatus {
  feodo?: ThreatFeedSync
  urlhaus?: ThreatFeedSync
}

export interface ThreatFeedSyncResult {
  new_iocs: number
  skipped_duplicates: number
  total_in_feed?: number
  total_online?: number
}

export interface ImportResult {
  imported: number
  skipped_duplicates: number
  skipped_invalid: number
  errors: string[]
}
