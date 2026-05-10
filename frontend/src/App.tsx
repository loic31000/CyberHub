import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import Layout from '@/components/Layout'
import Loader from '@/components/Loader'
import Login from '@/pages/Login'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Tools = lazy(() => import('@/pages/Tools'))
const ToolDetail = lazy(() => import('@/pages/ToolDetail'))
const ToolForm = lazy(() => import('@/pages/ToolForm'))
const CTFList = lazy(() => import('@/pages/CTFList'))
const CTFDetail = lazy(() => import('@/pages/CTFDetail'))
const CTFForm = lazy(() => import('@/pages/CTFForm'))
const CVEList = lazy(() => import('@/pages/CVEList'))
const CVEDetail = lazy(() => import('@/pages/CVEDetail'))
const CVEForm = lazy(() => import('@/pages/CVEForm'))
const PlaybookList = lazy(() => import('@/pages/PlaybookList'))
const PlaybookDetail = lazy(() => import('@/pages/PlaybookDetail'))
const PlaybookForm = lazy(() => import('@/pages/PlaybookForm'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const MITREPage = lazy(() => import('@/pages/MITRE'))
const CLOAKPage = lazy(() => import('@/pages/CLOAKPage'))
const IOCPage = lazy(() => import('@/pages/IOCPage'))
const BGPLookup = lazy(() => import('@/pages/BGPLookup'))
const BGPHistorian = lazy(() => import('@/pages/BGPHistorian'))
const CorrelationPage = lazy(() => import('@/pages/CorrelationPage'))
const OSINTRunner = lazy(() => import('@/pages/OSINTRunner'))
const NotesPage = lazy(() => import('@/pages/NotesPage'))
const CheatsheetsPage = lazy(() => import('@/pages/CheatsheetsPage'))
const LOLBinsPage = lazy(() => import('@/pages/LOLBinsPage'))
const EncoderDecoder = lazy(() => import('@/pages/EncoderDecoder'))
const RevShellGenerator = lazy(() => import('@/pages/RevShellGenerator'))
const InvestigationList = lazy(() => import('@/pages/InvestigationList'))
const InvestigationDetail = lazy(() => import('@/pages/InvestigationDetail'))
const MITRELayers = lazy(() => import('@/pages/MITRELayers'))
const MITRELayerDetail = lazy(() => import('@/pages/MITRELayerDetail'))

// Guard : redirige vers /login si non authentifié
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Route publique */}
          <Route path="/login" element={<Login />} />

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

            {/* CVE */}
            <Route path="cve" element={<CVEList />} />
            <Route path="cve/new" element={<CVEForm />} />
            <Route path="cve/:id" element={<CVEDetail />} />
            <Route path="cve/:id/edit" element={<CVEForm />} />

            {/* Playbooks */}
            <Route path="playbooks" element={<PlaybookList />} />
            <Route path="playbooks/new" element={<PlaybookForm />} />
            <Route path="playbooks/:id" element={<PlaybookDetail />} />
            <Route path="playbooks/:id/edit" element={<PlaybookForm />} />

            {/* MITRE ATT&CK */}
            <Route path="mitre" element={<MITREPage />} />
            <Route path="mitre/layers" element={<MITRELayers />} />
            <Route path="mitre/layers/:id" element={<MITRELayerDetail />} />

            {/* CLOAK - OpSec concealment TTPs */}
            <Route path="cloak" element={<CLOAKPage />} />

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

            {/* LOLBins & GTFOBins */}
            <Route path="lolbins" element={<LOLBinsPage />} />

            {/* Encoder / Decoder */}
            <Route path="encoder" element={<EncoderDecoder />} />

            {/* Reverse Shell Generator */}
            <Route path="revshell" element={<RevShellGenerator />} />

            {/* Investigations / Timeline */}
            <Route path="investigations" element={<InvestigationList />} />
            <Route path="investigations/:id" element={<InvestigationDetail />} />

            {/* Paramètres */}
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
