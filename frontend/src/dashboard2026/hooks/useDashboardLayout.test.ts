// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { LAYOUT_STORAGE_KEY, parseLayout, useDashboardLayout } from './useDashboardLayout'
import { DEFAULT_WIDGETS, parseWidgets, spanOf } from '../widgetRegistry'
import { DEFAULT_ENVIRONMENT_CARDS } from '../environmentRegistry'

describe('préférences du Dashboard — format localStorage', () => {
  afterEach(() => localStorage.clear())

  it('garde la clé et le format version 1', () => {
    expect(LAYOUT_STORAGE_KEY).toBe('cyberhub.console.dashboard.layout.v1')
    const { result } = renderHook(() => useDashboardLayout())
    act(() => result.current.update(['system.bgp', 'system.console', 'system.bgp']))
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) as string)).toEqual({
      version: 1, envCards: ['system.bgp', 'system.console'], widgets: DEFAULT_WIDGETS,
    })
  })

  it("n'écrit rien tant que la disposition reste celle par défaut, et efface la clé au retour aux défauts", () => {
    const { result } = renderHook(() => useDashboardLayout())
    expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toBeNull()
    act(() => result.current.updateWidgets(DEFAULT_WIDGETS.map((w) => (w.id === 'sync' ? { ...w, visible: false } : w))))
    expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).not.toBeNull()
    act(() => result.current.resetWidgets())
    expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toBeNull()
  })

  it('réinitialise chaque partie sans toucher à l’autre', () => {
    const { result } = renderHook(() => useDashboardLayout())
    act(() => result.current.update(['system.bgp']))
    act(() => result.current.updateWidgets(DEFAULT_WIDGETS.map((w) => ({ ...w, visible: w.id !== 'network' }))))
    act(() => result.current.reset())
    expect(result.current.envCards).toEqual(DEFAULT_ENVIRONMENT_CARDS)
    expect(result.current.widgets.find((w) => w.id === 'network')?.visible).toBe(false)
  })

  it('lit les anciennes dispositions et écarte les valeurs inconnues ou invalides', () => {
    expect(parseLayout(null).envCards).toEqual(DEFAULT_ENVIRONMENT_CARDS)
    expect(parseLayout('{oops').widgets).toEqual(DEFAULT_WIDGETS)
    expect(parseLayout(JSON.stringify({ version: 2, envCards: [] })).envCards).toEqual(DEFAULT_ENVIRONMENT_CARDS)
    // Phase 3A.1 layouts: cards only, widgets empty.
    expect(parseLayout(JSON.stringify({ version: 1, envCards: ['system.console', 'nope'], widgets: [] }))).toEqual({
      version: 1, envCards: ['system.console'], widgets: DEFAULT_WIDGETS,
    })
  })
})

describe('registre des widgets', () => {
  it('nettoie les placements : doublons, inconnus, tailles invalides, widgets manquants ajoutés', () => {
    const parsed = parseWidgets([
      { id: 'watch', visible: false, size: 'large' }, { id: 'watch', visible: true, size: 'compact' },
      { id: 'ghost', visible: true, size: 'large' }, { id: 'network', visible: 'yes', size: 'compact' },
    ])
    expect(parsed.map((w) => `${w.id}:${w.visible}:${w.size}`)).toEqual([
      'watch:false:large', 'network:true:standard', 'operations:true:compact', 'threat:true:compact', 'sync:true:large',
    ])
  })

  it('calcule les spans desktop et tablette', () => {
    expect(spanOf({ id: 'network', visible: true, size: 'large' })).toEqual({ cols: 9, rows: 2, colsTablet: 6 })
    expect(spanOf({ id: 'threat', visible: true, size: 'compact' })).toEqual({ cols: 3, rows: 1, colsTablet: 3 })
    expect(spanOf({ id: 'network', visible: true, size: 'compact' })).toEqual({ cols: 6, rows: 2, colsTablet: 6 })
  })
})
