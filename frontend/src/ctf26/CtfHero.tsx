import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import CtfMotif from './CtfMotif'

/*
 * The same hero on the index, the report and the form, so moving between them
 * never changes its size; only the status line says what each page knows.
 */
export default function CtfHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="OPÉRATIONS / JOURNAL CTF" title="CTF" accent="Writeups" typeOnce="ctf"
      subtitle="Journal d'opérations — plateformes, machines, difficulté et rapports de résolution."
      motif={<CtfMotif />}
      index={{ label: 'JOURNAL CTF', lines: ['CIBLE · TERMINAL', 'PROGRESSION', 'FLAG CAPTURÉ'], status }}
    />
  )
}
