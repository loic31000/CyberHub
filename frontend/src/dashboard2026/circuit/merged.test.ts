// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { journeyKeyframes, TAILS } from './animations'
import { mergedKeyframes, mergeJourneys, supportsPathAnimation } from './merged'
import type { Journey } from './types'

// Two journeys of fictional hops; lengths given by a fake measurer (the browser measures them for real).
const hop = (d: string, length: number, start: number, end: number) => ({ d, length, points: [], start, end })
const JOURNEYS: Journey[] = [
  { tone: 'cyan', rare: false, period: 10, delay: -10, glows: [], hops: [hop('M0 0h100', 100, 1, 2), hop('M200 0v50', 50, 3, 3.5)] },
  { tone: 'amber', rare: true, period: 20, delay: -20, glows: [], hops: [hop('M10 10h40', 40, 5, 6)] },
]
const LENGTHS: Record<string, number> = { 'M0 0h100': 100, 'M200 0v50': 50, 'M10 10h40': 40 }
const fake = (ds: string[]) => ds.map((d) => LENGTHS[d])
const keyframes = (css: string, name: string) => css.split('@keyframes ').find((k) => k.startsWith(`${name}{`)) ?? ''
// Every keyframe percentage, grouped selectors included ("0%,10.000%{").
const percents = (frames: string) => [...new Set([...frames.matchAll(/([\d.]+)%[,{]/g)].map((m) => Number(m[1])))]

describe('variante B — une LED et deux traînes par trajet', () => {
  const merged = mergeJourneys(JOURNEYS, fake)
  const css = mergedKeyframes(JOURNEYS, merged)

  it('enchaîne les sauts, chacun précédé de son espaceur hors écran', () => {
    expect(merged[0].d).toBe('M-4000 -4000h120M0 0h100M-4000 -4000h120M200 0v50')
    expect(merged[0].hops.map((h) => [h.from, h.length])).toEqual([[120, 100], [340, 50]])
    expect(merged[1].hops.map((h) => [h.from, h.length])).toEqual([[120, 40]])
  })

  it('garde pour chaque saut la fenêtre des images clés par saut', () => {
    const perHop = journeyKeyframes(JOURNEYS)
    for (const [ji, j] of JOURNEYS.entries()) {
      for (const hi of j.hops.keys()) {
        // The per-hop LED: a, a+e, z-e, z (besides 0 and 100).
        const [a, ae, ze, z] = percents(keyframes(perHop, `cbd${ji}-${hi}`)).filter((p) => p !== 0 && p !== 100)
        const led = percents(keyframes(css, `cbdm${ji}`))
        for (const p of [a, ae, ze, z]) expect(led).toContain(p)
      }
    }
  })

  it('place la LED sur la distance du saut actif, et la tête de chaque traîne sur la LED', () => {
    const led = keyframes(css, 'cbdm0')
    // Hop 1 of journey 0 travels from 340 px to 390 px on the merged path.
    expect(led).toContain('offset-distance:340.000px')
    expect(led).toContain('offset-distance:390.000px')
    const near = keyframes(css, 'cbtm0-0')
    const len = Math.min(0.5, TAILS[0].px / 50) * 50 // the per-hop tail of hop 1, in px
    // Its own path, dashed in its own pixels: offset from len (tail before the start) to len - length (at the end).
    expect(near).toContain('d:path("M200 0v50")')
    expect(near).toContain(`stroke-dashoffset:${len.toFixed(3)}`)
    expect(near).toContain(`stroke-dashoffset:${(len - 50).toFixed(3)}`)
  })

  it("nomme les animations pour l'alignement du moteur (/^cb[dtg]/)", () => {
    const names = [...css.matchAll(/@keyframes ([\w-]+)\{/g)].map((m) => m[1])
    expect(names).toEqual(['cbdm0', 'cbtm0-0', 'cbtm0-1', 'cbdm1', 'cbtm1-0', 'cbtm1-1'])
    expect(names.every((n) => /^cb[dtg]/.test(n))).toBe(true)
  })

  it('reste sur le rendu par saut sans animation de forme mesurable (jsdom, WebKit)', () => {
    expect(supportsPathAnimation()).toBe(false)
  })
})
