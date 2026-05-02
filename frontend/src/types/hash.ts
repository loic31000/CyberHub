export interface HashAnalysisResult {
  query_status: string
  data?: HashData | HashData[]
  from_cache?: boolean
}

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
  tlsh?: string
  telfhash?: string
  ssdeep?: string
  reporter?: string
}

export interface BulkHashResult {
  hash: string
  result?: HashAnalysisResult
  error?: string
}

export interface BulkHashResponse {
  results: BulkHashResult[]
}
