import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import CheatsheetsMotif from './CheatsheetsMotif'

/*
 * The index and the open command workspace share this hero, so the page frame
 * never shifts; only the status line says what the page currently knows.
 */
export default function CheatsheetsHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="RÉFÉRENCE / BIBLIOTHÈQUE DE COMMANDES" title="Cheatsheets" typeOnce="cheatsheets"
      subtitle="Bibliothèque de commandes — variables à renseigner, ligne finale prête à copier."
      motif={<CheatsheetsMotif />}
      index={{ label: 'COMMAND LIB', lines: ['FICHES · COMMANDES', 'VARIABLES {…}', 'LIGNE FINALE'], status }}
    />
  )
}
