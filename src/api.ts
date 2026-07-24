import type { Coords, MenuItem, NewFood, OrderPayload, Role } from './types'
import { MENU } from './menu'

// ---------------------------------------------------------------------------
// Location + order submission.
// The UI is done. Fill in the fetch() below with your real backend endpoint.
// ---------------------------------------------------------------------------

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface TelegramWebApp {
  LocationManager?: {
    init: (cb: () => void) => void
    getLocation: (cb: (data: { latitude: number; longitude: number } | null) => void) => void
  }
  initData?: string
  initDataUnsafe?: { user?: TelegramUser }
}

function getTelegram(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
}

/** The signed-in Telegram user, if the app is running inside a Mini App. */
export function getTelegramUser(): TelegramUser | null {
  return getTelegram()?.initDataUnsafe?.user ?? null
}

/**
 * Ask the user to share their location.
 * Uses Telegram's LocationManager inside a Mini App, otherwise falls back to
 * the browser Geolocation API. Rejects if the user denies or it's unavailable.
 */
export function requestLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    const tg = getTelegram()

    if (tg?.LocationManager) {
      tg.LocationManager.init(() => {
        tg.LocationManager!.getLocation((data) => {
          if (data) resolve({ latitude: data.latitude, longitude: data.longitude })
          else reject(new Error('Location access was denied'))
        })
      })
      return
    }

    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported on this device'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Could not get location')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}

/**
 * Send the finished order to the backend.
 *
 * TODO(backend): point this at your real endpoint. The `initData` header lets
 * you verify the Telegram user server-side.
 */
export async function submitOrder(payload: OrderPayload): Promise<void> {
  const tg = getTelegram()

  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(tg?.initData ? { 'X-Telegram-Init-Data': tg.initData } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`Order failed (${res.status})`)
  }
}

// ---------------------------------------------------------------------------
// Roles + menu management (admin).
// These are stubs returning local data so the UI works before the backend
// exists. Replace each body with a real fetch() when the API is ready.
// ---------------------------------------------------------------------------

/**
 * Resolve the current user's role.
 *
 * For local testing you can force a role with `?role=admin` in the URL or
 * `localStorage.setItem('role', 'admin')`. In production, replace the body
 * with a call to your backend (which reads the verified Telegram user).
 */
export async function fetchRole(): Promise<Role> {
  const fromQuery = new URLSearchParams(window.location.search).get('role')
  const override = fromQuery ?? localStorage.getItem('role')
  if (override === 'admin' || override === 'customer') return override

  // TODO(backend): const res = await fetch('/api/me', { headers: {...} })
  //                return (await res.json()).role
  return 'customer'
}

// In-memory copy so admin edits persist within a session without a backend.
let foods: MenuItem[] = MENU.map((m) => ({ ...m }))

/** All menu items (admin sees every item; customers filter to active ones). */
export async function fetchFoods(): Promise<MenuItem[]> {
  // TODO(backend): return (await fetch('/api/foods')).json()
  return foods.map((m) => ({ ...m }))
}

/** Create a new menu item. Returns the created item (with its id). */
export async function createFood(food: NewFood): Promise<MenuItem> {
  const created: MenuItem = {
    id: `food_${Date.now()}`,
    emoji: '🍽️',
    active: true,
    ...food,
  }
  // TODO(backend): POST /api/foods (multipart if uploading the raw image file)
  foods = [created, ...foods]
  return { ...created }
}

/** Activate or deactivate a menu item. */
export async function setFoodActive(id: string, active: boolean): Promise<void> {
  // TODO(backend): PATCH /api/foods/:id { active }
  foods = foods.map((m) => (m.id === id ? { ...m, active } : m))
}
