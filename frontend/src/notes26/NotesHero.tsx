import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import NotesMotif from './NotesMotif'

/*
 * The registre, the open note and the editor share this hero, so the page
 * frame never shifts; only the status line says what the page currently knows.
 */
export default function NotesHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="INVESTIGATION / CARNET OPÉRATIONNEL" title="Notes" typeOnce="notes"
      subtitle="Carnet opérationnel — contexte, tags et références liées aux IOC, techniques ATT&CK et CVE."
      motif={<NotesMotif />}
      index={{ label: 'NOTEBOOK', lines: ['NOTE · TAGS', 'IOC · ATT&CK · CVE', 'IMPORT / EXPORT'], status }}
    />
  )
}
