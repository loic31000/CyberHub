// ASNs known to have snapshots, so Historian can offer them without typing.
// The backend has no endpoint listing them; this browser remembers the ASNs it
// snapshotted from Network Atlas or whose history it loaded, with what it saw.
// localStorage is a per-viewer convenience: failures fall back to an empty list.

const KEY = 'cyberhub.bgp.snapshot-asns'
const MAX = 12

export interface SnapshotShortcut {
  asn: number
  /** Snapshot count the last time the history was loaded, when known. */
  count?: number
  /** Most recent snapshot date seen, ISO. */
  last?: string
}

export function readShortcuts(): SnapshotShortcut[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s): s is SnapshotShortcut => !!s && Number.isSafeInteger((s as SnapshotShortcut).asn) && (s as SnapshotShortcut).asn > 0)
      .slice(0, MAX)
  } catch {
    return []
  }
}

/** Puts an ASN first, merging what is newly known about its snapshots. */
export function rememberSnapshotASN(entry: SnapshotShortcut): SnapshotShortcut[] {
  const previous = readShortcuts()
  const known = previous.find(s => s.asn === entry.asn)
  const merged = { ...known, ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined)) } as SnapshotShortcut
  const next = [merged, ...previous.filter(s => s.asn !== entry.asn)].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: the shortcut only lasts for this page.
  }
  return next
}
