import { Activity, Cpu, Shield, User } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AnnotationStatus } from '@/types/cloakAnnotation'

/*
 * Shared pieces for the CLOAK OpSec atlas (styles in cloak26/cloak.css). Purely
 * presentational — the page keeps the data, refs, debounce and API contract.
 * Level and status are always carried by a label, never colour alone. The
 * rainbow of per-tactic colours is dropped: colour here orients by LEVEL
 * (Technical / Behavioral / Physical) and by annotation STATUS only.
 */

export type CloakLevel = 'Technical' | 'Behavioral' | 'Physical'
export const LEVELS: CloakLevel[] = ['Technical', 'Behavioral', 'Physical']
const LEVEL_ICON: Record<CloakLevel, ReactNode> = {
  Technical: <Cpu size={12} aria-hidden="true" />,
  Behavioral: <User size={12} aria-hidden="true" />,
  Physical: <Shield size={12} aria-hidden="true" />,
}
export const levelKey = (type: string): string =>
  type === 'Technical' ? 'tech' : type === 'Behavioral' ? 'behav' : type === 'Physical' ? 'phys' : 'none'

export function LevelMark({ type, short }: { type: string; short?: boolean }) {
  if (!type) return null
  const isKnown = (LEVELS as string[]).includes(type)
  return (
    <span className="ck26-level" data-level={levelKey(type)}>
      {isKnown ? LEVEL_ICON[type as CloakLevel] : <Activity size={12} aria-hidden="true" />}
      {short ? type.charAt(0) : type}
    </span>
  )
}

/* Annotation status: dot + label, readable without colour. */
export const STATUS_LABEL: Record<Exclude<AnnotationStatus, ''>, string> = {
  a_tester: 'À tester',
  vu_en_lab: 'Vu en lab',
  maitrise: 'Maîtrisé',
}
export const STATUS_KEY: Record<Exclude<AnnotationStatus, ''>, string> = {
  a_tester: 'test', vu_en_lab: 'lab', maitrise: 'ok',
}

export function StatusMark({ status, dotOnly }: { status: AnnotationStatus; dotOnly?: boolean }) {
  if (!status) return null
  const s = status as Exclude<AnnotationStatus, ''>
  if (!(s in STATUS_KEY)) return null
  if (dotOnly) return <span className="ck26-statusdot" data-status={STATUS_KEY[s]} title={STATUS_LABEL[s]} aria-label={STATUS_LABEL[s]} />
  return (
    <span className="ck26-status" data-status={STATUS_KEY[s]}>
      <i aria-hidden="true" />{STATUS_LABEL[s]}
    </span>
  )
}

/* Extract only well-formed HTTP(S) links from a procedure description. */
export function procUrl(description?: string): { url?: string; urls: string[]; clean: string } {
  if (!description) return { urls: [], clean: '' }
  const matches = [...description.matchAll(/https?:\/\/[^\s<>"']+/gi)]
  const urls: string[] = []
  let clean = description

  for (const match of matches) {
    let candidate = match[0].replace(/[.,;!?]+$/, '')
    const paired = { ')': '(', ']': '[', '}': '{' } as const
    while (candidate.endsWith(')') || candidate.endsWith(']') || candidate.endsWith('}')) {
      const close = candidate[candidate.length - 1] as keyof typeof paired
      const opens = candidate.split(paired[close]).length - 1
      const closes = candidate.split(close).length - 1
      if (closes <= opens) break
      candidate = candidate.slice(0, -1)
    }
    try {
      const parsed = new URL(candidate)
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname) {
        urls.push(parsed.href)
        clean = clean.replace(match[0], '')
      }
    } catch {
      // Keep malformed URL-like text as regular description text.
    }
  }

  return { url: urls[0], urls: [...new Set(urls)], clean: clean.replace(/\s{2,}/g, ' ').trim() }
}
