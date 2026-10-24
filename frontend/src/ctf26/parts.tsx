import { Children, isValidElement, useState, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, CheckCircle2, Circle, Copy, Flag } from 'lucide-react'
import type { CTFDifficulty, CTFPlatform } from '@/types'

/* Labels and ordering shared by the index, the report and the form. Colour is never the only carrier: each mark keeps its text. */
export const PLATFORMS: CTFPlatform[] = ['TryHackMe', 'HackTheBox', 'Root-Me', 'PicoCTF', 'Autre']
export const DIFFICULTIES: CTFDifficulty[] = ['easy', 'medium', 'hard', 'insane']
export const DIFF_LABEL: Record<CTFDifficulty, string> = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile', insane: 'Insane' }
export const DIFF_RANK: Record<CTFDifficulty, number> = { easy: 1, medium: 2, hard: 3, insane: 4 }
export const PLATFORM_KEY: Record<CTFPlatform, string> = {
  TryHackMe: 'thm', HackTheBox: 'htb', 'Root-Me': 'rootme', PicoCTF: 'pico', Autre: 'other',
}

export const splitList = (v?: string) => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : [])
export const diffOf = (d: string): CTFDifficulty => (DIFFICULTIES.includes(d as CTFDifficulty) ? (d as CTFDifficulty) : 'medium')
export const platformOf = (p: string): CTFPlatform => (PLATFORMS.includes(p as CTFPlatform) ? (p as CTFPlatform) : 'Autre')

export function PlatformMark({ platform }: { platform: CTFPlatform }) {
  return <span className="ct26-plat" data-plat={PLATFORM_KEY[platform]}><i aria-hidden="true" />{platform}</span>
}

/* Difficulty as a four-step meter plus its label, so the level reads without relying on colour. */
export function DifficultyMark({ difficulty }: { difficulty: CTFDifficulty }) {
  const rank = DIFF_RANK[difficulty]
  return (
    <span className="ct26-diff" data-diff={difficulty}>
      <span className="ct26-diff-meter" aria-hidden="true">
        {[1, 2, 3, 4].map(i => <i key={i} data-on={i <= rank} />)}
      </span>
      {DIFF_LABEL[difficulty]}
    </span>
  )
}

export function StatusMark({ completed }: { completed: boolean }) {
  return completed
    ? <span className="ct26-status is-done"><CheckCircle2 size={14} aria-hidden="true" />Terminé</span>
    : <span className="ct26-status is-wip"><Circle size={14} aria-hidden="true" />En cours</span>
}

/* Flags: sensitive parts of the writeup — distinct, readable, no flashy effect, no auto-copy. */
export function FlagList({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null
  return (
    <ul className="ct26-flags" aria-label="Flags">
      {flags.map((f, i) => (
        <li key={i}><Flag size={12} aria-hidden="true" /><code>{f}</code></li>
      ))}
    </ul>
  )
}

/* ---------- Markdown, the main body of the report ---------- */

const isComment = (line: string) => /^\s*(#|\/\/|REM\s|::)/i.test(line)

function CodeBlock({ language, text }: { language?: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const lines = text.replace(/\n$/, '').split('\n')
  const copy = () => {
    const writeText = navigator.clipboard?.writeText
    if (!writeText) return
    void writeText.call(navigator.clipboard, text.replace(/\n$/, ''))
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600) })
      .catch(() => {})
  }
  return (
    <figure className="ct26-code">
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
 * Fenced blocks are taken at the <pre> level (one <figure>, no nested <pre>),
 * so a block without a language is a command block too, not inline code.
 * The report body is h2+; Markdown headings sit below at h3/h4.
 */
const MD_COMPONENTS: Components = {
  pre({ children }) {
    const child = Children.toArray(children).find(isValidElement) as ReactElement<{ className?: string; children?: ReactNode }> | undefined
    const language = child?.props.className?.replace(/^language-/, '')
    return <CodeBlock language={language} text={String(child?.props.children ?? '')} />
  },
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  h4: ({ children }) => <h5>{children}</h5>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
  table: ({ children }) => <div className="ct26-table-wrap"><table>{children}</table></div>,
}

export function Markdown({ children }: { children: string }) {
  return <div className="ct26-md"><ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{children}</ReactMarkdown></div>
}
