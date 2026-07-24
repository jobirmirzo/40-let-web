import { useEffect, useState } from 'react'
import App from './App'
import AdminPage from './AdminPage'
import { fetchRole } from './api'
import { useTheme } from './useTheme'
import type { Role } from './types'
import './App.css'

/** Decides which experience to show based on the signed-in user's role. */
export default function Root() {
  useTheme() // apply the saved theme app-wide (incl. while loading + admin)
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    fetchRole().then(setRole)
  }, [])

  if (role === null) {
    return <div className="loading">Loading…</div>
  }

  return role === 'admin' ? <AdminPage /> : <App />
}
