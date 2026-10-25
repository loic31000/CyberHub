// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cveApi } from '@/api/client'
import { LegacyCveRecordRedirect, LegacyLayersRedirect, LegacySourceRedirect, legacyCveNewUrl } from './LegacyKnowledgeRedirect'

vi.mock('@/api/client', () => ({ cveApi: { get: vi.fn() } }))

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderAt(url: string) {
  cleanup()
  return render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/cve" element={<LegacySourceRedirect source="cve" />} />
    <Route path="/cve/new" element={<Navigate to={legacyCveNewUrl} replace />} />
    <Route path="/cve/:id" element={<LegacyCveRecordRedirect />} />
    <Route path="/cve/:id/edit" element={<LegacyCveRecordRedirect edit />} />
    <Route path="/mitre" element={<LegacySourceRedirect source="mitre" />} />
    <Route path="/mitre/layers" element={<LegacyLayersRedirect />} />
    <Route path="/mitre/layers/:id" element={<LegacyLayersRedirect />} />
    <Route path="/cloak" element={<LegacySourceRedirect source="cloak" />} />
    <Route path="/lolbins" element={<LegacySourceRedirect source="lolbins" />} />
    <Route path="/knowledge" element={<Location />} />
  </Routes></MemoryRouter>)
}

describe('legacy knowledge redirects', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it.each([
    ['/cve', '/knowledge?source=cve'],
    ['/cve?find=CVE-2024-1234', '/knowledge?source=cve&id=CVE-2024-1234'],
    ['/cve/new', '/knowledge?source=cve&action=new'],
    ['/mitre', '/knowledge?source=mitre'],
    ['/mitre?technique=T1059.001', '/knowledge?source=mitre&id=T1059.001'],
    ['/mitre?id=T1002', '/knowledge?source=mitre&id=T1002'],
    ['/mitre?find=T1105', '/knowledge?source=mitre&id=T1105'],
    ['/mitre/layers', '/knowledge?workspace=layers'],
    ['/mitre/layers/7', '/knowledge?workspace=layers&id=7'],
    ['/cloak', '/knowledge?source=cloak'],
    ['/cloak?id=TE-35', '/knowledge?source=cloak&id=TE-35'],
    ['/lolbins', '/knowledge?source=lolbins'],
    ['/lolbins?binary=curl', '/knowledge?source=lolbins&id=curl'],
  ])('redirects %s to %s', async (from, to) => {
    renderAt(from)
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(to))
  })

  it.each([
    ['/cve/17', '/knowledge?source=cve&id=CVE-2024-6387'],
    ['/cve/17/edit', '/knowledge?source=cve&id=CVE-2024-6387&action=edit'],
  ])('resolves the numeric CVE database id for %s', async (from, to) => {
    vi.mocked(cveApi.get).mockResolvedValue({ id: 17, cve_id: 'CVE-2024-6387' } as never)
    renderAt(from)
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(to))
    expect(cveApi.get).toHaveBeenCalledWith(17, expect.any(AbortSignal))
  })

  it('shows a stable error instead of a redirect loop for an unknown CVE id', async () => {
    vi.mocked(cveApi.get).mockRejectedValue(new Error('404'))
    renderAt('/cve/999')
    expect((await screen.findByRole('alert')).textContent).toContain('CVE introuvable')
  })
})
