export interface LayerEntry {
  technique_id: string
  name: string
  color: string
  comment: string
  score: number
  enabled: boolean
}

export interface AttackLayer {
  id: number
  name: string
  description: string
  domain: string
  version: string
  layer_data: string
  created_at: string
  updated_at: string
}

export interface AttackLayerListResponse {
  items: AttackLayer[]
  total: number
}

export interface AttackLayerCreatePayload {
  name: string
  description?: string
  domain?: string
  version?: string
}

export interface NavigatorExport {
  name: string
  description: string
  domain: string
  versions: Record<string, string>
  techniques: {
    techniqueID: string
    tactic?: string
    color: string
    comment: string
    score: number
    enabled: boolean
  }[]
}
