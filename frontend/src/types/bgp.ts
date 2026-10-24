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

/** Origin of one snapshot section: RIPE Stat directly, the backend cache, or a stale cache served because RIPE failed. */
export type BGPDataSource = 'ripe' | 'cache' | 'cache-stale'

/**
 * Provenance of one section. `fetched_at` is when the CyberHub backend
 * retrieved the data from RIPE Stat, not a RIPE publication date;
 * `age_seconds` is its age when the snapshot was taken.
 */
export interface BGPDataProvenance {
  source: BGPDataSource | string
  fetched_at?: string
  age_seconds?: number
}

/** Per section: info, prefixes, peers, upstreams, downstreams. */
export type BGPDataProvenanceMap = Record<string, BGPDataProvenance>

/** "unknown" for snapshots taken before the backend recorded provenance. */
export type BGPProvenanceStatus = 'known' | 'unknown'

export interface BGPSnapshot {
  id: number
  created_at: string
  asn: number
  snapshot_date: string
  taken_by: string
  // Absent from older backends.
  provenance_status?: BGPProvenanceStatus
  data_provenance?: BGPDataProvenanceMap | null
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

/** State of one compared list, keyed "prefixes.data.ipv4_prefixes" in `list_status`. */
export type BGPListState = 'identical' | 'changed' | 'missing/unavailable' | 'error'

export interface BGPListStatus {
  status: BGPListState
  older_error?: string
  newer_error?: string
}

/** complete: every list compared · incomplete: a list is missing on one side · error: a snapshot or list is unreadable. */
export type BGPComparisonStatus = 'complete' | 'incomplete' | 'error'

export interface BGPDiffResult {
  changed_fields: string[]
  changes: BGPDiffChanges
  // Absent from older backends, which only returned changed lists.
  status?: BGPComparisonStatus
  list_status?: Record<string, BGPListStatus>
  decode_errors?: { older?: string; newer?: string }
}

export interface BGPDiffSnapshotMeta {
  id: number
  created_at: string
  asn: number
  snapshot_date?: string
  provenance_status?: BGPProvenanceStatus
  data_provenance?: BGPDataProvenanceMap | null
}

export interface BGPDiffResponse {
  older: BGPDiffSnapshotMeta
  newer: BGPDiffSnapshotMeta
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

/** Comparison of a new snapshot with the previous one of the same ASN. */
export interface BGPSnapshotComparison {
  status: 'no_previous' | BGPComparisonStatus
  previous_snapshot_id: number | null
}

export interface BGPSnapshotResponse {
  // Sent with the Go field names (ID, CreatedAt, ...); the UI does not read it.
  snapshot: unknown
  // null when the comparison produced no alert (nil slice on the Go side).
  alerts: BGPAlert[] | null
  // Absent from older backends.
  data_provenance?: BGPDataProvenanceMap
  comparison?: BGPSnapshotComparison
}
