import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ToastContainer from './Toast'
import SearchModal from './SearchModal'

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false)

  // Ctrl+K global : ouvrir la recherche depuis n'importe quelle page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar onSearchOpen={() => setSearchOpen(true)} />
      {/* flex-col + h-full pour que les pages plein-écran (chat IA, scans live) remplissent la zone */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Toasts globaux — visibles sur toutes les pages */}
      <ToastContainer />

      {/* Recherche globale Ctrl+K */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
