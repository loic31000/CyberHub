import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import CveMotif from './CveMotif'

/*
 * The same hero on the index, the detail and the form, so moving between them
 * never changes its size; only the status line says what each page knows.
 */
export default function CveHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="INTEL / VULNERABILITY INTELLIGENCE" title="CVE" accent="& KEV" typeOnce="cve"
      subtitle="Veille des vulnérabilités — sévérité CVSS, exploitation KEV, probabilité EPSS."
      motif={<CveMotif />}
      index={{ label: 'VULN INTEL', lines: ['CVE · CVSS', 'CISA KEV', 'EPSS · FIRST.ORG'], status }}
    />
  )
}
