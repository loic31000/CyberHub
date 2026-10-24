import { describe, expect, it } from 'vitest'
import { matchesQuery, orderedSteps, progressOf, scenarioLabel, toSlug, apiError } from './parts'
import { editStep, insertStep, moveStep, newStep, removeStep, toPayload, validate, hasErrors, sameDraft, type Draft } from './steps'
import { playbook, step } from './__fixtures__'

describe('Playbooks 2026 — progression et recherche', () => {
  it('calcule la progression à partir des étapes cochées', () => {
    expect(progressOf([])).toEqual({ done: 0, total: 0, pct: 0, state: 'empty' })
    expect(progressOf([step(1, 1, 'a'), step(2, 2, 'b')]).state).toBe('todo')
    expect(progressOf([step(1, 1, 'a', true), step(2, 2, 'b'), step(3, 3, 'c')])).toEqual({ done: 1, total: 3, pct: 33, state: 'active' })
    expect(progressOf([step(1, 1, 'a', true)])).toMatchObject({ pct: 100, state: 'done' })
    expect(progressOf(null).state).toBe('empty')
  })

  it('cherche dans le titre, le scénario, la description et les étapes, sans accents ni casse', () => {
    const pb = playbook(1, 'Réponse Ransomware', 'ransomware', [step(1, 1, 'Isoler la machine')], 'Chiffrement massif')
    expect(matchesQuery(pb, '')).toBe(true)
    expect(matchesQuery(pb, 'REPONSE')).toBe(true)
    expect(matchesQuery(pb, 'chiffrement')).toBe(true)
    expect(matchesQuery(pb, 'isoler machine')).toBe(true)
    expect(matchesQuery(pb, 'phishing')).toBe(false)
    expect(matchesQuery(playbook(2, 'X', 'insider-threat', []), 'menace interne')).toBe(true)
  })

  it('ordonne les étapes par ordre puis par identifiant', () => {
    expect(orderedSteps([step(3, 2, 'c'), step(1, 1, 'a'), step(2, 2, 'b')]).map(s => s.id)).toEqual([1, 2, 3])
  })

  it('normalise un scénario saisi en slug et le libelle', () => {
    expect(toSlug('Élévation  de Privilèges!')).toBe('elevation-de-privileges-')
    expect(scenarioLabel('ddos')).toBe('DDoS')
    expect(scenarioLabel('custom-x')).toBe('custom-x')
    expect(scenarioLabel('')).toBe('Sans scénario')
  })

  it('reprend le message du backend quand il existe', () => {
    expect(apiError({ response: { data: { error: 'Key: title min' } } }, 'défaut')).toBe('Key: title min')
    expect(apiError(new Error('x'), 'défaut')).toBe('défaut')
  })
})

describe('Playbooks 2026 — éditeur d’étapes', () => {
  const draft = (steps: string[], title = 'Réponse DDoS'): Draft => ({ title, scenario: 'ddos', description: '', steps: steps.map(c => newStep(c)) })

  it('ajoute, modifie, déplace et supprime sans muter', () => {
    const base = draft(['a', 'b', 'c']).steps
    const inserted = insertStep(base, 0)
    expect(inserted.map(s => s.content)).toEqual(['a', '', 'b', 'c'])
    expect(base).toHaveLength(3)
    expect(editStep(base, 1, 'B').map(s => s.content)).toEqual(['a', 'B', 'c'])
    expect(moveStep(base, 2, 0).map(s => s.content)).toEqual(['c', 'a', 'b'])
    expect(moveStep(base, 0, -1)).toBe(base)
    expect(removeStep(base, 1).map(s => s.content)).toEqual(['a', 'c'])
    const last = removeStep([base[0]], 0)
    expect(last).toHaveLength(1)
    expect(last[0].content).toBe('')
  })

  it('garde les clés des étapes déplacées', () => {
    const base = draft(['a', 'b']).steps
    expect(moveStep(base, 0, 1).map(s => s.key)).toEqual([base[1].key, base[0].key])
  })

  it('valide comme le backend et refuse une checklist vide', () => {
    expect(validate(draft(['a'], ' ')).title).toBe('Le titre est requis')
    expect(validate(draft(['a'], 'A')).title).toMatch(/au moins 2/)
    expect(validate(draft(['', '  '])).steps).toBe('Ajoutez au moins une étape')
    const long = draft(['x'.repeat(501)])
    expect(validate(long).step?.[long.steps[0].key]).toMatch(/500/)
    expect(hasErrors(validate(draft(['a'])))).toBe(false)
  })

  it('construit le corps attendu par le backend Go', () => {
    expect(toPayload({ title: '  Réponse  ', scenario: 'ddos-', description: ' d ', steps: [newStep(' un '), newStep(''), newStep('deux')] }))
      .toEqual({ title: 'Réponse', scenario: 'ddos', description: 'd', steps: [{ content: 'un', order: 1 }, { content: 'deux', order: 2 }] })
  })

  it('compare deux brouillons sur ce qui serait enregistré', () => {
    expect(sameDraft(draft(['a', '']), draft(['a']))).toBe(true)
    expect(sameDraft(draft(['a', 'b']), draft(['b', 'a']))).toBe(false)
  })
})
