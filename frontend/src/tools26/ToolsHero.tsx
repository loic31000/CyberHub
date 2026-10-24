import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import ToolsMotif from './ToolsMotif'

/*
 * The same hero on the list, the sheet and the form, so moving between them
 * never changes its size; only the status line says what each page knows.
 */
export default function ToolsHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="ARSENAL / BIBLIOTHÈQUE TECHNIQUE" title="Outils" accent="& Arsenal" typeOnce="tools"
      subtitle="Fiches opérationnelles — installation, commandes, contre-mesures et cadre d'emploi."
      motif={<ToolsMotif />}
      index={{ label: 'ARSENAL', lines: ['OFFENSIF · DÉFENSIF', 'OSINT', 'WINDOWS · LINUX'], status }}
    />
  )
}
