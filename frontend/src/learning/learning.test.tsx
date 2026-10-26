// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mitreApi } from '@/api/client'
import Learn from './Learn'
import LearningModeSwitch from './LearningModeSwitch'
import { LEARNING, LEARNING_VERSION } from './content'
import { readLearningMode, setLearningMode } from './preferences'
import CveRecord from '@/knowledge26/records/CveRecord'
import MitreRecord from '@/knowledge26/records/MitreRecord'
import LolbinRecord from '@/knowledge26/records/LolbinRecord'
import CloakRecord from '@/knowledge26/records/CloakRecord'
import ResultView from '@/corr26/ResultView'
import { correlationResult } from '@/corr26/__fixtures__'
import { fromCLOAK, fromCVE, fromLOLBIN, fromMITRE } from '@/knowledge26/model'
import type { CloakAnnotation } from '@/types/cloakAnnotation'
import type { CVEEntry, MITRETechnique } from '@/types'
import type { LOLBin } from '@/types/lolbins'

vi.mock('@/api/client', () => ({ mitreApi: { techniques: vi.fn() } }))

const KEY = 'cyberhub.learning.v1'
const useMode = (mode: string) => localStorage.setItem(KEY, mode)
const block = (label: string) => screen.getByRole('complementary', { name: `Comprendre : ${label}` })
const queryBlock = (label: string) => screen.queryByRole('complementary', { name: `Comprendre : ${label}` })
const tags = (element: HTMLElement) => Array.from(element.querySelectorAll('.lr-tag')).map(tag => tag.textContent)

beforeEach(() => { localStorage.clear(); vi.mocked(mitreApi.techniques).mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 }) })
afterEach(() => { cleanup(); localStorage.clear() })

describe('Learning — content and preference', () => {
  it('versions a complete entry for every concept of #78 only', () => {
    expect(LEARNING_VERSION).toBe(1)
    expect(Object.keys(LEARNING).sort()).toEqual(['attack-association', 'attack-subtechnique', 'attack-technique', 'cloak', 'correlation', 'cve', 'cvss', 'epss', 'kev', 'lolbin'])
    for (const entry of Object.values(LEARNING)) for (const field of ['label', 'essential', 'what', 'why', 'limit'] as const) expect(entry[field].trim()).not.toBe('')
  })

  it('keeps every essential line short: one sentence, definition and key limit', () => {
    for (const entry of Object.values(LEARNING)) expect(entry.essential.length).toBeLessThanOrEqual(100)
  })

  it('defaults to essential and falls back to essential on an invalid stored value', () => {
    expect(readLearningMode()).toBe('essential')
    useMode('verbose'); expect(readLearningMode()).toBe('essential')
    useMode('guided'); expect(readLearningMode()).toBe('guided')
  })

  it('persists the chosen mode locally and updates every mounted block', () => {
    render(<><LearningModeSwitch /><Learn id="cvss" /><Learn id="kev" /></>)
    expect((screen.getByRole('radio', { name: 'Essentiel' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Off' }))
    expect(localStorage.getItem(KEY)).toBe('off')
    expect(queryBlock('CVSS')).toBeNull(); expect(queryBlock('CISA KEV')).toBeNull()
    expect(screen.getByRole('group', { name: 'Aide à la lecture' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Guidé' }))
    expect(tags(block('CVSS'))).toEqual(['C’EST QUOI ?', 'POURQUOI ?', 'LIMITE', 'ENSUITE'])
    expect(tags(block('CISA KEV'))).toEqual(['C’EST QUOI ?', 'POURQUOI ?', 'LIMITE', 'ENSUITE'])
  })

  it('ignores an invalid mode passed programmatically', () => {
    act(() => setLearningMode('loud' as never))
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

describe('Learning — modes and accessibility', () => {
  it('renders nothing in off mode', () => {
    useMode('off'); render(<Learn id="cvss" evidence={[{ label: 'Score', value: '9.8' }]} />)
    expect(document.querySelector('.lr')).toBeNull()
  })

  it('shows one essential line in essential mode, the full format behind a keyboard disclosure', () => {
    render(<Learn id="epss" evidence={[{ label: 'Probabilité', value: '42 %', source: 'FIRST.org' }]} />)
    const aside = block('EPSS')
    expect(within(aside).getByText(LEARNING.epss.essential)).toBeTruthy()
    expect(tags(aside)).toEqual([])
    const toggle = within(aside).getByRole('button', { name: 'Comprendre' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeTruthy()
    toggle.focus(); expect(document.activeElement).toBe(toggle)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(tags(aside)).toEqual(['C’EST QUOI ?', 'POURQUOI ?', 'PREUVE', 'LIMITE', 'ENSUITE'])
    expect(within(aside).getByText('42 %')).toBeTruthy()
    expect(within(aside).getByText('FIRST.org')).toBeTruthy()
    expect(document.activeElement).toBe(toggle)
  })

  it('folds a guided block back to the essential line', () => {
    useMode('guided'); render(<Learn id="kev" />)
    fireEvent.click(within(block('CISA KEV')).getByRole('button', { name: 'Replier' }))
    expect(tags(block('CISA KEV'))).toEqual([])
    expect(within(block('CISA KEV')).getByText(LEARNING.kev.essential)).toBeTruthy()
  })

  it('shows the five questions open in guided mode', () => {
    useMode('guided'); render(<Learn id="cve" evidence={[{ label: 'Produits', value: '2' }]} />)
    expect(tags(block('CVE'))).toEqual(['C’EST QUOI ?', 'POURQUOI ?', 'PREUVE', 'LIMITE', 'ENSUITE'])
  })

  it('hides PREUVE without evidence and shows a sober fallback for an empty one', () => {
    useMode('guided')
    render(<><Learn id="cvss" /><Learn id="kev" evidence={[]} /></>)
    expect(tags(block('CVSS'))).not.toContain('PREUVE')
    expect(within(block('CISA KEV')).getByText('Aucune donnée disponible pour étayer cette lecture.')).toBeTruthy()
  })

  it('stays understandable without animation: plain text in the DOM, no motion required', () => {
    useMode('guided'); render(<Learn id="kev" />)
    expect(block('CISA KEV').textContent).toContain(LEARNING.kev.limit)
  })
})

describe('Learning — CVE dossier', () => {
  const cve = fromCVE({ id: 1, cve_id: 'CVE-2026-1234', description: 'Synthetic', severity: 'critical', cvss_score: 9.8, status: 'new', products: 'A, B' } as CVEEntry)
  const kevEntry = { id: 1, cve_id: 'CVE-2026-1234', vendor_project: 'V', product: 'P', vulnerability_name: 'N', date_added: '2026-10-01', short_description: '', required_action: 'Patch', due_date: '2026-11-01', notes: '' }

  it('explains CVSS, KEV and EPSS separately with the real values and their source', () => {
    useMode('guided')
    render(<CveRecord item={cve} kev={{ status: 'ready', value: kevEntry }} epss={{ status: 'ready', value: { cve_id: 'CVE-2026-1234', score: .42, percentile: .81, date: '2026-10-25' } }} />)
    expect(within(block('CVSS')).getByText('9.8 / 10')).toBeTruthy()
    expect(within(block('CVSS')).getByText('Fiche CVE CyberHub')).toBeTruthy()
    expect(within(block('CISA KEV')).getByText('Présente')).toBeTruthy()
    expect(Array.from(block('CISA KEV').querySelectorAll('.lr-evidence small')).map(n => n.textContent)).toContain('CISA KEV')
    expect(within(block('EPSS')).getByText('42.0 %')).toBeTruthy()
    expect(within(block('EPSS')).getByText('FIRST.org · 2026-10-25')).toBeTruthy()
    expect(block('CVE')).toBeTruthy()
  })

  it('never presents KEV in the rendered CVE dossier as a confirmed or locally observed exploitation', () => {
    for (const mode of ['essential', 'guided']) {
      useMode(mode)
      const { container, unmount } = render(<CveRecord item={cve} kev={{ status: 'ready', value: kevEntry }} epss={{ status: 'ready', value: null }} />)
      if (mode === 'essential') fireEvent.click(within(block('CISA KEV')).getByRole('button', { name: 'Comprendre' }))
      expect(screen.getByText('Exploitation connue · CISA KEV')).toBeTruthy()
      const text = container.textContent ?? ''
      expect(text).not.toContain('Exploitation confirmée')
      // Any mention of a confirmed / observed exploitation must be a negation or a distinction.
      for (const match of text.matchAll(/exploitation (confirmée|observée)/gi)) {
        expect(text.slice(Math.max(0, match.index! - 16), match.index)).toMatch(/(pas une |ni |distincte de l’)$/)
      }
      unmount()
    }
  })

  it('never presents KEV as an observed exploitation nor EPSS as a confirmed one', () => {
    for (const field of ['what', 'why'] as const) {
      expect(LEARNING.kev[field]).not.toMatch(/observée/i)
      expect(LEARNING.epss[field]).not.toMatch(/confirmée|observée/i)
      expect(LEARNING.cvss[field]).not.toMatch(/exploitée/i)
    }
    expect(LEARNING.kev.limit).toMatch(/pas une exploitation observée par CyberHub/)
    expect(LEARNING.epss.limit).toMatch(/ni exploitation confirmée ni exploitation observée/)
    expect(LEARNING.cvss.limit).toMatch(/ne signifie pas que la vulnérabilité est exploitée/)
  })

  it('falls back cleanly when the data is missing or still loading', () => {
    useMode('guided')
    render(<CveRecord item={fromCVE({ id: 2, cve_id: 'CVE-2026-9', description: '', severity: 'none', cvss_score: 0, status: 'new', products: '' } as CVEEntry)} kev={{ status: 'error' }} epss={{ status: 'loading' }} />)
    for (const label of ['CVSS', 'CISA KEV', 'EPSS']) expect(within(block(label)).getByText('Aucune donnée disponible pour étayer cette lecture.')).toBeTruthy()
  })

  it('keeps the business data visible when Learning is off', () => {
    useMode('off')
    render(<CveRecord item={cve} kev={{ status: 'ready', value: null }} epss={{ status: 'ready', value: null }} />)
    expect(document.querySelector('.lr')).toBeNull()
    expect(screen.getByText('Absente du catalogue local')).toBeTruthy()
    expect(screen.getByText('Aucun score obtenu')).toBeTruthy()
  })
})

describe('Learning — ATT&CK dossier', () => {
  const technique = { technique_id: 'T1059', name: 'Command Interpreter', description: 'x', tactics: '["execution"]', platforms: '["Windows"]', is_subtechnique: false } as MITRETechnique
  const ctx = (allItems = [] as ReturnType<typeof fromLOLBIN>[]) => ({ allItems, annotations: new Map(), onOpen: vi.fn(), onOpenRef: vi.fn() })

  it('explains a technique as a concept, without repeating the sheet', () => {
    useMode('guided')
    render(<MitreRecord item={fromMITRE(technique, [])} ctx={ctx()} />)
    const aside = block('Technique ATT&CK')
    expect(aside.textContent).toContain('La tactique est cet objectif')
    expect(aside.textContent).not.toContain(technique.name)
    expect(queryBlock('Sous-technique ATT&CK')).toBeNull()
  })

  it('uses the sub-technique explanation for a sub-technique', () => {
    useMode('guided')
    render(<MitreRecord item={fromMITRE({ ...technique, technique_id: 'T1059.001', name: 'PowerShell', is_subtechnique: true, parent_id: 'T1059' }, [])} ctx={ctx()} />)
    expect(block('Sous-technique ATT&CK').textContent).toContain('technique parente')
  })

  it('never turns an association into an observed activity', () => {
    useMode('guided')
    const bin = fromLOLBIN({ id: 1, name: 'curl', os: 'linux', description: '', full_path: '/usr/bin/curl', commands: '[]', mitre_tech: '["T1059"]', tags: '[]', category: 'Download', command_count: 0 } as LOLBin)
    render(<MitreRecord item={fromMITRE(technique, [])} ctx={ctx([bin])} />)
    const aside = block('Association ATT&CK')
    expect(within(aside).getByText('1')).toBeTruthy()
    expect(aside.textContent).toContain('ne signifie pas qu’un adversaire a exécuté cette technique')
    for (const entry of [LEARNING['attack-association'], LEARNING['attack-technique'], LEARNING['attack-subtechnique']]) expect(entry.what + entry.why).not.toMatch(/a exécuté|a été observ/i)
  })

  it('shows no association explanation when nothing is associated', () => {
    useMode('guided')
    render(<MitreRecord item={fromMITRE(technique, [])} ctx={ctx()} />)
    expect(queryBlock('Association ATT&CK')).toBeNull()
  })
})

describe('Learning — correlation', () => {
  const view = (overrides = {}) => render(<MemoryRouter><ResultView result={correlationResult(overrides)} actions={null} /></MemoryRouter>)

  it('uses the real rationale, confidence, signals and next actions in guided mode — once', () => {
    useMode('guided'); view()
    const aside = block('Corrélation')
    expect(within(aside).getByText(correlationResult().rationale)).toBeTruthy()
    expect(within(aside).getByText('72 % · Confiance forte')).toBeTruthy()
    expect(within(aside).getByText('Techniques MITRE')).toBeTruthy()
    for (const action of correlationResult().next_actions) expect(within(aside).getByText(action)).toBeTruthy()
    expect(document.querySelector('.cr26-rationale')).toBeNull()
    expect(document.querySelector('.cr26-next')).toBeNull()
    expect(aside.textContent).toContain('n’est pas une preuve de compromission')
  })

  it('keeps the existing rationale and next steps in essential mode with a compact help', () => {
    view()
    expect(document.querySelector('.cr26-rationale')?.textContent).toBe(correlationResult().rationale)
    expect(screen.getByRole('heading', { name: 'Prochaines étapes' })).toBeTruthy()
    expect(tags(block('Corrélation'))).toEqual([])
    expect(within(block('Corrélation')).getByText(LEARNING.correlation.essential)).toBeTruthy()
  })

  it('invents no justification when the engine gave none', () => {
    useMode('guided')
    view({ rationale: '', next_actions: [], techniques: [], cves: [], playbooks: [], investigations: [], attack_layers: [], cloak_tactics: [], tools: [], confidence: undefined as never })
    const aside = block('Corrélation')
    expect(tags(aside)).toEqual(['C’EST QUOI ?', 'POURQUOI ?', 'PREUVE', 'LIMITE'])
    expect(within(aside).getByText('Aucune donnée disponible pour étayer cette lecture.')).toBeTruthy()
    expect(aside.textContent).not.toContain('Lecture du moteur')
  })
})

describe('Learning — LOLBins dossier', () => {
  const bin = (overrides: Partial<LOLBin> = {}) => fromLOLBIN({ id: 7, name: 'certutil.exe', os: 'windows', description: 'Certificate utility.', full_path: 'C:\\Windows\\System32\\certutil.exe', commands: JSON.stringify([{ Command: 'certutil.exe -?', Description: 'Help', Usecase: 'Documentation', Privileges: 'User' }]), mitre_tech: '["T1105"]', tags: '["download"]', category: 'Download', command_count: 1, ...overrides } as LOLBin)
  const ctx = { allItems: [], annotations: new Map(), onOpen: vi.fn(), onOpenRef: vi.fn() }

  it('renders nothing in off mode and a single compact line in essential mode', () => {
    useMode('off')
    const { unmount } = render(<LolbinRecord item={bin()} ctx={ctx} />)
    expect(queryBlock('LOLBin / GTFOBin')).toBeNull(); unmount()
    useMode('essential'); render(<LolbinRecord item={bin()} ctx={ctx} />)
    expect(tags(block('LOLBin / GTFOBin'))).toEqual([])
    expect(within(block('LOLBin / GTFOBin')).getByText(LEARNING.lolbin.essential)).toBeTruthy()
  })

  it('shows the five questions with evidence taken from the record in guided mode', () => {
    useMode('guided'); render(<LolbinRecord item={bin()} ctx={ctx} />)
    const aside = block('LOLBin / GTFOBin')
    expect(tags(aside)).toEqual(['C’EST QUOI ?', 'POURQUOI ?', 'PREUVE', 'LIMITE', 'ENSUITE'])
    const evidence = Array.from(aside.querySelectorAll('.lr-evidence li')).map(li => li.textContent)
    expect(evidence).toEqual(['OSWindowsLOLBAS', 'CatégorieDownload', 'CheminC:\\Windows\\System32\\certutil.exe', 'Techniques ATT&CK liéesT1105', 'Tagsdownload', 'Commandes documentées1'])
  })

  it('names GTFOBins as the reference of a Linux binary', () => {
    useMode('guided'); render(<LolbinRecord item={bin({ os: 'linux', name: 'curl', full_path: '/usr/bin/curl' })} ctx={ctx} />)
    expect(Array.from(block('LOLBin / GTFOBin').querySelectorAll('.lr-evidence small')).map(n => n.textContent)).toEqual(['GTFOBins'])
  })

  it('invents no evidence when the record lacks data', () => {
    useMode('guided'); render(<LolbinRecord item={bin({ full_path: '', mitre_tech: '[]', tags: '[]', commands: '[]', command_count: 0, category: '' })} ctx={ctx} />)
    const labels = Array.from(block('LOLBin / GTFOBin').querySelectorAll('.lr-evidence li > span')).map(n => n.textContent)
    expect(labels).toEqual(['OS'])
  })

  it('never presents the presence of the binary as malicious', () => {
    for (const field of ['what', 'why'] as const) expect(LEARNING.lolbin[field]).not.toMatch(/malveillant|compromission|attaque en cours/i)
    expect(LEARNING.lolbin.limit).toMatch(/ne signifie pas un usage malveillant/)
    expect(LEARNING.lolbin.limit).toMatch(/n’est pas une preuve de compromission/)
    expect(LEARNING.lolbin.essential).toMatch(/ne prouve aucun usage malveillant/)
  })
})

describe('Learning — CLOAK dossier', () => {
  const data = { tactics: [{ id: 3, name: 'Anonymous browsing', description: '', type: '', techniques: [
    { id: 9, name: 'Anonymous internet connection', description: 'The adversary is leveraging public Wi-Fi.', type: 'Technical\n', procedures: [{ id: 'TTP-1', name: 'Tails', description: 'Live OS. https://tails.net/', type: '' }], subtechniques: [{ id: 21, name: 'Garlic routing', description: 'Variant of onion routing.', type: 'Technical', procedures: [] }] },
  ] }] }
  const items = fromCLOAK(data as never)
  const technique = items.find(item => item.id === 'TE-9')!, sub = items.find(item => item.id === 'ST-21')!
  const ctx = (annotations = new Map<string, CloakAnnotation>()) => ({ allItems: items, annotations, onOpen: vi.fn(), onOpenRef: vi.fn() })
  const evidence = () => Array.from(block('CLOAK').querySelectorAll('.lr-evidence li')).map(li => li.textContent)

  it('respects the three modes', () => {
    useMode('off')
    const first = render(<CloakRecord item={technique} ctx={ctx()} analyst={null} />)
    expect(queryBlock('CLOAK')).toBeNull(); first.unmount()
    useMode('essential')
    const second = render(<CloakRecord item={technique} ctx={ctx()} analyst={null} />)
    expect(within(block('CLOAK')).getByText(LEARNING.cloak.essential)).toBeTruthy(); second.unmount()
    useMode('guided'); render(<CloakRecord item={technique} ctx={ctx()} analyst={null} />)
    expect(tags(block('CLOAK'))).toEqual(['C’EST QUOI ?', 'POURQUOI ?', 'PREUVE', 'LIMITE', 'ENSUITE'])
  })

  it('uses the real dataset fields of a technique as evidence', () => {
    useMode('guided'); render(<CloakRecord item={technique} ctx={ctx()} analyst={null} />)
    expect(evidence()).toEqual(['RéférenceTE-9CLOAK', 'TactiqueAnonymous browsing', 'TypeTechnical', 'NiveauTechnique', 'Sous-techniques1', 'Procédures1', 'Liens externes1'])
  })

  it('shows the parent of a sub-technique and the local annotation when they exist', () => {
    useMode('guided')
    const annotations = new Map([['tac-3:te-9:sub-21', { id: 1, technique_ref: 'tac-3:te-9:sub-21', status: 'vu_en_lab', user_notes: '', counter_notes: 'Block', tags: '', created_at: '', updated_at: '' } as CloakAnnotation]])
    render(<CloakRecord item={sub} ctx={ctx(annotations)} analyst={null} />)
    expect(evidence()).toEqual(['RéférenceST-21CLOAK', 'TactiqueAnonymous browsing', 'TypeTechnical', 'NiveauSous-technique de TE-9', 'AnnotationVu en labAnnotation locale CyberHub'])
  })

  it('never turns a CLOAK entry into a local observation', () => {
    for (const field of ['essential', 'what', 'why'] as const) expect(LEARNING.cloak[field]).not.toMatch(/a été observée|observée dans votre|détectée/i)
    expect(LEARNING.cloak.limit).toMatch(/ne prouve pas que cette technique a été observée dans votre environnement/)
  })
})

describe('Atlas dossier sections — explicit titles (#78)', () => {
  const sectionTitles = () => Array.from(document.querySelectorAll('.ka-sec-head h3')).map(h => h.textContent)
  const leads = () => Array.from(document.querySelectorAll('.ka-sec-lead')).map(p => p.textContent)
  const ctx = { allItems: [], annotations: new Map(), onOpen: vi.fn(), onOpenRef: vi.fn() }

  it('names the CVE sections after their real content', () => {
    useMode('off')
    render(<CveRecord item={fromCVE({ id: 1, cve_id: 'CVE-2026-1', description: '', severity: 'high', cvss_score: 7, status: 'new', products: 'A' } as CVEEntry)} />)
    expect(sectionTitles()).toEqual(['OVERVIEW', 'INTELLIGENCE', 'AFFECTED SCOPE', 'ANALYST NOTES'])
    expect(leads()).toEqual(['Trois signaux distincts : gravité (CVSS), exploitation connue (KEV), probabilité (EPSS).'])
  })

  it('names the ATT&CK sections after their real content', () => {
    useMode('off')
    render(<MitreRecord item={fromMITRE({ technique_id: 'T1059', name: 'X', description: '', tactics: '[]', platforms: '[]', is_subtechnique: false } as MITRETechnique, [])} ctx={ctx} />)
    expect(sectionTitles()).toEqual(['OVERVIEW', 'DETECTION', 'RELATIONS'])
    expect(leads()).toEqual(['Comment repérer cette technique et quelles données collecter.', 'Sous-techniques et binaires du catalogue liés à cette technique.'])
  })

  it('names the LOLBins sections after their real content', () => {
    useMode('off')
    render(<LolbinRecord item={fromLOLBIN({ id: 1, name: 'awk', os: 'linux', description: '', full_path: '', commands: '[]', mitre_tech: '[]', tags: '[]', category: 'Shell', command_count: 0 } as LOLBin)} ctx={ctx} />)
    expect(sectionTitles()).toEqual(['OVERVIEW', 'MAPPING', 'COMMANDS'])
  })

  it('titles the CLOAK content section from what it really holds', () => {
    useMode('off')
    const both = fromCLOAK({ tactics: [{ id: 1, name: 'T', description: '', type: '', techniques: [{ id: 2, name: 'N', description: 'd', type: '', procedures: [{ id: 'TTP-1', name: 'P', description: 'x', type: '' }], subtechniques: [{ id: 3, name: 'S', description: 'd', type: '', procedures: [] }] }] }] } as never)
    const view = render(<CloakRecord item={both[0]} ctx={{ ...ctx, allItems: both }} analyst={null} />)
    expect(sectionTitles()).toEqual(['OVERVIEW', 'SUB-TECHNIQUES · PROCEDURES', 'ANNOTATION']); view.unmount()
    render(<CloakRecord item={both[1]} ctx={{ ...ctx, allItems: both }} analyst={null} />)
    expect(sectionTitles()).toEqual(['OVERVIEW', 'ANNOTATION'])
    expect(sectionTitles()).not.toContain('CONTENT')
    expect(sectionTitles()).not.toContain('ANALYST DATA')
  })
})
