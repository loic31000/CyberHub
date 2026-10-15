import { describe, expect, it } from 'vitest'
import { bgpAlerts, destinationRoute, environmentStatuses, hasDataError, recentCves, remoteTitle, stateText, widgetCounts } from './dashboardViewModel'
import type { BgpAlertsPayload, CvesPayload, IocPayload, Remote, StatsPayload } from '../model/dashboard.types'
import { DEFAULT_WIDGETS } from '../widgetRegistry'

// Fictional data only.
const ready = <T,>(data: T): Remote<T> => ({ status: 'ready', data })
const loading = { status: 'loading' } as const
const error = { status: 'error' } as const
const cve = (id: number, severity: string, published_at: string, created_at = '2099-01-01T00:00:00Z') =>
  ({ id, cve_id: `CVE-2099-000${id}`, description: `Entry ${id}`, cvss_score: 1, severity, products: '', status: 'new', notes: '', published_at, created_at, updated_at: '' })

describe('mappers du Dashboard', () => {
  it('écrit chargement, indisponibilité (en ligne ou non) ou la donnée', () => {
    expect(stateText(loading, () => 'x')).toBe('Chargement…')
    expect(stateText(error, () => 'x', true)).toBe('Données indisponibles')
    expect(stateText(error, () => 'x', false)).toBe('Hors connexion')
    expect(stateText(ready(3), (n) => `${n} IOC`)).toBe('3 IOC')
    expect(remoteTitle(error, { loading: 'L', error: 'E', ready: 'R' })).toBe('E')
  })

  it("dérive les statuts des cartes système de l'API, avec le bon ton", () => {
    const statuses = environmentStatuses({
      stats: ready({ tools_total: 59, ctf_total: 8 } as StatsPayload),
      ioc: ready({ total: 1 } as IocPayload),
      bgp: ready({ items: [], total: 1 } as unknown as BgpAlertsPayload),
    })
    expect(statuses['system.console']).toEqual({ status: '59 outils · 8 writeups', secondary: 'Données de la Console', tone: 'ready' })
    expect(statuses['system.sources'].status).toBe('1 IOC enregistrés')
    expect(statuses['system.bgp']).toEqual({ status: '1 alerte BGP enregistrée', secondary: 'Historique BGP', tone: 'attention' })
    const none = environmentStatuses({ stats: loading, ioc: error, bgp: ready({ items: [], total: 0 } as unknown as BgpAlertsPayload) })
    expect(none['system.console'].tone).toBe('quiet')
    expect(none['system.bgp']).toMatchObject({ status: 'Aucune alerte BGP', tone: 'ready' })
  })

  it('garde les trois CVE les plus récentes (publication, sinon création) avec leur sévérité réelle', () => {
    const items = recentCves(ready({ count: 4, cves: [cve(1, 'low', '2099-01-01T00:00:00Z'), cve(2, 'critical', '2099-05-01T00:00:00Z'), cve(3, 'high', '', '2099-04-01T00:00:00Z'), cve(4, 'weird', '2099-03-01T00:00:00Z')] } as unknown as CvesPayload))
    expect(items.map((c) => [c.cveId, c.severityLabel, c.iconTone, c.date])).toEqual([
      ['CVE-2099-0002', 'CRITIQUE', 'is-red', '2099-05-01T00:00:00Z'],
      ['CVE-2099-0003', 'ÉLEVÉE', 'is-amber', '2099-04-01T00:00:00Z'],
      ['CVE-2099-0004', 'weird', '', '2099-03-01T00:00:00Z'],
    ])
    expect(recentCves(loading)).toEqual([])
  })

  it('présente au plus deux alertes BGP avec leur état', () => {
    const items = bgpAlerts(ready({ total: 3, items: [
      { id: 1, asn: 64500, alert_type: 'prefix_withdrawn', detected_at: '2099-05-01T00:00:00Z', acknowledged: false },
      { id: 2, asn: 64501, alert_type: 'new_peer', detected_at: '2099-05-02T00:00:00Z', acknowledged: true },
      { id: 3, asn: 64502, alert_type: 'new_prefix', detected_at: '2099-05-03T00:00:00Z', acknowledged: false },
    ] } as unknown as BgpAlertsPayload))
    expect(items.map((a) => [a.asn, a.type, a.status])).toEqual([[64500, 'prefix withdrawn', 'Non acquittée'], [64501, 'new peer', 'Acquittée']])
  })

  it("signale une erreur dès qu'une source échoue, compte les widgets, résout les routes", () => {
    expect(hasDataError({ stats: ready({} as StatsPayload), tools: loading, bgp: loading, ioc: error, cves: loading })).toBe(true)
    expect(hasDataError({ stats: loading, tools: loading, bgp: loading, ioc: loading, cves: loading })).toBe(false)
    const counts = widgetCounts(DEFAULT_WIDGETS.map((w) => ({ ...w, visible: w.id !== 'sync' })))
    expect([counts.shown.map((w) => w.id), counts.hidden]).toEqual([['network', 'operations', 'threat', 'watch'], 1])
    expect(destinationRoute('Dashboard')).toBe('/dashboard')
    expect(destinationRoute('No such module')).toBeNull()
  })
})
