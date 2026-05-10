export type InvestigationStatus = 'open' | 'closed' | 'archived'
export type EventType = 'ioc' | 'note' | 'cve' | 'bgp' | 'mitre' | 'playbook' | 'manual'
export type EventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface Investigation {
  id: number
  title: string
  description: string
  status: InvestigationStatus
  tags: string
  created_at: string
  updated_at: string
}

export interface InvestigationEvent {
  id: number
  investigation_id: number
  timestamp: string
  title: string
  description: string
  event_type: EventType
  severity: EventSeverity
  source_module: string
  source_entity_id: string
  metadata: string
  created_at: string
  updated_at: string
}

export interface InvestigationListResponse {
  items: Investigation[]
  total: number
  page: number
  limit: number
}

export interface EventListResponse {
  items: InvestigationEvent[]
  total: number
}

export interface InvestigationCreatePayload {
  title: string
  description?: string
  status?: InvestigationStatus
  tags?: string
}

export interface EventCreatePayload {
  timestamp?: string
  title: string
  description?: string
  event_type?: EventType
  severity?: EventSeverity
  source_module?: string
  source_entity_id?: string
  metadata?: string
}

export interface InvestigationFilter {
  status?: InvestigationStatus | ''
  q?: string
  page?: number
  limit?: number
}

export interface EventFilter {
  event_type?: EventType | ''
  severity?: EventSeverity | ''
  order?: 'asc' | 'desc'
}
