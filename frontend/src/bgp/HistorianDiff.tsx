import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Copy, GitCompare, Minus, Plus, RefreshCw, X, XCircle } from 'lucide-react'
import { toast } from '@/store/toast'
import type { BGPDiffResponse } from '@/types/bgp'
import { formatDateTime, formatGap } from './format'
import { analyzeDiff, snapshotMoment, type DiffItem, type FieldAnalysis, type ListState } from './history'
import { ProvenanceNote } from './Provenance'

const LIST_LIMIT = 200
const LIST_STATE_LABEL: Record<ListState, string> = {
  identical: 'identique', changed: 'modifiée', missing: 'manquante', error: 'illisible', unreported: 'non renseignée',
}

function copyLines(lines: string[], what: string) {
  navigator.clipboard.writeText(lines.join('\n')).then(() => toast.success(`${what} copiés (${lines.length})`))
}

function KeyList({ kind, items, field }: { kind: 'added' | 'removed'; items: DiffItem[]; field: string }) {
  const [all, setAll] = useState(false)
  const label = kind === 'added' ? 'Ajoutés' : 'Retirés'
  const shown = all ? items : items.slice(0, LIST_LIMIT)
  return (
    <div className={`bgp-diff-col is-${kind}`}>
      <h5>
        {kind === 'added' ? <Plus size={13} aria-hidden="true" /> : <Minus size={13} aria-hidden="true" />}
        {label} <b>{items.length}</b>
        {items.length > 0 && (
          <button type="button" className="bgp-icon-button" onClick={() => copyLines(items.map(i => i.key), label)} aria-label={`Copier les ${label.toLowerCase()} · ${field}`}>
            <Copy size={12} />
          </button>
        )}
      </h5>
      {items.length === 0 ? <p className="bgp-diff-none">Aucun</p> : (
        <ul>
          {shown.map(item => (
            <li key={item.key}>{kind === 'added' ? '+' : '-'} {item.key}{item.detail && <small>{item.detail}</small>}</li>
          ))}
          {items.length > LIST_LIMIT && (
            <li className="bgp-diff-more">
              <button type="button" className="bgp-link" onClick={() => setAll(v => !v)}>
                {all ? 'Réduire' : `Afficher les ${items.length - LIST_LIMIT} autres`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/** Raw lists of a field, serialised only once the reader opens them. */
function RawField({ field, data }: { field: string; data: unknown }) {
  const [open, setOpen] = useState(false)
  const json = useMemo(() => (open ? JSON.stringify(data, null, 2) : ''), [open, data])
  return (
    <details className="bgp-raw" onToggle={event => setOpen((event.target as HTMLDetailsElement).open)}>
      <summary>Données brutes · {field}</summary>
      {open && (
        <>
          <button type="button" className="bgp-link" onClick={() => copyLines([json], 'JSON')}><Copy size={12} aria-hidden="true" /> Copier le JSON</button>
          <pre>{json}</pre>
        </>
      )}
    </details>
  )
}

function FieldBlock({ field, raw }: { field: FieldAnalysis; raw: unknown }) {
  const net = field.after - field.before
  return (
    <div className="bgp-diff-field">
      <div className="bgp-diff-field-head">
        <h4>{field.label}</h4>
        <span className="bgp-volume" aria-label={`Volume : ${field.before} avant, ${field.after} après`}>
          {field.before} <ArrowRight size={12} aria-hidden="true" /> {field.after}
          <b data-sign={net > 0 ? 'up' : net < 0 ? 'down' : 'flat'}>{net > 0 ? `+${net}` : net < 0 ? `−${-net}` : '±0'}</b>
        </span>
      </div>
      <div className="bgp-diff-cols">
        <KeyList kind="removed" items={field.removed} field={field.label} />
        <KeyList kind="added" items={field.added} field={field.label} />
      </div>
      {field.modified.length > 0 && (
        <div className="bgp-diff-modified">
          <h5>Attributs modifiés <b>{field.modified.length}</b></h5>
          <ul>
            {field.modified.slice(0, LIST_LIMIT).map(m => <li key={m.key}>~ {m.key}</li>)}
          </ul>
        </div>
      )}
      <RawField field={field.field} data={raw} />
    </div>
  )
}

/**
 * The comparison of two snapshots: verdict first, then the interval, the
 * changes per compared list with before / after volumes, and the raw data.
 * The verdict follows the backend's list_status: identical only when all
 * eight lists were compared; with an older backend, omitted lists remain unknown.
 */
export function ComparisonSurface({ diffResponse, onClose }: { diffResponse: BGPDiffResponse; onClose: () => void }) {
  const { older, newer, diff } = diffResponse
  const analysis = useMemo(() => analyzeDiff(diffResponse), [diffResponse])
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus({ preventScroll: true })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])

  const { verdict } = analysis
  const notCompared = analysis.lists.filter(l => l.state === 'missing' || l.state === 'error')
  const changes = diff.changes as Record<string, Record<string, unknown> | undefined>
  const olderAt = snapshotMoment({ snapshot_date: older.snapshot_date ?? '', created_at: older.created_at })
  const newerAt = snapshotMoment({ snapshot_date: newer.snapshot_date ?? '', created_at: newer.created_at })

  return (
    <section className="bgp-diff" role="region" aria-labelledby="bgp-diff-title" data-verdict={verdict} data-no-reported-diff={analysis.sections.length === 0}>
      <header className="bgp-diff-head">
        <GitCompare size={16} aria-hidden="true" />
        <h2 id="bgp-diff-title">Comparaison des snapshots</h2>
        <button ref={closeButtonRef} type="button" className="bgp-icon-button" onClick={onClose} aria-label="Fermer"><X size={15} /></button>
      </header>

      {/* 1 · verdict */}
      <div className="bgp-verdict" aria-live="polite">
        {verdict === 'impossible' && (
          <div className="bgp-verdict-unreported" data-tone="error">
            <XCircle size={18} aria-hidden="true" />
            <span>
              <strong>Comparaison impossible.</strong> Les données d’au moins un snapshot sont illisibles : ni changement ni stabilité ne peuvent être affirmés.
              {analysis.decodeErrors.length > 0 && <ul className="bgp-verdict-errors">{analysis.decodeErrors.map(e => <li key={e}>{e}</li>)}</ul>}
            </span>
          </div>
        )}
        {verdict === 'identical' && (
          <p className="bgp-verdict-unreported" data-tone="ok"><CheckCircle2 size={18} aria-hidden="true" /><span><strong>Données identiques.</strong> Les 8 listes comparées (préfixes, peers, upstreams, downstreams IPv4/IPv6) sont les mêmes dans les deux snapshots.</span></p>
        )}
        {verdict === 'partial' && (
          <p className="bgp-verdict-unreported"><AlertCircle size={18} aria-hidden="true" /><span><strong>Aucune différence sur les listes comparables.</strong> {notCompared.length} liste{notCompared.length > 1 ? 's' : ''} n’{notCompared.length > 1 ? 'ont' : 'a'} pas pu être comparée{notCompared.length > 1 ? 's' : ''} ({notCompared.map(l => l.label).join(', ')}) : elles ne sont pas déclarées identiques.</span></p>
        )}
        {verdict === 'unreported' && (
          <p className="bgp-verdict-unreported"><AlertCircle size={18} aria-hidden="true" /><span><strong>Aucune différence n’est renvoyée par l’API.</strong> Les listes omises ne peuvent pas être déclarées identiques ou absentes à partir de ce diff.</span></p>
        )}
        {verdict === 'changed' && (
          <>
            <div className="bgp-verdict-figures">
              <span className="is-added"><Plus size={14} aria-hidden="true" /><b>{analysis.added}</b> ajouté{analysis.added > 1 ? 's' : ''}</span>
              <span className="is-removed"><Minus size={14} aria-hidden="true" /><b>{analysis.removed}</b> retiré{analysis.removed > 1 ? 's' : ''}</span>
              {analysis.modified > 0 && <span className="is-modified"><RefreshCw size={13} aria-hidden="true" /><b>{analysis.modified}</b> modifié{analysis.modified > 1 ? 's' : ''}</span>}
            </div>
            <ul className="bgp-verdict-sections" aria-label="Sections modifiées">
              {analysis.sections.map(s => <li key={s.section}>{s.label} <small>+{s.added} / −{s.removed}{s.modified ? ` / ~${s.modified}` : ''}</small></li>)}
            </ul>
            {notCompared.length > 0 && (
              <p className="bgp-verdict-caveat"><AlertCircle size={13} aria-hidden="true" /> Non comparées : {notCompared.map(l => l.label).join(', ')}. Leur état reste inconnu.</p>
            )}
          </>
        )}
      </div>

      {/* 2 · interval, with where each snapshot's data came from */}
      <div className="bgp-diff-span">
        <div data-state="before">
          <span>AVANT · #{older.id}</span>
          <time dateTime={olderAt}>{formatDateTime(olderAt)}</time>
          <ProvenanceNote status={older.provenance_status} map={older.data_provenance} />
        </div>
        <div className="bgp-diff-gap"><ArrowRight size={14} aria-hidden="true" /><small>{formatGap(olderAt, newerAt)}</small></div>
        <div data-state="after">
          <span>APRÈS · #{newer.id}</span>
          <time dateTime={newerAt}>{formatDateTime(newerAt)}</time>
          <ProvenanceNote status={newer.provenance_status} map={newer.data_provenance} />
        </div>
      </div>
      {/* 3 · changes, 4 · raw data */}
      <div className="bgp-diff-body">
        {analysis.sections.map(section => (
          <section key={section.section} className="bgp-diff-section">
            <h3>{section.label}</h3>
            {section.fields.map(field => <FieldBlock key={field.field} field={field} raw={changes[section.section]?.[field.field]} />)}
          </section>
        ))}
        <footer className="bgp-diff-scope">
          {analysis.status !== 'legacy' && (
            <ul className="bgp-list-states" aria-label="État des listes comparées">
              {analysis.lists.map(l => (
                <li key={l.field} data-state={l.state} title={l.detail}>{l.label} <b>{LIST_STATE_LABEL[l.state]}</b></li>
              ))}
            </ul>
          )}
          {analysis.notReported.length > 0 && <p><b>Non renseignées dans ce diff :</b> {analysis.notReported.join(', ')}. L’API omet les listes sans différence et ne précise pas si une liste omise était vide ou identique.</p>}
          <p><b>Non comparés par l’API :</b> nom, pays et registre de l’ASN. Les listes examinées sont les préfixes, peers, upstreams et downstreams IPv4/IPv6.</p>
        </footer>
      </div>
    </section>
  )
}
