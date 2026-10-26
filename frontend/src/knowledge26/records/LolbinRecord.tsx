import type { LOLBin } from '@/types/lolbins'
import { CopyButton, OsMark, PrivMark, getCommandDesc, getCommandPriv, getCommandText, getCommandType, parseCommands, parseMitre, parseTags } from '@/lolbins26/parts'
import Learn from '@/learning/Learn'
import type { LearningEvidence } from '@/learning/types'
import type { KnowledgeItem } from '../model'
import { Fact, Facts, Prose, RefButton, Section, Subhead, type RecordContext } from './parts'

/*
 * LOLBins dossier: description, classification (OS, category, full path),
 * every associated ATT&CK technique as an internal Atlas link, tags, then
 * every documented command with the robust copy control of the LOLBins
 * module. Commands are displayed and copied, never executed.
 */

/* Learning evidence (#78): only what this record holds, with its reference as source. */
function lolbinEvidence(bin: LOLBin, category: string, mitre: string[], tags: string[], commands: number): LearningEvidence[] {
  const referential = bin.os === 'linux' ? 'GTFOBins' : 'LOLBAS'
  return [
    { label: 'OS', value: bin.os === 'linux' ? 'Linux' : 'Windows', source: referential },
    ...(category ? [{ label: 'Catégorie', value: category }] : []),
    ...(bin.full_path?.trim() ? [{ label: 'Chemin', value: bin.full_path }] : []),
    ...(mitre.length ? [{ label: 'Techniques ATT&CK liées', value: mitre.join(', ') }] : []),
    ...(tags.length ? [{ label: 'Tags', value: tags.join(', ') }] : []),
    ...(commands ? [{ label: 'Commandes documentées', value: String(commands) }] : []),
  ]
}

export default function LolbinRecord({ item, ctx }: { item: KnowledgeItem; ctx: RecordContext }) {
  const bin = item.original as LOLBin
  const commands = parseCommands(bin.commands)
  const mitre = parseMitre(bin.mitre_tech)
  const tags = parseTags(bin.tags)
  const titleOf = (id: string) => ctx.allItems.find(other => other.source === 'MITRE' && other.id === id)?.title

  return <>
    <Section index="01" title="OVERVIEW">
      <Prose>{bin.description?.trim() || 'Description non disponible.'}</Prose>
      <Facts>
        <Fact label="OS"><OsMark os={bin.os} long /></Fact>
        <Fact label="Catégorie">{item.categories[0]}</Fact>
        <Fact label="Référentiel">{bin.os === 'linux' ? 'GTFOBins' : 'LOLBAS'}</Fact>
        <Fact label="Chemin" span><code className="ka-path">{bin.full_path || '—'}</code></Fact>
      </Facts>
      <Learn id="lolbin" evidence={lolbinEvidence(bin, item.categories[0] === 'Non classé' ? '' : item.categories[0], mitre, tags, commands.length)} />
    </Section>

    <Section index="02" title="MAPPING" lead="Techniques ATT&CK liées et tags du référentiel.">
      <Subhead count={mitre.length}>Techniques ATT&amp;CK</Subhead>
      {mitre.length
        ? <ul className="ka-ref-list">{mitre.map(id => <li key={id}><RefButton id={id} label={titleOf(id)} onClick={() => ctx.onOpenRef('MITRE', id)} /></li>)}</ul>
        : <p className="ka-empty-note">Aucune technique ATT&amp;CK associée.</p>}
      <Subhead count={tags.length}>Tags</Subhead>
      {tags.length ? <ul className="ka-chip-list">{tags.map(tag => <li key={tag}>{tag}</li>)}</ul> : <p className="ka-empty-note">Aucun tag.</p>}
    </Section>

    <Section index="03" title="COMMANDS" aside={`Commandes · ${commands.length}`} lead="Usages documentés par le référentiel, affichés et copiables, jamais exécutés.">
      {commands.length ? <ol className="ka-commands">{commands.map((command, index) => {
        const text = getCommandText(command), type = getCommandType(command), priv = getCommandPriv(command), desc = getCommandDesc(command)
        return <li key={index}>
          <header><span className="ka-command-index">{String(index + 1).padStart(2, '0')}</span><h5>{type || `Commande ${index + 1}`}</h5>{priv && <PrivMark priv={priv} />}</header>
          {desc && <p>{desc}</p>}
          <div className="ka-command-line"><pre tabIndex={0} aria-label={`Commande ${type || index + 1}`}><code>{text}</code></pre><CopyButton text={text} label={`Copier la commande ${type || index + 1}`} /></div>
        </li>
      })}</ol> : <p className="ka-empty-note">Aucune commande documentée.</p>}
    </Section>
  </>
}
