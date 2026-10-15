import { useEffect, useState } from 'react'
import { bgpApi, cveApi, iocApi, statsApi, toolsApi } from '@/api/client'

export type Remote<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error' }

const loading = <T,>(): Remote<T> => ({ status: 'loading' })

export function useDashboardData() {
  const [revision, setRevision] = useState(0)
  const [stats, setStats] = useState<Remote<Awaited<ReturnType<typeof statsApi.get>>>>(loading)
  const [tools, setTools] = useState<Remote<Awaited<ReturnType<typeof toolsApi.list>>>>(loading)
  const [bgp, setBgp] = useState<Remote<Awaited<ReturnType<typeof bgpApi.getAlerts>>>>(loading)
  const [ioc, setIoc] = useState<Remote<Awaited<ReturnType<typeof iocApi.list>>>>(loading)
  const [cves, setCves] = useState<Remote<Awaited<ReturnType<typeof cveApi.list>>>>(loading)

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
