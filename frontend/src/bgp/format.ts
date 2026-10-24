// Formatting helpers shared by BGP Lookup and BGP Historian. Every value they
// produce is derived from an API response; none of them invents data.

export function parseAPIError(error: unknown): string {
  if (error instanceof Error) {
    const axiosError = error as { response?: { data?: { error?: string } } }
    return axiosError.response?.data?.error || error.message
  }
  return 'Erreur réseau'
}

export function stripASN(raw: string): number {
  return parseInt(raw.replace(/^AS/i, '').trim(), 10)
}

export function isValidASN(asn: number): boolean {
  return Number.isSafeInteger(asn) && asn > 0
}

const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const dayLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const dayShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

const parsed = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatDateTime = (iso: string) => { const d = parsed(iso); return d ? dateTime.format(d) : 'Date inconnue' }
export const formatDay = (iso: string) => { const d = parsed(iso); return d ? dayLong.format(d) : 'Date inconnue' }
export const formatShortDay = (iso: string) => { const d = parsed(iso); return d ? dayShort.format(d) : 'Date inconnue' }
export const formatClock = (iso: string) => { const d = parsed(iso); return d ? clock.format(d) : '--:--' }
export const dayKey = (iso: string) => { const d = parsed(iso); return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : 'unknown' }
export const isValidDate = (iso: string) => parsed(iso) !== null

/** Elapsed time between two timestamps, in words ("3 j 4 h", "45 min"). */
export function formatGap(fromISO: string, toISO: string): string {
  const from = parsed(fromISO)
  const to = parsed(toISO)
  if (!from || !to) return 'écart inconnu'
  const minutes = Math.round(Math.abs(to.getTime() - from.getTime()) / 60000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
  const days = Math.floor(hours / 24)
  return `${days} j${hours % 24 ? ` ${hours % 24} h` : ''}`
}

/** A duration in seconds, in the same words as formatGap ("moins d’1 min" under a minute). */
export function formatAge(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'âge inconnu'
  if (seconds < 60) return 'moins d’1 min'
  return formatGap(new Date(0).toISOString(), new Date(seconds * 1000).toISOString())
}

/** Number of addresses covered by an IPv4 prefix, from its CIDR length. */
export function ipv4Size(cidr: number): string {
  if (!Number.isInteger(cidr) || cidr < 0 || cidr > 32) return ''
  const size = 2 ** (32 - cidr)
  return `${size.toLocaleString('fr-FR')} adresse${size > 1 ? 's' : ''}`
}

export function splitPrefix(prefix: string): [string, string] {
  const slash = prefix.lastIndexOf('/')
  return slash < 0 ? [prefix, ''] : [prefix.slice(0, slash), prefix.slice(slash)]
}
