// Types pour le module ThreatFeed (feeds CVE automatiques)

export type FeedStatus = 'ok' | 'running' | 'error' | 'pending'

export interface ThreatFeedLog {
  feed_name:    string
  status:       FeedStatus
  cves_added:   number
  cves_updated: number
  last_run:     string   // ISO 8601
  next_run:     string   // ISO 8601
  error_msg?:   string
}
