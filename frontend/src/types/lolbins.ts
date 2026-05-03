export interface LOLBinCommand {
  // LOLBAS (Windows)
  Command?: string
  Description?: string
  Usecase?: string
  Category?: string
  Privileges?: string
  MitreID?: string
  Tags?: string[]
  // GTFOBins (Linux)
  type?: string
  description?: string
  commands?: string
}

export interface LOLBin {
  id: number
  name: string
  os: 'windows' | 'linux'
  description: string
  full_path: string
  commands: string        // JSON string → parser avec parseJSON
  mitre_tech: string      // JSON string → parser avec parseJSON
  tags: string            // JSON string → parser avec parseJSON
  category: string
  command_count?: number  // enrichi par le backend
}

export interface LOLBinDetail extends LOLBin {
  parsed_commands: LOLBinCommand[]
  parsed_mitre: string[]
  parsed_tags: string[]
}

export interface LOLBinsResponse {
  items: LOLBin[]
  total: number
  win_count: number
  linux_count: number
}

export interface LOLBinCategory {
  os: string
  category: string
  count: number
}
