import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Dialog } from './MitreUi'

export type MitrePreferences = {
  layout: 'comfort' | 'compact'
  circuit: boolean
  tactics: boolean
  filters: boolean
}

const KEY = 'cyberhub:mitre-display:v1'
export const DEFAULT_MITRE_PREFERENCES: MitrePreferences = {
  layout: 'comfort', circuit: false, tactics: true, filters: false,
}

function readPreferences(): MitrePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<MitrePreferences>
    return {
      layout: saved.layout === 'compact' ? 'compact' : 'comfort',
      circuit: saved.circuit === true,
      tactics: saved.tactics !== false,
      filters: saved.filters === true,
    }
  } catch { return { ...DEFAULT_MITRE_PREFERENCES } }
}

export function useMitrePreferences() {
  const [preferences, setPreferences] = useState<MitrePreferences>(readPreferences)
  useEffect(() => {
    const sync = () => setPreferences(readPreferences())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const update = (next: MitrePreferences) => {
    setPreferences(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* local storage can be unavailable */ }
  }
  return [preferences, update] as const
}

export function MitreDisplaySettings({ preferences, onChange }: {
  preferences: MitrePreferences
  onChange: (next: MitrePreferences) => void
}) {
  const [open, setOpen] = useState(false)
  const set = <K extends keyof MitrePreferences>(key: K, value: MitrePreferences[K]) =>
    onChange({ ...preferences, [key]: value })
  return (
    <>
      <button type="button" className="mx-btn mx-settings-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <SlidersHorizontal size={15} aria-hidden="true" />Personnaliser MITRE
      </button>
      {open && <Dialog title="Personnaliser MITRE" onClose={() => setOpen(false)} footer={
        <>
          <button type="button" className="mx-btn" onClick={() => onChange({ ...DEFAULT_MITRE_PREFERENCES })}>Réinitialiser l’affichage</button>
          <button type="button" className="mx-btn is-primary" onClick={() => setOpen(false)}>Terminé</button>
        </>
      }>
        <p className="mx-settings-intro">Adaptez la lecture de MITRE ATT&CK sur cet appareil.</p>
        <fieldset className="mx-settings-group">
          <legend>Disposition des fiches</legend>
          <label><input type="radio" name="mx-layout" checked={preferences.layout === 'comfort'} onChange={() => set('layout', 'comfort')} />Confort <small>Fiches plus larges et lisibles</small></label>
          <label><input type="radio" name="mx-layout" checked={preferences.layout === 'compact'} onChange={() => set('layout', 'compact')} />Compact <small>Davantage de techniques à l’écran</small></label>
        </fieldset>
        <div className="mx-settings-group" role="group" aria-label="Options d’affichage">
          <label><input type="checkbox" checked={preferences.circuit} onChange={e => set('circuit', e.target.checked)} />Circuit de fond <small>Le processeur du header reste visible</small></label>
          <label><input type="checkbox" checked={preferences.tactics} onChange={e => set('tactics', e.target.checked)} />Panneau des tactiques</label>
          <label><input type="checkbox" checked={preferences.filters} onChange={e => set('filters', e.target.checked)} />Filtres avancés affichés</label>
        </div>
      </Dialog>}
    </>
  )
}
