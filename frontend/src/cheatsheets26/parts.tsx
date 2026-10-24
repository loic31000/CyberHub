import { useMemo, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import type { CheatsheetCommand } from '@/types/cheatsheet'

/*
 * Shared pieces for the Cheatsheets command library (styles in
 * cheatsheets26/cheatsheets.css). The substitution syntax is untouched: a
 * placeholder is `{name}`, replaced by its value, left as `{name}` while
 * empty. The frontend only displays and copies text — nothing is executed.
 */

/* Replace every `{v}` with its value, or leave the placeholder when empty. */
export function renderCommand(cmd: CheatsheetCommand, values: Record<string, string>): string {
  return cmd.vars.reduce((acc, v) => acc.split(`{${v}}`).join(values[v] || `{${v}}`), cmd.cmd)
}

/*
 * The final command split into tokens so filled values and still-empty
 * placeholders read differently — the copied text stays the plain string.
 */
type Token = { text: string; kind: 'text' | 'filled' | 'empty' }
function tokenize(cmd: CheatsheetCommand, values: Record<string, string>): Token[] {
  if (cmd.vars.length === 0) return [{ text: cmd.cmd, kind: 'text' }]
  const re = new RegExp(`\\{(${cmd.vars.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\}`, 'g')
  const tokens: Token[] = []
  let last = 0
  for (let m = re.exec(cmd.cmd); m; m = re.exec(cmd.cmd)) {
    if (m.index > last) tokens.push({ text: cmd.cmd.slice(last, m.index), kind: 'text' })
    const val = values[m[1]]
    tokens.push(val ? { text: val, kind: 'filled' } : { text: m[0], kind: 'empty' })
    last = m.index + m[0].length
  }
  if (last < cmd.cmd.length) tokens.push({ text: cmd.cmd.slice(last), kind: 'text' })
  return tokens
}

function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(text)
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800) })
      .catch(() => {})
  }
  return (
    <button type="button" className="cs26-copy" data-copied={copied || undefined} onClick={copy} aria-label={copied ? 'Copié' : label}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{copied ? 'Copié' : 'Copier'}</span>
    </button>
  )
}

/* One command: title, its variables grouped, and the final line made prominent. */
export function CommandCard({ cmd, index }: { cmd: CheatsheetCommand; index: number }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(cmd.vars.map(v => [v, ''])))
  const rendered = useMemo(() => renderCommand(cmd, values), [cmd, values])
  const tokens = useMemo(() => tokenize(cmd, values), [cmd, values])
  const filledCount = cmd.vars.filter(v => values[v]).length
  const titleId = `cs26-cmd-${index}`

  return (
    <article className="cs26-cmd" aria-labelledby={titleId}>
      <header className="cs26-cmd-head">
        <h4 id={titleId}>{cmd.title}</h4>
        {cmd.vars.length > 0 && (
          <span className="cs26-cmd-count">{filledCount}/{cmd.vars.length} variable{cmd.vars.length > 1 ? 's' : ''}</span>
        )}
      </header>

      {cmd.vars.length > 0 && (
        <div className="cs26-vars">
          {cmd.vars.map((v) => {
            const inputId = `${titleId}-var-${v}`
            return (
              <div key={v} className="cs26-var" data-filled={Boolean(values[v]) || undefined}>
                <label htmlFor={inputId}>{v}</label>
                <input
                  id={inputId} type="text" value={values[v]} placeholder={`{${v}}`}
                  onChange={e => setValues(prev => ({ ...prev, [v]: e.target.value }))}
                  autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                />
              </div>
            )
          })}
        </div>
      )}

      <div className="cs26-final">
        <pre tabIndex={0} aria-label="Commande générée"><code>
          {tokens.map((t, i): ReactNode => t.kind === 'text'
            ? t.text
            : <span key={i} className={t.kind === 'empty' ? 'cs26-tok-empty' : 'cs26-tok-filled'}>{t.text}</span>)}
        </code></pre>
        <CopyButton text={rendered} label={`Copier la commande ${cmd.title}`} />
      </div>
    </article>
  )
}
