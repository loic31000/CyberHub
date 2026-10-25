import { useState, useMemo } from 'react'
import { AlertTriangle, ArrowLeftRight, ArrowRight, Check, Copy, Trash2 } from 'lucide-react'
import { OPERATIONS, GROUPS, transform } from '@/types/encoder'
import type { EncoderGroup, EncoderOperation } from '@/types/encoder'
import { toast } from '@/store/toast'
import EncoderHero from '@/encoder26/EncoderHero'
import '@/encoder26/encoder.css'

/* Short help per family, kept from the previous quick-reference (data unchanged). */
const QUICK_REF: { group: EncoderGroup; ex: string }[] = [
  { group: 'Base64', ex: 'Hello ⇄ SGVsbG8=' },
  { group: 'URL', ex: 'a b ⇄ a%20b' },
  { group: 'Hex', ex: 'Hi ⇄ 4869' },
  { group: 'ROT13', ex: 'Hello → Uryyb' },
  { group: 'HTML', ex: '<b> ⇄ &lt;b&gt;' },
]

export default function EncoderDecoder() {
  const [input, setInput] = useState('')
  const [activeOp, setActiveOp] = useState<EncoderOperation>('base64-encode')
  const [copied, setCopied] = useState(false)

  const result = useMemo(() => transform(activeOp, input), [activeOp, input])
  const activeConfig = OPERATIONS.find(o => o.id === activeOp)!
  const canUseOutput = Boolean(result.output) && !result.error

  const handleCopy = () => {
    if (!canUseOutput) return
    navigator.clipboard?.writeText(result.output)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
        toast.success('Copié dans le presse-papiers')
      })
      .catch(() => {})
  }
  const handleSwap = () => { if (canUseOutput) setInput(result.output) }
  const handleClear = () => setInput('')

  return (
    <div className="en26">
      <div className="en26-frame">
        <EncoderHero status={{ text: `${activeConfig.group.toUpperCase()} · ${activeConfig.label.toUpperCase()}`, mark: 'LOCAL' }} />

        {/* Operation selector: one row per family, operations as a segment. */}
        <section className="en26-ops" aria-label="Opération">
          <span className="en26-ops-title">Opération</span>
          <div className="en26-ops-grid">
            {GROUPS.map(group => {
              const ops = OPERATIONS.filter(o => o.group === group)
              return (
                <div key={group} className="en26-fam" role="group" aria-label={group}>
                  <span className="en26-fam-label">{group}</span>
                  <div className="en26-seg">
                    {ops.map(op => (
                      <button key={op.id} type="button" className="en26-seg-btn"
                        aria-pressed={activeOp === op.id}
                        aria-label={`${group} ${op.label}`}
                        onClick={() => setActiveOp(op.id)}>
                        {activeOp === op.id && <Check size={13} aria-hidden="true" />}{op.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Workspace: INPUT → active operation → OUTPUT. */}
        <section className="en26-workspace" aria-label="Transformation">
          <div className="en26-pane">
            <div className="en26-pane-head">
              <h2 className="en26-pane-title">Input</h2>
              <div className="en26-pane-tools">
                <span className="en26-count">{input.length.toLocaleString('fr-FR')} car.</span>
                <button type="button" className="en26-tool" onClick={handleClear} disabled={!input}>
                  <Trash2 size={13} aria-hidden="true" /> Clear
                </button>
              </div>
            </div>
            <label className="en26-sr" htmlFor="en26-input">Texte à transformer</label>
            <textarea id="en26-input" className="en26-area" value={input}
              onChange={e => setInput(e.target.value)} placeholder="Entrez ou collez votre texte ici…"
              spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          </div>

          <div className="en26-pivot" aria-hidden="true">
            <span className="en26-pivot-op">{activeConfig.group} · {activeConfig.label}</span>
            <ArrowRight className="en26-pivot-arrow" size={18} />
          </div>

          <div className="en26-pane" data-error={result.error ? true : undefined}>
            <div className="en26-pane-head">
              <h2 className="en26-pane-title">Output</h2>
              <div className="en26-pane-tools">
                {!result.error && <span className="en26-count">{result.output.length.toLocaleString('fr-FR')} car.</span>}
                <button type="button" className="en26-tool" onClick={handleSwap} disabled={!canUseOutput}
                  title="Déplacer l'output vers l'input">
                  <ArrowLeftRight size={13} aria-hidden="true" /> Swap
                </button>
                <button type="button" className="en26-tool is-copy" data-copied={copied || undefined}
                  onClick={handleCopy} disabled={!canUseOutput}>
                  {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>
            <label className="en26-sr" htmlFor="en26-output">Résultat</label>
            {result.error ? (
              <div className="en26-error" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <p className="en26-error-title">Transformation impossible</p>
                  <p className="en26-error-msg">{result.error}</p>
                </div>
              </div>
            ) : (
              <textarea id="en26-output" className="en26-area is-output" value={result.output} readOnly
                placeholder="Le résultat apparaît ici…" spellCheck={false} />
            )}
          </div>
        </section>

        {/* Quick reference: secondary, collapsible. */}
        <details className="en26-ref">
          <summary>
            <span>Référence rapide</span>
            <span className="en26-ref-hint">{OPERATIONS.length} opérations · Base64, URL, Hex, ROT13, HTML</span>
          </summary>
          <ul className="en26-ref-list">
            {QUICK_REF.map(({ group, ex }) => (
              <li key={group}><span className="en26-ref-fam">{group}</span><code>{ex}</code></li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}
