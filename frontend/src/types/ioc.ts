// 'cidr' ajouté pour les préfixes réseau exportés depuis le module BGP Lookup
export type IOCType = 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'cidr'

export type IOCTLP = 'white' | 'green' | 'amber' | 'red'

export type IOCStatus = 'active' | 'archived' | 'false_positive'

export interface IOC {
  id: number
  type: IOCType
  value: string
  source: string
  tlp: IOCTLP
  status: IOCStatus
  tags: string       // JSON array encodé en string ex: '["ransomware","c2"]'
  notes: string
  mitre_tech_id: string
  created_at: string
  updated_at: string
}

export interface IOCCreatePayload {
  type: IOCType
  value: string
  source?: string
  tlp?: IOCTLP
  status?: IOCStatus
  tags?: string
  notes?: string
  mitre_tech_id?: string
}

export interface IOCUpdatePayload {
  type?: IOCType
  value?: string
  source?: string
  tlp?: IOCTLP
  status?: IOCStatus
  tags?: string
  notes?: string
  mitre_tech_id?: string
}

export interface IOCListResponse {
  items: IOC[]
  total: number
  page: number
  limit: number
}

export interface IOCStats {
  total: number
  by_type: Partial<Record<IOCType, number>>
}

export interface IOCFilter {
  type?: IOCType | ''
  status?: IOCStatus | ''
  tlp?: IOCTLP | ''
  q?: string
  page?: number
  limit?: number
}
