import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import PbMotif from './PbMotif'

/*
 * The same hero on the index, a playbook and the editor, so moving between
 * them never changes its size; only the status line says what each page knows.
 */
export default function PbHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="OPS / INCIDENT RESPONSE" title="PLAYBOOKS" typeOnce="playbooks"
      subtitle="Procédures de réponse à incident — checklists suivies étape par étape."
      motif={<PbMotif />}
      index={{ label: 'RUNBOOKS', lines: ['SCÉNARIOS', 'CHECKLISTS', 'PROGRESSION'], status }}
    />
  )
}
