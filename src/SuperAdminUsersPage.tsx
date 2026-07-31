import { useCallback, useEffect, useState } from 'react'
import type { BotUser } from './types'
import { fetchUsers, signOut, updateUserRole } from './api'
import { useTheme } from './useTheme'
import Banner from './Banner'
import './App.css'
import './Admin.css'

/**
 * The page the bot's "Adminlarni boshqarish" button opens (?page=admins,
 * superadmin only — see Root.tsx and KippoHandler.StartSuperAdmin). Lists
 * every BotUser and lets the superadmin promote/demote plain users to admin.
 * Other superadmins are shown but not editable here — that role only comes
 * from the SuperAdmin:ChatIds config, not this UI.
 */
export default function SuperAdminUsersPage() {
  const [theme, toggleTheme] = useTheme()
  const [users, setUsers] = useState<BotUser[]>([])
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      setUsers(await fetchUsers())
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load users')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleAdmin(user: BotUser) {
    const isAdmin = user.role?.toLowerCase() === 'admin'
    const nextRole = isAdmin ? 'user' : 'admin'
    const before = users
    setBusyId(user.id)
    setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)))
    try {
      await updateUserRole(user.id, nextRole)
    } catch (err) {
      setUsers(before)
      setLoadError(err instanceof Error ? err.message : 'Could not update the role')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="app admin">
      <Banner />

      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <button
        type="button"
        className="logout-toggle"
        onClick={signOut}
        aria-label="Sign out"
        title="Sign out"
      >
        ⎋
      </button>

      <header className="app-header">
        <h1>Adminlarni boshqarish</h1>
        <p>{users.length} foydalanuvchi</p>
      </header>

      {loadError && (
        <div className="state-msg state-msg--error">
          <p>{loadError}</p>
          <button type="button" className="retry-btn" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!loadError && users.length === 0 && (
        <p className="state-msg">Hali hech kim ro'yxatdan o'tmagan.</p>
      )}

      <div className="admin-list">
        {users.map((user) => {
          const role = user.role?.toLowerCase()
          const isAdmin = role === 'admin'
          const isSuperAdmin = role === 'superadmin'

          return (
          <div key={user.id} className="admin-row">
            <div className="admin-row-body">
              <div className="card-name">{user.fullname || `User #${user.id}`}</div>
              <div className="admin-row-meta">
                {user.phoneNumber ?? 'raqam yo’q'} · {user.role ?? 'user'}
              </div>
            </div>

            {isSuperAdmin ? (
              <span className="badge-discount">Superadmin</span>
            ) : (
              <button
                type="button"
                className={`switch ${isAdmin ? 'on' : 'off'}`}
                role="switch"
                aria-checked={isAdmin}
                aria-label={isAdmin ? 'Adminlikdan olish' : 'Admin qilish'}
                disabled={busyId === user.id}
                onClick={() => toggleAdmin(user)}
              >
                <span className="switch-knob" />
              </button>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}
