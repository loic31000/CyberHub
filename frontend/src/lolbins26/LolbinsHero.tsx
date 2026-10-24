import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import LolbinsMotif from './LolbinsMotif'

/*
 * The catalog and its open analysis panel share this hero, so the page frame
 * never shifts; only the status line says what the page currently knows.
 */
export default function LolbinsHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="INTEL / BINARY INTELLIGENCE" title="LOLBins" accent="& GTFOBins" typeOnce="lolbins"
      subtitle="Catalogue de binaires natifs — exécution détournée, techniques ATT&CK et commandes d'abus."
      motif={<LolbinsMotif />}
      index={{ label: 'NATIVE EXEC', lines: ['WINDOWS · LINUX', 'ATT&CK · CAPACITÉS', 'COMMANDES D’ABUS'], status }}
    />
  )
}
