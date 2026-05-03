export interface CorrelationTechnique {
  technique_id: string
  name: string
  tactic: string
}

export interface CorrelationCloakTactic {
  name: string
  description: string
}

export interface CorrelationTool {
  name: string
  category: string
}

export interface CorrelationPlaybook {
  id: number
  title: string
}

export interface CorrelationCVE {
  cve_id: string
  description: string
  cvss_score: number
}

export interface CorrelationLOLBin {
  name: string
  os: string
  category: string
}

export interface CorrelationResult {
  ioc_type: string
  ioc_value: string
  techniques: CorrelationTechnique[]
  cloak_tactics: CorrelationCloakTactic[]
  tools: CorrelationTool[]
  playbooks: CorrelationPlaybook[]
  cves: CorrelationCVE[]
  lolbins: CorrelationLOLBin[]
  generated_at: string
  from_cache: boolean
}

export interface CorrelationHistoryItem {
  ioc_type: string
  ioc_value: string
  generated_at: string
  from_cache: boolean
}
