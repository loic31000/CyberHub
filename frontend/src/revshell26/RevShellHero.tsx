import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import RevShellMotif from './RevShellMotif'

/*
 * The console hero. Generation runs via the backend over a single GET; the
 * status line recalls the active OS, language and encoding from what the page
 * already knows.
 */
export default function RevShellHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="OUTILS / PAYLOAD BUILDER" title="Reverse Shell" accent="Generator" typeOnce="revshell"
      subtitle="Console de génération — reverse shells pour CTF, labs isolés et tests autorisés."
      motif={<RevShellMotif />}
      index={{ label: 'PAYLOAD BUILDER', lines: ['LHOST : LPORT', 'LANGAGE · OS', 'PAYLOAD · LISTENER'], status }}
    />
  )
}
