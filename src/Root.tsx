import { useEffect, useState } from 'react'
import App from './App'
import AdminPage from './AdminPage'
import SuperAdminUsersPage from './SuperAdminUsersPage'
import { fetchRole } from './api'
import { useTheme } from './useTheme'
import type { Role } from './types'
import './App.css'

/** Decides which experience to show based on the signed-in user's role. */
export default function Root() {
  useTheme() // apply the saved theme app-wide (incl. while loading + admin)
  const [role, setRole] = useState<Role | null>(null)
  const [error, setError] = useState('')
  const [previewAsUser, setPreviewAsUser] = useState(false)

  useEffect(() => {
    fetchRole()
      .then(setRole)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not sign in'))
  }, [])

  if (error) {
    return <div className="loading">{error}</div>
  }

  if (role === null) {
    return <div className="loading">Loading…</div>
  }

  // Just swaps which UI renders — the admin's token stays active, since
  // /foods, /orders etc. require *some* authenticated user regardless of
  // role, and there's no separate "customer" identity to switch to.
  if ((role === 'admin' || role === 'superadmin') && previewAsUser) {
    return <App onExitAdminPreview={() => setPreviewAsUser(false)} />
  }

  // The bot's "Adminlarni boshqarish" button opens this exact page (?page=admins).
  const page = new URLSearchParams(window.location.search).get('page')
  if (role === 'superadmin' && page === 'admins') {
    return <SuperAdminUsersPage />
  }

  return role === 'admin' || role === 'superadmin' ? (
    <AdminPage onPreviewAsUser={() => setPreviewAsUser(true)} />
  ) : (
    <App />
  )
}
