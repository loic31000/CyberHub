import axios from 'axios'
import type {
  AuthResponse,
  AuthStatus,
  CTFCreateRequest,
  CTFsResponse,
  CTFWriteup,
  CVECreateRequest,
  CVEEntry,
  CVEsResponse,
  NVDImportResponse,
  Playbook,
  PlaybookCreateRequest,
  PlaybooksResponse,
  PlaybookStep,
  SearchResponse,
  Stats,
  Tool,
  ToolCreateRequest,
  ToolFilter,
  CTFFilter,
  CVEFilter,
  ToolsResponse,
} from '@/types'

// En dev : Vite proxie /api → localhost:7743
// En prod (embarqué) : même origine
const BASE_URL = '/api'

const http = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Injecter le token JWT dans chaque requête si présent
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('cyber_hub_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Rediriger vers /login si le token expire (401)
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cyber_hub_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// ---- Auth ----
export const authApi = {
  getStatus: () => http.get<AuthStatus>('/auth/status').then((r) => r.data),

  setup: (password: string) =>
    http.post<AuthResponse>('/auth/setup', { password }).then((r) => r.data),

  login: (password: string) =>
    http.post<AuthResponse>('/auth/login', { password }).then((r) => r.data),
}

// ---- Outils ----
export const toolsApi = {
  list: (filters?: ToolFilter) =>
    http
      .get<ToolsResponse>('/tools', { params: filters })
      .then((r) => r.data),

  get: (id: number) =>
    http.get<Tool>(`/tools/${id}`).then((r) => r.data),

  create: (data: ToolCreateRequest) =>
    http.post<Tool>('/tools', data).then((r) => r.data),

  update: (id: number, data: ToolCreateRequest) =>
    http.put<Tool>(`/tools/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    http.delete(`/tools/${id}`).then((r) => r.data),

  getCategories: () =>
    http
      .get<{ categories: string[] }>('/tools/categories')
      .then((r) => r.data.categories),
}

// ---- Stats ----
export const statsApi = {
  get: () => http.get<Stats>('/stats').then((r) => r.data),
}

// ---- CTF ----
export const ctfApi = {
  list: (filters?: CTFFilter) =>
    http.get<CTFsResponse>('/ctf', { params: filters }).then((r) => r.data),

  get: (id: number) =>
    http.get<CTFWriteup>(`/ctf/${id}`).then((r) => r.data),

  create: (data: CTFCreateRequest) =>
    http.post<CTFWriteup>('/ctf', data).then((r) => r.data),

  update: (id: number, data: CTFCreateRequest) =>
    http.put<CTFWriteup>(`/ctf/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    http.delete(`/ctf/${id}`).then((r) => r.data),
}

// ---- CVE ----
export const cveApi = {
  list: (filters?: CVEFilter) =>
    http.get<CVEsResponse>('/cve', { params: filters }).then((r) => r.data),

  get: (id: number) =>
    http.get<CVEEntry>(`/cve/${id}`).then((r) => r.data),

  create: (data: CVECreateRequest) =>
    http.post<CVEEntry>('/cve', data).then((r) => r.data),

  update: (id: number, data: CVECreateRequest) =>
    http.put<CVEEntry>(`/cve/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    http.delete(`/cve/${id}`).then((r) => r.data),

  importNVD: (payload: object) =>
    http.post<NVDImportResponse>('/cve/import-nvd', payload).then((r) => r.data),

  fetchFromNVD: (params: import('@/types/nvd').NVDOnlineRequest) =>
    http.post<import('@/types/nvd').NVDOnlineResponse>('/cve/fetch-from-nvd', params).then(r => r.data),
}

// ---- Settings / Backup / Export ----
export const settingsApi = {
  backup: () =>
    http.post<{ message: string; path: string }>('/settings/backup').then((r) => r.data),

  export: () =>
    http.get('/settings/export').then((r) => r.data),

  import: (payload: unknown) =>
    http.post<{
      tools:     { created: number; skipped: number }
      ctf:       { created: number; skipped: number }
      cve:       { created: number; skipped: number }
      playbooks: { created: number; skipped: number }
    }>('/settings/import', payload).then((r) => r.data),

  getNvdKey: () =>
    http.get<import('@/types/nvd').NVDConfig>('/settings/nvd-key').then((r) => r.data),

  setNvdKey: (apiKey: string) =>
    http.post<{ success: boolean }>('/settings/nvd-key', { api_key: apiKey }).then((r) => r.data),

  deleteNvdKey: () =>
    http.delete<{ success: boolean }>('/settings/nvd-key').then((r) => r.data),
}

// ---- Recherche Globale ----
export const searchApi = {
  global: (q: string) =>
    http.get<SearchResponse>('/search', { params: { q } }).then((r) => r.data),
}

// ---- MITRE ATT&CK ----
export const mitreApi = {
  status: () =>
    http.get<import('@/types').MITREStatus>('/mitre/status').then((r) => r.data),

  tactics: () =>
    http.get<import('@/types').MITRETactic[]>('/mitre/tactics').then((r) => r.data),

  techniques: (params?: {
    tactic?: string
    platform?: string
    q?: string
    only_techniques?: boolean
    page?: number
    limit?: number
  }) =>
    http.get<import('@/types').MITRETechniquesResponse>('/mitre/techniques', { params }).then((r) => r.data),

  technique: (id: string) =>
    http.get<import('@/types').MITRETechnique>(`/mitre/techniques/${id}`).then((r) => r.data),
}

// ---- Playbooks ----
export const playbookApi = {
  list: (params?: { page?: number; limit?: number }) =>
    http.get<PlaybooksResponse>('/playbooks', { params }).then((r) => r.data),

  get: (id: number) =>
    http.get<Playbook>(`/playbooks/${id}`).then((r) => r.data),

  create: (data: PlaybookCreateRequest) =>
    http.post<Playbook>('/playbooks', data).then((r) => r.data),

  update: (id: number, data: PlaybookCreateRequest) =>
    http.put<Playbook>(`/playbooks/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    http.delete(`/playbooks/${id}`).then((r) => r.data),

  toggleStep: (playbookId: number, stepId: number) =>
    http
      .patch<PlaybookStep>(`/playbooks/${playbookId}/steps/${stepId}/toggle`)
      .then((r) => r.data),

  reset: (id: number) =>
    http.post(`/playbooks/${id}/reset`).then((r) => r.data),
}

// ---- IOC Manager ----
export const iocApi = {
  list: (params?: import('@/types/ioc').IOCFilter) =>
    http
      .get<import('@/types/ioc').IOCListResponse>('/ioc', { params })
      .then((r) => r.data),

  get: (id: number) =>
    http.get<import('@/types/ioc').IOC>(`/ioc/${id}`).then((r) => r.data),

  stats: () =>
    http.get<import('@/types/ioc').IOCStats>('/ioc/stats').then((r) => r.data),

  create: (data: import('@/types/ioc').IOCCreatePayload) =>
    http.post<import('@/types/ioc').IOC>('/ioc', data).then((r) => r.data),

  update: (id: number, data: import('@/types/ioc').IOCUpdatePayload) =>
    http.put<import('@/types/ioc').IOC>(`/ioc/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    http.delete(`/ioc/${id}`).then((r) => r.data),

  exportCSV: () =>
    http
      .get('/ioc/export', { responseType: 'blob' })
      .then((r) => {
        const url = window.URL.createObjectURL(new Blob([r.data]))
        const a = document.createElement('a')
        a.href = url
        const date = new Date().toISOString().slice(0, 10)
        a.download = `ioc-export-${date}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      }),

  importCSV: (file: File, defaultTlp: string, defaultStatus: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('default_tlp', defaultTlp)
    formData.append('default_status', defaultStatus)
    return http
      .post<import('@/types/threat_intel').ImportResult>('/ioc/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
}

// ---- BGP / AS Lookup + Historian ----

/**
 * Payload pour l'export IOC depuis le module BGP.
 *
 * - `type` : toujours "cidr" — les numéros ASN ne sont pas des IOC valides dans ce système.
 * - `value` : préfixe CIDR valide (ex: "1.2.3.0/24", "2001:db8::/32").
 * - `asn` : numéro AS d'origine, utilisé par le backend pour construire la source si `source` est absent.
 * - `source` : libellé de source libre (ex: "IP Lookup — AS13335"). Prioritaire sur `asn` côté backend.
 * - `description` : note optionnelle ajoutée aux métadonnées de l'IOC.
 */
export type BGPExportIOCPayload = {
  type: 'cidr'
  value: string
  asn?: number
  source?: string
  description?: string
}

export const bgpApi = {
  // Proxy BGPView avec cache TTL 1h
  lookupASN: (asn: number) =>
    http
      .get<import('@/types/bgp').BGPViewResponse<import('@/types/bgp').ASNInfo>>(`/bgp/asn/${asn}`)
      .then((r) => r.data),

  lookupASNPrefixes: (asn: number) =>
    http
      .get<import('@/types/bgp').PrefixList>(`/bgp/asn/${asn}/prefixes`)
      .then((r) => r.data),

  lookupASNPeers: (asn: number) =>
    http
      .get<import('@/types/bgp').PeerList>(`/bgp/asn/${asn}/peers`)
      .then((r) => r.data),

  lookupASNUpstreams: (asn: number) =>
    http
      .get<import('@/types/bgp').UpstreamList>(`/bgp/asn/${asn}/upstreams`)
      .then((r) => r.data),

  lookupASNDownstreams: (asn: number) =>
    http
      .get<import('@/types/bgp').DownstreamList>(`/bgp/asn/${asn}/downstreams`)
      .then((r) => r.data),

  lookupIP: (ip: string) =>
    http
      .get<import('@/types/bgp').IPInfo>(`/bgp/ip/${ip}`)
      .then((r) => r.data),

  getStatus: () =>
    http
      .get<import('@/types/bgp').BGPStatusResponse>('/bgp/status')
      .then((r) => r.data),

  search: (q: string) =>
    http
      .get<import('@/types/bgp').SearchResult>('/bgp/search', { params: { q } })
      .then((r) => r.data),

  takeSnapshot: (asn: number) =>
    http
      .post<import('@/types/bgp').BGPSnapshotResponse>(`/bgp/snapshot/${asn}`)
      .then((r) => r.data),

  getSnapshots: (asn: number, limit = 20, offset = 0) =>
    http
      .get<import('@/types/bgp').PaginatedResponse<import('@/types/bgp').BGPSnapshot>>(
        `/bgp/snapshots/${asn}`,
        { params: { limit, offset } },
      )
      .then((r) => r.data),

  getDiff: (asn: number, idA: number, idB: number) =>
    http
      .get<import('@/types/bgp').BGPDiffResponse>(`/bgp/snapshots/${asn}/diff`, {
        params: { id_a: idA, id_b: idB },
      })
      .then((r) => r.data),

  getAlerts: (limit = 50, offset = 0) =>
    http
      .get<import('@/types/bgp').PaginatedResponse<import('@/types/bgp').BGPAlert>>(
        '/bgp/alerts',
        { params: { limit, offset } },
      )
      .then((r) => r.data),

  ackAlert: (id: number) =>
    http.patch(`/bgp/alerts/${id}/ack`).then((r) => r.data),

  /**
   * Exporte un préfixe BGP en IOC de type CIDR.
   * Le backend valide le format CIDR et génère la source depuis `asn` si `source` n'est pas fourni.
   */
  exportIOC: (payload: BGPExportIOCPayload) =>
    http
      .post<import('@/types/ioc').IOC>('/bgp/export-ioc', payload)
      .then((r) => r.data),
}

// ---- CLOAK Annotations ----
export const cloakAnnotationsApi = {
  list: () =>
    http
      .get<import('@/types/cloakAnnotation').CloakAnnotation[]>('/cloak/annotations')
      .then((r) => r.data),

  upsert: (req: import('@/types/cloakAnnotation').CloakAnnotationRequest) =>
    http
      .post<import('@/types/cloakAnnotation').CloakAnnotation>('/cloak/annotations', req)
      .then((r) => r.data),

  deleteByRef: (ref: string) =>
    http.delete(`/cloak/annotations/ref/${encodeURIComponent(ref)}`).then((r) => r.data),
}

// ---- Threat Feed (feeds CVE automatiques) ----
export const threatApi = {
  feeds: () =>
    http
      .get<import('@/types/threat').ThreatFeedLog[]>('/threat/feeds')
      .then((r) => r.data),

  alerts: () =>
    http
      .get<{ alerts: import('@/types').CVEEntry[]; count: number; since: string }>('/threat/alerts')
      .then((r) => r.data),

  runFeed: (name: 'cisa_kev' | 'nvd_api') =>
    http.post(`/threat/run/${name}`).then((r) => r.data),
}

// ---- Reverse Shell Generator ----
export const revshellApi = {
  generate: (params: import('@/types/revshell').RevShellParams) =>
    http
      .get<import('@/types/revshell').RevShellResponse>('/revshell', { params })
      .then((r) => r.data),
}

// ---- Corrélation Globale ----
export const correlationApi = {
  correlationByIOCId: (id: number) =>
    http
      .get<import('@/types/correlation').CorrelationResult>(`/correlation/ioc/${id}`)
      .then((r) => r.data),

  correlationAnalyze: (type: string, value: string) =>
    http
      .post<import('@/types/correlation').CorrelationResult>('/correlation/analyze', { type, value })
      .then((r) => r.data),

  correlationHistory: () =>
    http
      .get<{ items: import('@/types/correlation').CorrelationHistoryItem[] }>('/correlation/history')
      .then((r) => r.data.items),

  correlationInvalidateCache: (iocValue: string) =>
    http.delete(`/correlation/cache/${encodeURIComponent(iocValue)}`).then((r) => r.data),
}

// ---- Notes opérationnelles ----
export const notesApi = {
  list: () =>
    http
      .get<import('@/types/note').NotesResponse>('/notes')
      .then((r) => r.data),

  get: (id: number) =>
    http.get<import('@/types/note').Note>(`/notes/${id}`).then((r) => r.data),

  create: (req: import('@/types/note').NoteCreateRequest) =>
    http.post<import('@/types/note').Note>('/notes', req).then((r) => r.data),

  update: (id: number, req: import('@/types/note').NoteCreateRequest) =>
    http
      .put<import('@/types/note').Note>(`/notes/${id}`, req)
      .then((r) => r.data),

  delete: (id: number) =>
    http.delete(`/notes/${id}`).then((r) => r.data),

  search: (q: string) =>
    http
      .get<import('@/types/note').NotesResponse>('/notes/search', { params: { q } })
      .then((r) => r.data),
}

// ---- Hash Analyzer (multi-sources) ----
export const hashApi = {
  hashAnalyze: (hash: string) =>
    http
      .get<import('@/types/hash').HashAnalysisResponse>(`/hash/analyze/${hash}`)
      .then((r) => r.data),

  bulkAnalyze: (hashes: string[]) =>
    http
      .post<import('@/types/hash').BulkHashResponse>('/hash/bulk', { hashes })
      .then((r) => r.data),

  deleteCache: (hash: string) =>
    http.delete(`/hash/cache/${hash}`).then((r) => r.data),

  vtGetConfig: () =>
    http.get<import('@/types/hash').VTConfig>('/settings/virustotal').then((r) => r.data),

  vtSaveKey: (apiKey: string) =>
    http.post('/settings/virustotal', { api_key: apiKey }).then((r) => r.data),

  vtDeleteKey: () =>
    http.delete('/settings/virustotal').then((r) => r.data),
}

// ---- Cheatsheets ----
export const cheatsheetsApi = {
  list: () =>
    http
      .get<import('@/types/cheatsheet').CheatsheetsListResponse>('/cheatsheets')
      .then((r) => r.data),

  getByTool: (toolName: string) =>
    http
      .get<import('@/types/cheatsheet').Cheatsheet>(`/cheatsheets/${toolName}`)
      .then((r) => r.data),
}

// ---- OSINT WMN (WhatsMyName natif Go) ----
export const osintWmnApi = {
  getMeta: () =>
    http
      .get<import('@/types/osint').WMNMeta>('/osint/meta')
      .then((r) => r.data),

  run: (username: string, category: string) =>
    http
      .post<{ job_id: number }>('/osint/run', { username, category })
      .then((r) => r.data),

  listJobs: () =>
    http
      .get<{ jobs: import('@/types/osint').OSINTJobSummary[]; total: number }>('/osint/jobs')
      .then((r) => r.data),

  getJob: (id: number) =>
    http
      .get<import('@/types/osint').OSINTJobDetail>(`/osint/jobs/${id}`)
      .then((r) => r.data),

  deleteJob: (id: number) =>
    http.delete(`/osint/jobs/${id}`).then((r) => r.data),

  importIoc: (id: number) =>
    http
      .post<{ created: number; skipped: number }>(`/osint/jobs/${id}/import-ioc`)
      .then((r) => r.data),

  updateDb: () =>
    http
      .post<{ success: boolean; site_count: number; updated_at: string }>('/osint/update-db')
      .then((r) => r.data),

  streamUrl: (id: number) => {
    const token = localStorage.getItem('cyber_hub_token') ?? ''
    return `/api/osint/jobs/${id}/stream?token=${encodeURIComponent(token)}`
  },
}

// ---- CISA KEV + EPSS ----
export const cisaApi = {
  checkKEV: (cveId: string) =>
    http.get<{ exploited: boolean; entry: import('@/types/threat_intel').CISAKEVEntry | null }>(`/cisa/kev/check/${cveId}`).then((r) => r.data),

  batchCheckKEV: (cveIds: string[]) =>
    http.get<Record<string, boolean>>('/cisa/kev/batch', {
      params: { ids: cveIds.join(',') },
    }).then((r) => r.data),

  getStats: () =>
    http.get<{ total_entries: number; last_updated: string }>(`/cisa/kev/stats`).then((r) => r.data),

  updateKEV: () =>
    http.post<{ success: boolean; count: number; new_items: number; updated_at: string }>(`/cisa/kev/update`).then((r) => r.data),

  getEPSS: (cveId: string) =>
    http.get<import('@/types/threat_intel').EPSSScore>(`/epss/${cveId}`).then((r) => r.data),
}

// ---- LOLBins (LOLBAS + GTFOBins) ----
export const lolbinsApi = {
  list: (params?: { os?: string; category?: string; search?: string; mitre?: string }) =>
    http.get<import('@/types/lolbins').LOLBinsResponse>(`/lolbins`, { params }).then((r) => r.data),

  getByName: (name: string) =>
    http.get<import('@/types/lolbins').LOLBin>(`/lolbins/${encodeURIComponent(name)}`).then((r) => r.data),

  getCategories: () =>
    http.get<import('@/types/lolbins').LOLBinCategory[]>(`/lolbins/categories`).then((r) => r.data),

  getByMitre: (techId: string) =>
    http.get<import('@/types/lolbins').LOLBin[]>(`/lolbins/mitre/${techId}`).then((r) => r.data),
}

// ---- Threat Feeds (Feodo + URLhaus) ----
export const threatFeedsApi = {
  getStatus: () =>
    http.get<import('@/types/threat_intel').ThreatFeedsStatus>(`/threat-feeds/status`).then((r) => r.data),

  syncFeodo: () =>
    http.post<import('@/types/threat_intel').ThreatFeedSyncResult>(`/threat-feeds/sync/feodo`).then((r) => r.data),

  syncURLhaus: () =>
    http.post<import('@/types/threat_intel').ThreatFeedSyncResult>(`/threat-feeds/sync/urlhaus`).then((r) => r.data),
}

// ---- Settings DB Versions ----
export const settingsDbApi = {
  getVersions: () =>
    http
      .get<import('@/types/osint').DBVersions>('/settings/db-versions')
      .then((r) => r.data),

  updateMitre: () =>
    http
      .post<{ success: boolean; technique_count: number; updated_at: string }>('/settings/update-mitre')
      .then((r) => r.data),

  updateCloak: () =>
    http
      .post<{ success: boolean; technique_count: number; updated_at: string }>('/settings/update-cloak')
      .then((r) => r.data),
}
