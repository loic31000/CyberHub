import { useEffect, useState } from 'react'
import { bgpApi, cveApi, iocApi, statsApi, toolsApi } from '@/api/client'
import type { BgpAlertsPayload, CvesPayload, DashboardData, IocPayload, Remote, StatsPayload, ToolsPayload } from '../model/dashboard.types'

export type { Remote } from '../model/dashboard.types'

const loading = <T,>(): Remote<T> => ({ status: 'loading' })

/* The Dashboard's data, loaded once for every widget; `retry` reloads all of it. */
export function useDashboardData(): DashboardData {
  const [revision, setRevision] = useState(0)
  const [stats, setStats] = useState<Remote<StatsPayload>>(loading)
  const [tools, setTools] = useState<Remote<ToolsPayload>>(loading)
  const [bgp, setBgp] = useState<Remote<BgpAlertsPayload>>(loading)
  const [ioc, setIoc] = useState<Remote<IocPayload>>(loading)
  const [cves, setCves] = useState<Remote<CvesPayload>>(loading)

  useEffect(() => {
    let active = true
    setStats(loading())
    setTools(loading())
    setBgp(loading())
    setIoc(loading())
    setCves(loading())

    const request = <T,>(promise: Promise<T>, update: (value: Remote<T>) => void) => {
      promise.then((data) => {
        if (active) update({ status: 'ready', data })
      }).catch(() => {
        if (active) update({ status: 'error' })
      })
    }

    request(statsApi.get(), setStats)
    request(toolsApi.list(), setTools)
    request(bgpApi.getAlerts(5, 0), setBgp)
    request(iocApi.list({ limit: 1 }), setIoc)
    request(cveApi.list(), setCves)
    return () => { active = false }
  }, [revision])

  return { stats, tools, bgp, ioc, cves, retry: () => setRevision((value) => value + 1) }
}
