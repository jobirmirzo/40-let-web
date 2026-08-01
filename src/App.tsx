import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  LayoutDashboard,
  Moon,
  RefreshCw,
  ShoppingCart,
  Sun,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react'
import {
  CATEGORIES,
  STATUS_ICON,
  STATUS_LABELS,
  categoryIcon,
  effectivePrice,
  formatPrice,
} from './menu'
import { Status } from './types'
import type { CartLine, Category, Coords, Food, Order } from './types'
import {
  createCheck,
  createOrder,
  fetchFoods,
  fetchOrders,
  getTelegramUser,
  requestLocation,
  signOut,
} from './api'
import { useTheme } from './useTheme'
import Banner from './Banner'
import './App.css'

type SubmitState = 'idle' | 'locating' | 'sending' | 'done' | 'error'
type Tab = 'menu' | 'orders' | 'profile'

/** Orders that are still moving; anything else is history. */
const isLive = (o: Order) =>
  o.status !== Status.Delivered && o.status !== Status.Canceled

type Props = {
  /** Set when an admin is previewing the customer app — lets them jump back. */
  onExitAdminPreview?: () => void
}

const CART_KEY = 'cart'

/** Survives closing/reloading the Mini App — read once at startup. */
function loadCart(): Record<number, number> {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function App({ onExitAdminPreview }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0].id)
  const [tab, setTab] = useState<Tab>('menu')
  const [cart, setCart] = useState<Record<number, number>>(loadCart)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [status, setStatus] = useState<SubmitState>('idle')
  const [message, setMessage] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [theme, toggleTheme] = useTheme()

  const user = useMemo(() => getTelegramUser(), [])

  const loadFoods = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setFoods(await fetchFoods())
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the menu')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOrders = useCallback(async () => {
    try {
      // TODO(backend): GET /orders returns *every* order — there is no per-user
      // filter yet. The BotUserOrder model exists but has no endpoint, so this
      // list isn't scoped to the signed-in customer.
      const all = await fetchOrders()
      setOrders([...all].sort((a, b) => b.id - a.id))
    } catch {
      // The orders tab shows its own empty state; don't block the menu.
    }
  }, [])

  useEffect(() => {
    loadFoods()
    loadOrders()
  }, [loadFoods, loadOrders])

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  async function refresh() {
    setRefreshing(true)
    await Promise.all([loadFoods(), loadOrders()])
    setRefreshing(false)
  }

  // Keep live order statuses fresh while the customer is watching them.
  useEffect(() => {
    if (tab !== 'orders') return
    const id = setInterval(loadOrders, 10000)
    return () => clearInterval(id)
  }, [tab, loadOrders])

  const visibleItems = useMemo(
    () => foods.filter((f) => f.category === activeCategory),
    [foods, activeCategory],
  )

  const lines = useMemo<CartLine[]>(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ food: foods.find((f) => f.id === Number(id))!, qty }))
        .filter((l) => l.food),
    [cart, foods],
  )

  const count = lines.reduce((n, l) => n + l.qty, 0)
  const total = lines.reduce((sum, l) => sum + effectivePrice(l.food) * l.qty, 0)
  /** What the basket would cost with no discounts — used to show the saving. */
  const listTotal = lines.reduce((sum, l) => sum + l.food.price * l.qty, 0)
  const saved = listTotal - total

  const add = (food: Food) =>
    setCart((c) => ({ ...c, [food.id]: (c[food.id] ?? 0) + 1 }))

  const remove = (food: Food) =>
    setCart((c) => {
      const next = (c[food.id] ?? 0) - 1
      const copy = { ...c }
      if (next <= 0) delete copy[food.id]
      else copy[food.id] = next
      return copy
    })

  async function checkout() {
    if (lines.length === 0) return

    let location: Coords | null = null
    setStatus('locating')
    setMessage('Getting your location…')
    try {
      location = await requestLocation()
    } catch (err) {
      // Location is optional — let the order go through without it.
      setMessage(err instanceof Error ? err.message : 'Location unavailable')
    }

    setStatus('sending')
    setMessage('Sending your order…')
    try {
      const order = await createOrder({
        status: Status.InProgress,
        // Basket-level promo codes aren't wired up yet; item discounts are
        // already baked into each line's unitPrice.
        discount: 0,
        hasPromoCode: false,
        totalPrice: Number(total.toFixed(2)),
        items: lines.map((l) => ({
          foodId: l.food.id,
          quantity: l.qty,
          unitPrice: Number(effectivePrice(l.food).toFixed(2)),
          discount: l.food.hasDiscount ? l.food.discount : 0,
          totalPrice: Number((effectivePrice(l.food) * l.qty).toFixed(2)),
        })),
      })

      // The receipt. Not fatal if it fails — the order itself is already saved.
      await createCheck({
        orderId: order.id,
        withdrawal: Number(total.toFixed(2)),
        orderedCount: count,
        withPromoCode: false,
        discountedAmount: Number(saved.toFixed(2)),
        discount: 0,
      }).catch(() => undefined)

      setStatus('done')
      setMessage(
        location
          ? `Order #${order.id} placed! 🎉`
          : `Order #${order.id} placed — we'll call about delivery 🎉`,
      )
      setCart({})
      loadOrders()
      setTimeout(() => {
        setSheetOpen(false)
        setStatus('idle')
        setMessage('')
        setTab('orders')
      }, 1600)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const busy = status === 'locating' || status === 'sending' || status === 'done'
  const liveOrders = orders.filter(isLive)

  return (
    <div className="app">
      <Banner />

      <div className="icon-row">
        {onExitAdminPreview && (
          <button
            type="button"
            className="icon-toggle admin-back-toggle"
            onClick={onExitAdminPreview}
            aria-label="Back to admin panel"
            title="Back to admin panel"
          >
            <LayoutDashboard />
          </button>
        )}

        <button
          type="button"
          className={`icon-toggle refresh-toggle ${refreshing ? 'is-spinning' : ''}`}
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw />
        </button>

        <button
          type="button"
          className="icon-toggle theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </div>

      {tab === 'menu' && (
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
                className={`tab ${activeCategory === c.id ? 'is-active' : ''}`}
                onClick={() => setActiveCategory(c.id)}
              >
                <c.icon className="tab-icon" />
                {c.label}
              </button>
            ))}
          </nav>

          <main className="menu">
            {loading && <p className="state-msg">Loading the menu…</p>}

            {!loading && loadError && (
              <div className="state-msg state-msg--error">
                <p>{loadError}</p>
                <button type="button" className="retry-btn" onClick={loadFoods}>
                  Try again
                </button>
              </div>
            )}

            {!loading && !loadError && visibleItems.length === 0 && (
              <p className="state-msg">Nothing here yet — check the other tab.</p>
            )}

            {visibleItems.map((food) => {
              const qty = cart[food.id] ?? 0
              const price = effectivePrice(food)
              const discounted = price < food.price
              const CategoryIcon = categoryIcon(food.category)

              return (
                <div key={food.id} className="card">
                  {food.image ? (
                    <img className="card-img" src={food.image} alt="" />
                  ) : (
                    <div className="card-icon">
                      <CategoryIcon />
                    </div>
                  )}
                  <div className="card-body">
                    <div className="card-name">{food.name ?? 'Unnamed item'}</div>
                    <div className="card-price">
                      {formatPrice(price)}
                      {discounted && (
                        <>
                          <span className="card-price-was">{formatPrice(food.price)}</span>
                          <span className="badge-discount">−{food.discount}%</span>
                        </>
                      )}
                    </div>
                  </div>

                  {qty === 0 ? (
                    <button type="button" className="add-btn" onClick={() => add(food)}>
                      Add
                    </button>
                  ) : (
                    <div className="stepper">
                      <button type="button" onClick={() => remove(food)} aria-label="Remove one">
                        −
                      </button>
                      <span>{qty}</span>
                      <button type="button" onClick={() => add(food)} aria-label="Add one">
                        +
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </main>
        </>
      )}

      {tab === 'orders' && (
        <section>
          <header className="app-header">
            <h1>Your orders</h1>
            <p>{liveOrders.length > 0 ? 'Tracking live' : 'Past and present'}</p>
          </header>

          {orders.length === 0 ? (
            <p className="state-msg">No orders yet. Your basket is waiting 🍔</p>
          ) : (
            <div className="orders">
              {orders.map((order) => {
                const StatusIcon = STATUS_ICON[order.status]
                return (
                <article key={order.id} className="order-card">
                  <div className="order-head">
                    <span className="order-id">Order #{order.id}</span>
                    <span className={`status-pill status-${order.status}`}>
                      <StatusIcon /> {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  <div className="order-lines">
                    {order.items.map((item) => {
                      const food = foods.find((f) => f.id === item.foodId)
                      return (
                        <div key={item.id} className="order-line">
                          <span>
                            {item.quantity}× {food?.name ?? `Item ${item.foodId}`}
                          </span>
                          <span>{formatPrice(item.totalPrice)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="order-foot">
                    <span>{new Date(order.createdAt).toLocaleString()}</span>
                    <strong>{formatPrice(order.totalPrice)}</strong>
                  </div>
                </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'profile' && (
        <section className="profile">
          <header className="app-header">
            <h1>Profile</h1>
          </header>
          <div className="profile-card">
            {user?.photo_url ? (
              <img className="profile-avatar" src={user.photo_url} alt="" />
            ) : user?.first_name ? (
              <div className="profile-avatar profile-avatar--fallback">
                {user.first_name.charAt(0)}
              </div>
            ) : (
              <div className="profile-avatar profile-avatar--fallback">
                <UserRound />
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
              <span>{formatPrice(total)}</span>
            </div>
            <div className="profile-row">
              <span>Orders placed</span>
              <span>{orders.length}</span>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={signOut}>
            Sign out
          </button>
        </section>
      )}

      {/* Floating "view basket" CTA — sits above the bottom navbar */}
      {tab === 'menu' && count > 0 && !sheetOpen && (
        <button type="button" className="basket-bar" onClick={() => setSheetOpen(true)}>
          <span className="basket-count">{count}</span>
          <span className="basket-label">View basket</span>
          <span className="basket-total">{formatPrice(total)}</span>
        </button>
      )}

      {/* Fixed bottom navbar */}
      <nav className="bottom-nav">
        <button
          type="button"
          className={`nav-btn ${tab === 'menu' ? 'is-active' : ''}`}
          onClick={() => setTab('menu')}
        >
          <span className="nav-icon">
            <UtensilsCrossed />
          </span>
          <span className="nav-label">Menu</span>
        </button>
        <button type="button" className="nav-btn" onClick={() => setSheetOpen(true)}>
          <span className="nav-icon">
            <ShoppingCart />
            {count > 0 && <span className="nav-badge">{count}</span>}
          </span>
          <span className="nav-label">Basket</span>
        </button>
        <button
          type="button"
          className={`nav-btn ${tab === 'orders' ? 'is-active' : ''}`}
          onClick={() => setTab('orders')}
        >
          <span className="nav-icon">
            <ClipboardList />
            {liveOrders.length > 0 && <span className="nav-badge">{liveOrders.length}</span>}
          </span>
          <span className="nav-label">Orders</span>
        </button>
        <button
          type="button"
          className={`nav-btn ${tab === 'profile' ? 'is-active' : ''}`}
          onClick={() => setTab('profile')}
        >
          <span className="nav-icon">
            <UserRound />
          </span>
          <span className="nav-label">Profile</span>
        </button>
      </nav>

      {/* Checkout sheet */}
      {sheetOpen && (
        <div className="sheet-backdrop" onClick={() => !busy && setSheetOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>Your basket</h2>

            {lines.length === 0 ? (
              <p className="state-msg">Your basket is empty.</p>
            ) : (
              <>
                <div className="sheet-lines">
                  {lines.map((l) => {
                    const LineIcon = categoryIcon(l.food.category)
                    return (
                    <div key={l.food.id} className="sheet-line">
                      <span className="sheet-line-icon">
                        <LineIcon size={20} />
                      </span>
                      <span className="sheet-line-name">{l.food.name ?? 'Unnamed item'}</span>
                      <div className="stepper small">
                        <button type="button" onClick={() => remove(l.food)} aria-label="Remove one">
                          −
                        </button>
                        <span>{l.qty}</span>
                        <button type="button" onClick={() => add(l.food)} aria-label="Add one">
                          +
                        </button>
                      </div>
                      <span className="sheet-line-price">
                        {formatPrice(effectivePrice(l.food) * l.qty)}
                      </span>
                    </div>
                    )
                  })}
                </div>

                {saved > 0.005 && (
                  <div className="sheet-saved">
                    <span>Discounts</span>
                    <span>−{formatPrice(saved)}</span>
                  </div>
                )}

                <div className="sheet-total">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </>
            )}

            {message && <p className={`sheet-msg ${status}`}>{message}</p>}

            {lines.length > 0 && (
              <button
                type="button"
                className="checkout-btn"
                disabled={busy}
                onClick={checkout}
              >
                {status === 'locating' || status === 'sending'
                  ? 'Please wait…'
                  : status === 'done'
                    ? 'Done ✓'
                    : 'Share location & order'}
              </button>
            )}

            {!busy && (
              <button type="button" className="close-btn" onClick={() => setSheetOpen(false)}>
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
