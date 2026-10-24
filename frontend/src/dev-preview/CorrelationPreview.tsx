/**
 * Development-only fixture harness for Correlation 2026. Not imported by the
 * app entry; correlation-preview.html is not part of the production build.
 * Every API call is answered here with fictional data: no login, no backend.
 */
import { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { correlationApi, iocApi } from '@/api/client'
import CorrelationPage from '@/pages/CorrelationPage'
import type { CorrelationHistoryItem, CorrelationResult } from '@/types/correlation'
import { correlationResult } from '@/corr26/__fixtures__'
import '@/index.css'
import './CorrelationPreview.css'

type Scenario = 'initial' | 'result' | 'history' | 'empty' | 'loading' | 'error'

const scenarios: { id: Scenario; label: string }[] = [
  { id: 'initial', label: 'Analyse initiale' },
  { id: 'result', label: 'Résultat complet' },
  { id: 'history', label: 'Historique' },
  { id: 'empty', label: 'Sans correspondance' },
  { id: 'loading', label: 'Chargement' },
  { id: 'error', label: 'Erreur' },
]

const query = new URLSearchParams(window.location.search)
const scenario = (scenarios.find(s => s.id === query.get('scenario'))?.id ?? 'initial') as Scenario

const full = correlationResult({
  techniques: [
    { technique_id: 'T1071.001', name: 'Application Layer Protocol: Web Protocols', tactic: '["command-and-control"]' },
    { technique_id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'exfiltration' },
    { technique_id: 'T1595', name: 'Active Scanning', tactic: 'reconnaissance' },
    { technique_id: 'T1110', name: 'Brute Force', tactic: '["credential-access"]' },
  ],
  tools: [{ name: 'Wireshark', category: 'Analyse réseau' }, { name: 'Zeek', category: 'NSM' }],
  playbooks: [{ id: 3, title: 'Réponse Ransomware' }, { id: 5, title: 'Brute Force SSH/RDP détecté' }],
  next_actions: ['Bloquer l’adresse sur le pare-feu périmétrique', 'Rechercher les connexions sortantes vers cette adresse sur 7 jours', 'Ouvrir le playbook Brute Force si des échecs d’authentification sont observés'],
})
const none = correlationResult({ techniques: [], cves: [], playbooks: [], investigations: [], attack_layers: [], tools: [], lolbins: [], cloak_tactics: [], notes: [], next_actions: [], confidence: 0.05, rationale: 'Aucun lien trouvé dans les données locales.' })
const history: CorrelationHistoryItem[] = [
  { ioc_type: 'ip', ioc_value: '203.0.113.42', generated_at: '2026-10-24T09:30:00Z', from_cache: true },
  { ioc_type: 'domain', ioc_value: 'exemple-malveillant.test', generated_at: '2026-10-23T16:12:00Z', from_cache: true },
  { ioc_type: 'hash', ioc_value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', generated_at: '2026-10-23T11:05:00Z', from_cache: true },
  { ioc_type: 'url', ioc_value: 'https://exemple.test/payload/stage2.bin', generated_at: '2026-10-22T08:40:00Z', from_cache: true },
  { ioc_type: 'cidr', ioc_value: '198.51.100.0/24', generated_at: '2026-10-21T14:20:00Z', from_cache: true },
]

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// The page talks to these objects; the harness answers in their place.
Object.assign(correlationApi, {
  correlationAnalyze: async (type: string, value: string): Promise<CorrelationResult> => {
    if (scenario === 'loading') return new Promise(() => {})
    await wait(450)
    if (scenario === 'error') throw new Error('Aperçu : erreur simulée')
    const base = scenario === 'empty' ? none : full
    return { ...base, ioc_type: type, ioc_value: value }
  },
  correlationHistory: async () => { await wait(300); return history },
  correlationInvalidateCache: async () => { await wait(200); return {} },
})
Object.assign(iocApi, { create: async () => { await wait(300); return {} } })

/* Plays the scenario once: types a value and analyses it, or opens the history. */
function Autoplay() {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scenario === 'history' || scenario === 'result') {
        document.querySelector<HTMLButtonElement>('.cr26-history button')?.click()
      }
      if (scenario === 'initial' || scenario === 'history') return
      const input = document.querySelector<HTMLInputElement>('.cr26-input input')
      if (!input) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '203.0.113.42')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      setTimeout(() => document.querySelector<HTMLButtonElement>('.cr26-query .cr26-btn')?.click(), 50)
    }, 300)
    return () => clearTimeout(timer)
  }, [])
  return null
}

/* Links inside the page stay in the preview: other modules show a placeholder. */
function Elsewhere() {
  const location = useLocation()
  return <p className="cr-preview-elsewhere">Aperçu : navigation vers <code>{location.pathname}{location.search}</code> (hors périmètre).</p>
}

function Preview() {
  return (
    <div className="cr-preview">
      <nav className="cr-preview-bar" aria-label="Scénarios d’aperçu">
        <strong>Aperçu Corrélation · données fictives</strong>
        {scenarios.map(s => (
          <a key={s.id} href={`?scenario=${s.id}`} aria-current={s.id === scenario ? 'page' : undefined}>{s.label}</a>
        ))}
      </nav>
      <div className="cr-preview-page">
        <MemoryRouter initialEntries={['/correlation']}>
          <Routes>
            <Route path="/correlation" element={<><CorrelationPage /><Autoplay /></>} />
            <Route path="*" element={<Elsewhere />} />
          </Routes>
        </MemoryRouter>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Preview />)
