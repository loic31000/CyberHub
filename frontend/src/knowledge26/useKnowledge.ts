import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cisaApi, cloakAnnotationsApi, cveApi, mitreApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { CloakAnnotation } from '@/types/cloakAnnotation'
import type { CVEEntry } from '@/types'
import { SOURCES, fromCVE, fromMITRE, loadCollection, type Collection, type KnowledgeItem, type Source } from './model'

/*
 * Everything Atlas knows, in one place: the four collections, CLOAK analyst
 * annotations and CISA KEV flags. `resolve` is the single entry point for
 * internal navigation (LOLBins → ATT&CK, parent ↔ sub-technique…): it returns
 * a loaded record, or fetches an ATT&CK technique that is not on a loaded page.
 */

type Entry = Collection & { error?: boolean; loadingMore?: boolean }
export type Collections = Partial<Record<Source, Entry>>

export function useKnowledge(onlyTechniques: boolean) {
  const [collections, setCollections] = useState<Collections>({})
  const [attempt, setAttempt] = useState(0)
  const [annotations, setAnnotations] = useState<Map<string, CloakAnnotation>>(new Map())
  const [annotationError, setAnnotationError] = useState(false)
  const [kevFlags, setKevFlags] = useState<Set<string>>(new Set())

  const request = useCallback((target: Source, page = 1) =>
    ({ page, limit: 100, ...(target === 'MITRE' && onlyTechniques ? { only_techniques: true } : {}) }), [onlyTechniques])

  useEffect(() => {
    const controller = new AbortController()
    setCollections({})
    SOURCES.forEach(target => {
      loadCollection(target, controller.signal, request(target))
        .then(result => { if (!controller.signal.aborted) setCollections(previous => ({ ...previous, [target]: result })) })
        .catch(() => { if (!controller.signal.aborted) setCollections(previous => ({ ...previous, [target]: { items: [], total: 0, error: true } })) })
    })
    return () => controller.abort()
  // Reload on explicit retry only; the technique toggle applies to the next pages.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  useEffect(() => {
    let active = true
    cloakAnnotationsApi.list()
      .then(list => { if (active) setAnnotations(new Map(list.map(annotation => [annotation.technique_ref, annotation]))) })
      .catch(() => { if (active) setAnnotationError(true) })
    return () => { active = false }
  }, [])

  const cveItems = collections.CVE?.items
  useEffect(() => {
    const ids = cveItems?.map(item => item.id) ?? []
    if (!ids.length) { setKevFlags(new Set()); return }
    const controller = new AbortController()
    cisaApi.batchCheckKEV(ids, controller.signal)
      .then(result => { if (!controller.signal.aborted) setKevFlags(new Set(Object.entries(result).filter(([, flagged]) => flagged).map(([id]) => id))) })
      .catch(() => { if (!controller.signal.aborted) setKevFlags(new Set()) })
    return () => controller.abort()
  }, [cveItems])

  const all = useMemo(() => SOURCES.flatMap(target => collections[target]?.items || []), [collections])
  const allRef = useRef(all)
  allRef.current = all

  const refreshCVE = async () => {
    try { const value = await loadCollection('CVE', new AbortController().signal); setCollections(previous => ({ ...previous, CVE: value })) }
    catch { toast.error('Impossible d’actualiser la collection CVE') }
  }

  const loadMore = async (target: Source) => {
    const current = collections[target]
    if (!current || current.items.length >= current.total || current.loadingMore) return
    const nextPage = (current.page ?? 1) + 1
    setCollections(previous => ({ ...previous, [target]: { ...previous[target]!, loadingMore: true } }))
    try {
      const next = await loadCollection(target, new AbortController().signal, request(target, nextPage))
      setCollections(previous => {
        const known = previous[target]!.items
        return { ...previous, [target]: { ...next, items: [...known, ...next.items.filter(item => !known.some(existing => existing.key === item.key))], loadingMore: false } }
      })
    } catch {
      setCollections(previous => ({ ...previous, [target]: { ...previous[target]!, loadingMore: false } }))
      toast.error(`Page ${nextPage} indisponible`)
    }
  }

  /* A created or edited CVE replaces its previous record (or joins the collection first). */
  const upsertCVE = (entry: CVEEntry): KnowledgeItem => {
    const item = fromCVE(entry)
    setCollections(previous => {
      const current = previous.CVE ?? { items: [], total: 0 }
      const exists = current.items.some(existing => existing.key === item.key)
      return { ...previous, CVE: { ...current, items: exists ? current.items.map(existing => existing.key === item.key ? item : existing) : [item, ...current.items], total: current.total + (exists ? 0 : 1) } }
    })
    return item
  }

  const removeItem =(target: Source, key: string) => setCollections(previous => {
    const entry = previous[target]
    if (!entry) return previous
    return { ...previous, [target]: { ...entry, items: entry.items.filter(item => item.key !== key), total: Math.max(0, entry.total - 1) } }
  })

  /* Finds a record by source + ID; paged CVE and ATT&CK records are resolved on demand. */
  const resolve = useCallback(async (target: Source, id: string): Promise<KnowledgeItem | null> => {
    const wanted = id.trim().toUpperCase()
    const found = allRef.current.find(item => item.source === target && item.id.toUpperCase() === wanted)
    if (found) return found
    if (target === 'CVE') {
      try {
        const result = await cveApi.list({ search: wanted })
        const entry = result.cves.find(candidate => candidate.cve_id.toUpperCase() === wanted)
        if (!entry) return null
        const item = fromCVE(entry)
        setCollections(previous => previous.CVE
          ? { ...previous, CVE: { ...previous.CVE, items: [item, ...previous.CVE.items.filter(existing => existing.key !== item.key)] } }
          : previous)
        return item
      } catch { return null }
    }
    if (target !== 'MITRE') return null
    try {
      const [technique, tactics] = await Promise.all([mitreApi.technique(wanted), mitreApi.tactics()])
      const item = fromMITRE(technique, tactics)
      setCollections(previous => previous.MITRE
        ? { ...previous, MITRE: { ...previous.MITRE, items: [item, ...previous.MITRE.items.filter(existing => existing.key !== item.key)] } }
        : previous)
      return item
    } catch {
      return null
    }
  }, [])

  return {
    collections, all, annotations, annotationError, kevFlags,
    retry: () => setAttempt(value => value + 1),
    refreshCVE, loadMore, removeItem, resolve, upsertCVE,
    saveAnnotation: (annotation: CloakAnnotation) => setAnnotations(previous => new Map(previous).set(annotation.technique_ref, annotation)),
    dropAnnotation: (ref: string) => setAnnotations(previous => { const next = new Map(previous); next.delete(ref); return next }),
  }
}
