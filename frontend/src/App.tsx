import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Loader from '@/components/Loader'
import LandingPage from '@/landing/LandingPage'

const Login = lazy(() => import('@/pages/Login'))
const ConsoleRoutes = lazy(() => import('./ConsoleRoutes'))

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<ConsoleRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  )
}
