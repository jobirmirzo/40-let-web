import type {
  BotUser,
  CheckInput,
  Coords,
  Food,
  FoodInput,
  Order,
  OrderInput,
  Role,
  Status,
} from './types'

// ---------------------------------------------------------------------------
// HTTP client for the 40Let API.
//
// Requests go to `/api/*`, which the Vite dev server proxies to the backend
// (see vite.config.ts). That keeps the browser same-origin, so no CORS setup is
// needed on the ASP.NET side. Set VITE_API_BASE to call a deployed API directly.
// ---------------------------------------------------------------------------
const BASE = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** The JWT from POST /auth/token, kept for the endpoints that require it. */
let token: string | null = localStorage.getItem('token')

function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers ?? {}) },
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the API running?', 0)
  }

  if (!res.ok) {
    // Surface the API's ProblemDetails message when there is one.
    const body = await res.text().catch(() => '')
    let detail = ''
    try {
      const parsed = JSON.parse(body)
      detail = parsed.detail ?? parsed.title ?? ''
    } catch {
      detail = body.slice(0, 200)
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status)
  }

  // 204 No Content — nothing to parse.
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// ---------------------------------------------------------------------------
// Telegram Mini App bridge
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

// ---------------------------------------------------------------------------
// Auth + role  (/auth, /users)
// ---------------------------------------------------------------------------

/** POST /auth/token — the shape the API returns. */
interface TokenView {
  accessToken: string
  expiresAt: string
}

function storeToken(res: TokenView): string {
  token = res.accessToken
  localStorage.setItem('token', token)
  return token
}

/** Exchange a phone number for a JWT and remember it. */
export async function login(phoneNumber: string): Promise<string> {
  return storeToken(
    await request<TokenView>('/auth/token', { method: 'POST', ...json({ phoneNumber }) }),
  )
}

/** Exchange the client id from the Mini App URL for a JWT and remember it. */
export async function loginByClientId(clientId: number): Promise<string> {
  return storeToken(
    await request<TokenView>(`/auth/token/${clientId}`, { method: 'POST' }),
  )
}

export function logout(): void {
  token = null
  localStorage.removeItem('token')
}

export const isLoggedIn = () => token !== null

/**
 * Clear the session and reload on a clean URL.
 *
 * The `?clientId=` still in the address bar would be traded for a fresh token
 * on the next load, so it has to go — otherwise signing out puts the user
 * straight back where they were.
 */
export function signOut(): void {
  logout()
  window.location.replace(window.location.pathname)
}

/** The authenticated user, or null when there's no valid token. */
export async function fetchMe(): Promise<BotUser | null> {
  if (!token) return null
  try {
    return await request<BotUser>('/users/me')
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
      logout()
      return null
    }
    throw err
  }
}

/** The claims the API puts in the token. */
interface JwtPayload {
  sub?: string
  role?: string
  chat_id?: string
  exp?: number
}

/** Read a JWT's payload. Null when it's malformed or already expired. */
function decodeToken(raw: string): JwtPayload | null {
  const segment = raw.split('.')[1]
  if (!segment) return null

  try {
    // base64url -> base64, then decode the bytes as UTF-8.
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as JwtPayload

    if (claims.exp && claims.exp * 1000 <= Date.now()) return null
    return claims
  } catch {
    return null
  }
}

/** The signed-in user's claims, or null when there's no usable token. */
export function getClaims(): JwtPayload | null {
  return token ? decodeToken(token) : null
}

/**
 * Resolve the current user's role from the JWT.
 *
 * The bot opens the Mini App as `?clientId=<number>`. That id is traded for a
 * signed token (POST /auth/token/{clientId}) and the role comes from the
 * token's `role` claim — never from the URL. A token kept from an earlier
 * session is reused until it expires.
 */
export async function fetchRole(): Promise<Role> {
  const clientId = Number(new URLSearchParams(window.location.search).get('clientId'))
  if (Number.isInteger(clientId) && clientId > 0) {
    // Don't swallow this — a failed exchange used to fall through silently
    // and land on whatever stale token happened to be in storage, which made
    // "why am I seeing the customer view" impossible to diagnose.
    await loginByClientId(clientId)
  }

  const claims = getClaims()
  if (!claims) {
    // Missing or expired token — drop it and fall back to the customer UI.
    if (token) logout()
    return 'customer'
  }

  const role = claims.role?.toLowerCase()
  if (role === 'superadmin') return 'superadmin'
  if (role === 'admin') return 'admin'
  return 'customer'
}

// ---------------------------------------------------------------------------
// Users  (/users) — superadmin only, for the "Manage admins" Mini App page.
// ---------------------------------------------------------------------------

export const fetchUsers = () => request<BotUser[]>('/users')

/** Promote a user to admin, or demote an admin back to a plain user. */
export const updateUserRole = (id: number, role: 'admin' | 'user') =>
  request<void>(`/users/${id}/role`, { method: 'PATCH', ...json({ role }) })

// ---------------------------------------------------------------------------
// Foods  (/foods)
// ---------------------------------------------------------------------------

export const fetchFoods = () => request<Food[]>('/foods')

export const fetchFood = (id: number) => request<Food>(`/foods/${id}`)

/** Foods are multipart because the image is uploaded with the record. */
function foodForm(input: FoodInput): FormData {
  const form = new FormData()
  form.append('Name', input.name)
  form.append('Price', String(input.price))
  form.append('Category', String(input.category))
  form.append('Discount', String(input.discount))
  form.append('HasDiscount', String(input.hasDiscount))
  if (input.imageFile) form.append('ImageFile', input.imageFile)
  return form
}

export const createFood = (input: FoodInput) =>
  request<Food>('/foods', { method: 'POST', body: foodForm(input) })

/** Omit `imageFile` to keep the existing image. */
export const updateFood = (id: number, input: FoodInput) =>
  request<void>(`/foods/${id}`, { method: 'PUT', body: foodForm(input) })

export const deleteFood = (id: number) =>
  request<void>(`/foods/${id}`, { method: 'DELETE' })

// ---------------------------------------------------------------------------
// Orders  (/orders)
// ---------------------------------------------------------------------------

export const fetchOrders = () => request<Order[]>('/orders')

export const fetchOrder = (id: number) => request<Order>(`/orders/${id}`)

export const createOrder = (input: OrderInput) =>
  request<Order>('/orders', { method: 'POST', ...json(input) })

export const updateOrder = (id: number, input: OrderInput) =>
  request<void>(`/orders/${id}`, { method: 'PUT', ...json(input) })

/** Moves an order along without resending the basket. */
export const updateOrderStatus = (id: number, status: Status) =>
  request<void>(`/orders/${id}/status`, { method: 'PATCH', ...json({ status }) })

export const deleteOrder = (id: number) =>
  request<void>(`/orders/${id}`, { method: 'DELETE' })

// ---------------------------------------------------------------------------
// Checks  (/checks) — the receipt written once an order is placed.
// ---------------------------------------------------------------------------

export const createCheck = (input: CheckInput) =>
  request<{ id: number }>('/checks', { method: 'POST', ...json(input) })
