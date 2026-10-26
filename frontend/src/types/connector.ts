// Public view of an internal connector, as served by GET /api/connectors (#94).

export type ConnectorType = 'network_inventory' | 'network_traffic' | 'network_detection' | 'appsec' | 'threat_intel'

export type ConnectorStatus = 'disabled' | 'ready' | 'unavailable' | 'degraded' | 'syncing' | 'error'

export interface ConnectorError {
  code: string
  message: string
  at: string
}

export interface ConnectorSnapshot {
  id: string
  name: string
  type: ConnectorType
  source: string
  description?: string
  capabilities: string[]
  permissions: { local_read: boolean; network_read: boolean; internet: boolean; local_write: boolean }
  inputs: { kind: string; format: string }[]
  outputs: { kind: string }[]
  natural_entity_ref: boolean
  enabled_by_default: boolean
  limits: { timeout_ms: number; max_payload_bytes: number; streaming: boolean }
  enabled: boolean
  status: ConnectorStatus
  last_sync: string | null
  last_success: string | null
  never_synced: boolean
  stale: boolean
  last_error: ConnectorError | null
}

export interface ConnectorList {
  items: ConnectorSnapshot[]
  total: number
}
