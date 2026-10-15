import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, Plus, RotateCcw, X } from 'lucide-react'
import { NAV_GROUPS, NAV_ITEMS } from './navigation'
import { DEFAULT_NAVIGATION, type NavigationDensity, type NavigationMode, type NavigationPreferences, type RailContent } from './navigationPreferences'

const MODES: { id: NavigationMode; title: string; detail: string }[] = [
  { id: 'auto', title: 'Automatique', detail: 'Rail sur ordinateur, tiroir sur mobile' },
  { id: 'compact', title: 'Compact', detail: 'Icônes et panneau ouvrable' },
  { id: 'expanded', title: 'Étendu', detail: 'Sidebar permanente dès 1600 px' },
]

export default function NavigationPreferencesDialog({ preferences, onChange, onClose }: {
  preferences: NavigationPreferences
  onChange: (next: NavigationPreferences) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const addRef = useRef<HTMLSelectElement>(null)
  const [candidate, setCandidate] = useState('')
  const available = NAV_ITEMS.filter((item) => !preferences.favorites.includes(item.id))

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    headingRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')]
      .filter((element) => element.getClientRects().length > 0)
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  const move = (index: number, offset: number) => {
    const favorites = [...preferences.favorites]
    const [item] = favorites.splice(index, 1)
    favorites.splice(index + offset, 0, item)
    onChange({ ...preferences, favorites })
  }

  return (
    <div className="ch-nav-settings-layer">
      <button type="button" className="ch-nav-settings-scrim" tabIndex={-1} aria-label="Fermer la personnalisation" onClick={onClose} />
      <div ref={dialogRef} className="ch-nav-settings" role="dialog" aria-modal="true"
        aria-labelledby="ch-nav-settings-title" onKeyDown={onKeyDown}>
        <header className="ch-nav-settings-head">
          <div><span>NAVIGATION / PRÉFÉRENCES</span><h2 id="ch-nav-settings-title" ref={headingRef} tabIndex={-1}>Personnaliser la navigation</h2></div>
          <button type="button" className="ch-icon-button" aria-label="Fermer la personnalisation" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="ch-nav-settings-body">
          <fieldset className="ch-nav-settings-section">
            <legend>Mode d’affichage</legend>
            <div className="ch-nav-mode-options">
              {MODES.map((mode) => (
                <label key={mode.id} className={preferences.mode === mode.id ? 'is-selected' : ''}>
                  <input type="radio" name="ch-nav-mode" value={mode.id} checked={preferences.mode === mode.id}
                    onChange={() => onChange({ ...preferences, mode: mode.id })} />
                  <span><strong>{mode.title}</strong><small>{mode.detail}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="ch-nav-settings-section">
            <legend>Contenu du rail</legend>
            <p>Choisissez les raccourcis du rail compact. Tous les modules restent dans le tiroir.</p>
            <div className="ch-nav-rail-options">
              {([
                { id: 'essential', title: 'Essentiel — recommandé', detail: 'Dashboard, jusqu’à cinq favoris et module courant' },
                { id: 'full', title: 'Complet', detail: 'Tous les modules, regroupés comme actuellement' },
              ] as { id: RailContent; title: string; detail: string }[]).map((option) => (
                <label key={option.id} className={preferences.railContent === option.id ? 'is-selected' : ''}>
                  <input type="radio" name="ch-nav-rail-content" value={option.id}
                    checked={preferences.railContent === option.id}
                    onChange={() => onChange({ ...preferences, railContent: option.id })} />
                  <span><strong>{option.title}</strong><small>{option.detail}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="ch-nav-settings-section">
            <legend>Densité</legend>
            <div className="ch-nav-density-options">
              {(['standard', 'comfort'] as NavigationDensity[]).map((density) => (
                <label key={density} className={preferences.density === density ? 'is-selected' : ''}>
                  <input type="radio" name="ch-nav-density" value={density} checked={preferences.density === density}
                    onChange={() => onChange({ ...preferences, density })} />
                  <span>{density === 'comfort' ? 'Confort' : 'Standard'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <section className="ch-nav-settings-section" aria-labelledby="ch-nav-settings-favorites">
            <h3 id="ch-nav-settings-favorites">Modules favoris</h3>
            <p>Le rail Essentiel affiche jusqu’à cinq favoris dans cet ordre. Les autres restent dans le tiroir ; Dashboard et Paramètres ont déjà leur place.</p>
            {preferences.favorites.length > 0 && (
              <ol className="ch-nav-favorite-order">
                {preferences.favorites.map((id, index) => {
                  const item = NAV_ITEMS.find((entry) => entry.id === id)
                  if (!item) return null
                  const Icon = item.icon
                  return <li key={id}>
                    <Icon size={16} aria-hidden="true" /><span>{item.title}</span>
                    <button type="button" aria-label={`Monter ${item.title}`} title={`Monter ${item.title}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
                    <button type="button" aria-label={`Descendre ${item.title}`} title={`Descendre ${item.title}`} disabled={index === preferences.favorites.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
                    <button type="button" aria-label={`Retirer ${item.title} des favoris`} title={`Retirer ${item.title} des favoris`}
                      onClick={() => {
                        onChange({ ...preferences, favorites: preferences.favorites.filter((value) => value !== id) })
                        requestAnimationFrame(() => addRef.current?.focus())
                      }}><X size={15} /></button>
                  </li>
                })}
              </ol>
            )}
            <div className="ch-nav-add-favorite">
              <select ref={addRef} aria-label="Module à épingler" value={candidate} onChange={(event) => setCandidate(event.target.value)}>
                <option value="">Choisir un module…</option>
                {available.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <button type="button" disabled={!candidate || !available.some((item) => item.id === candidate)}
                onClick={() => { onChange({ ...preferences, favorites: [...preferences.favorites, candidate] }); setCandidate('') }}>
                <Plus size={15} aria-hidden="true" />Épingler
              </button>
            </div>
          </section>

          <fieldset className="ch-nav-settings-section">
            <legend>Groupes</legend>
            <p>Replier un groupe ne retire aucun module de la navigation.</p>
            <div className="ch-nav-group-options">
              {NAV_GROUPS.map((group) => <label key={group.id}>
                <input type="checkbox" checked={!preferences.collapsed.includes(group.id)}
                  onChange={() => onChange({ ...preferences, collapsed: preferences.collapsed.includes(group.id)
                    ? preferences.collapsed.filter((id) => id !== group.id) : [...preferences.collapsed, group.id] })} />
                <span><b>{group.code}</b> {group.label}</span>
              </label>)}
            </div>
          </fieldset>
        </div>
        <footer className="ch-nav-settings-foot">
          <button type="button" className="ch-nav-reset" onClick={() => { onChange({ ...DEFAULT_NAVIGATION }); setCandidate('') }}>
            <RotateCcw size={15} aria-hidden="true" />Réinitialiser la navigation
          </button>
          <button type="button" className="ch-nav-done" onClick={onClose}>Terminé</button>
        </footer>
      </div>
    </div>
  )
}
