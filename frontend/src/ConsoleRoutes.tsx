import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import Layout from '@/components/Layout'
import Loader from '@/components/Loader'
import { LegacyCveRecordRedirect, LegacyLayersRedirect, LegacySourceRedirect, legacyCveNewUrl } from '@/knowledge26/LegacyKnowledgeRedirect'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Tools = lazy(() => import('@/pages/Tools'))
const ToolDetail = lazy(() => import('@/pages/ToolDetail'))
const ToolForm = lazy(() => import('@/pages/ToolForm'))
const CTFList = lazy(() => import('@/pages/CTFList'))
const CTFDetail = lazy(() => import('@/pages/CTFDetail'))
const CTFForm = lazy(() => import('@/pages/CTFForm'))
const PlaybookList = lazy(() => import('@/pages/PlaybookList'))
const PlaybookDetail = lazy(() => import('@/pages/PlaybookDetail'))
const PlaybookForm = lazy(() => import('@/pages/PlaybookForm'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const KnowledgeAtlas = lazy(() => import('@/pages/KnowledgeAtlas'))
const IOCPage = lazy(() => import('@/pages/IOCPage'))
const BGPLookup = lazy(() => import('@/pages/BGPLookup'))
const BGPHistorian = lazy(() => import('@/pages/BGPHistorian'))
const CorrelationPage = lazy(() => import('@/pages/CorrelationPage'))
const OSINTRunner = lazy(() => import('@/pages/OSINTRunner'))
const NotesPage = lazy(() => import('@/pages/NotesPage'))
const CheatsheetsPage = lazy(() => import('@/pages/CheatsheetsPage'))
const EncoderDecoder = lazy(() => import('@/pages/EncoderDecoder'))
const RevShellGenerator = lazy(() => import('@/pages/RevShellGenerator'))
const InvestigationList = lazy(() => import('@/pages/InvestigationList'))
const InvestigationDetail = lazy(() => import('@/pages/InvestigationDetail'))

// Guard : redirige vers /login si non authentifié
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function ConsoleRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Routes protégées */}
        <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Outils */}
            <Route path="tools" element={<Tools />} />
            <Route path="tools/new" element={<ToolForm />} />
            <Route path="tools/:id" element={<ToolDetail />} />
            <Route path="tools/:id/edit" element={<ToolForm />} />

            {/* CTF */}
            <Route path="ctf" element={<CTFList />} />
            <Route path="ctf/new" element={<CTFForm />} />
            <Route path="ctf/:id" element={<CTFDetail />} />
            <Route path="ctf/:id/edit" element={<CTFForm />} />

            {/* Legacy knowledge URLs: kept as compatibility redirects. */}
            <Route path="cve" element={<LegacySourceRedirect source="cve" />} />
            <Route path="cve/new" element={<Navigate to={legacyCveNewUrl} replace />} />
            <Route path="cve/:id" element={<LegacyCveRecordRedirect />} />
            <Route path="cve/:id/edit" element={<LegacyCveRecordRedirect edit />} />

            {/* Playbooks */}
            <Route path="playbooks" element={<PlaybookList />} />
            <Route path="playbooks/new" element={<PlaybookForm />} />
            <Route path="playbooks/:id" element={<PlaybookDetail />} />
            <Route path="playbooks/:id/edit" element={<PlaybookForm />} />

            <Route path="mitre" element={<LegacySourceRedirect source="mitre" />} />
            <Route path="mitre/layers" element={<LegacyLayersRedirect />} />
            <Route path="mitre/layers/:id" element={<LegacyLayersRedirect />} />

            <Route path="cloak" element={<LegacySourceRedirect source="cloak" />} />

            {/* IOC Manager */}
            <Route path="ioc" element={<IOCPage />} />

            {/* Corrélation Globale */}
            <Route path="correlation" element={<CorrelationPage />} />

            {/* BGP / AS Lookup + Historian */}
            <Route path="bgp" element={<BGPLookup />} />
            <Route path="bgp/historian" element={<BGPHistorian />} />

            {/* OSINT Runner */}
            <Route path="osint" element={<OSINTRunner />} />

            {/* Notes opérationnelles */}
            <Route path="notes" element={<NotesPage />} />

            {/* Cheatsheets */}
            <Route path="cheatsheets" element={<CheatsheetsPage />} />

            <Route path="lolbins" element={<LegacySourceRedirect source="lolbins" />} />

            {/* Encoder / Decoder */}
            <Route path="encoder" element={<EncoderDecoder />} />

            {/* Reverse Shell Generator */}
            <Route path="revshell" element={<RevShellGenerator />} />

            {/* Investigations / Timeline */}
            <Route path="investigations" element={<InvestigationList />} />
            <Route path="investigations/:id" element={<InvestigationDetail />} />

            {/* Paramètres */}
            <Route path="settings" element={<SettingsPage />} />
            <Route path="knowledge" element={<KnowledgeAtlas />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
