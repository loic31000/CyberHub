import { useEffect, useRef } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronRight, LogOut, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { NAV_GROUPS } from './navigation'

/*
 * "Tous les modules": every module by category, with its description and its
 * real route. Opened by the burger (the only navigation on phones) and by the
 * rail. Modal dialog: focus kept inside, Escape and the scrim close it, focus
 * returns to the control that opened it.
 */
export default function ModuleDrawer({
  open,
  onClose,
  returnFocus,
  bgpAlertCount = 0,
}: {
  open: boolean
  onClose: () => void
  returnFocus: RefObject<HTMLElement | null>
  bgpAlertCount?: number
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const current = dialogRef.current?.querySelector<HTMLElement>('.ch-drawer-link.is-active')
      ;(current ?? closeRef.current)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  const close = () => {
    onClose()
    const target = returnFocus.current
    window.setTimeout(() => target?.isConnected && target.focus(), 0)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
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
      <div
        ref={dialogRef}
        id="ch-drawer"
        className="ch-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ch-drawer-title"
        onKeyDown={onKeyDown}
      >
        <div className="ch-drawer-head">
          <div>
            <span>NAVIGATION</span>
            <h2 id="ch-drawer-title">Tous les modules</h2>
          </div>
          <button ref={closeRef} type="button" className="ch-icon-button" aria-label="Fermer la navigation" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <nav className="ch-drawer-body" aria-label="Tous les modules CyberHub">
          {NAV_GROUPS.map((group) => (
            <section key={group.id} className="ch-drawer-group" aria-labelledby={`ch-drawer-${group.id}`}>
              <h3 id={`ch-drawer-${group.id}`}>
                <b>{group.code}</b>
                {group.label}
              </h3>
              <ul>
                {group.items.map(({ id, title, description, route, icon: Icon, end }) => (
                  <li key={route}>
                    <NavLink
                      to={route}
                      end={end}
                      className={({ isActive }) => `ch-drawer-link${isActive ? ' is-active' : ''}`}
                      onClick={close}
                    >
                      {({ isActive }) => (
                        <>
                          <span className="ch-glyph-tile" aria-hidden="true">
                            <Icon size={17} />
                          </span>
                          <span>
                            <strong>{title}</strong>
                            <small>
                              {id === 'bgp-historian' && bgpAlertCount > 0
                                ? `${bgpAlertCount} alerte${bgpAlertCount > 1 ? 's' : ''} enregistrée${bgpAlertCount > 1 ? 's' : ''}`
                                : description}
                            </small>
                          </span>
                          {isActive ? <em>ACTUEL</em> : <ChevronRight size={15} aria-hidden="true" />}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="ch-drawer-foot">
          <button
            type="button"
            className="ch-drawer-logout"
            onClick={() => {
              onClose()
              logout()
              navigate('/login')
            }}
          >
            <LogOut size={16} aria-hidden="true" /> Déconnexion
          </button>
        </div>
      </div>
    </div>
  )
}
