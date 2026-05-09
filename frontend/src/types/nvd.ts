export interface NVDOnlineRequest {
  pub_start_date: string   // format ISO "2024-01-01T00:00:00.000Z"
  pub_end_date?: string
  cvss_min: number
  keyword?: string
  results_per_page: number // 1-2000
  page: number
}

export interface NVDOnlineResponse {
  message: string
  created: number
  skipped: number
  total_remote: number
  total_available: number
}

export interface NVDConfig {
  has_key: boolean
  masked: string
}