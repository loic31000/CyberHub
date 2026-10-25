import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { AlertTriangle, Check, Database, Download, EyeOff, KeyRound, Link2, RefreshCw, Search, Upload, Wifi } from 'lucide-react'
import { settingsApi, settingsDbApi, osintWmnApi, hashApi, cisaApi, threatFeedsApi } from '@/api/client'
import { toast } from '@/store/toast'
import ConfirmModal from '@/components/ConfirmModal'
import { ModuleHero, Body, Pins, Pulse, Trace, Via } from '@/hero/ModuleHero'
import type { DBVersions } from '@/types/osint'
import type { ThreatFeedSync } from '@/types/threat_intel'
import '../settings26/settings.css'

type Resource = 'knowledge' | 'kev' | 'feeds' | 'vt' | 'nvd'
type LoadState = 'loading' | 'success' | 'error'
type Counts = { created: number; skipped: number }
type ImportStats = { tools: Counts; ctf: Counts; cve: Counts; playbooks: Counts }
type KeyTarget = 'vt' | 'nvd' | null
const IMPORT_LIMIT = 10 * 1024 * 1024

export function formatSettingsDate(value?: string | null): string {
  if (!value || value.startsWith('0001-')) return 'Jamais synchronisé'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Date inconnue'
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isExportPayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const arrays = ['tools', 'ctf_writeups', 'cve_entries', 'playbooks']
  const recognized = arrays.filter(key => key in value)
  return recognized.length > 0 && recognized.every(key => Array.isArray(value[key]))
}

function normalizeImportStats(value: unknown): ImportStats {
  const result = isRecord(value) ? value : {}
  const count = (key: string): Counts => {
    const category = isRecord(result[key]) ? result[key] : {}
    const safe = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
    return { created: safe(category.created), skipped: safe(category.skipped) }
  }
  return { tools: count('tools'), ctf: count('ctf'), cve: count('cve'), playbooks: count('playbooks') }
}

function SettingsMotif() {
  return <svg className="st26-motif" viewBox="0 0 600 118" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="st26-bus-glow"><stop stopColor="#00d4ff" stopOpacity=".14" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
      <linearGradient id="st26-node-fill" x2="0" y2="1"><stop stopColor="#102437" /><stop offset="1" stopColor="#09131e" /></linearGradient>
    </defs>
    <ellipse cx="306" cy="59" rx="252" ry="62" fill="url(#st26-bus-glow)" />
    <Trace pts={[[118, 59], [166, 59], [182, 59]]} bus />
    <Trace pts={[[298, 59], [326, 59], [342, 46], [360, 46]]} bus />
    <Trace pts={[[438, 46], [458, 46], [474, 35], [490, 35]]} />
    <Trace pts={[[438, 70], [458, 70], [474, 82], [490, 82]]} />
    <path className="st26-motif-flow" d="M118 59h64m116 0h44l18-13h60l18-11h112M438 70h20l16 12h64" />
    <Pulse path="M118 59 L166 59 L182 59" period={9} delay={0} />
    <Pulse path="M298 59 L326 59 L342 46 L360 46" period={9} delay={2.2} tone="ice" />
    <Pulse path="M438 46 L458 46 L474 35 L490 35" period={9} delay={4.4} />
    <Pulse path="M438 70 L458 70 L474 82 L490 82" period={9} delay={6.6} tone="ice" />
    <Via x={118} y={59} /><Via x={166} y={59} r={2} /><Via x={342} y={46} r={2} /><Via x={474} y={35} r={2} /><Via x={474} y={82} r={2} />
    <Body x={34} y={35} w={84} h={48} r={6} /><Pins side="l" at={[45, 58, 71]} from={34} /><Pins side="r" at={[45, 58, 71]} from={118} />
    <Body x={182} y={20} w={116} h={78} r={9} /><Pins side="l" at={[39, 59, 79]} from={182} len={6} /><Pins side="r" at={[39, 59, 79]} from={298} len={6} />
    <rect className="st26-motif-core" x="191" y="28" width="98" height="62" rx="6" />
    <path className="st26-motif-core-mark" d="M223 58h34m-17-16v32m-9-16 9-9 9 9-9 9" />
    <Body x={360} y={32} w={78} h={48} r={6} /><Pins side="l" at={[46, 58, 70]} from={360} /><Pins side="r" at={[46, 58, 70]} from={438} />
    <Body x={490} y={24} w={82} h={22} r={5} /><Body x={490} y={71} w={82} h={22} r={5} />
    <text x="76" y="62" textAnchor="middle">DATABASE</text><text x="240" y="63" textAnchor="middle">CONTROL NODE</text>
    <text x="399" y="61" textAnchor="middle">INTEL SOURCES</text><text x="531" y="38" textAnchor="middle">API</text><text x="531" y="85" textAnchor="middle">FEEDS</text>
  </svg>
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`st26-panel ${className}`}>{children}</div>
}

function SectionHeading({ id, index, title, detail, icon }: { id: string; index: string; title: string; detail: string; icon: ReactNode }) {
  return <div className="st26-heading"><span className="st26-heading-icon" aria-hidden="true">{icon}</span><div><p className="st26-kicker">CONTROL PLANE / {index}</p><h2 id={id}>{title}</h2><p>{detail}</p></div></div>
}

function ResourceState({ state }: { state: LoadState }) {
  return <span className={`st26-state is-${state}`}><i aria-hidden="true" />{state === 'loading' ? 'Chargement' : state === 'error' ? 'Indisponible' : 'Disponible'}</span>
}

export default function Settings() {
  const mounted = useRef(false)
  const requestIds = useRef<Record<Resource, number>>({ knowledge: 0, kev: 0, feeds: 0, vt: 0, nvd: 0 })
  const busyRef = useRef(new Set<string>())
  const objectUrls = useRef(new Set<string>())
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [states, setStates] = useState<Record<Resource, LoadState>>({ knowledge: 'loading', kev: 'loading', feeds: 'loading', vt: 'loading', nvd: 'loading' })
  const [dbVersions, setDbVersions] = useState<DBVersions | null>(null)
  const [cisaStats, setCisaStats] = useState<{ total_entries: number; last_updated: string } | null>(null)
  const [feedStatus, setFeedStatus] = useState<{ feodo?: ThreatFeedSync; urlhaus?: ThreatFeedSync } | null>(null)
  const [vtConfig, setVtConfig] = useState<{ configured: boolean; masked_key: string } | null>(null)
  const [nvdConfig, setNvdConfig] = useState<{ has_key: boolean; masked: string } | null>(null)
  const [vtKey, setVtKey] = useState('')
  const [nvdKey, setNvdKey] = useState('')
  const [importResult, setImportResult] = useState<ImportStats | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KeyTarget>(null)
  const [importMessage, setImportMessage] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const vtRef = useRef<HTMLElement>(null)

  const load = useCallback(<T,>(resource: Resource, fetcher: () => Promise<T>, accept: (data: T) => void) => {
    const id = ++requestIds.current[resource]
    setStates(previous => ({ ...previous, [resource]: 'loading' }))
    return fetcher().then(data => {
      if (!mounted.current || requestIds.current[resource] !== id) return
      accept(data)
      setStates(previous => ({ ...previous, [resource]: 'success' }))
    }).catch(() => {
      if (!mounted.current || requestIds.current[resource] !== id) return
      setStates(previous => ({ ...previous, [resource]: 'error' }))
    })
  }, [])

  const loadKnowledge = useCallback(() => load('knowledge', settingsDbApi.getVersions, setDbVersions), [load])
  const loadKev = useCallback(() => load('kev', cisaApi.getStats, setCisaStats), [load])
  const loadFeeds = useCallback(() => load('feeds', threatFeedsApi.getStatus, setFeedStatus), [load])
  const loadVt = useCallback(() => load('vt', hashApi.vtGetConfig, setVtConfig), [load])
  const loadNvd = useCallback(() => load('nvd', settingsApi.getNvdKey, setNvdConfig), [load])

  useEffect(() => {
    mounted.current = true
    void loadKnowledge(); void loadKev(); void loadFeeds(); void loadVt(); void loadNvd()
    const params = new URLSearchParams(window.location.search)
    let frame = 0
    if (params.get('section') === 'virustotal') frame = requestAnimationFrame(() => vtRef.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }))
    return () => {
      mounted.current = false
      cancelAnimationFrame(frame)
      objectUrls.current.forEach(url => URL.revokeObjectURL(url))
      objectUrls.current.clear()
    }
  }, [loadKnowledge, loadKev, loadFeeds, loadVt, loadNvd])

  const run = async (key: string, action: () => Promise<void>, onError: string, successMessage?: string) => {
    if (busyRef.current.has(key)) return
    busyRef.current.add(key)
    setFeedback(null)
    setBusy(previous => new Set(previous).add(key))
    try {
      await action()
      if (mounted.current && successMessage) setFeedback({ tone: 'success', text: successMessage })
    } catch {
      if (mounted.current) setFeedback({ tone: 'error', text: onError })
      toast.error(onError)
    }
    finally {
      busyRef.current.delete(key)
      if (mounted.current) setBusy(previous => { const next = new Set(previous); next.delete(key); return next })
    }
  }
  const isBusy = (key: string) => busy.has(key)
  const update = (key: string, label: string, action: () => Promise<void>) => run(key, async () => { await action(); toast.success(label) }, `Impossible de terminer : ${label.toLowerCase()}.`, label)

  const handleBackup = () => run('backup', async () => {
    const result = await settingsApi.backup()
    if (!result || typeof result.path !== 'string' || !result.path.trim()) throw new Error('invalid backup response')
    toast.success(`Sauvegarde créée : ${result.path}`)
  }, 'La sauvegarde n’a pas pu être créée ou sa réponse est incomplète.', 'Sauvegarde SQLite créée.')

  const handleExport = () => run('export', async () => {
    const data = await settingsApi.export()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    objectUrls.current.add(url)
    window.setTimeout(() => { URL.revokeObjectURL(url); objectUrls.current.delete(url) }, 1000)
    const link = document.createElement('a')
    try {
      link.href = url
      link.download = `cyber-hub-export-${new Date().toISOString().slice(0, 10)}.json`
      link.hidden = true
      document.body.appendChild(link)
      link.click()
    } finally { link.remove() }
    toast.success('Export JSON téléchargé')
  }, 'L’export JSON a échoué.', 'Export JSON téléchargé.')

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImportMessage('')
    setImportResult(null)
    await run('import', async () => {
      if (file.size === 0) throw new Error('empty file')
      if (file.size > IMPORT_LIMIT) throw new Error('file too large')
      const text = await file.text()
      const payload: unknown = JSON.parse(text)
      if (!isExportPayload(payload)) throw new Error('unexpected export format')
      const response = await settingsApi.import(payload)
      const normalized = normalizeImportStats(response)
      if (mounted.current) {
        setImportResult(normalized)
        setImportMessage('Import terminé. Résultats affichés par catégorie.')
      }
      toast.success('Import terminé')
    }, 'Fichier invalide ou import impossible. Vérifiez qu’il s’agit d’un export CyberHub valide.')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSaveKey = (target: Exclude<KeyTarget, null>) => {
    const value = (target === 'vt' ? vtKey : nvdKey).trim()
    if (!value) return
    void run(`save-${target}`, async () => {
      if (target === 'vt') { await hashApi.vtSaveKey(value); if (mounted.current) setVtKey(''); await loadVt() }
      else { await settingsApi.setNvdKey(value); if (mounted.current) setNvdKey(''); await loadNvd() }
      toast.success(`${target === 'vt' ? 'VirusTotal' : 'NVD'} : clé enregistrée`)
    }, `Impossible d’enregistrer la clé ${target === 'vt' ? 'VirusTotal' : 'NVD'}.`, `Clé ${target === 'vt' ? 'VirusTotal' : 'NVD'} enregistrée.`)
  }

  const handleDeleteKey = async () => {
    const target = deleteTarget
    if (!target) return
    setDeleteTarget(null)
    await run(`delete-${target}`, async () => {
      if (target === 'vt') { await hashApi.vtDeleteKey(); if (mounted.current) setVtConfig({ configured: false, masked_key: '' }) }
      else { await settingsApi.deleteNvdKey(); if (mounted.current) setNvdConfig({ has_key: false, masked: '' }) }
      toast.success(`${target === 'vt' ? 'VirusTotal' : 'NVD'} : clé supprimée`)
    }, `Impossible de supprimer la clé ${target === 'vt' ? 'VirusTotal' : 'NVD'}.`, `Clé ${target === 'vt' ? 'VirusTotal' : 'NVD'} supprimée.`)
  }

  const knowledgeRows = [
    { key: 'mitre', title: 'MITRE ATT&CK', type: 'Techniques', count: dbVersions?.mitre?.technique_count, date: dbVersions?.mitre?.last_updated, action: () => update('mitre', 'MITRE ATT&CK mis à jour', async () => { const result = await settingsDbApi.updateMitre(); if (mounted.current) setDbVersions(prev => prev ? { ...prev, mitre: { ...prev.mitre, technique_count: result.technique_count, last_updated: result.updated_at } } : prev) }) },
    { key: 'cloak', title: 'CLOAK OpSec', type: 'Sous-techniques', count: dbVersions?.cloak?.technique_count, date: dbVersions?.cloak?.last_updated, action: () => update('cloak', 'CLOAK mis à jour', async () => { const result = await settingsDbApi.updateCloak(); if (mounted.current) setDbVersions(prev => prev ? { ...prev, cloak: { ...prev.cloak, technique_count: result.technique_count, last_updated: result.updated_at } } : prev) }) },
    { key: 'wmn', title: 'WhatsMyName', type: 'Sites OSINT', count: dbVersions?.wmn?.site_count, date: dbVersions?.wmn?.last_updated, action: () => update('wmn', 'WhatsMyName mis à jour', async () => { const result = await osintWmnApi.updateDb(); if (mounted.current) setDbVersions(prev => prev ? { ...prev, wmn: { site_count: result.site_count, last_updated: result.updated_at } } : prev) }) },
    { key: 'kev', title: 'CISA KEV', type: 'Vulnérabilités', count: cisaStats?.total_entries, date: cisaStats?.last_updated, action: () => update('kev', 'CISA KEV mis à jour', async () => { await cisaApi.updateKEV(); await loadKev() }) },
  ]

  const renderCredential = (target: Exclude<KeyTarget, null>) => {
    const vt = target === 'vt'
    const state = states[vt ? 'vt' : 'nvd']
    const configured = vt ? vtConfig?.configured : nvdConfig?.has_key
    const masked = vt ? vtConfig?.masked_key : nvdConfig?.masked
    const value = vt ? vtKey : nvdKey
    const setValue = vt ? setVtKey : setNvdKey
    const name = vt ? 'VirusTotal' : 'NVD'
    const saveKey = `save-${target}`
    const deleteKey = `delete-${target}`
    return <Panel className="st26-credential" key={target}>
      <div className="st26-credential-top"><div><p className="st26-kicker">{vt ? 'HASH REPUTATION' : 'VULNERABILITY ENRICHMENT'}</p><h3>{name}</h3></div><ResourceState state={state} /></div>
      <p className="st26-muted">{vt ? 'Enrichissement des analyses de hash avec VirusTotal.' : 'Clé optionnelle pour augmenter la limite de requêtes NVD.'}</p>
      {state === 'error' && <p className="st26-inline-error" role="alert">Configuration indisponible. Réessayez ultérieurement.</p>}
      {state === 'loading' && <p className="st26-loading" aria-live="polite">Lecture de la configuration…</p>}
      {state === 'success' && configured ? <div className="st26-configured"><p><Check size={15} aria-hidden="true" /> Clé configurée <code>{masked}</code></p><button className="st26-button is-danger" onClick={() => setDeleteTarget(target)} disabled={isBusy(deleteKey)}><EyeOff size={14} />Supprimer la clé</button></div> : state === 'success' ? <form className="st26-key-form" onSubmit={event => { event.preventDefault(); handleSaveKey(target) }}>
        <label htmlFor={`${target}-key`}>Clé API {name}</label><div className="st26-key-entry"><input id={`${target}-key`} type="password" autoComplete="new-password" spellCheck={false} value={value} onChange={event => setValue(event.target.value)} placeholder={`Saisir la clé ${name}`} /><button className="st26-button is-primary" type="submit" disabled={!value.trim() || isBusy(saveKey)}>{isBusy(saveKey) ? <><RefreshCw className="st26-spin" size={14} />Enregistrement…</> : 'Enregistrer'}</button></div>
      </form> : null}
    </Panel>
  }

  const sideLinks = [
    { href: '#data-safety', n: '01', label: 'DATA / BACKUP', accessible: 'Data & Backup' },
    { href: '#knowledge-sources', n: '02', label: 'KNOWLEDGE', accessible: 'Knowledge Sources' },
    { href: '#threat-intelligence', n: '03', label: 'THREAT FEEDS', accessible: 'Threat Feeds' },
    { href: '#api-integrations', n: '04', label: 'API INTEGRATIONS', accessible: 'API Integrations' },
  ]

  return <div className="st26">
    <div className="st26-scroll" id="settings-scroll">
      <ModuleHero breadcrumb="OPERATIONS / CONTROL PLANE" title="SYSTEM" accent="SETTINGS" typeOnce="settings-2026" subtitle="Data operations, intelligence sources & integrations" motif={<SettingsMotif />} index={{ label: 'CONTROL PLANE', lines: ['DATABASE / SNAPSHOTS', 'INTELLIGENCE SOURCES', 'THREAT FEED BUS', 'API INTEGRATIONS'], status: { text: 'SYSTEM OPERATIONAL', mark: 'LIVE', tone: 'ok' } }} />
      <div className="st26-workspace">
        <nav className="st26-nav" aria-label="Sections des paramètres">
          <span className="st26-nav-label">SYSTEM CHANNELS</span>
          {sideLinks.map(link => <a key={link.href} href={link.href} aria-label={link.accessible}><span aria-hidden="true">{link.n}</span>{link.label}</a>)}
        </nav>

        <main className="st26-content">
          {feedback && <p className={`st26-feedback is-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'} aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}>{feedback.text}</p>}
          <section id="data-safety" className="st26-section" aria-labelledby="st26-data-title" aria-busy={isBusy('backup') || isBusy('export') || isBusy('import')}>
            <SectionHeading id="st26-data-title" index="01 / DATA SAFETY" title="Data & Backup" detail="Sauvegarder, exporter ou importer vos données CyberHub." icon={<Database size={17} />} />
            <div className="st26-ops-grid">
              <Panel className="st26-operation"><div className="st26-op-icon"><Database size={17} /></div><p className="st26-kicker">SQLITE / SNAPSHOT</p><h3>Sauvegarde manuelle</h3><p className="st26-muted">Crée une copie cohérente `.db.bak` dans le dossier de données. Une sauvegarde automatique est également réalisée au démarrage et chaque jour.</p><button className="st26-button" onClick={handleBackup} disabled={isBusy('backup')} aria-busy={isBusy('backup')}>{isBusy('backup') ? <><RefreshCw className="st26-spin" size={14} />Création…</> : <><Database size={14} />Créer une sauvegarde</>}</button></Panel>
              <Panel className="st26-operation"><div className="st26-op-icon"><Download size={17} /></div><p className="st26-kicker">PORTABLE / JSON</p><h3>Exporter CyberHub</h3><p className="st26-muted">Télécharge les outils, writeups CTF, CVE et Playbooks au format JSON.</p><button className="st26-button" onClick={handleExport} disabled={isBusy('export')} aria-busy={isBusy('export')}>{isBusy('export') ? <><RefreshCw className="st26-spin" size={14} />Préparation…</> : <><Download size={14} />Exporter les données</>}</button></Panel>
              <Panel className="st26-operation is-import"><div className="st26-op-icon"><Upload size={17} /></div><p className="st26-kicker">IMPORT / NON DESTRUCTIF</p><h3>Importer un export CyberHub</h3><p className="st26-muted">Les éléments existants sont conservés et ignorés. Choisissez un fichier JSON créé par CyberHub.</p><input ref={fileRef} className="st26-file" type="file" accept="application/json,.json" aria-label="Fichier d’export CyberHub au format JSON" onChange={handleImport} /><button className="st26-button is-import-button" onClick={() => fileRef.current?.click()} disabled={isBusy('import')} aria-busy={isBusy('import')}>{isBusy('import') ? <><RefreshCw className="st26-spin" size={14} />Import…</> : <><Upload size={14} />Choisir un fichier JSON</>}</button><p className="st26-op-foot"><AlertTriangle size={13} />Action sensible · taille maximale 10 Mo</p></Panel>
            </div>
            {importMessage && importResult && <div className="st26-import-result" role="status" aria-live="polite"><div className="st26-result-heading"><Check size={15} />{importMessage}</div><div className="st26-counts">{([['Outils', importResult.tools], ['Writeups CTF', importResult.ctf], ['CVE', importResult.cve], ['Playbooks', importResult.playbooks]] as const).map(([label, counts]) => <div key={label}><span>{label}</span><strong><b>+{counts.created}</b><small>{counts.skipped} ignorés</small></strong></div>)}</div></div>}
          </section>

          <section id="knowledge-sources" className="st26-section" aria-labelledby="st26-knowledge-title" aria-busy={states.knowledge === 'loading'}>
            <SectionHeading id="st26-knowledge-title" index="02 / REFERENCE DATA" title="Knowledge Sources" detail="Référentiels locaux utilisés pour enrichir les enquêtes." icon={<Search size={17} />} />
            <Panel className="st26-register">
              <div className="st26-register-head"><span>Source / Type</span><span>Éléments</span><span>Dernière mise à jour</span><span>État</span><span>Action</span></div>
              {knowledgeRows.map(row => <div className="st26-register-row" key={row.key}>
                <div className="st26-source-name"><span className="st26-source-mark" aria-hidden="true"><Database size={14} /></span><span><strong>{row.title}</strong><small>{row.type}</small></span></div>
                <span className="st26-metric">{row.count ?? (states[row.key === 'kev' ? 'kev' : 'knowledge'] === 'loading' ? '—' : 'Indisponible')}</span>
                <span className="st26-date">{row.date ? formatSettingsDate(row.date) : states[row.key === 'kev' ? 'kev' : 'knowledge'] === 'error' ? 'Indisponible' : '—'}</span>
                <ResourceState state={states[row.key === 'kev' ? 'kev' : 'knowledge']} />
                <button className="st26-button is-small" onClick={row.action} disabled={isBusy(row.key)} aria-busy={isBusy(row.key)}>{isBusy(row.key) ? <><RefreshCw className="st26-spin" size={12} />Mise à jour…</> : 'Mettre à jour'}</button>
              </div>)}
              {states.knowledge === 'error' && <p className="st26-register-error" role="alert">Les données MITRE, CLOAK et WhatsMyName sont temporairement indisponibles.</p>}
            </Panel>
          </section>

          <section id="threat-intelligence" className="st26-section" aria-labelledby="st26-threat-title" aria-busy={states.feeds === 'loading'}>
            <SectionHeading id="st26-threat-title" index="03 / THREAT INTELLIGENCE" title="Threat Feeds" detail="Connecteurs de flux IOC externes." icon={<Wifi size={17} />} />
            {states.feeds === 'error' && <p className="st26-inline-error" role="alert">État des flux indisponible. Vous pouvez réessayer une synchronisation.</p>}
            <div className="st26-feed-grid">
              {([{ key: 'feodo', title: 'Feodo Tracker', origin: 'abuse.ch · IPs de serveurs C2', icon: <Wifi size={15} />, runKey: 'feodo', action: () => update('feodo', 'Feodo Tracker synchronisé', async () => { await threatFeedsApi.syncFeodo(); await loadFeeds() }) }, { key: 'urlhaus', title: 'URLhaus', origin: 'abuse.ch · URLs malveillantes', icon: <Link2 size={15} />, runKey: 'urlhaus', action: () => update('urlhaus', 'URLhaus synchronisé', async () => { await threatFeedsApi.syncURLhaus(); await loadFeeds() }) }] as const).map(feed => {
                const sync = feedStatus?.[feed.key]
                return <Panel className="st26-feed" key={feed.key}><div className="st26-feed-title"><span className="st26-source-mark">{feed.icon}</span><div><h3>{feed.title}</h3><p>{feed.origin}</p></div><ResourceState state={states.feeds} /></div><div className="st26-feed-stats"><div><span>DERNIÈRE SYNC</span><strong>{sync ? formatSettingsDate(sync.last_sync) : 'Jamais synchronisé'}</strong></div><div><span>IOCS</span><strong>{sync?.item_count ?? '—'}</strong></div><div><span>NOUVEAUX</span><strong>{sync?.new_items ?? '—'}</strong></div></div><button className="st26-button is-small" onClick={feed.action} disabled={isBusy(feed.runKey)} aria-busy={isBusy(feed.runKey)}>{isBusy(feed.runKey) ? <><RefreshCw className="st26-spin" size={12} />Synchronisation…</> : <><RefreshCw size={12} />Synchroniser</>}</button></Panel>
              })}
            </div>
          </section>

          <section id="api-integrations" className="st26-section" aria-labelledby="st26-api-title" aria-busy={states.vt === 'loading' || states.nvd === 'loading'}>
            <SectionHeading id="st26-api-title" index="04 / CREDENTIALS" title="API Integrations" detail="Clés utilisées uniquement par les intégrations correspondantes." icon={<KeyRound size={17} />} />
            <div className="st26-credentials">
              <section id="virustotal" ref={vtRef} aria-label="Intégration VirusTotal">{renderCredential('vt')}</section>
              <section id="nvd" aria-label="Intégration NVD">{renderCredential('nvd')}</section>
            </div>
          </section>
          <footer className="st26-footer"><span>CYBERHUB / SETTINGS 2026</span><span>LOCAL CONTROL PLANE</span></footer>
        </main>
      </div>
    </div>
    <ConfirmModal open={deleteTarget !== null} title={`Supprimer la clé ${deleteTarget === 'vt' ? 'VirusTotal' : 'NVD'} ?`} message={`La clé ${deleteTarget === 'vt' ? 'VirusTotal' : 'NVD'} enregistrée sera supprimée de la configuration CyberHub.`} confirmLabel="Supprimer la clé" onConfirm={() => { void handleDeleteKey() }} onCancel={() => setDeleteTarget(null)} />
  </div>
}
