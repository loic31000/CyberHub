import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { cveApi } from '@/api/client'

type LegacySource = 'cve' | 'mitre' | 'cloak' | 'lolbins'

const atlasUrl = (source: LegacySource, id?: string, action?: 'new' | 'edit') => {
  const query = new URLSearchParams({ source })
  if (id) query.set('id', id)
  if (action) query.set('action', action)
  return `/knowledge?${query}`
}

/** Compatibility redirect for old list URLs and their historical query names. */
export function LegacySourceRedirect({ source }: { source: LegacySource }) {
  const { search } = useLocation()
  const legacy = new URLSearchParams(search)
  const id = source === 'mitre'
    ? legacy.get('technique') || legacy.get('id') || legacy.get('find')
    : source === 'lolbins'
      ? legacy.get('binary') || legacy.get('name') || legacy.get('id') || legacy.get('find')
      : legacy.get('id') || legacy.get('find')
  const next = new URLSearchParams({ source })
  if (id) next.set('id', id)
  else if (legacy.get('q')) next.set('q', legacy.get('q')!)
  return <Navigate replace to={`/knowledge?${next}`} />
}

/** Numeric legacy CVE routes need one API lookup before Atlas can use the CVE-ID. */
export function LegacyCveRecordRedirect({ edit = false }: { edit?: boolean }) {
  const { id = '' } = useParams()
  const [resolved, setResolved] = useState<string | null>(/^CVE-\d{4}-\d{4,}$/i.test(id) ? id.toUpperCase() : null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (resolved || !/^[1-9]\d*$/.test(id)) { if (!resolved) setMissing(true); return }
    const controller = new AbortController()
    cveApi.get(Number(id), controller.signal)
      .then(entry => setResolved(entry.cve_id))
      .catch(() => { if (!controller.signal.aborted) setMissing(true) })
    return () => controller.abort()
  }, [id, resolved])

  if (resolved) return <Navigate replace to={atlasUrl('cve', resolved, edit ? 'edit' : undefined)} />
  if (missing) return <section className="legacy-redirect-error" role="alert"><h1>CVE introuvable</h1><p>L’ancienne référence <code>{id}</code> ne correspond à aucune fiche.</p><Link to={atlasUrl('cve')}>Ouvrir Knowledge Atlas</Link></section>
  return <p role="status" className="legacy-redirect-loading">Résolution de la référence CVE…</p>
}

export function LegacyLayersRedirect() {
  const { id } = useParams()
  const query = new URLSearchParams({ workspace: 'layers' })
  if (id) query.set('id', id)
  return <Navigate replace to={`/knowledge?${query}`} />
}

export const legacyCveNewUrl = atlasUrl('cve', undefined, 'new')
