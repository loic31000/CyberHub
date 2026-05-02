export interface CheatsheetCommand {
  title: string
  cmd: string
  vars: string[]
}

export interface Cheatsheet {
  tool: string
  category: string
  description: string
  commands: CheatsheetCommand[]
}

export interface CheatsheetSummary {
  tool: string
  category: string
  description: string
  nb_commands: number
}

export interface CheatsheetsListResponse {
  cheatsheets: CheatsheetSummary[]
  total: number
}
