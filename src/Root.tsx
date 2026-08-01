import { useEffect, useRef, useState } from 'react'
import App from './App'
import AdminPage from './AdminPage'
import { fetchRole, getToken, setToken } from './api'
import { useTheme } from './useTheme'
import type { Role } from './types'
import './App.css'

/** Decides which experience to show based on the signed-in user's role. */
export default function Root() {
  useTheme() // apply the saved theme app-wide (incl. while loading + admin)
  const [role, setRole] = useState<Role | null>(null)
  const [previewAsUser, setPreviewAsUser] = useState(false)
  // The admin's token, stashed while previewing so requests stop going out
  // with admin auth — restored when they switch back.
  const stashedAdminToken = useRef<string | null>(null)

  useEffect(() => {
    fetchRole().then(setRole)
  }, [])

  if (role === null) {
    return <div className="loading">Loading…</div>
  }

  function enterPreview() {
    stashedAdminToken.current = getToken()
    setToken(null)
    setPreviewAsUser(true)
  }

  function exitPreview() {
    setToken(stashedAdminToken.current)
    stashedAdminToken.current = null
    setPreviewAsUser(false)
  }

  if (role === 'admin' && previewAsUser) {
    return <App onExitAdminPreview={exitPreview} />
  }

  return role === 'admin' ? (
    <AdminPage onPreviewAsUser={enterPreview} />
  ) : (
    <App />
  )
}
