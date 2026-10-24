import { Children, isValidElement, useState, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { Check, Copy, Globe, Monitor, Terminal } from 'lucide-react'
import type { EthicalLevel, Tool, ToolCategory, ToolOS } from '@/types'

/* Labels shared by the list, the sheet and the form. Colour is never the only carrier: each mark has its text. */
export const CATEGORY_LABEL: Record<ToolCategory, string> = { offensive: 'Offensif', defensive: 'Défensif', osint: 'OSINT' }
export const CATEGORY_CODE: Record<ToolCategory, string> = { offensive: 'OFF', defensive: 'DEF', osint: 'INT' }
export const OS_LABEL: Record<ToolOS, string> = { windows: 'Windows', linux: 'Linux', both: 'Windows + Linux' }
export const ETHIC_LABEL: Record<EthicalLevel, string> = { standard: 'Standard', elevated: 'Audit autorisé', warning: 'Pédagogique' }
export const ETHIC_HINT: Record<EthicalLevel, string> = {
  standard: 'Usage défensif, forensics ou OSINT pur.',
  elevated: 'Légal en bug bounty ou audit autorisé ; notes légales attendues.',
  warning: 'Référencé à titre pédagogique ; rappel Art. 323-1 du Code pénal.',
}

export const splitTags = (tags?: string) => (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [])
export const ethicOf = (tool: Pick<Tool, 'ethical_level'>): EthicalLevel => tool.ethical_level || 'standard'

export function CategoryMark({ category }: { category: ToolCategory }) {
  return <span className="tl26-cat" data-cat={category}><i aria-hidden="true" />{CATEGORY_LABEL[category] ?? category}</span>
}

export function OsMark({ os }: { os: ToolOS }) {
  const Icon = os === 'windows' ? Monitor : os === 'linux' ? Terminal : Globe
  return <span className="tl26-os"><Icon size={13} aria-hidden="true" />{OS_LABEL[os] ?? os}</span>
}

export function EthicMark({ level }: { level: EthicalLevel }) {
  return (
    <span className="tl26-ethic" data-ethic={level} title={ETHIC_HINT[level]}>
      <i aria-hidden="true" />Éthique : {ETHIC_LABEL[level] ?? level}
    </span>
  )
}

/* ---------- Markdown with readable command blocks ---------- */

/* Shell and script comments keep their own colour, as on the previous sheet. */
const isComment = (line: string) => /^\s*(#|\/\/|REM\s|::)/i.test(line)

function CodeBlock({ language, text }: { language?: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const lines = text.replace(/\n$/, '').split('\n')
  const copy = () => {
    navigator.clipboard?.writeText(text.replace(/\n$/, ''))
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600) })
      .catch(() => {})
  }
  return (
    <figure className="tl26-code">
      <figcaption>
        <span>{language || 'commande'}</span>
        <button type="button" onClick={copy} aria-label={copied ? 'Copié' : 'Copier le bloc'}>
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </figcaption>
      <pre tabIndex={0}><code>
        {lines.map((line, i) => (
          <span key={i} className={isComment(line) ? 'is-comment' : undefined}>{line || ' '}{'\n'}</span>
        ))}
      </code></pre>
    </figure>
  )
}

/*
 * Fenced blocks are taken at the <pre> level, so a block without a language
 * (```` ``` ````) is a command block too, not inline code.
 */
const MD_COMPONENTS: Components = {
  pre({ children }) {
    const child = Children.toArray(children).find(isValidElement) as ReactElement<{ className?: string; children?: ReactNode }> | undefined
    const language = child?.props.className?.replace(/^language-/, '')
    return <CodeBlock language={language} text={String(child?.props.children ?? '')} />
  },
  /* Sheet sections are h3: Markdown headings sit below them. */
  h1: ({ children }) => <h4>{children}</h4>,
  h2: ({ children }) => <h4>{children}</h4>,
  h3: ({ children }) => <h5>{children}</h5>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
}

export function Markdown({ children }: { children: string }) {
  return <div className="tl26-md"><ReactMarkdown components={MD_COMPONENTS}>{children}</ReactMarkdown></div>
}
