// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import NotesPage from './NotesPage'
import { notesApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { Note, NotesResponse } from '@/types/note'

vi.mock('@/api/client', () => ({ notesApi: {
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), search: vi.fn(),
} }))

const list = vi.mocked(notesApi.list)
const create = vi.mocked(notesApi.create)
const update = vi.mocked(notesApi.update)
const remove = vi.mocked(notesApi.delete)
const search = vi.mocked(notesApi.search)
const createdToast = vi.spyOn(toast, 'success')
const errorToast = vi.spyOn(toast, 'error')
const createUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const revokeUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')

const note = (id: number, title: string, fields: Partial<Note> = {}): Note => ({
  id, title, content: `Body for ${title}`, created_at: '2026-01-01T12:00:00.000Z',
  updated_at: '2026-01-02T12:00:00.000Z', tags: '[]', linked_iocs: '[]',
  linked_techniques: '[]', linked_cves: '[]', created_by: 'test', ...fields,
})
const response = (...notes: Note[]): NotesResponse => ({ notes, total: notes.length })
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="route">{location.pathname}{location.search}</output>
}

const renderPage = () => render(
  <MemoryRouter initialEntries={['/notes']}>
    <Routes><Route path="*" element={<><NotesPage /><LocationProbe /></>} /></Routes>
  </MemoryRouter>,
)

function file(name: string, content: string | Promise<string>): File {
  const value = new File([], name)
  Object.defineProperty(value, 'text', { configurable: true, value: () => Promise.resolve(content) })
  return value
}

const blobText = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result ?? ''))
  reader.onerror = () => reject(reader.error)
  reader.readAsText(blob)
})

const upload = (files: File[]) => fireEvent.change(screen.getByLabelText('Importer'), { target: { files } })
const restoreUrlApi = () => {
  if (createUrlDescriptor) Object.defineProperty(URL, 'createObjectURL', createUrlDescriptor)
  else Reflect.deleteProperty(URL, 'createObjectURL')
  if (revokeUrlDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeUrlDescriptor)
  else Reflect.deleteProperty(URL, 'revokeObjectURL')
}

afterEach(() => {
  cleanup()
  restoreUrlApi()
  vi.useRealTimers()
  vi.clearAllMocks()
})

beforeEach(() => {
  list.mockReset()
  create.mockReset()
  update.mockReset()
  remove.mockReset()
  search.mockReset()
  list.mockResolvedValue(response())
  create.mockImplementation(async req => note(50, req.title, {
    content: req.content ?? '', tags: req.tags ?? '[]', linked_iocs: req.linked_iocs ?? '[]',
    linked_techniques: req.linked_techniques ?? '[]', linked_cves: req.linked_cves ?? '[]',
  }))
  update.mockImplementation(async (id, req) => note(id, req.title, {
    content: req.content ?? '', tags: req.tags ?? '[]', linked_iocs: req.linked_iocs ?? '[]',
    linked_techniques: req.linked_techniques ?? '[]', linked_cves: req.linked_cves ?? '[]',
  }))
  remove.mockResolvedValue({} as never)
  search.mockResolvedValue(response())
})

describe('NotesPage search and register state', () => {
  it('keeps the latest search result when an earlier request resolves later', async () => {
    const a = deferred<NotesResponse>()
    const b = deferred<NotesResponse>()
    search.mockImplementation(q => q === 'A' ? a.promise : b.promise)
    renderPage()
    await screen.findByText(/Aucune note/)
    const input = screen.getByRole('searchbox', { name: 'Rechercher une note' })
    fireEvent.change(input, { target: { value: 'A' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'B' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(search).toHaveBeenNthCalledWith(1, 'A')
    expect(search).toHaveBeenNthCalledWith(2, 'B')
    b.resolve(response(note(2, 'Result B')))
    expect(await screen.findByText('Result B')).toBeTruthy()
    a.resolve(response(note(1, 'Stale result A')))
    await waitFor(() => expect(screen.queryByText('Stale result A')).toBeNull())
    expect(screen.getByText('Result B')).toBeTruthy()
  })

  it('lets clear supersede a pending search and restores the full register', async () => {
    const slow = deferred<NotesResponse>()
    search.mockReturnValue(slow.promise)
    list.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(note(1, 'Full register')))
    renderPage()
    await screen.findByText(/Aucune note/)
    const input = screen.getByRole('searchbox', { name: 'Rechercher une note' })
    fireEvent.change(input, { target: { value: 'slow query' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }))
    expect(await screen.findByText('Full register')).toBeTruthy()
    slow.resolve(response(note(2, 'Stale search result')))
    await waitFor(() => expect(screen.queryByText('Stale search result')).toBeNull())
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('supports an empty search, retry after list errors, selection, and stale-object reconciliation', async () => {
    const older = note(1, 'Selected note')
    list.mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response(older))
      .mockResolvedValueOnce(response(note(1, 'Selected note', { content: 'Fresh body' })))
    renderPage()
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /essayer/ }))
    const opener = (await screen.findAllByRole('button', { name: /Selected note/ }))[0]
    fireEvent.click(opener)
    expect((await screen.findAllByText('Body for Selected note')).length).toBeGreaterThan(0)
    const input = screen.getByRole('searchbox', { name: 'Rechercher une note' })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getAllByText('Fresh body').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Fresh body').length).toBeGreaterThan(0)
  })

  it('clears a selected note when a search result no longer contains it', async () => {
    list.mockResolvedValue(response(note(1, 'Selected')))
    search.mockResolvedValue(response(note(2, 'Other result')))
    renderPage()
    fireEvent.click((await screen.findAllByRole('button', { name: /^Selected/ }))[0])
    const input = screen.getByRole('searchbox', { name: 'Rechercher une note' })
    fireEvent.change(input, { target: { value: 'other' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Aucune note sélectionnée')).toBeTruthy()
  })
})

describe('NotesPage editor and deletion', () => {
  const startNewNote = async () => {
    await screen.findByText(/Aucune note/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Nouvelle note' })[0])
  }

  it('requires a title, focuses the field, and keeps a failed create editable before success', async () => {
    renderPage()
    await startNewNote()
    const title = screen.getByLabelText('Titre de la note') as HTMLInputElement
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    expect(screen.getByRole('alert').textContent).toBe('Le titre est requis')
    expect(title.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(title)

    fireEvent.change(title, { target: { value: '  Incident ÃƒÂ©clair Ã°Å¸â€â€™  ' } })
    fireEvent.change(screen.getByLabelText('Corps de la note'), { target: { value: 'premiÃƒÂ¨re ligne\nseconde ligne' } })
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: ' triage, triage, phishing ' } })
    fireEvent.change(screen.getByLabelText('IOC'), { target: { value: '12, 13' } })
    fireEvent.change(screen.getByLabelText('MITRE ATT&CK'), { target: { value: 'T1059, T1105' } })
    fireEvent.change(screen.getByLabelText('CVE'), { target: { value: 'CVE-2026-12345' } })
    create.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    expect(await screen.findByText(/enregistrer la note/)).toBeTruthy()
    expect((screen.getByLabelText('Titre de la note') as HTMLInputElement).value).toBe('  Incident ÃƒÂ©clair Ã°Å¸â€â€™  ')
    expect((screen.getByLabelText('Corps de la note') as HTMLTextAreaElement).value).toBe('premiÃƒÂ¨re ligne\nseconde ligne')
    expect(screen.getByRole('button', { name: 'Sauvegarder' })).toBeTruthy()
    expect(createdToast).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    expect((await screen.findAllByText('Incident ÃƒÂ©clair Ã°Å¸â€â€™')).length).toBeGreaterThan(0)
    expect(create).toHaveBeenLastCalledWith({
      title: 'Incident ÃƒÂ©clair Ã°Å¸â€â€™', content: 'premiÃƒÂ¨re ligne\nseconde ligne',
      tags: '["triage","triage","phishing"]', linked_iocs: '["12","13"]',
      linked_techniques: '["T1059","T1105"]', linked_cves: '["CVE-2026-12345"]',
    })
    expect(createdToast).toHaveBeenCalledTimes(1)
  })

  it('preserves every edit field after an API failure and returns to view only on success', async () => {
    const initial = note(7, 'Existing', {
      content: 'Original content', tags: 'legacy, csv', linked_iocs: '["12", 13]',
      linked_techniques: '["T1059"]', linked_cves: '["CVE-2024-1234"]',
    })
    list.mockResolvedValue(response(initial))
    renderPage()
    fireEvent.click((await screen.findAllByRole('button', { name: /Existing/ }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    expect((screen.getByLabelText('Tags') as HTMLInputElement).value).toBe('legacy, csv')
    expect((screen.getByLabelText('IOC') as HTMLInputElement).value).toBe('12, 13')
    expect((screen.getByLabelText('MITRE ATT&CK') as HTMLInputElement).value).toBe('T1059')
    expect((screen.getByLabelText('CVE') as HTMLInputElement).value).toBe('CVE-2024-1234')
    fireEvent.change(screen.getByLabelText('Titre de la note'), { target: { value: 'Updated' } })
    fireEvent.change(screen.getByLabelText('Corps de la note'), { target: { value: 'Updated body' } })

    update.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    expect(await screen.findByText(/enregistrer la note/)).toBeTruthy()
    expect(screen.getByLabelText('Titre de la note')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sauvegarder' })).toBeTruthy()
    expect(createdToast).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    expect(await screen.findByText('Updated body')).toBeTruthy()
    expect(update).toHaveBeenLastCalledWith(7, expect.objectContaining({
      title: 'Updated', content: 'Updated body', tags: '["legacy","csv"]',
      linked_iocs: '["12","13"]', linked_techniques: '["T1059"]', linked_cves: '["CVE-2024-1234"]',
    }))
  })

  it('does not carry an edited note into a new form', async () => {
    list.mockResolvedValue(response(note(1, 'Old note')))
    renderPage()
    fireEvent.click((await screen.findAllByRole('button', { name: /Old note/ }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    fireEvent.change(screen.getByLabelText('Titre de la note'), { target: { value: 'Draft change' } })
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Nouvelle note' })[0])
    expect((screen.getByLabelText('Titre de la note') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Corps de la note') as HTMLTextAreaElement).value).toBe('')
  })

  it('uses ConfirmModal for cancel, Escape, focus restoration, confirm and selected-note cleanup', async () => {
    list.mockResolvedValue(response(note(1, 'Alpha'), note(2, 'Beta')))
    renderPage()
    const openAlpha = await screen.findByRole('button', { name: /^Alpha/ })
    fireEvent.click(openAlpha)
    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer la note Alpha' })
    deleteButtons[0].focus()
    fireEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('SUPPRIMER CETTE NOTE ?')).toBeTruthy()
    expect(within(dialog).getByText(/Cette action est/)).toBeTruthy()
    const cancel = within(dialog).getByRole('button', { name: 'Annuler' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(document.activeElement).toBe(deleteButtons[0])

    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer la note Alpha' })[0])
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer la note Alpha' })[0])
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith(1))
    expect(await screen.findByText(/Aucune note/)).toBeTruthy()
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.queryByText('Alpha')).toBeNull()
  })

  it('keeps a note on delete failure and reports the API error', async () => {
    list.mockResolvedValue(response(note(1, 'Keep me')))
    remove.mockRejectedValueOnce(new Error('offline'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^Keep me/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la note Keep me' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(errorToast).toHaveBeenCalledTimes(1))
    expect(screen.getAllByText('Keep me')).toHaveLength(2)
    expect(remove).toHaveBeenCalledWith(1)
  })
})

describe('NotesPage import and parsing', () => {
  it('normalizes JSON imports, ignores malformed entries and preserves supported fields', async () => {
    renderPage()
    await screen.findByText(/Aucune note/)
    upload([file('note.json', JSON.stringify({
      title: '  Import ÃƒÂ©clair  ', content: 17, tags: ['red', 3, null, { x: 1 }, '  blue '],
      linked_iocs: 'legacy, csv', linked_techniques: ['T1059', null, 'T1105'], linked_cves: false,
    }))])
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith({
      title: 'Import ÃƒÂ©clair', content: '', tags: '["red","3","blue"]',
      linked_iocs: 'legacy, csv', linked_techniques: '["T1059","T1105"]', linked_cves: '',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findAllByText('Import ÃƒÂ©clair')).toHaveLength(2)
  })

  it('accepts JSON arrays and {notes:[]} while skipping entries without a usable title', async () => {
    renderPage()
    await screen.findByText(/Aucune note/)
    upload([file('batch.json', JSON.stringify({ notes: [
      { title: 'First JSON', content: 'one' }, { title: '', content: 'skip' },
      null, { title: 9, content: 'skip' }, { title: 'Second JSON', tags: 'a, b' },
    ] }))])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('First JSON')).toBeTruthy()
    expect(within(dialog).getByText('Second JSON')).toBeTruthy()
    expect(within(dialog).queryByText('skip')).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON, empty JSON and wrong roots without calling create', async () => {
    renderPage()
    await screen.findByText(/Aucune note/)
    upload([file('bad.json', '{broken')])
    await waitFor(() => expect(errorToast).toHaveBeenCalledTimes(1))
    upload([file('empty.json', '')])
    await waitFor(() => expect(errorToast).toHaveBeenCalledTimes(2))
    upload([file('root.json', '42')])
    await waitFor(() => expect(errorToast).toHaveBeenCalledTimes(3))
    expect(create).not.toHaveBeenCalled()
  })

  it('imports Markdown, TXT and HTML as text and never executes imported scripts', async () => {
    renderPage()
    await screen.findByText(/Aucune note/)
    upload([file('incident.md', '# Ãƒâ€°vÃƒÂ©nement\nLigne 1\nLigne 2')])
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenLastCalledWith({ title: 'Ãƒâ€°vÃƒÂ©nement', content: 'Ligne 1\nLigne 2' })

    upload([file('journal_local.txt', 'texte brut\navec plusieurs lignes')])
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))
    expect(create).toHaveBeenLastCalledWith({ title: 'journal local', content: 'texte brut\navec plusieurs lignes' })

    const marker = '__notesImportedScriptRan'
    delete (window as unknown as Record<string, unknown>)[marker]
    upload([file('rapport.html', '<h1>Rapport &amp; preuve</h1><script>window.__notesImportedScriptRan = true</script><style>.x{color:red}</style><p><b>Texte</b> &lt;ok&gt;</p>')])
    await waitFor(() => expect(create).toHaveBeenCalledTimes(3))
    const htmlRequest = create.mock.calls[2][0]
    expect(htmlRequest.title).toBe('rapport')
    expect(htmlRequest.content).toContain('Rapport & preuve')
    expect(htmlRequest.content).toContain('window.__notesImportedScriptRan = true')
    expect(htmlRequest.content).toContain('Texte <ok>')
    expect((window as unknown as Record<string, unknown>)[marker]).toBeUndefined()
    expect(document.querySelector('script')).toBeNull()
  })

  it('keeps file order and each JSON batch order despite reversed asynchronous reads and partial creates', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const third = deferred<string>()
    renderPage()
    await screen.findByText(/Aucune note/)
    upload([
      file('first.json', first.promise),
      file('second.md', second.promise),
      file('third.txt', third.promise),
    ])
    third.resolve('third body')
    second.resolve('# Second\nsecond body')
    first.resolve(JSON.stringify([{ title: 'First A' }, { title: 'First B' }]))
    const dialog = await screen.findByRole('dialog')
    const previewTitles = within(dialog).getAllByRole('listitem').map(item => item.textContent?.replace(/^\d+/, ''))
    expect(previewTitles).toEqual(['First A', 'First B', 'Second', 'third'])

    create.mockImplementation(async req => {
      if (req.title === 'First A') throw new Error('one rejected create')
      return note(50 + create.mock.calls.length, req.title, { content: req.content ?? '' })
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Importer 4 note(s)' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(4))
    expect(create.mock.calls.map(([req]) => req.title)).toEqual(['First A', 'First B', 'Second', 'third'])
    expect((await screen.findAllByText('First B')).length).toBeGreaterThan(0)
    expect(errorToast).toHaveBeenCalledTimes(1)
  })

  it('shows native empty-file handling for TXT and derives Markdown title when no heading exists', async () => {
    renderPage()
    await screen.findByText(/Aucune note/)
    upload([file('empty_note.txt', '')])
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenLastCalledWith({ title: 'empty note', content: '' })
    upload([file('sans-titre.md', 'Texte sans heading\nligne 2')])
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))
    expect(create).toHaveBeenLastCalledWith({ title: 'sans titre', content: 'Texte sans heading\nligne 2' })
  })
})

describe('NotesPage tags, references and export disclosure', () => {
  it('parses JSON arrays and historical CSV safely while preserving string duplicates', async () => {
    const mixed = note(1, 'Mixed values', {
      tags: '[" alpha ", 7, null, {"tag":"ignored"}, "alpha", "  "]',
      linked_iocs: '["12", 13, null, {}, "", "12"]',
      linked_techniques: 'T1059, T1105, T1059',
      linked_cves: 'not-json, CVE-2025-1234',
    })
    const csv = note(2, 'CSV note', { tags: 'red, blue', linked_iocs: '21, 22' })
    list.mockResolvedValue(response(mixed, csv))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^Mixed values/ }))
    const tagList = screen.getByRole('list', { name: 'Tags' })
    expect(tagList.textContent).toContain('alpha')
    expect(tagList.textContent).toContain('7')
    expect(tagList.querySelectorAll('li')).toHaveLength(3)
    expect((tagList.textContent?.match(/alpha/g) ?? [])).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'IOC #12' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'T1059' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /^CSV note/ }))
    expect(screen.getByRole('list', { name: 'Tags' }).textContent).toContain('red')
    expect(screen.getByRole('list', { name: 'Tags' }).textContent).toContain('blue')
  })

  it('encodes linked-reference navigation and rejects invalid IDs without crashing', async () => {
    list.mockResolvedValue(response(note(4, 'References', {
      linked_iocs: '["42", "abc"]', linked_techniques: '["T1059.001", "bad"]', linked_cves: '["CVE-2025-12345", "nope"]',
    })))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^References/ }))
    fireEvent.click(screen.getByRole('button', { name: 'IOC #42' }))
    expect(screen.getByTestId('route').textContent).toBe('/ioc?selected=42')
    fireEvent.click(screen.getByRole('button', { name: 'T1059.001' }))
    expect(screen.getByTestId('route').textContent).toBe('/knowledge?source=mitre&id=T1059.001')
    fireEvent.click(screen.getByRole('button', { name: 'CVE-2025-12345' }))
    expect(screen.getByTestId('route').textContent).toBe('/knowledge?source=cve&id=CVE-2025-12345')
    fireEvent.click(screen.getByRole('button', { name: 'IOC #abc' }))
    fireEvent.click(screen.getByRole('button', { name: 'bad' }))
    fireEvent.click(screen.getByRole('button', { name: 'nope' }))
    expect(screen.getByTestId('route').textContent).toBe('/knowledge?source=cve&id=CVE-2025-12345')
    expect(errorToast).toHaveBeenCalledTimes(3)
  })

  it('uses an accessible Export disclosure and restores focus on Escape and after an action', async () => {
    list.mockResolvedValue(response(note(1, 'Exportable')))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^Exportable/ }))
    const trigger = screen.getByRole('button', { name: 'Exporter' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe('nt26-export-options')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(within(screen.getByRole('group', { name: 'Note actuelle' })).getByRole('button', { name: 'JSON' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(trigger)
    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
    fireEvent.click(trigger)
    fireEvent.click(within(screen.getByRole('group', { name: 'Note actuelle' })).getByRole('button', { name: 'JSON' }))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })
})

describe('NotesPage downloads', () => {
  function mockDownloads() {
    const blobs: Blob[] = []
    const createUrl = vi.fn((blob: Blob) => { blobs.push(blob); return `blob:notes-${blobs.length}` })
    const revokeUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl })
    const anchors: Array<{ href: string; filename: string; type: string; connected: boolean }> = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      anchors.push({ href: this.href, filename: this.download, type: blobs[blobs.length - 1]?.type ?? '', connected: this.isConnected })
    })
    return { blobs, createUrl, revokeUrl, anchors }
  }

  const chooseExport = async (group: string, format: string) => {
    const trigger = screen.getByRole('button', { name: 'Exporter' })
    fireEvent.click(trigger)
    fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name: format }))
  }

  it('exports current and all notes as JSON, TXT and Markdown without losing metadata or Unicode', async () => {
    const entry = note(1, '\u00c9vidence op\u00e9rationnelle \ud83d\udd12', {
      content: 'Premi\u00e8re ligne\nSeconde ligne', tags: '["triage", "phishing"]',
      linked_iocs: '["12"]', linked_techniques: '["T1059"]', linked_cves: '["CVE-2026-12345"]',
    })
    list.mockResolvedValue(response(entry))
    const { blobs, revokeUrl, anchors } = mockDownloads()
    renderPage()
    fireEvent.click((await screen.findAllByRole('button', { name: /vidence op/ }))[0])
    await chooseExport('Note actuelle', 'JSON')
    expect(JSON.parse(await blobText(blobs[blobs.length - 1]))).toMatchObject({ title: entry.title, content: entry.content, tags: entry.tags })
    await chooseExport('Note actuelle', 'TXT')
    const singleTxt = await blobText(blobs[blobs.length - 1])
    expect(singleTxt).toContain(entry.title.toUpperCase())
    expect(singleTxt).toContain(entry.content)
    expect(singleTxt).toContain('T1059')
    await chooseExport('Note actuelle', 'Markdown')
    const singleMarkdown = await blobText(blobs[blobs.length - 1])
    expect(singleMarkdown).toContain(`# ${entry.title}`)
    expect(singleMarkdown).toContain('**Tags:** triage, phishing')
    expect(singleMarkdown).toContain('**IOCs:** 12')
    await chooseExport('Toutes les notes', 'JSON')
    expect(JSON.parse(await blobText(blobs[blobs.length - 1])).notes[0]).toMatchObject({ title: entry.title, content: entry.content })
    await chooseExport('Toutes les notes', 'TXT')
    expect(await blobText(blobs[blobs.length - 1])).toContain(entry.content)
    await chooseExport('Toutes les notes', 'Markdown')
    expect(await blobText(blobs[blobs.length - 1])).toContain('**CVE:** CVE-2026-12345')

    expect(anchors).toHaveLength(6)
    expect(anchors[0]).toMatchObject({ type: 'application/json', connected: true })
    expect(anchors[0].filename.endsWith('.json')).toBe(true)
    expect(anchors.every(anchor => anchor.href.startsWith('blob:notes-'))).toBe(true)
    expect(revokeUrl).not.toHaveBeenCalled()
    await new Promise(resolve => window.setTimeout(resolve, 1100))
    expect(revokeUrl.mock.calls.length).toBeGreaterThanOrEqual(6)
  })

  it('escapes hostile text in single and bulk HTML exports and delays Blob URL revocation', async () => {
    const hostile = note(9, `Titre "&' <script>alert(1)</script>`, {
      content: `<script>alert("x")</script><img src=x onerror="alert(2)">& < > " '`,
      tags: JSON.stringify(['<img onerror="tag">', "' & "]),
      linked_iocs: JSON.stringify(['<script>ioc</script>']),
      linked_techniques: JSON.stringify(['T1059']), linked_cves: JSON.stringify(['CVE-2026-1234']),
    })
    list.mockResolvedValue(response(hostile))
    const { blobs, revokeUrl, anchors } = mockDownloads()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^Titre/ }))
await chooseExport('Note actuelle', 'HTML')
    const single = await blobText(blobs[blobs.length - 1])
    expect(single).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(single).toContain('&lt;img src=x onerror=&quot;alert(2)&quot;&gt;')
    expect(single).toContain('&lt;script&gt;ioc&lt;/script&gt;')
    expect(single).toContain('&lt;img onerror=&quot;tag&quot;&gt;')
    expect(single).not.toContain('<script>alert')
    expect(single).not.toContain('<img src=x onerror=')

    await chooseExport('Toutes les notes', 'HTML')
    const all = await blobText(blobs[blobs.length - 1])
    expect(all).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(all).toContain('&lt;img onerror=&quot;tag&quot;&gt;')
    expect(all).toContain('IOC:&lt;script&gt;ioc&lt;/script&gt;')
    expect(all).toContain('MITRE:T1059')
    expect(all).toContain('CVE-2026-1234')
    expect(all).not.toContain('<script>alert')
    expect(anchors).toEqual([
      { href: 'blob:notes-1', filename: 'titre-script-alert-1-script.html', type: 'text/html', connected: true },
      expect.objectContaining({ href: 'blob:notes-2', filename: expect.stringMatching(/^notes-\d{4}-\d{2}-\d{2}\.html$/), type: 'text/html', connected: true }),
    ])
    expect(revokeUrl).not.toHaveBeenCalled()
    await new Promise(resolve => window.setTimeout(resolve, 1100))
    expect(revokeUrl).toHaveBeenCalledTimes(2)
  })
})
