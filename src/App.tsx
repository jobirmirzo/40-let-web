import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES } from './menu'
import type { CartLine, Category, Coords, MenuItem, OrderPayload } from './types'
import { fetchFoods, getTelegramUser, requestLocation, submitOrder } from './api'
import { useTheme } from './useTheme'
import './App.css'

type SubmitState = 'idle' | 'locating' | 'sending' | 'done' | 'error'
type Tab = 'menu' | 'profile'

function App() {
  const [active, setActive] = useState<Category>('food')
  const [tab, setTab] = useState<Tab>('menu')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [status, setStatus] = useState<SubmitState>('idle')
  const [message, setMessage] = useState('')
  const [foods, setFoods] = useState<MenuItem[]>([])
  const [theme, toggleTheme] = useTheme()

  const user = useMemo(() => getTelegramUser(), [])

  // Load the menu from the backend; customers only see active items.
  useEffect(() => {
    fetchFoods().then((all) => setFoods(all.filter((m) => m.active)))
  }, [])

  const visibleItems = useMemo(
    () => foods.filter((m) => m.category === active),
    [foods, active],
  )

  const lines = useMemo<CartLine[]>(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ item: foods.find((m) => m.id === id)!, qty }))
      .filter((l) => l.item)
  }, [cart, foods])

  const count = lines.reduce((n, l) => n + l.qty, 0)
  const total = lines.reduce((sum, l) => sum + l.item.price * l.qty, 0)

  function add(item: MenuItem) {
    setCart((c) => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }))
  }

  function remove(item: MenuItem) {
    setCart((c) => {
      const next = (c[item.id] ?? 0) - 1
      const copy = { ...c }
      if (next <= 0) delete copy[item.id]
      else copy[item.id] = next
      return copy
    })
  }

  async function checkout() {
    let location: Coords | null = null
    setStatus('locating')
    setMessage('Getting your location…')
    try {
      location = await requestLocation()
    } catch (err) {
      // Location is optional — let the order go through without it.
      location = null
      setMessage(err instanceof Error ? err.message : 'Location unavailable')
    }

    const payload: OrderPayload = {
      lines: lines.map((l) => ({
        id: l.item.id,
        name: l.item.name,
        price: l.item.price,
        qty: l.qty,
      })),
      total,
      location,
      createdAt: new Date().toISOString(),
    }

    setStatus('sending')
    setMessage('Sending your order…')
    try {
      await submitOrder(payload)
      setStatus('done')
      setMessage('Order placed! 🎉')
      setCart({})
      setTimeout(() => {
        setSheetOpen(false)
        setStatus('idle')
        setMessage('')
      }, 1600)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div className="app">
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {tab === 'menu' ? (
        <>
          <header className="app-header">
            <h1>Order Food V1</h1>
            <p>Pick a category and add items to your basket</p>
          </header>

          <nav className="tabs">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`tab ${active === c.id ? 'is-active' : ''}`}
                onClick={() => setActive(c.id)}
              >
                <span className="tab-emoji">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </nav>

          <main className="menu">
            {visibleItems.map((item) => {
              const qty = cart[item.id] ?? 0
              return (
                <div key={item.id} className="card">
                  {item.image ? (
                    <img className="card-img" src={item.image} alt="" />
                  ) : (
                    <div className="card-emoji">{item.emoji}</div>
                  )}
                  <div className="card-body">
                    <div className="card-name">{item.name}</div>
                    {item.description && (
                      <div className="card-desc">{item.description}</div>
                    )}
                    <div className="card-price">${item.price.toFixed(2)}</div>
                  </div>

                  {qty === 0 ? (
                    <button
                      type="button"
                      className="add-btn"
                      onClick={() => add(item)}
                    >
                      Add
                    </button>
                  ) : (
                    <div className="stepper">
                      <button type="button" onClick={() => remove(item)} aria-label="Remove one">
                        −
                      </button>
                      <span>{qty}</span>
                      <button type="button" onClick={() => add(item)} aria-label="Add one">
                        +
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </main>
        </>
      ) : (
        <section className="profile">
          <header className="app-header">
            <h1>Profile</h1>
          </header>
          <div className="profile-card">
            {user?.photo_url ? (
              <img className="profile-avatar" src={user.photo_url} alt="" />
            ) : (
              <div className="profile-avatar profile-avatar--fallback">
                {(user?.first_name ?? '👤').charAt(0)}
              </div>
            )}
            <div className="profile-name">
              {user ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'Guest'}
            </div>
            {user?.username && <div className="profile-username">@{user.username}</div>}
          </div>
          <div className="profile-rows">
            <div className="profile-row">
              <span>Items in basket</span>
              <span>{count}</span>
            </div>
            <div className="profile-row">
              <span>Basket total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Floating "view basket" CTA — sits above the bottom navbar */}
      {tab === 'menu' && count > 0 && !sheetOpen && (
        <button
          type="button"
          className="basket-bar"
          onClick={() => setSheetOpen(true)}
        >
          <span className="basket-count">{count}</span>
          <span className="basket-label">View basket</span>
          <span className="basket-total">${total.toFixed(2)}</span>
        </button>
      )}

      {/* Fixed bottom navbar */}
      <nav className="bottom-nav">
        <button
          type="button"
          className={`nav-btn ${tab === 'menu' ? 'is-active' : ''}`}
          onClick={() => setTab('menu')}
        >
          <span className="nav-icon">🍽️</span>
          <span className="nav-label">Menu</span>
        </button>
        <button
          type="button"
          className="nav-btn"
          onClick={() => setSheetOpen(true)}
        >
          <span className="nav-icon">
            🛒
            {count > 0 && <span className="nav-badge">{count}</span>}
          </span>
          <span className="nav-label">Basket</span>
        </button>
        <button
          type="button"
          className={`nav-btn ${tab === 'profile' ? 'is-active' : ''}`}
          onClick={() => setTab('profile')}
        >
          <span className="nav-icon">👤</span>
          <span className="nav-label">Profile</span>
        </button>
      </nav>

      {/* Checkout sheet */}
      {sheetOpen && (
        <div className="sheet-backdrop" onClick={() => status === 'idle' && setSheetOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>Your basket</h2>

            <div className="sheet-lines">
              {lines.map((l) => (
                <div key={l.item.id} className="sheet-line">
                  <span className="sheet-line-emoji">{l.item.emoji}</span>
                  <span className="sheet-line-name">{l.item.name}</span>
                  <div className="stepper small">
                    <button type="button" onClick={() => remove(l.item)} aria-label="Remove one">
                      −
                    </button>
                    <span>{l.qty}</span>
                    <button type="button" onClick={() => add(l.item)} aria-label="Add one">
                      +
                    </button>
                  </div>
                  <span className="sheet-line-price">
                    ${(l.item.price * l.qty).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="sheet-total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            {message && (
              <p className={`sheet-msg ${status}`}>{message}</p>
            )}

            <button
              type="button"
              className="checkout-btn"
              disabled={status === 'locating' || status === 'sending' || status === 'done'}
              onClick={checkout}
            >
              {status === 'locating' || status === 'sending'
                ? 'Please wait…'
                : status === 'done'
                  ? 'Done ✓'
                  : 'Share location & order'}
            </button>

            {status === 'idle' && (
              <button
                type="button"
                className="close-btn"
                onClick={() => setSheetOpen(false)}
              >
                Keep browsing
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
