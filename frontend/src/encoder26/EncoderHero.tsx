import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import EncoderMotif from './EncoderMotif'

/*
 * The workspace hero. Transforms run in the browser (pure functions, no
 * network), so the status honestly reads "local / stateless"; the status line
 * also names the active operation.
 */
export default function EncoderHero({ status }: { status?: HeroIndex['status'] }) {
  return (
    <ModuleHero
      breadcrumb="OUTILS / TRANSFORMATION DE DONNÉES" title="Encoder" accent="/ Decoder" typeOnce="encoder"
      subtitle="Console de transformation — Base64, URL, Hex, ROT13, HTML. Calcul dans le navigateur, sans envoi."
      motif={<EncoderMotif />}
      index={{ label: 'TRANSFORM', lines: ['INPUT → PROC → OUTPUT', 'BASE64 · URL · HEX', 'ROT13 · HTML'], status }}
    />
  )
}
