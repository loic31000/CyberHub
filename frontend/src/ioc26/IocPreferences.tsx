import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Dialog } from '@/components/AccessibleDialog'

export type IocDensity = 'comfort' | 'compact'
const KEY = 'cyberhub:ioc-display:v1'

function read(): IocDensity {
  try { return localStorage.getItem(KEY) === 'compact' ? 'compact' : 'comfort' }
  catch { return 'comfort' }
}

export function useIocDensity() {
  const [density, setDensity] = useState<IocDensity>(read)
  const update = (next: IocDensity) => {
    setDensity(next)
    try { localStorage.setItem(KEY, next) } catch { /* private browsing can deny storage */ }
  }
  return [density, update] as const
}

export function IocDisplaySettings({ density, onChange }: { density: IocDensity; onChange: (next: IocDensity) => void }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="ioc26-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <SlidersHorizontal size={15} aria-hidden="true" />Personnaliser
    </button>
    {open && <Dialog title="Personnaliser IOC Manager" onClose={() => setOpen(false)} footer={
      <button type="button" className="ioc26-btn is-primary" onClick={() => setOpen(false)}>Terminé</button>
    }>
      <p>Choisissez la densité de la liste. Ce réglage est conservé sur cet appareil.</p>
      <fieldset className="ioc26-density-options">
        <legend>Affichage des indicateurs</legend>
        <label><input type="radio" name="ioc-density" checked={density === 'comfort'} onChange={() => onChange('comfort')} />
          <span><strong>Confort</strong><small>Lignes aérées et données faciles à parcourir</small></span>
        </label>
        <label><input type="radio" name="ioc-density" checked={density === 'compact'} onChange={() => onChange('compact')} />
          <span><strong>Compact</strong><small>Plus d’indicateurs visibles</small></span>
        </label>
      </fieldset>
    </Dialog>}
  </>
}
