import { attackLayerApi } from '@/api/client'
import type { LayerEntry } from '@/types/attackLayer'

/* Layer payload helpers shared by the Atlas Layers workspace. */

export function parseEntries(raw: string): LayerEntry[] {
  try { const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value as LayerEntry[] : [] } catch { return [] }
}

export const techniqueCount = (raw: string) => parseEntries(raw).length

export const layerFileName = (name: string) => `layer-${(name || 'export').toLowerCase().replace(/\s+/g, '-')}.json`

/* The export endpoint is authenticated, so it is fetched with the session token and saved as a blob. */
export async function downloadLayer(id: number, name: string): Promise<void> {
  const token = localStorage.getItem('cyber_hub_token') ?? ''
  const response = await fetch(attackLayerApi.exportUrl(id), { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`Export HTTP ${response.status}`)
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = layerFileName(name)
  anchor.click()
  URL.revokeObjectURL(url)
}

export const formatDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR')
}
