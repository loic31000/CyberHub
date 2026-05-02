export interface OSINTJob {
  id: number
  created_at: string
  tool: string
  target: string
  status: 'pending' | 'running' | 'done' | 'error'
  output: string
  iocs_extracted: string // JSON array of {type, value}
  duration: number // ms
  launched_by: string
}

export interface OSINTTool {
  name: string
  installed: boolean
  description: string
  example: string
  install: string  // commande pip pour installer
}

export interface ExtractedIOC {
  type: string
  value: string
}

export interface OSINTJobsResponse {
  jobs: OSINTJob[]
  total: number
}

export interface OSINTToolsResponse {
  tools: OSINTTool[]
}

export interface OSINTRunRequest {
  tool: string
  target: string
}
