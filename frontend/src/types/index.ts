// ====================================================
// Types TypeScript stricts pour Cyber-Hub
// ====================================================

export type ToolCategory = 'offensive' | 'defensive' | 'osint'
export type ToolOS = 'windows' | 'linux' | 'both'

// EthicalLevel : niveau d'encadrement éthique d'une fiche outil (v0.6)
//   - standard : 100% défensif/forensics ou OSINT pur
//   - elevated : légal en bug bounty / audit autorisé (LegalNotes obligatoires)
//   - warning  : référencé pédagogiquement, gros warning + rappel Art. 323-1
export type EthicalLevel = 'standard' | 'elevated' | 'warning'

// InputField : un champ paramétrable du générateur de commande.
// Stocké en JSON dans Tool.input_schema.
export interface InputField {
  key: string                // identifiant interne, utilisé dans le template ({{key}})
  label: string              // libellé affiché à l'utilisateur
  placeholder?: string
  required?: boolean
  type?: 'text' | 'number' | 'url' | 'email' | 'username' | 'ip' | 'domain' | 'select'
  options?: string[]         // pour type=select
  default?: string
  helpText?: string
}

export interface Tool {
  id: number
  name: string
  category: ToolCategory
  sub_category: string
  os: ToolOS
  description: string

  // Contenu pédagogique éditable (Markdown)
  install: string
  usage: string
  examples: string
  defense: string
  procedure: string

  // Encadrement éthique et légal
  ethical_level: EthicalLevel
  legal_notes: string
  ethical_use_cases: string

  // Générateur de commande paramétrable
  command_template: string   // ex: "sherlock {{username}} --timeout 10"
  input_schema: string       // JSON.stringify(InputField[])

  // Notes personnelles (Markdown libre)
  user_notes: string

  tags: string
  created_at: string
  updated_at: string
}

export interface ToolCreateRequest {
  name: string
  category: ToolCategory
  sub_category: string
  os: ToolOS
  description: string
  install: string
  usage: string
  examples: string
  defense: string
  procedure: string
  ethical_level: EthicalLevel
  legal_notes: string
  ethical_use_cases: string
  command_template: string
  input_schema: string
  user_notes: string
  tags: string
}

export interface ToolsResponse {
  tools: Tool[]
  count: number
}

export interface AuthStatus {
  is_setup: boolean
}

export interface AuthResponse {
  token: string
  message: string
}

export interface Stats {
  tools_total: number
  offensive: number
  defensive: number
  ctf_total: number
  ctf_completed: number
  cve_total: number
  cve_critical: number
  playbooks_total: number
}

export interface ApiError {
  error: string
}

export type ToolFilter = {
  category?: ToolCategory | ''
  sub_category?: string
  os?: ToolOS | ''
  search?: string
}

// ---- CTF ----
export type CTFPlatform = 'TryHackMe' | 'HackTheBox' | 'Root-Me' | 'PicoCTF' | 'Autre'
export type CTFDifficulty = 'easy' | 'medium' | 'hard' | 'insane'

export interface CTFWriteup {
  id: number
  title: string
  platform: CTFPlatform
  machine_name: string
  difficulty: CTFDifficulty
  category: string
  content: string
  flags: string
  tags: string
  completed: boolean
  created_at: string
  updated_at: string
}

export interface CTFCreateRequest {
  title: string
  platform: CTFPlatform
  machine_name: string
  difficulty: CTFDifficulty
  category: string
  content: string
  flags: string
  tags: string
  completed: boolean
}

export interface CTFsResponse {
  writeups: CTFWriteup[]
  count: number
}

export type CTFFilter = {
  platform?: CTFPlatform | ''
  difficulty?: CTFDifficulty | ''
  search?: string
}

// ---- CVE ----
export type CVESeverity = 'critical' | 'high' | 'medium' | 'low' | 'none'
export type CVEStatus = 'new' | 'analyzed' | 'patched' | 'na'

export interface CVEEntry {
  id: number
  cve_id: string
  description: string
  cvss_score: number
  severity: CVESeverity
  products: string
  status: CVEStatus
  notes: string
  published_at: string
  created_at: string
  updated_at: string
}

export interface CVECreateRequest {
  cve_id: string
  description: string
  cvss_score: number
  severity: CVESeverity
  products: string
  status: CVEStatus
  notes: string
  published_at: string
}

export interface CVEsResponse {
  cves: CVEEntry[]
  count: number
}

export type CVEFilter = {
  severity?: CVESeverity | ''
  status?: CVEStatus | ''
  search?: string
}

export interface NVDImportResponse {
  message: string
  created: number
  skipped: number
  total: number
}

// ---- Playbooks ----
export interface PlaybookStep {
  id: number
  playbook_id: number
  order: number
  content: string
  checked: boolean
}

export interface Playbook {
  id: number
  title: string
  scenario: string
  description: string
  steps: PlaybookStep[]
  created_at: string
  updated_at: string
}

export interface PlaybookCreateRequest {
  title: string
  scenario: string
  description: string
  steps: { content: string; order: number }[]
}

export interface PlaybooksResponse {
  playbooks: Playbook[]
  count: number
}

// ---- Recherche Globale ----
export type SearchCategory = 'tool' | 'ctf' | 'cve' | 'playbook'

export interface SearchResult {
  id: number
  category: SearchCategory
  title: string
  subtitle: string
  path: string
}

export interface SearchResponse {
  results: SearchResult[]
}

// ---- MITRE ATT&CK ----
export interface MITRETactic {
  id: number
  tactic_id: string    // TA0001
  name: string
  short_name: string   // initial-access
  description: string
  url: string
  display_order: number
  created_at: string
}

export interface MITRETechnique {
  id: number
  technique_id: string  // T1046 ou T1046.001
  name: string
  description?: string
  tactics: string       // JSON array stocké en string → parse côté client
  platforms: string     // JSON array
  is_subtechnique: boolean
  parent_id: string
  detection?: string
  url: string
  data_sources?: string
  created_at: string
}

export interface MITREStatus {
  seeded: boolean
  seeding: boolean
  count: number
}

export interface MITRETechniquesResponse {
  items: MITRETechnique[]
  total: number
  page: number
  limit: number
}