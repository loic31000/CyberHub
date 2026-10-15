import { useEffect, useRef } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, SlidersHorizontal, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import NavigationSections from './NavigationSections'
import type { NavigationPreferences } from './navigationPreferences'

export default function ModuleDrawer({ open, onClose, onCustomize, onToggleGroup, preferences, returnFocus, bgpAlertCount = 0 }: {
  open: boolean
  onClose: () => void
  onCustomize: (trigger: HTMLElement) => void
  onToggleGroup: (id: string) => void
  preferences: NavigationPreferences
  returnFocus: RefObject<HTMLElement | null>
  bgpAlertCount?: number
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => {
      const current = dialogRef.current?.querySelector<HTMLElement>('.ch-nav-link.is-active')
      ;(current ?? closeRef.current)?.focus()
    })
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      const target = returnFocus.current
      onClose()
      window.setTimeout(() => target?.isConnected && target.focus(), 0)
    }
    window.addEventListener('keydown', onEscape, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onEscape, true)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  const close = () => {
    onClose()
    const target = returnFocus.current
    window.setTimeout(() => target?.isConnected && target.focus(), 0)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
      .filter((element) => element.getClientRects().length > 0)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="ch-drawer-layer">
      <button type="button" className="ch-drawer-scrim" aria-label="Fermer la navigation" tabIndex={-1} onClick={close} />
      <div ref={dialogRef} id="ch-drawer" className="ch-drawer" role="dialog" aria-modal="true"
        aria-labelledby="ch-drawer-title" onKeyDown={onKeyDown}>
        <div className="ch-drawer-head">
          <div><span>NAVIGATION</span><h2 id="ch-drawer-title">Tous les modules</h2></div>
          <button ref={closeRef} type="button" className="ch-icon-button" aria-label="Fermer la navigation" onClick={close}><X size={18} /></button>
        </div>

        <div className="ch-drawer-body">
          <NavigationSections idPrefix="ch-drawer" preferences={preferences} onToggleGroup={onToggleGroup}
            onNavigate={close} bgpAlertCount={bgpAlertCount} />
        </div>

        <div className="ch-drawer-foot">
          <button type="button" className="ch-drawer-customize" onClick={(event) => onCustomize(event.currentTarget)}>
            <SlidersHorizontal size={16} aria-hidden="true" />Personnaliser la navigation
          </button>
          <button type="button" className="ch-drawer-logout" onClick={() => { onClose(); logout(); navigate('/login') }}>
            <LogOut size={16} aria-hidden="true" />Déconnexion
          </button>
        </div>
      </div>
    </div>
  )
}
