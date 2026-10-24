import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import InvMotif from './InvMotif'

/*
 * The same hero on the case list and on a case, so moving between them never
 * changes its size; only the status line says what each page knows.
 */
export default function InvHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="OPS / CASE MANAGEMENT" title="INVESTIGATIONS" typeOnce="investigations"
      subtitle="Dossiers d’enquête — chronologie des faits, sources et preuves rattachées."
      motif={<InvMotif />}
      index={{ label: 'CASE FILES', lines: ['DOSSIERS', 'CHRONOLOGIE', 'SOURCES · PREUVES'], status }}
    />
  )
}
