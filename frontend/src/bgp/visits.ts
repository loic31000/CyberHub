// ASNs opened in BGP Lookup during this browser session, newest first. Only an
// ASN whose identity actually loaded counts as visited; relations merely listed
// on a page are never recorded. Kept in sessionStorage so a detour through
// BGP Historian does not lose the trail; storage failures fall back to memory.

const KEY = 'cyberhub.bgp.visited'
export const MAX_VISITS = 200

export function readVisits(): number[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((asn): asn is number => Number.isSafeInteger(asn) && asn > 0).slice(0, MAX_VISITS)
      : []
  } catch {
    return []
  }
}

export function writeVisits(visits: number[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(visits))
  } catch {
    // Private mode or blocked storage: the trail stays in memory for this page.
  }
}

export function recordVisit(visits: number[], asn: number): number[] {
  return visits[0] === asn ? visits : [asn, ...visits.filter(item => item !== asn)].slice(0, MAX_VISITS)
}
