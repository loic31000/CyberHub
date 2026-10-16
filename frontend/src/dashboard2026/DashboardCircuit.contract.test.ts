import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildBoard, journeyKeyframes, LAYERS, type ModuleFeed, type Rect } from './DashboardCircuit'
import MITRE from './__fixtures__/mitre-feed.json'

/*
 * The circuit engine is shared with the module pages (ModuleCircuit, MITRE).
 * `buildBoard` is pure: for fixed rectangles it must keep producing the same
 * drawing. The fingerprints below were taken on the engine before any
 * refactoring; a change means the drawing changed, on purpose or not.
 */
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)

// A desktop Dashboard: hero, environment, five widgets (the globe among them), footer.
const DESKTOP: Rect[] = [
  { x: 28, y: 24, w: 1224, h: 120, role: 'hero' },
  { x: 28, y: 176, w: 1224, h: 128, role: 'env' },
  { x: 28, y: 368, w: 604, h: 452, role: 'widget', globe: true },
  { x: 656, y: 368, w: 290, h: 300, role: 'widget' },
  { x: 962, y: 368, w: 290, h: 240, role: 'widget' },
  { x: 962, y: 632, w: 290, h: 260, role: 'widget' },
  { x: 28, y: 916, w: 1224, h: 76, role: 'widget' },
  { x: 28, y: 1024, w: 1224, h: 40, role: 'foot' },
]
// A phone: everything in one column.
const PHONE: Rect[] = [
  { x: 16, y: 16, w: 328, h: 200, role: 'hero' },
  { x: 16, y: 240, w: 328, h: 420, role: 'env' },
  { x: 16, y: 690, w: 328, h: 380, role: 'widget', globe: true },
  { x: 16, y: 1090, w: 328, h: 280, role: 'widget' },
  { x: 16, y: 1390, w: 328, h: 90, role: 'widget' },
]
// A module page layout with a feed argument, as ModuleCircuit passes it (see the note in the first test).
const MODULE_OBSTACLES: Rect[] = [
  { x: 40, y: 24, w: 1200, h: 150, role: 'hero' },
  { x: 40, y: 330, w: 760, h: 420 },
  { x: 830, y: 330, w: 410, h: 420 },
]
const FEED: ModuleFeed = {
  clearAbove: 174,
  link: { x: 860, y: 164, w: 96, h: 18, variant: 'a', pins: [878, 908, 938], dummies: [], top: 150, bottom: 186 },
  heroPaths: [878, 908, 938].map((x) => [{ x, y: 120 }, { x, y: 164 }]),
  chip: { x: 1060, y: 60, w: 120, h: 80 },
  relayTop: 220,
  keepout: [{ x: 40, y: 330, w: 1200, h: 420 }],
  schedule: { cycle: 10.8, start: 0, trip: 3 },
  avoid: [{ x: 40, y: 190, w: 600, h: 60 }],
  spots: [{ dx: 0, top: 220 }, { dx: 24, top: 226 }],
}

describe('moteur de circuit partagé — contrat', () => {
  const desktop = buildBoard(1280, 1100, DESKTOP)
  const phone = buildBoard(360, 1500, PHONE)
  const module = buildBoard(1280, 900, MODULE_OBSTACLES, MODULE_OBSTACLES, null, 260, FEED)

  it('produit chaque couche, des trajets bornés et une clé de dessin', () => {
    for (const g of [desktop, phone, module]) {
      expect(Object.keys(g.layers).sort()).toEqual([...LAYERS].sort())
      expect(g.journeys.length).toBeLessThanOrEqual(5)
      expect(typeof g.boardKey).toBe('string')
    }
    // Journeys measured on the engine before refactoring: five on the desktop and module
    // boards, none on this phone layout. This synthetic feed is not routable, so the
    // module board plans its own journeys (fed: false): MITRE's real feed path is
    // checked in the browser on the MITRE page, not here.
    expect([desktop, phone, module].map((g) => g.journeys.length)).toEqual([5, 0, 5])
    expect(module.fed).toBeFalsy()
    expect(typeof journeyKeyframes(desktop.journeys)).toBe('string')
  })

  it('est déterministe', () => {
    expect(fingerprint(buildBoard(1280, 1100, DESKTOP))).toBe(fingerprint(desktop))
    expect(fingerprint(buildBoard(1280, 900, MODULE_OBSTACLES, MODULE_OBSTACLES, null, 260, FEED))).toBe(fingerprint(module))
  })

  it('garde le dessin de référence (empreintes prises avant la refactorisation)', () => {
    expect({
      desktop: fingerprint(desktop),
      phone: fingerprint(phone),
      module: fingerprint(module),
      keyframes: fingerprint(journeyKeyframes(desktop.journeys)),
    }).toEqual(BASELINE)
  })
})

const BASELINE = { desktop: 'ba26c9bd99532ae6', phone: '86ec995f2f67c0ff', module: 'ae01bf19a6519381', keyframes: 'f983474874fd4840' }

/*
 * The real MITRE path: buildBoard's arguments as ModuleCircuit passed them on the
 * MITRE page (captured in the browser, see __fixtures__/mitre-feed.json). The feed
 * is routable: the module's processor drives the board's journeys.
 */
describe('moteur de circuit partagé — trajet MITRE réel', () => {
  const mitre = (w: '1280' | '1440') => {
    const m = MITRE[w] as unknown as { width: number; height: number; obstacles: Rect[]; boardTop: number | null; feed: ModuleFeed }
    return buildBoard(m.width, m.height, m.obstacles, m.obstacles, null, m.boardTop || undefined, m.feed)
  }

  it('est alimenté par le processeur du module, comme dans le navigateur', () => {
    for (const w of ['1280', '1440'] as const) {
      const g = mitre(w)
      expect(g.fed).toBe(true)
      expect(g.journeys.length).toBe(9)
    }
  })

  it('garde le dessin MITRE de référence', () => {
    expect({ w1280: fingerprint(mitre('1280')), w1440: fingerprint(mitre('1440')), keyframes: fingerprint(journeyKeyframes(mitre('1440').journeys)) }).toEqual(MITRE_BASELINE)
  })
})

const MITRE_BASELINE = { w1280: '42bb0bec01a20175', w1440: 'c53603963e978c30', keyframes: 'b94f8f15860c2756' }
