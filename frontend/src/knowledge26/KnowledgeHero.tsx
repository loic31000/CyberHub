import { ModuleHero } from '@/hero/ModuleHero'
import KnowledgeMotif from './KnowledgeMotif'
export default function KnowledgeHero({ loaded }: { loaded: number }) {
  return <ModuleHero breadcrumb="INTEL / KNOWLEDGE ATLAS" title="KNOWLEDGE" accent="ATLAS" typeOnce="knowledge-atlas"
    subtitle="Threat Intelligence · Doctrine · Vulnerability · Living-off-the-land" motif={<KnowledgeMotif />}
    index={{ label: 'UNIFIED KNOWLEDGE BASE', lines: ['04 SOURCES', `${loaded.toLocaleString('fr-FR')} LOADED`, 'CVE · ATT&CK', 'CLOAK · LOLBINS'] }} />
}
