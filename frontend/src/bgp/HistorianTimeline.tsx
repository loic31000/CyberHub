import { memo, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { GitCompare } from 'lucide-react'
import type { BGPSnapshot } from '@/types/bgp'
import { formatClock, formatDateTime, formatGap, formatShortDay } from './format'
import { snapshotMoment, summarizeProvenance, timeTicks } from './history'
import { ProvenanceTag, provenanceText } from './Provenance'

export type Role = 'before' | 'after'
const ROLE_LABEL: Record<Role, string> = { before: 'avant', after: 'après' }

// Snapshots are placed and ordered by snapshot_date, as the backend orders them.
const momentOf = (s: BGPSnapshot) => snapshotMoment(s)
const time = (s: BGPSnapshot) => new Date(momentOf(s)).getTime()
const LANES = 3
const CLOSE = 1.6 // % of the axis under which two marks share a lane

/**
 * The observation instrument: every snapshot sits at its real date on a
 * calendar axis, the two compared ones are labelled and the span between
 * them is shaded with its duration. One tab stop; arrow keys move between
 * observations in time order, Enter or Space selects.
 */
export const TimeInstrument = memo(function TimeInstrument({ snapshots, total, selected, roleOf, onToggle }: {
  snapshots: BGPSnapshot[]
  total: number
  selected: number[]
  roleOf: (id: number) => Role | null
  onToggle: (id: number) => void
}) {
  const chronological = useMemo(() => [...snapshots].sort((a, b) => time(a) - time(b)), [snapshots])
  const [focusIndex, setFocusIndex] = useState(chronological.length - 1)
  const marks = useRef<(HTMLButtonElement | null)[]>([])

  const geometry = useMemo(() => {
    const first = time(chronological[0])
    const last = time(chronological[chronological.length - 1])
    const span = Math.max(last - first, 3_600_000)
    const pad = span * 0.04
    const min = first - pad
    const max = first + span + pad
    const at = (t: number) => ((t - min) / (max - min)) * 100
    const lanes: number[] = []
    let lastAt = -Infinity
    let lane = 0
    for (const snap of chronological) {
      const x = at(time(snap))
      lane = x - lastAt < CLOSE ? (lane + 1) % LANES : 0
      lanes.push(lane)
      lastAt = x
    }
    return { at, lanes, ticks: timeTicks(min, max) }
  }, [chronological])

  const first = chronological[0]
  const last = chronological[chronological.length - 1]
  const picked = chronological.filter(s => selected.includes(s.id))
  const band = picked.length === 2
    ? { left: geometry.at(time(picked[0])), right: geometry.at(time(picked[1])), gap: formatGap(momentOf(picked[0]), momentOf(picked[1])) }
    : null

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }
    if (!(event.key in keys)) return
    event.preventDefault()
    const step = keys[event.key]
    const next = Number.isFinite(step) ? Math.min(chronological.length - 1, Math.max(0, focusIndex + step)) : step < 0 ? 0 : chronological.length - 1
    setFocusIndex(next)
    marks.current[next]?.focus()
  }

  return (
    <figure className="bgp-instrument">
      <figcaption className="bgp-instrument-head">
        <span><b>{formatShortDay(momentOf(first))}</b> → <b>{formatShortDay(momentOf(last))}</b></span>
        <span>{formatGap(momentOf(first), momentOf(last))} couverts</span>
        <span>{snapshots.length < total ? `${snapshots.length} plus récentes sur ${total}` : `${total} observation${total > 1 ? 's' : ''}`}</span>
      </figcaption>
      <div className="bgp-axis" role="group" aria-label="Frise des observations, flèches pour parcourir" onKeyDown={move}>
        <div className="bgp-axis-grid" aria-hidden="true">
          {geometry.ticks.map(tick => (
            <span key={tick.t} className="bgp-axis-tick" style={{ left: `${geometry.at(tick.t)}%` }}>{geometry.at(tick.t) > 2 && geometry.at(tick.t) < 92 && <small>{tick.label}</small>}</span>
          ))}
        </div>
        {band && (
          <div className="bgp-axis-band" style={{ left: `${band.left}%`, width: `${Math.max(band.right - band.left, 0.4)}%` }} aria-hidden="true">
            <span>{band.gap}</span>
          </div>
        )}
        <div className="bgp-axis-line" aria-hidden="true" />
        {chronological.map((snap, i) => {
          const role = roleOf(snap.id)
          const isSelected = selected.includes(snap.id)
          const provenance = summarizeProvenance(snap.provenance_status, snap.data_provenance)
          return (
            <button
              key={snap.id}
              ref={el => { marks.current[i] = el }}
              type="button"
              className="bgp-axis-mark"
              data-lane={geometry.lanes[i]}
              data-selected={isSelected}
              data-role={role ?? undefined}
              data-provenance={provenance.state}
              style={{ left: `${geometry.at(time(snap))}%` }}
              tabIndex={i === Math.min(focusIndex, chronological.length - 1) ? 0 : -1}
              onFocus={() => setFocusIndex(i)}
              onClick={() => onToggle(snap.id)}
              aria-pressed={isSelected}
              aria-label={`Observation #${snap.id}, ${formatDateTime(momentOf(snap))}${role ? `, ${ROLE_LABEL[role]}` : ''}`}
              title={`#${snap.id} · ${formatDateTime(momentOf(snap))}\n${provenanceText(provenance)}`}
            >
              {role && <em>{role === 'before' ? 'AVANT' : 'APRÈS'}</em>}
            </button>
          )
        })}
      </div>
    </figure>
  )
})

/** Observations newest first, with the real gap to the previous one. */
export const ObservationList = memo(function ObservationList({ snapshots, asn, selected, roleOf, onToggle, onCompareWithPrevious }: {
  snapshots: BGPSnapshot[]
  asn: number
  selected: number[]
  roleOf: (id: number) => Role | null
  onToggle: (id: number) => void
  onCompareWithPrevious: (newer: BGPSnapshot, older: BGPSnapshot) => void
}) {
  return (
    <ol className="bgp-timeline" aria-label="Chronologie des snapshots">
      {snapshots.map((snap, idx) => {
        const role = roleOf(snap.id)
        const previous = snapshots[idx + 1]
        return (
          <li key={snap.id}>
            <label className="bgp-snapshot-item" data-selected={selected.includes(snap.id)} data-latest={idx === 0}>
              <input type="checkbox" checked={selected.includes(snap.id)} onChange={() => onToggle(snap.id)} aria-label={`Comparer le snapshot ${snap.id}`} />
              <span className="bgp-snapshot-node" aria-hidden="true" />
              <span className="bgp-snapshot-copy">
                <time dateTime={momentOf(snap)}>{formatShortDay(momentOf(snap))} <b>{formatClock(momentOf(snap))}</b></time>
                <span className="bgp-snapshot-meta">
                  <span title={previous ? `${formatGap(momentOf(previous), momentOf(snap))} après #${previous.id}` : undefined}>#{snap.id}{previous ? ` · +${formatGap(momentOf(previous), momentOf(snap))}` : ' · plus ancienne chargée'}</span>
                  <ProvenanceTag status={snap.provenance_status} map={snap.data_provenance} />
                </span>
              </span>
              {role && <span className="bgp-snapshot-role" data-role={role}>{ROLE_LABEL[role]}</span>}
              {idx === 0 && !role && <span className="bgp-latest-badge">Le plus récent</span>}
            </label>
            {previous && (
              <button
                type="button"
                className="bgp-step-compare"
                onClick={() => onCompareWithPrevious(snap, previous)}
                aria-label={`Comparer le snapshot ${snap.id} au précédent (#${previous.id}) · AS${asn}`}
                title="Comparer à l’observation précédente"
              >
                <GitCompare size={13} aria-hidden="true" />
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
})
