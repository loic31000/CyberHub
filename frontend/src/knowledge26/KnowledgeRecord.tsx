import type { ReactNode } from 'react'
import type { MITRETechnique } from '@/types'
import type { CISAKEVEntry, EPSSScore } from '@/types/threat_intel'
import type { KnowledgeItem } from './model'
import type { RecordContext } from './records/parts'
import CveRecord, { type Enrichment } from './records/CveRecord'
import MitreRecord from './records/MitreRecord'
import CloakRecord from './records/CloakRecord'
import LolbinRecord from './records/LolbinRecord'

/*
 * The complete record of one knowledge item, rendered only in the central
 * dossier (Carousel cards stay bounded previews). Each source has its own
 * editorial sheet under records/; they share the same section language.
 */

export interface KnowledgeRecordProps {
  item: KnowledgeItem
  ctx: RecordContext
  /** Detailed ATT&CK sheet, once the dossier has fetched it. */
  enriched?: MITRETechnique | null
  pending?: boolean
  failed?: boolean
  kev?: Enrichment<CISAKEVEntry>
  epss?: Enrichment<EPSSScore>
  /** CLOAK analyst section content (annotation view or editor). */
  analyst?: ReactNode
}

export default function KnowledgeRecord({ item, ctx, enriched, pending, failed, kev, epss, analyst }: KnowledgeRecordProps) {
  if (item.source === 'CVE') return <CveRecord item={item} kev={kev} epss={epss} />
  if (item.source === 'MITRE') return <MitreRecord item={item} ctx={ctx} enriched={enriched} pending={pending} failed={failed} />
  if (item.source === 'LOLBINS') return <LolbinRecord item={item} ctx={ctx} />
  return <CloakRecord item={item} ctx={ctx} analyst={analyst} />
}
