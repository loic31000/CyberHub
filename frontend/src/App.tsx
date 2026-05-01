import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Tools from '@/pages/Tools'
import ToolDetail from '@/pages/ToolDetail'
import ToolForm from '@/pages/ToolForm'
import CTFList from '@/pages/CTFList'
import CTFDetail from '@/pages/CTFDetail'
import CTFForm from '@/pages/CTFForm'
import CVEList from '@/pages/CVEList'
import CVEDetail from '@/pages/CVEDetail'
import CVEForm from '@/pages/CVEForm'
import PlaybookList from '@/pages/PlaybookList'
import PlaybookDetail from '@/pages/PlaybookDetail'
import PlaybookForm from '@/pages/PlaybookForm'
import SettingsPage from '@/pages/Settings'
import MITREPage from '@/pages/MITRE'
import IOCPage from '@/pages/IOCPage'

// Guard : redirige vers /login si non authentifié
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
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

          {/* IOC Manager */}
          <Route path="ioc" element={<IOCPage />} />

          {/* Paramètres */}
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}