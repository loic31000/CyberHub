import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '@/api/client'
import type { SearchCategory, SearchResult } from '@/types'

// ---- Icônes par catégorie ----
const CATEGORY_ICON: Record<SearchCategory, string> = {
  tool:     '🔧',
  ctf:      '🏴',
  cve:      '🛡️',
  playbook: '📖',
}

// CATEGORY_LABEL is now resolved via t() inside the component

const CATEGORY_ORDER: SearchCategory[] = ['tool', 'ctf', 'cve', 'playbook']

// ---- Composant ----
interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
    const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const inputRef   = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate   = useNavigate()

  const CATEGORY_LABEL: Record<SearchCategory, string> = {
    tool:     `Outils`,
    ctf:      `Writeups CTF`,
    cve:      `Veille CVE`,
    playbook: `Playbooks`,
  }

  // Focus l'input à l'ouverture
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounce de la recherche (300 ms)
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

  // Navigation clavier
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (!results.length) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const r = results[activeIdx]
        if (r) {
          navigate(r.path)
          onClose()
        }
      }
    },
    [results, activeIdx, navigate, onClose],
  )

  const handleSelect = useCallback(
    (r: SearchResult) => {
      navigate(r.path)
      onClose()
    },
    [navigate, onClose],
  )

  // Clic hors du modal = fermeture
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Grouper les résultats par catégorie
  const grouped = CATEGORY_ORDER.reduce<Record<SearchCategory, SearchResult[]>>(
    (acc, cat) => {
      acc[cat] = results.filter((r) => r.category === cat)
      return acc
    },
    { tool: [], ctf: [], cve: [], playbook: [] },
  )

  // Index global pour la navigation clavier
  let globalIdx = 0

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* ---- Input ---- */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-text-muted text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Rechercher dans les outils, CVE, writeups, playbooks…`}
            className="flex-1 bg-transparent outline-none text-text-primary placeholder-text-muted text-sm"
          />
          {loading && (
            <span className="text-xs text-text-muted animate-pulse">{`Recherche…`}</span>
          )}
          <kbd
            className="hidden sm:inline-block px-2 py-0.5 rounded text-xs border border-border text-text-muted"
          >
            Esc
          </kbd>
        </div>

        {/* ---- Résultats ---- */}
        <div className="max-h-96 overflow-y-auto">
          {query.trim() === '' && (
            <p className="px-5 py-8 text-center text-text-muted text-sm">
              {`Tapez pour rechercher dans tous les modules…`}
            </p>
          )}

          {query.trim() !== '' && !loading && results.length === 0 && (
            <p className="px-5 py-8 text-center text-text-muted text-sm">
              {`Aucun résultat pour « ${query} »`}
            </p>
          )}

          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat]
            if (!items.length) return null

            return (
              <div key={cat}>
                {/* En-tête de groupe */}
                <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                  <span className="text-xs">{CATEGORY_ICON[cat]}</span>
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {CATEGORY_LABEL[cat]}
                  </span>
                </div>

                {items.map((r) => {
                  const idx = globalIdx++
                  const isActive = idx === activeIdx

                  return (
                    <button
                      key={`${r.category}-${r.id}`}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive
                          ? 'bg-accent/20 text-text-primary'
                          : 'text-text-secondary hover:bg-accent/10'
                      }`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => handleSelect(r)}
                    >
                      <span className="text-base leading-none flex-shrink-0">
                        {CATEGORY_ICON[r.category]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        {r.subtitle && (
                          <p className="text-xs text-text-muted truncate">{r.subtitle}</p>
                        )}
                      </div>
                      {isActive && (
                        <span className="text-xs text-text-muted flex-shrink-0">↵ {`↵ ouvrir`}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* ---- Footer ---- */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-text-muted">
            <span><kbd className="border border-border rounded px-1">↑↓</kbd> {`↑↓ naviguer`}</span>
            <span><kbd className="border border-border rounded px-1">↵</kbd> {`↵ ouvrir`}</span>
            <span><kbd className="border border-border rounded px-1">Esc</kbd> {`Esc fermer`}</span>
            <span className="ml-auto">{`${results.length} résultat`}</span>
          </div>
        )}
      </div>
    </div>
  )
}
