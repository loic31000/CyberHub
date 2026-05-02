// Types BGP — interfaces TypeScript strictes (zéro any)
// Basées sur l'API BGPView (https://bgpview.docs.apiary.io/)

// ─────────────────────────────────────────────
// Réponses BGPView
// ─────────────────────────────────────────────

export interface BGPViewResponse<T> {
  status: string
  status_message: string
  data: T
}

export interface RIRAllocation {
  rir_name: string
  country_code: string
  prefix: string
  prefix_ip: string
  prefix_cidr: number
  allocation_status: string
}

export interface ASNInfo {
  asn: number
  name: string
  description_short: string
  description_full: string[]
  country_code: string
  website: string
  email_contacts: string[]
  abuse_contacts: string[]
  looking_glass: string | null
  traffic_estimation: string
  traffic_ratio: string
  owner_address: string[]
  rir_allocation: RIRAllocation
  date_updated: string
}

export interface PrefixParent {
  prefix: string
  ip: string
  cidr: number
  rir_name: string
  allocation_status: string
}

export interface IPv4Prefix {
  prefix: string
  ip: string
  cidr: number
  name: string
  country_code: string
  description: string
  parent: PrefixParent
}

export interface IPv6Prefix {
  prefix: string
  ip: string
  cidr: number
  name: string
  country_code: string
  description: string
  parent: PrefixParent
}

export interface PrefixListData {
  ipv4_prefixes: IPv4Prefix[]
  ipv6_prefixes: IPv6Prefix[]
}

export type PrefixList = BGPViewResponse<PrefixListData>

export interface BGPPeer {
  asn: number
  name: string
  description: string
  country_code: string
}

export interface PeerListData {
  ipv4_peers: BGPPeer[]
  ipv6_peers: BGPPeer[]
}

export type PeerList = BGPViewResponse<PeerListData>

export interface BGPUpstream {
  asn: number
  name: string
  description: string
  country_code: string
}

export interface UpstreamListData {
  ipv4_upstreams: BGPUpstream[]
  ipv6_upstreams: BGPUpstream[]
}

export type UpstreamList = BGPViewResponse<UpstreamListData>

export interface BGPDownstream {
  asn: number
  name: string
  description: string
  country_code: string
}

export interface DownstreamListData {
  ipv4_downstreams: BGPDownstream[]
  ipv6_downstreams: BGPDownstream[]
}

export type DownstreamList = BGPViewResponse<DownstreamListData>

export interface IPPrefix {
  prefix: string
  ip: string
  cidr: number
  asn: {
    asn: number
    name: string
    description: string
    country_code: string
  }
  name: string
  description: string
  country_code: string
  parent: PrefixParent
}

export interface IPInfoData {
  ip: string
  ptr_record: string | null
  prefixes: IPPrefix[]
  rir_allocation: RIRAllocation | null
}

export type IPInfo = BGPViewResponse<IPInfoData | null>

export interface SearchASN {
  asn: number
  name: string
  description: string
  country_code: string
  email: string
  rir_name: string
}

export interface SearchResultData {
  asns: SearchASN[]
  ipv4_prefixes: IPv4Prefix[]
  ipv6_prefixes: IPv6Prefix[]
}

export type SearchResult = BGPViewResponse<SearchResultData>

export interface BGPStatusResponse {
  available: boolean
  primary: string
  message: string
  cache_available: boolean
  cache_age_seconds: number
}

// ─────────────────────────────────────────────
// Modèles Historian (backend CyberHub)
// ─────────────────────────────────────────────

export interface BGPSnapshot {
  id: number
  created_at: string
  asn: number
  snapshot_date: string
  taken_by: string
  // full_data_json n'est pas retourné dans les listes, uniquement dans le diff
}

export type BGPAlertType =
  | 'prefix_change'
  | 'upstream_change'
  | 'peer_change'
  | 'downstream_change'

export interface BGPAlert {
  id: number
  created_at: string
  asn: number
  alert_type: BGPAlertType
  old_value: string  // JSON sérialisé
  new_value: string  // JSON sérialisé
  detected_at: string
  acknowledged: boolean
}

export interface BGPDiffField {
  old: unknown[]
  new: unknown[]
  added: unknown[]
  removed: unknown[]
}

export interface BGPDiffChanges {
  prefixes?: Record<string, BGPDiffField>
  peers?: Record<string, BGPDiffField>
  upstreams?: Record<string, BGPDiffField>
  downstreams?: Record<string, BGPDiffField>
}

export interface BGPDiffResult {
  changed_fields: string[]
  changes: BGPDiffChanges
}

export interface BGPDiffResponse {
  older: { id: number; created_at: string; asn: number }
  newer: { id: number; created_at: string; asn: number }
  diff: BGPDiffResult
}

// ─────────────────────────────────────────────
// Réponse paginée générique
// ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

// ─────────────────────────────────────────────
// Snapshot complet (utilisé pour le snapshot POST response)
// ─────────────────────────────────────────────

export interface BGPSnapshotResponse {
  snapshot: BGPSnapshot
  alerts: BGPAlert[]
}
