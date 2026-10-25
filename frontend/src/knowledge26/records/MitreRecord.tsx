import { useEffect, useState } from 'react'
import { mitreApi } from '@/api/client'
import type { MITRETechnique } from '@/types'
import { parseMitre } from '@/lolbins26/parts'
import type { LOLBin } from '@/types/lolbins'
import { cleanList, cleanText, type KnowledgeItem } from '../model'
import { Fact, Facts, Prose, RefButton, Section, Subhead, type RecordContext } from './parts'

/*
 * ATT&CK dossier: description, classification, detection and data sources,
 * then relations navigable inside Atlas — parent, sub-techniques (fetched by
 * ID prefix so they are complete even when not on a loaded page) and the
 * LOLBins that implement the technique.
 */

type Subs = { status: 'loading' | 'error' } | { status: 'ready'; list: { id: string; name: string }[] }

export default function MitreRecord({ item, ctx, enriched, pending, failed }: {
  item: KnowledgeItem; ctx: RecordContext; enriched?: MITRETechnique | null; pending?: boolean; failed?: boolean
}) {
  const t = (enriched ?? item.original) as MITRETechnique
  const [subs, setSubs] = useState<Subs>({ status: 'loading' })
  const isSub = !!t.is_subtechnique
  const parentId = cleanText(t.parent_id)
  const description = cleanText(t.description), detection = cleanText(t.detection)

  useEffect(() => {
    if (isSub) return
    let active = true
    setSubs({ status: 'loading' })
    const prefix = `${item.id}.`
    const loaded = ctx.allItems.filter(other => other.source === 'MITRE' && other.id.startsWith(prefix)).map(other => ({ id: other.id, name: other.title }))
    mitreApi.techniques({ q: prefix, page: 1, limit: 100 })
      .then(result => {
        if (!active) return
        const byId = new Map(loaded.map(sub => [sub.id, sub]))
        for (const technique of result.items ?? []) if (technique.technique_id.startsWith(prefix)) byId.set(technique.technique_id, { id: technique.technique_id, name: technique.name })
        setSubs({ status: 'ready', list: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'fr', { numeric: true })) })
      })
      .catch(() => { if (active) setSubs(loaded.length ? { status: 'ready', list: loaded } : { status: 'error' }) })
    return () => { active = false }
  // The loaded collection only seeds the list; refetch when the technique changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.key, isSub])

  const lolbins = ctx.allItems.filter(other => other.source === 'LOLBINS' && parseMitre((other.original as LOLBin).mitre_tech).some(id => id === item.id || id.startsWith(`${item.id}.`) || (isSub && !!parentId && id === parentId)))
  const sources = cleanList(t.data_sources)

  return <>
    <Section index="01" title="OVERVIEW" aside={pending ? 'chargement…' : undefined}>
      <Prose>{description || 'Description non disponible dans cet extrait.'}</Prose>
      {failed && <p role="status" className="ka-dossier-note">Fiche détaillée indisponible. Le lien vers ATT&amp;CK reste accessible.</p>}
      <Facts>
        <Fact label="Tactiques">{item.metadata.find(m => m[0] === 'Tactiques')?.[1] || '—'}</Fact>
        <Fact label="Plateformes">{item.metadata.find(m => m[0] === 'Plateformes')?.[1] || '—'}</Fact>
        <Fact label="Niveau">{isSub ? 'Sous-technique' : 'Technique'}</Fact>
        {isSub && parentId && <Fact label="Technique parent"><RefButton id={parentId} onClick={() => ctx.onOpenRef('MITRE', parentId)} /></Fact>}
      </Facts>
    </Section>

    <Section index="02" title="INTELLIGENCE">
      <Subhead>Détection</Subhead>
      {detection ? <Prose>{detection}</Prose> : <p className="ka-empty-note">Non renseignée.</p>}
      <Subhead count={sources.length || undefined}>Sources de données</Subhead>
      {sources.length ? <ul className="ka-chip-list">{sources.map(value => <li key={value}>{value}</li>)}</ul> : <p className="ka-empty-note">Non renseignées.</p>}
    </Section>

    <Section index="03" title="RELATIONS">
      {!isSub && <>
        <Subhead count={subs.status === 'ready' ? subs.list.length : undefined}>Sous-techniques</Subhead>
        {subs.status === 'loading' && <p className="ka-empty-note">Recherche des sous-techniques…</p>}
        {subs.status === 'error' && <p className="ka-empty-note">Sous-techniques indisponibles (erreur réseau).</p>}
        {subs.status === 'ready' && (subs.list.length
          ? <ul className="ka-ref-list">{subs.list.map(sub => <li key={sub.id}><RefButton id={sub.id} label={sub.name} onClick={() => ctx.onOpenRef('MITRE', sub.id)} /></li>)}</ul>
          : <p className="ka-empty-note">Aucune sous-technique.</p>)}
      </>}
      <Subhead count={lolbins.length}>LOLBins associés</Subhead>
      {lolbins.length
        ? <ul className="ka-ref-list">{lolbins.map(bin => <li key={bin.key}><RefButton id={bin.id} label={`${(bin.original as LOLBin).os === 'linux' ? 'Linux' : 'Windows'} · ${bin.categories[0]}`} onClick={() => ctx.onOpen(bin)} /></li>)}</ul>
        : <p className="ka-empty-note">Aucun binaire du catalogue n’est rattaché à cette technique.</p>}
    </Section>
  </>
}
