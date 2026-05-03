export interface VTStats {
  malicious: number
  suspicious: number
  undetected: number
  harmless: number
}

export interface VTEngineResult {
  category: string
  result: string
}

export interface VirusTotalData {
  meaningful_name: string
  type_description: string
  first_seen: string
  last_analysis: string
  stats: VTStats
  malicious_engines: Record<string, VTEngineResult>
  tags: string[]
  threat_label: string
  detection_score: number
}

export interface MalwareBazaarData {
  file_type: string
  file_name: string
  first_seen: string
  last_seen: string
  signature: string
  tags: string[]
  reporter: string
  vendor_intel?: Record<string, unknown>
}

export interface ThreatFoxData {
  malware: string
  confidence_level: number
  ioc_type: string
  threat_type: string
  first_seen: string
  last_seen: string
  tags: string[]
}

export interface URLhausData {
  file_type: string
  urls_count: number
  urlhaus_reference: string
  signature: string
}

export interface HashSourceResult {
  source: 'malwarebazaar' | 'threatfox' | 'urlhaus' | 'virustotal'
  status: 'found' | 'not_found' | 'error' | 'skipped' | 'not_configured'
  found: boolean
  data?: unknown
  error?: string
}

export interface HashAnalysisResponse {
  hash: string
  hash_type: 'md5' | 'sha256'
  found: boolean
  sources: HashSourceResult[]
  best_result: HashSourceResult | null
  from_cache: boolean
}

export interface VTConfig {
  configured: boolean
  masked_key: string
}

// Legacy — keep for compatibility
export interface HashData {
  sha256_hash?: string
  md5_hash?: string
  sha1_hash?: string
  file_name?: string
  file_type?: string
  file_size?: number
  first_seen?: string
  last_seen?: string
  tags?: string[]
  signature?: string | null
  imphash?: string
  reporter?: string
}

export interface BulkHashResult {
  hash: string
  result?: HashAnalysisResponse
  error?: string
}

export interface BulkHashResponse {
  results: BulkHashResult[]
}
