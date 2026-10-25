import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import CloakMotif from './CloakMotif'

/*
 * The atlas hero. Stats come only from the loaded data (tactics / techniques).
 * CLOAK is credited sobrely in the index lines; the full attribution and
 * GPL-2.0 licence stay in the page footer.
 */
export default function CloakHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="DOCTRINE / OPSEC ATLAS" title="CLOAK" typeOnce="cloak"
      subtitle="Operational Security — base de connaissances dissimulation : tactiques, techniques et annotations d'analyste."
      motif={<CloakMotif />}
      index={{ label: 'CONCEALMENT MATRIX', lines: ['TACTIQUE → TECHNIQUE', 'SOUS-TECH · PROCÉDURE', 'CLOAK · GPL-2.0'], status }}
    />
  )
}
