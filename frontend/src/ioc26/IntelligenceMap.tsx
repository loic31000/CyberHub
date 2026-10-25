import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, Crosshair, ExternalLink, Radar, ShieldAlert } from 'lucide-react'
import type { IOC } from '@/types/ioc'
import type { IntelligenceData, IntelligenceGroupId } from './intelligenceData'

const PAGE_SIZE = 5
const groupIcons = { mitre: Crosshair, cve: ShieldAlert, playbooks: BookOpen }
const groupHints = { mitre: 'Techniques', cve: 'Vulnérabilités', playbooks: 'Réponse' }

interface Props {
  ioc: IOC
  data: IntelligenceData
  /* The group open when the map appears (coming back from a technique, a CVE or a playbook). */
  initialGroup?: IntelligenceGroupId | null
}

type Box = { x: number; y: number; w: number; h: number }

/* Where the line from a box's centre towards `to` leaves the box. */
function edge(b: Box, to: { x: number; y: number }, gap = 4) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const dx = to.x - cx, dy = to.y - cy
  const t = Math.min(Math.abs((b.w / 2 + gap) / (dx || 1e-6)), Math.abs((b.h / 2 + gap) / (dy || 1e-6)))
  return { x: cx + dx * t, y: cy + dy * t }
}

function severity(score: number) {
  if (score >= 9) return { label: 'Critique', tone: 'critical' }
  if (score >= 7) return { label: 'Élevée', tone: 'high' }
  if (score >= 4) return { label: 'Moyenne', tone: 'medium' }
  return { label: 'Faible', tone: 'low' }
}

export default function IntelligenceMap({ ioc, data, initialGroup = null }: Props) {
  const navigate = useNavigate()
  const startGroup = initialGroup && data.groups.some(group => group.id === initialGroup && group.count > 0) ? initialGroup : null
  const [activeGroup, setActiveGroup] = useState<IntelligenceGroupId | null>(startGroup)
  const [page, setPage] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const core = useRef<HTMLDivElement>(null)
  const groupButtons = useRef<Partial<Record<IntelligenceGroupId, HTMLButtonElement | null>>>({})
  const [links, setLinks] = useState<{ id: IntelligenceGroupId; d: string }[]>([])
  const active = data.groups.find(group => group.id === activeGroup)
  const count = active?.count ?? 0
  const pages = Math.ceil(count / PAGE_SIZE)
  const start = page * PAGE_SIZE

  // The three links, measured on the real layout: from the IOC's edge to each
  // group's edge, slightly curved. Re-measured when the map resizes, never per frame.
  useLayoutEffect(() => {
    const host = stage.current
    if (!host) return
    const measure = () => {
      const base = host.getBoundingClientRect()
      const box = (el: Element | null | undefined): Box | null => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return r.width ? { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height } : null
      }
      const centre = box(core.current)
      if (!centre) return setLinks([])
      const c = { x: centre.x + centre.w / 2, y: centre.y + centre.h / 2 }
      setLinks(data.groups.flatMap(group => {
        const target = box(groupButtons.current[group.id])
        if (!target) return []
        const t = { x: target.x + target.w / 2, y: target.y + target.h / 2 }
        const a = edge(centre, t, 6), z = edge(target, c, 6)
        // A gentle bow, away from the centre line.
        const mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2
        const len = Math.hypot(z.x - a.x, z.y - a.y) || 1
        const bow = Math.min(18, len * 0.12) * (t.x < c.x ? -1 : 1)
        const q = { x: mx + ((z.y - a.y) / len) * bow, y: my - ((z.x - a.x) / len) * bow }
        const f = (n: number) => n.toFixed(1)
        return [{ id: group.id, d: `M${f(a.x)} ${f(a.y)}Q${f(q.x)} ${f(q.y)} ${f(z.x)} ${f(z.y)}` }]
      }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [data.groups, activeGroup])

  const openGroup = (id: IntelligenceGroupId) => { setActiveGroup(id); setPage(0) }
  const returnToGroups = () => {
    const previous = activeGroup
    setActiveGroup(null)
    setPage(0)
    if (previous) requestAnimationFrame(() => groupButtons.current[previous]?.focus())
  }
  // Leaving for a technique, a CVE or a playbook: the investigation is kept in
  // this page's URL first, so Back (or MITRE's return button) brings it back as it was.
  const leaveFor = (url: string, group: IntelligenceGroupId) => {
    const back = new URLSearchParams({ selected: String(ioc.id), analysis: 'deep', group })
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${back}`)
    navigate(url, { state: { from: 'ioc' } })
  }

  return (
    <section className={`ioc26-map${active ? ' has-focus' : ''}`} aria-label="CyberHub Intelligence Map" onKeyDown={event => {
      if (event.key === 'Escape' && activeGroup) {
        event.preventDefault()
        event.stopPropagation()
        returnToGroups()
      }
    }}>
      <div className="ioc26-map-heading">
        <div><span>CYBERHUB / INTELLIGENCE MAP</span><h3>Relations de l’indicateur</h3></div>
        <span className="ioc26-map-level">{active ? active.label.toUpperCase() : 'VUE D’ENSEMBLE'}</span>
      </div>

      <div className="ioc26-map-stage" ref={stage}>
        <svg className="ioc26-map-links" aria-hidden="true">
          {links.map(link => {
            const group = data.groups.find(item => item.id === link.id)
            const state = activeGroup === link.id ? 'is-active' : activeGroup ? 'is-muted' : group?.count ? '' : 'is-empty'
            return <path key={link.id} className={state} d={link.d} />
          })}
        </svg>
        <div className="ioc26-map-core" ref={core}>
          <span className="ioc26-map-core-mark" aria-hidden="true"><Radar size={15} /></span>
          <span className="ioc26-map-core-kicker">IOC ANALYSÉ · {ioc.type.toUpperCase()}</span>
          <strong title={ioc.value}>{ioc.value}</strong>
          <small>{ioc.status === 'active' ? 'Actif' : ioc.status === 'archived' ? 'Archivé' : 'Faux positif'} · TLP:{ioc.tlp.toUpperCase()}</small>
        </div>
        {data.groups.map(group => {
          const Icon = groupIcons[group.id]
          const state = activeGroup === group.id ? ' is-active' : activeGroup ? ' is-muted' : ''
          return <button key={group.id} ref={element => { groupButtons.current[group.id] = element }} type="button"
            className={`ioc26-map-node is-${group.id}${state}`}
            disabled={group.count === 0}
            aria-label={`${group.label}, ${group.count} correspondance${group.count > 1 ? 's' : ''}${group.count > 0 ? ', afficher les résultats' : ''}`}
            aria-pressed={activeGroup === group.id}
            onClick={() => (activeGroup === group.id ? returnToGroups() : openGroup(group.id))}>
            <span className="ioc26-map-node-icon"><Icon size={16} aria-hidden="true" /></span>
            <span className="ioc26-map-node-text">
              <span className="ioc26-map-node-name">{group.label}</span>
              <span className="ioc26-map-node-hint">{group.count > 0 ? groupHints[group.id] : 'Aucune correspondance'}</span>
            </span>
            <strong className="ioc26-map-node-count">{group.count}</strong>
            {group.count > 0 && <ChevronRight className="ioc26-map-node-go" size={14} aria-hidden="true" />}
          </button>
        })}
      </div>

      {active && (
        <div className="ioc26-map-results" aria-live="polite">
          <div className="ioc26-map-results-head">
            <button type="button" className="ioc26-map-back" onClick={returnToGroups}><ChevronLeft size={15} aria-hidden="true" />Vue d’ensemble</button>
            <div className="ioc26-map-switch" role="group" aria-label="Changer de famille">
              {data.groups.map(group => (
                <button key={group.id} type="button" aria-pressed={activeGroup === group.id} disabled={group.count === 0}
                  onClick={() => openGroup(group.id)}>{group.label}<span>{group.count}</span></button>
              ))}
            </div>
            <span className="ioc26-map-range">{start + 1}–{Math.min(start + PAGE_SIZE, count)} / {count}</span>
          </div>
          <ul className="ioc26-map-result-list">
            {active.id === 'mitre' && data.techniques.slice(start, start + PAGE_SIZE).map(technique => <li key={technique.technique_id}>
              <div className="ioc26-map-result-main">
                <span className="ioc26-map-result-id">{technique.technique_id}</span>
                <strong>{technique.name}</strong>
                {technique.tactics.length > 0 && <small>{technique.tactics.join(' · ')}</small>}
              </div>
              <button type="button" className="ioc26-map-result-open"
                aria-label={`Ouvrir la fiche ${technique.technique_id} ${technique.name}`}
                onClick={() => leaveFor(`/knowledge?source=mitre&id=${encodeURIComponent(technique.technique_id)}`, 'mitre')}>
                Ouvrir la fiche<ExternalLink size={13} aria-hidden="true" />
              </button>
            </li>)}
            {active.id === 'cve' && data.cves.slice(start, start + PAGE_SIZE).map(cve => {
              const level = severity(cve.cvss_score)
              return <li key={cve.cve_id}>
                <div className="ioc26-map-result-main">
                  <span className="ioc26-map-result-id">{cve.cve_id}</span>
                  <span className={`ioc26-map-severity is-${level.tone}`}>CVSS {cve.cvss_score.toFixed(1)} · {level.label}</span>
                  <small className="is-clamped">{cve.description || 'Aucune description disponible.'}</small>
                </div>
                <button type="button" className="ioc26-map-result-open" aria-label={`Ouvrir la fiche ${cve.cve_id}`}
                  onClick={() => leaveFor(`/knowledge?source=cve&id=${encodeURIComponent(cve.cve_id)}`, 'cve')}>
                  Ouvrir la fiche<ExternalLink size={13} aria-hidden="true" />
                </button>
              </li>
            })}
            {active.id === 'playbooks' && data.playbooks.slice(start, start + PAGE_SIZE).map(playbook => <li key={playbook.id}>
              <div className="ioc26-map-result-main">
                <span className="ioc26-map-result-id">PLAYBOOK #{playbook.id}</span>
                <strong>{playbook.title}</strong>
              </div>
              <button type="button" className="ioc26-map-result-open" aria-label={`Ouvrir le playbook ${playbook.title}`}
                onClick={() => leaveFor(`/playbooks/${playbook.id}`, 'playbooks')}>
                Ouvrir le playbook<ExternalLink size={13} aria-hidden="true" />
              </button>
            </li>)}
          </ul>
          {pages > 1 && <nav className="ioc26-map-pagination" aria-label={`Pages ${active.label}`}>
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={14} aria-hidden="true" />Précédent</button>
            <span>Page {page + 1} / {pages}</span>
            <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Suivant<ChevronRight size={14} aria-hidden="true" /></button>
          </nav>}
        </div>
      )}
      <p className="ioc26-map-note">Connexions agrégées à l’IOC. Aucune relation entre résultats individuels n’est déduite.</p>
    </section>
  )
}
