import { describe, expect, it } from 'vitest'
import { journeyKeyframes } from './animations'
import { hopIn } from './geometry'
import type { Journey } from './types'

// Fictional journeys: one hop inside a fictional hero box, one outside, and two chip glows.
const hop = (x: number, y: number, start: number) => ({ d: `M${x} ${y}h40`, length: 40, points: [{ x, y }, { x: x + 40, y }], start, end: start + 1 })
const glow = (x: number, start: number) => ({ x, y: 0, w: 20, h: 10, start, end: start + 0.5 })
const JOURNEYS: Journey[] = [
  { tone: 'cyan', rare: false, period: 10, delay: -10, glows: [glow(0, 0), glow(500, 3)], hops: [hop(10, 10, 1), hop(500, 300, 4)] },
]
const HERO = { x: 0, y: 0, w: 200, h: 100 }
const names = (css: string) => [...css.matchAll(/@keyframes ([\w-]+)\{/g)].map((m) => m[1])

describe('images clés par saut — génération ciblée', () => {
  it("sans filtre, produit exactement l'ancienne sortie (MITRE, rendu WebKit)", () => {
    expect(journeyKeyframes(JOURNEYS, undefined)).toBe(journeyKeyframes(JOURNEYS))
    expect(names(journeyKeyframes(JOURNEYS))).toEqual(['cbd0-0', 'cbt0-0-0', 'cbt0-0-1', 'cbd0-1', 'cbt0-1-0', 'cbt0-1-1', 'cbg0-0', 'cbg0-1'])
  })

  it('ne garde que les sauts dessinés par le hero, et tous les halos', () => {
    const css = journeyKeyframes(JOURNEYS, (ji, hi) => hopIn(JOURNEYS[ji].hops[hi], HERO))
    expect(names(css)).toEqual(['cbd0-0', 'cbt0-0-0', 'cbt0-0-1', 'cbg0-0', 'cbg0-1'])
  })

  it("garde à l'identique les images clés conservées", () => {
    const all = journeyKeyframes(JOURNEYS)
    const kept = journeyKeyframes(JOURNEYS, (ji, hi) => hopIn(JOURNEYS[ji].hops[hi], HERO))
    for (const k of kept.split('@keyframes ').slice(1)) expect(all).toContain(`@keyframes ${k}`)
  })
})
