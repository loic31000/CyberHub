// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Settings, { formatSettingsDate } from './Settings'
import { settingsApi, settingsDbApi, osintWmnApi, hashApi, cisaApi, threatFeedsApi } from '@/api/client'
import { toast } from '@/store/toast'

vi.mock('@/api/client', () => ({
  settingsApi: { backup: vi.fn(), export: vi.fn(), import: vi.fn(), getNvdKey: vi.fn(), setNvdKey: vi.fn(), deleteNvdKey: vi.fn() },
  settingsDbApi: { getVersions: vi.fn(), updateMitre: vi.fn(), updateCloak: vi.fn() },
  osintWmnApi: { updateDb: vi.fn() },
  hashApi: { vtGetConfig: vi.fn(), vtSaveKey: vi.fn(), vtDeleteKey: vi.fn() },
  cisaApi: { getStats: vi.fn(), updateKEV: vi.fn() },
  threatFeedsApi: { getStatus: vi.fn(), syncFeodo: vi.fn(), syncURLhaus: vi.fn() },
}))
vi.mock('@/store/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

const api = {
  settingsApi: vi.mocked(settingsApi), settingsDbApi: vi.mocked(settingsDbApi), osintWmnApi: vi.mocked(osintWmnApi),
  hashApi: vi.mocked(hashApi), cisaApi: vi.mocked(cisaApi), threatFeedsApi: vi.mocked(threatFeedsApi),
}
const resolved = {
  versions: { mitre: { technique_count: 691, last_updated: '2026-10-20T12:00:00Z', seeded: true }, cloak: { technique_count: 320, last_updated: '2026-10-20T12:00:00Z' }, wmn: { site_count: 600, last_updated: '2026-10-20T12:00:00Z' } },
  stats: { total_entries: 1200, last_updated: '2026-10-20T12:00:00Z' },
  feeds: { feodo: { id: 1, feed_name: 'Feodo', last_sync: '0001-01-01T00:00:00Z', item_count: 0, new_items: 0 }, urlhaus: { id: 2, feed_name: 'URLhaus', last_sync: '2026-10-20T12:00:00Z', item_count: 55, new_items: 4 } },
}

function setup() {
  return render(<Settings />)
}
function setupDefaults() {
  api.settingsDbApi.getVersions.mockResolvedValue(resolved.versions)
  api.cisaApi.getStats.mockResolvedValue(resolved.stats)
  api.threatFeedsApi.getStatus.mockResolvedValue(resolved.feeds)
  api.hashApi.vtGetConfig.mockResolvedValue({ configured: false, masked_key: '' })
  api.settingsApi.getNvdKey.mockResolvedValue({ has_key: false, masked: '' })
  api.settingsApi.backup.mockResolvedValue({ message: 'ok', path: '/data/backup.db.bak' })
  api.settingsApi.export.mockResolvedValue({ exported_at: '2026-10-25', tools: [], ctf_writeups: [], cve_entries: [], playbooks: [] })
  api.settingsApi.import.mockResolvedValue({ tools: { created: 1, skipped: 2 }, ctf: { created: 0, skipped: 0 }, cve: { created: 0, skipped: 1 }, playbooks: { created: 3, skipped: 0 } })
  api.settingsDbApi.updateMitre.mockResolvedValue({ success: true, technique_count: 700, updated_at: '2026-10-25T00:00:00Z' })
  api.settingsDbApi.updateCloak.mockResolvedValue({ success: true, technique_count: 330, updated_at: '2026-10-25T00:00:00Z' })
  api.osintWmnApi.updateDb.mockResolvedValue({ success: true, site_count: 610, updated_at: '2026-10-25T00:00:00Z' })
  api.cisaApi.updateKEV.mockResolvedValue({ success: true, count: 1201, new_items: 1, updated_at: '2026-10-25T00:00:00Z' })
  api.threatFeedsApi.syncFeodo.mockResolvedValue({ new_iocs: 2, skipped_duplicates: 0 })
  api.threatFeedsApi.syncURLhaus.mockResolvedValue({ new_iocs: 3, skipped_duplicates: 0 })
  api.hashApi.vtSaveKey.mockResolvedValue({ success: true })
  api.hashApi.vtDeleteKey.mockResolvedValue({ success: true })
  api.settingsApi.setNvdKey.mockResolvedValue({ success: true })
  api.settingsApi.deleteNvdKey.mockResolvedValue({ success: true })
}
beforeEach(() => { vi.clearAllMocks(); setupDefaults() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Settings 2026', () => {
  it('loads independent sections and shows four control-plane areas', async () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Data & Backup' })).toBeTruthy()
    await screen.findByText('691')
    expect(screen.getByText('CLOAK OpSec')).toBeTruthy()
    expect(screen.getByText('Feodo Tracker')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'API Integrations' })).toBeTruthy()
  })

  it('keeps headings, section navigation, password labels, and focus targets semantic', async () => {
    setup()
    await screen.findByLabelText('Clé API VirusTotal')
    expect(screen.getByRole('navigation', { name: 'Sections des paramètres' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Data & Backup/ }).getAttribute('href')).toBe('#data-safety')
    expect((screen.getByLabelText('Clé API NVD') as HTMLInputElement).type).toBe('password')
    expect(screen.getByRole('heading', { name: 'Knowledge Sources' })).toBeTruthy()
  })

  it('keeps an unavailable source isolated and reports malformed dates safely', async () => {
    api.settingsDbApi.getVersions.mockRejectedValue(new Error('offline'))
    api.cisaApi.getStats.mockResolvedValue(resolved.stats)
    setup()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('1200')).toBeTruthy()
    expect(formatSettingsDate('bad-date')).toBe('Date inconnue')
    expect(formatSettingsDate('')).toBe('Jamais synchronisé')
  })

  it('backs up once and rejects an incomplete response', async () => {
    setup()
    const button = await screen.findByRole('button', { name: 'Créer une sauvegarde' })
    fireEvent.click(button); fireEvent.click(button)
    await waitFor(() => expect(api.settingsApi.backup).toHaveBeenCalledTimes(1))
    expect(toast.success).toHaveBeenCalledWith('Sauvegarde créée : /data/backup.db.bak')
    api.settingsApi.backup.mockResolvedValueOnce({ message: 'ok', path: '' })
    fireEvent.click(button)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('réponse est incomplète')))
  })

  it('exposes backup loading and disables repeated activation', async () => {
    let finish!: (value: { message: string; path: string }) => void
    api.settingsApi.backup.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    setup()
    const button = await screen.findByRole('button', { name: 'Créer une sauvegarde' })
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Création…' }).getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    expect(api.settingsApi.backup).toHaveBeenCalledOnce()
    finish({ message: 'ok', path: '/data/backup.db.bak' })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Sauvegarde SQLite créée'))
  })

  it('shows a generic backup error without exposing server details', async () => {
    setup()
    api.settingsApi.backup.mockRejectedValue(new Error('private server detail'))
    fireEvent.click(await screen.findByRole('button', { name: 'Créer une sauvegarde' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.not.stringContaining('private server detail')))
  })

  it('exports JSON with the expected MIME type and a dated filename, then revokes the URL', async () => {
    setup()
    const create = vi.fn<(blob: Blob) => string>().mockReturnValue('blob:settings-export')
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(await screen.findByRole('button', { name: 'Exporter les données' }))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    const blob = create.mock.calls[0][0]
    expect(blob.type).toBe('application/json;charset=utf-8')
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    expect(content).toContain('ctf_writeups')
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download="cyber-hub-export-2026-10-25.json"]')).toBeNull()
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:settings-export'), { timeout: 2000 })
  })

  it('reports export failures without exposing response details', async () => {
    setup()
    api.settingsApi.export.mockRejectedValueOnce(new Error('private export detail'))
    fireEvent.click(await screen.findByRole('button', { name: 'Exporter les données' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('export JSON a échoué'))
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('private export detail'))
  })

  it('validates import JSON structure before calling the API and normalizes partial stats', async () => {
    setup()
    const input = screen.getByLabelText('Fichier d’export CyberHub au format JSON') as HTMLInputElement
    const valid = new File([JSON.stringify({ tools: [], ctf_writeups: [], cve_entries: [], playbooks: [] })], 'export.json', { type: 'application/json' })
    Object.defineProperty(valid, 'text', { value: () => Promise.resolve(JSON.stringify({ tools: [], ctf_writeups: [], cve_entries: [], playbooks: [] })) })
    fireEvent.change(input, { target: { files: [valid] } })
    expect(await screen.findByRole('status')).toBeTruthy()
    expect(api.settingsApi.import).toHaveBeenCalledOnce()
    expect(screen.getByText('+1')).toBeTruthy()
    api.settingsApi.import.mockResolvedValueOnce({ tools: { created: 4 } } as never)
    fireEvent.change(input, { target: { files: [valid] } })
    await waitFor(() => expect(screen.getByText('+4')).toBeTruthy())
    expect(screen.getAllByText('0 ignorés')).toHaveLength(4)
  })

  it.each(['', 'null', '42', '"text"', '[]', '{"tools":42}', '{"unknown":[]}'])('rejects invalid import payload %s', async raw => {
    setup()
    const input = screen.getByLabelText('Fichier d’export CyberHub au format JSON') as HTMLInputElement
    const file = new File([raw], 'invalid.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(api.settingsApi.import).not.toHaveBeenCalled()
  })

  it('rejects oversized imports before reading or posting them', async () => {
    setup()
    const input = screen.getByLabelText('Fichier d’export CyberHub au format JSON')
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: vi.fn() })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(file.text).not.toHaveBeenCalled()
    expect(api.settingsApi.import).not.toHaveBeenCalled()
  })

  it('handles file read failures without logging or sending an import request', async () => {
    setup()
    const input = screen.getByLabelText('Fichier d’export CyberHub au format JSON')
    const file = new File(['{}'], 'unreadable.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: () => Promise.reject(new Error('private file details')) })
    const log = vi.spyOn(console, 'error')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Fichier invalide'))
    expect(api.settingsApi.import).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it('reports import API failures with a safe message and releases the selected file', async () => {
    setup()
    api.settingsApi.import.mockRejectedValueOnce(new Error('private import detail'))
    const input = screen.getByLabelText('Fichier d’export CyberHub au format JSON') as HTMLInputElement
    const file = new File(['{"tools":[]}'], 'valid.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('{"tools":[]}') })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Fichier invalide ou import impossible'))
    expect(input.value).toBe('')
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('private import detail'))
  })

  it('updates each knowledge source and prevents duplicate concurrent updates', async () => {
    setup()
    await screen.findByText('691')
    let resolve!: (value: { success: boolean; technique_count: number; updated_at: string }) => void
    api.settingsDbApi.updateMitre.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const mitreRow = screen.getByText('MITRE ATT&CK').closest('.st26-register-row') as HTMLElement
    const updateButton = within(mitreRow).getByRole('button', { name: 'Mettre à jour' })
    fireEvent.click(updateButton); fireEvent.click(updateButton)
    expect(api.settingsDbApi.updateMitre).toHaveBeenCalledOnce()
    resolve({ success: true, technique_count: 700, updated_at: '2026-10-25T00:00:00Z' })
    await screen.findByText('700')
    fireEvent.click(within(screen.getByText('CLOAK OpSec').closest('.st26-register-row') as HTMLElement).getByRole('button', { name: 'Mettre à jour' }))
    await waitFor(() => expect(api.settingsDbApi.updateCloak).toHaveBeenCalledOnce())
    fireEvent.click(within(screen.getByText('WhatsMyName').closest('.st26-register-row') as HTMLElement).getByRole('button', { name: 'Mettre à jour' }))
    await waitFor(() => expect(api.osintWmnApi.updateDb).toHaveBeenCalledOnce())
    fireEvent.click(within(screen.getByText('CISA KEV').closest('.st26-register-row') as HTMLElement).getByRole('button', { name: 'Mettre à jour' }))
    await waitFor(() => expect(api.cisaApi.updateKEV).toHaveBeenCalledOnce())
  })

  it('shows an accessible generic error when a knowledge update fails', async () => {
    setup()
    await screen.findByText('691')
    api.settingsDbApi.updateCloak.mockRejectedValueOnce(new Error('private source failure'))
    const row = screen.getByText('CLOAK OpSec').closest('.st26-register-row') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Mettre à jour' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('cloak mis à jour'))
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('private source failure'))
  })

  it('syncs Feodo and URLhaus, showing never synced as a normal state', async () => {
    setup()
    await screen.findByText('Feodo Tracker')
    expect(screen.getByText('Jamais synchronisé')).toBeTruthy()
    const feeds = screen.getAllByRole('button', { name: 'Synchroniser' })
    fireEvent.click(feeds[0]); fireEvent.click(feeds[0])
    await waitFor(() => expect(api.threatFeedsApi.syncFeodo).toHaveBeenCalledOnce())
    fireEvent.click(feeds[1])
    await waitFor(() => expect(api.threatFeedsApi.syncURLhaus).toHaveBeenCalledOnce())
    expect(formatSettingsDate('not-a-timestamp')).toBe('Date inconnue')
  })

  it('saves a trimmed VirusTotal key, clears the input, and renders only the masked value', async () => {
    setup()
    const secret = 'dummy-secret-never-real'
    api.hashApi.vtGetConfig.mockResolvedValue({ configured: true, masked_key: '••••cret' })
    const input = await screen.findByLabelText('Clé API VirusTotal') as HTMLInputElement
    expect(input.type).toBe('password')
    expect(input.autocomplete).toBe('new-password')
    fireEvent.change(input, { target: { value: ` ${secret} ` } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0])
    await screen.findByText('••••cret')
    expect(api.hashApi.vtSaveKey).toHaveBeenCalledWith(secret)
    expect(screen.queryByLabelText('Clé API VirusTotal')).toBeNull()
    expect(document.body.textContent).not.toContain(secret)
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining(secret))
  })

  it('keeps VirusTotal key save errors generic', async () => {
    setup()
    const secret = 'vt-dummy-secret'
    api.hashApi.vtSaveKey.mockRejectedValueOnce(new Error(secret))
    const input = await screen.findByLabelText('Clé API VirusTotal') as HTMLInputElement
    fireEvent.change(input, { target: { value: secret } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0])
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Impossible d’enregistrer la clé VirusTotal'))
    expect(document.body.textContent).not.toContain(secret)
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining(secret))
  })

  it('keeps API key failures generic and confirms key deletion', async () => {
    api.hashApi.vtGetConfig.mockResolvedValue({ configured: true, masked_key: '••••abcd' })
    api.hashApi.vtDeleteKey.mockRejectedValue(new Error('dummy-secret-never-real'))
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer la clé' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Supprimer la clé VirusTotal ?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer la clé' }))
    await waitFor(() => expect(api.hashApi.vtDeleteKey).toHaveBeenCalledOnce())
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(document.body.textContent).not.toContain('dummy-secret-never-real')
  })

  it('saves and deletes NVD credentials through the confirmation dialog', async () => {
    api.settingsApi.getNvdKey.mockResolvedValueOnce({ has_key: false, masked: '' }).mockResolvedValueOnce({ has_key: true, masked: '••••1234' })
    setup()
    const input = await screen.findByLabelText('Clé API NVD') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'nvd-dummy' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[1])
    await waitFor(() => expect(api.settingsApi.setNvdKey).toHaveBeenCalledWith('nvd-dummy'))
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer la clé' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Supprimer la clé NVD ?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer la clé' }))
    await waitFor(() => expect(api.settingsApi.deleteNvdKey).toHaveBeenCalledOnce())
  })

  it('supports the VirusTotal deep link', async () => {
    history.replaceState({}, '', '/settings?section=virustotal')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    setup()
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
    history.replaceState({}, '', '/')
  })
})
