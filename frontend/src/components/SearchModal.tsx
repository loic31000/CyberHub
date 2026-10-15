import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { searchApi } from '@/api/client'
import type { SearchCategory, SearchResult } from '@/types'
import { searchItems } from '@/dashboard2026/moduleSearch'
import { categoryOf } from '@/dashboard2026/environmentRegistry'
import { CveGlyph, PlaybookGlyph, ToolsGlyph, WriteupGlyph } from '@/dashboard2026/CyberGlyphs'
import { NAV_ITEMS, type NavItem, type ShellIcon } from '@/shell/navigation'

/*
 * Global search (Ctrl+K), shared by every page.
 *
 * Two sources, never mixed up:
 * - Modules: the shared module registry, matched locally by name, category
 *   and aliases (same matching as the Dashboard catalogues);
 * - Content: the existing backend search (/api/search) over tools, writeups,
 *   CVE and playbooks, unchanged. Module pages keep their own searches.
 */

const CATEGORY_ORDER: SearchCategory[] = ['tool', 'ctf', 'cve', 'playbook']

const CATEGORY_META: Record<SearchCategory, { label: string; icon: ShellIcon }> = {
  tool: { label: 'Outils', icon: ToolsGlyph },
  ctf: { label: 'Writeups CTF', icon: WriteupGlyph },
  cve: { label: 'Veille CVE', icon: CveGlyph },
  playbook: { label: 'Playbooks', icon: PlaybookGlyph },
}

type Option =
  | { kind: 'module'; key: string; item: NavItem }
  | { kind: 'content'; key: string; result: SearchResult }

interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setLoading(false)
    setActiveIdx(0)
    const id = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(id)
  }, [open])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  // Backend content search, debounced (300 ms) as before.
  const handleChange = useCallback((value: string) => {
    setQuery(value)
    setActiveIdx(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.global(value.trim())
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  // Modules first (all of them when the field is empty), then content by category.
  const modules = useMemo(() => (query.trim() ? searchItems(query, NAV_ITEMS).slice(0, 6) : NAV_ITEMS.slice(0, 8)), [query])
  const options: Option[] = useMemo(
    () => [
      ...modules.map((item) => ({ kind: 'module' as const, key: `module-${item.id}`, item })),
      ...CATEGORY_ORDER.flatMap((category) =>
        results.filter((r) => r.category === category).map((result) => ({ kind: 'content' as const, key: `${result.category}-${result.id}`, result })),
      ),
    ],
    [modules, results],
  )

  const select = useCallback(
    (option: Option | undefined) => {
      if (!option) return
      navigate(option.kind === 'module' ? option.item.route : option.result.path)
      onClose()
    },
    [navigate, onClose],
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + options.length) % options.length)
    } else if (e.key === 'Enter' && document.activeElement === inputRef.current) {
      e.preventDefault()
      select(options[activeIdx])
    } else if (e.key === 'Tab') {
      // The field is the dialog's only tab stop (options are reached with the arrows).
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  // Keep the active option visible while moving with the arrows.
  useEffect(() => {
    dialogRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!open) return null

  const activeId = options[activeIdx] ? `ch-search-${options[activeIdx].key}` : undefined
  const contentCount = options.length - modules.length
  let index = -1
  const renderOption = (option: Option) => {
    index += 1
    const i = index
    const selected = i === activeIdx
    const Icon = option.kind === 'module' ? option.item.icon : CATEGORY_META[option.result.category].icon
    return (
      <button
        key={option.key}
        id={`ch-search-${option.key}`}
        type="button"
        role="option"
        aria-selected={selected}
        tabIndex={-1}
        className="ch-palette-option"
        onMouseEnter={() => setActiveIdx(i)}
        onClick={() => select(option)}
      >
        <span className="ch-glyph-tile" aria-hidden="true">
          <Icon size={17} />
        </span>
        <span>
          <strong>{option.kind === 'module' ? option.item.title : option.result.title}</strong>
          <small>
            {option.kind === 'module'
              ? `${categoryOf(option.item.category).code} · ${option.item.description}`
              : option.result.subtitle || CATEGORY_META[option.result.category].label}
          </small>
        </span>
        {selected && <em aria-hidden="true">↵ ouvrir</em>}
      </button>
    )
  }

  return (
    <div className="ch-palette-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="ch-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ch-search-title"
        onKeyDown={handleKeyDown}
      >
        <h2 id="ch-search-title" className="ch-sr-only">
          Recherche globale CyberHub
        </h2>
        <div className="ch-palette-field">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls="ch-search-results"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Rechercher un module, un outil, une CVE, un writeup ou un playbook"
            placeholder="Module, outil, CVE, writeup, playbook…"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="ch-kbd">Recherche…</span>}
          <kbd className="ch-kbd">Échap</kbd>
        </div>

        <div className="ch-palette-results">
          {options.length ? (
            <div id="ch-search-results" role="listbox" aria-label="Résultats">
              {modules.length > 0 && (
                <div role="group" aria-label={query.trim() ? 'Modules' : 'Modules CyberHub'}>
                  <div className="ch-palette-group-title" aria-hidden="true">
                    Modules
                  </div>
                  {modules.map((item) => renderOption({ kind: 'module', key: `module-${item.id}`, item }))}
                </div>
              )}
              {CATEGORY_ORDER.map((category) => {
                const items = results.filter((r) => r.category === category)
                if (!items.length) return null
                return (
                  <div key={category} role="group" aria-label={CATEGORY_META[category].label}>
                    <div className="ch-palette-group-title" aria-hidden="true">
                      {CATEGORY_META[category].label}
                    </div>
                    {items.map((result) => renderOption({ kind: 'content', key: `${result.category}-${result.id}`, result }))}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="ch-palette-empty">{loading ? 'Recherche…' : `Aucun résultat pour « ${query.trim()} »`}</p>
          )}
        </div>

        <div className="ch-palette-foot">
          <span>
            <kbd className="ch-kbd">↑↓</kbd> naviguer
          </span>
          <span>
            <kbd className="ch-kbd">↵</kbd> ouvrir
          </span>
          <span>
            <kbd className="ch-kbd">Échap</kbd> fermer
          </span>
          <output aria-live="polite">
            {query.trim()
              ? `${modules.length} module${modules.length > 1 ? 's' : ''} · ${loading ? '…' : `${contentCount} contenu${contentCount > 1 ? 's' : ''}`}`
              : 'Tapez pour chercher dans les modules et contenus'}
          </output>
        </div>
      </div>
    </div>
  )
}
