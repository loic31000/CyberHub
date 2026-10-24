import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import CorrMotif from './CorrMotif'

/* The shared CyberHub hero; only the status line says what the page knows. */
export default function CorrHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="OPS / CORRELATION ENGINE" title="CORRÉLATION" typeOnce="correlation"
      subtitle="Rapprochement d’un indicateur avec MITRE ATT&CK, les CVE, les playbooks et les données locales."
      motif={<CorrMotif />}
      index={{ label: 'CORRELATION', lines: ['INDICATEURS', 'MITRE ATT&CK', 'CVE · PLAYBOOKS'], status }}
    />
  )
}
