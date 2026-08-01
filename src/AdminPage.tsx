import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Camera,
  ClipboardList,
  LogOut,
  Moon,
  Pencil,
  RefreshCw,
  Sun,
  Trash2,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react'
import {
  CATEGORIES,
  STATUS_ICON,
  STATUS_LABELS,
  categoryIcon,
  categoryLabel,
  effectivePrice,
  formatPrice,
  nextStatus,
} from './menu'
import { Category, Status } from './types'
import type { Food, Order } from './types'
import {
  createFood,
  deleteFood,
  deleteOrder,
  fetchFoods,
  fetchOrders,
  signOut,
  updateFood,
  updateOrderStatus,
} from './api'
import { useTheme } from './useTheme'
import Banner from './Banner'
import './App.css'
import './Admin.css'

type AdminTab = 'menu' | 'orders'

/** Empty form state, also used to reset after a save. */
const blankForm = {
  name: '',
  price: '',
  category: Category.Food as Category,
  discount: '',
  hasDiscount: false,
}

type Props = {
  /** Lets the admin preview the app as a regular, signed-out-of-admin customer. */
  onPreviewAsUser?: () => void
}

export default function AdminPage({ onPreviewAsUser }: Props) {
  const [theme, toggleTheme] = useTheme()
  const [tab, setTab] = useState<AdminTab>('menu')

  const [foods, setFoods] = useState<Food[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loadError, setLoadError] = useState('')
  const [orderError, setOrderError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Form state. `editing` is the id being updated, or null when creating.
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState(blankForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadFoods = useCallback(async () => {
    try {
      setFoods(await fetchFoods())
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load foods')
    }
  }, [])

  const loadOrders = useCallback(async () => {
    try {
      const all = await fetchOrders()
      setOrders([...all].sort((a, b) => b.id - a.id))
    } catch {
      // Menu management still works without the orders board.
    }
  }, [])

  useEffect(() => {
    loadFoods()
    loadOrders()
  }, [loadFoods, loadOrders])

  async function refresh() {
    setRefreshing(true)
    await Promise.all([loadFoods(), loadOrders()])
    setRefreshing(false)
  }

  // Poll the kitchen board so a second admin's changes show up.
  useEffect(() => {
    if (tab !== 'orders') return
    const id = setInterval(loadOrders, 10000)
    return () => clearInterval(id)
  }, [tab, loadOrders])

  const canSubmit = useMemo(
    () => form.name.trim() !== '' && Number(form.price) > 0 && !saving,
    [form, saving],
  )

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function resetForm() {
    setEditing(null)
    setForm(blankForm)
    setImageFile(null)
    setImagePreview(undefined)
    setError('')
  }

  function startEdit(food: Food) {
    setEditing(food.id)
    setForm({
      name: food.name ?? '',
      price: String(food.price),
      category: food.category,
      discount: String(food.discount || ''),
      hasDiscount: food.hasDiscount,
    })
    setImageFile(null)
    setImagePreview(food.image ?? undefined)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      category: form.category,
      discount: form.hasDiscount ? Number(form.discount) || 0 : 0,
      hasDiscount: form.hasDiscount,
      // Sending no file on update keeps the stored image (FoodService only
      // replaces it when ImageFile is present).
      imageFile,
    }

    try {
      if (editing === null) await createFood(payload)
      else await updateFood(editing, payload)
      await loadFoods()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the item')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(food: Food) {
    if (!confirm(`Delete "${food.name ?? 'this item'}" from the menu?`)) return
    const before = foods
    setFoods((list) => list.filter((f) => f.id !== food.id))
    try {
      await deleteFood(food.id)
      if (editing === food.id) resetForm()
    } catch (err) {
      setFoods(before)
      setError(err instanceof Error ? err.message : 'Could not delete the item')
    }
  }

  /** Toggling the discount switch writes straight through to the API. */
  async function onToggleDiscount(food: Food) {
    const next = !food.hasDiscount
    const before = foods
    setFoods((list) =>
      list.map((f) => (f.id === food.id ? { ...f, hasDiscount: next } : f)),
    )
    try {
      await updateFood(food.id, {
        name: food.name ?? '',
        price: food.price,
        category: food.category,
        discount: food.discount,
        hasDiscount: next,
      })
    } catch {
      setFoods(before)
    }
  }

  async function onAdvance(order: Order) {
    const next = nextStatus(order.status)
    if (!next) return
    const before = orders
    setOrders((list) =>
      list.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
    )
    try {
      await updateOrderStatus(order.id, next)
    } catch {
      setOrders(before)
    }
  }

  async function onCancel(order: Order) {
    if (!confirm(`Cancel order #${order.id}?`)) return
    const before = orders
    setOrders((list) =>
      list.map((o) => (o.id === order.id ? { ...o, status: Status.Canceled } : o)),
    )
    try {
      await updateOrderStatus(order.id, Status.Canceled)
    } catch {
      setOrders(before)
    }
  }

  async function onDeleteOrder(order: Order) {
    if (!confirm(`Delete order #${order.id}? This cannot be undone.`)) return
    const before = orders
    setOrders((list) => list.filter((o) => o.id !== order.id))
    setOrderError('')
    try {
      await deleteOrder(order.id)
    } catch {
      setOrders(before)
      // checks.order_id is ON DELETE RESTRICT, so any order with a receipt
      // can't be removed. Say so rather than silently snapping back.
      setOrderError(
        `Order #${order.id} can't be deleted — it has a receipt attached. Cancel it instead.`,
      )
    }
  }

  const openOrders = orders.filter(
    (o) => o.status !== Status.Delivered && o.status !== Status.Canceled,
  )

  return (
    <div className="app admin">
      <Banner />

      <div className="icon-row">
        {onPreviewAsUser && (
          <button
            type="button"
            className="icon-toggle user-mode-toggle"
            onClick={onPreviewAsUser}
            aria-label="Switch to simple user mode"
            title="Switch to simple user mode"
          >
            <UserRound />
          </button>
        )}

        <button
          type="button"
          className="icon-toggle logout-toggle"
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut />
        </button>

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

      <header className="app-header">
        <h1>{tab === 'menu' ? 'Menu Admin' : 'Kitchen'}</h1>
        <p>
          {tab === 'menu'
            ? 'Add, edit and price the items customers can order'
            : `${openOrders.length} order${openOrders.length === 1 ? '' : 's'} in progress`}
        </p>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'menu' ? 'is-active' : ''}`}
          onClick={() => setTab('menu')}
        >
          <UtensilsCrossed className="tab-icon" />
          Menu
        </button>
        <button
          type="button"
          className={`tab ${tab === 'orders' ? 'is-active' : ''}`}
          onClick={() => setTab('orders')}
        >
          <ClipboardList className="tab-icon" />
          Orders
          {openOrders.length > 0 && <span className="tab-count">{openOrders.length}</span>}
        </button>
      </nav>

      {tab === 'menu' && (
        <>
          <form className="admin-form" onSubmit={onSubmit}>
            <div className="admin-form-title">
              {editing === null ? 'New item' : `Editing item #${editing}`}
            </div>

            <label className="image-picker">
              {imagePreview ? (
                <img className="image-preview" src={imagePreview} alt="" />
              ) : (
                <span className="image-placeholder">
                  <Camera />
                  Add photo
                </span>
              )}
              <input type="file" accept="image/*" onChange={onPickImage} hidden />
            </label>

            <input
              className="field"
              type="text"
              placeholder="Item name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />

            <div className="field-row">
              <input
                className="field"
                type="number"
                min="0"
                step="any"
                placeholder="Price (so'm)"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
              <select
                className="field"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: Number(e.target.value) as Category }))
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.hasDiscount}
                  onChange={(e) => setForm((f) => ({ ...f, hasDiscount: e.target.checked }))}
                />
                On sale
              </label>
              <input
                className="field"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="Discount %"
                disabled={!form.hasDiscount}
                value={form.discount}
                onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
              />
            </div>

            {error && <p className="admin-error">{error}</p>}

            <div className="field-row">
              <button type="submit" className="admin-add-btn" disabled={!canSubmit}>
                {saving ? 'Saving…' : editing === null ? 'Add item' : 'Save changes'}
              </button>
              {editing !== null && (
                <button type="button" className="admin-ghost-btn" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <h2 className="admin-list-title">Items ({foods.length})</h2>

          {loadError && (
            <div className="state-msg state-msg--error">
              <p>{loadError}</p>
              <button type="button" className="retry-btn" onClick={loadFoods}>
                Try again
              </button>
            </div>
          )}

          <div className="admin-list">
            {foods.map((food) => {
              const CategoryIcon = categoryIcon(food.category)
              return (
              <div
                key={food.id}
                className={`admin-row ${food.hasDiscount ? '' : 'is-plain'}`}
              >
                {food.image ? (
                  <img className="card-img" src={food.image} alt="" />
                ) : (
                  <div className="card-icon">
                    <CategoryIcon />
                  </div>
                )}
                <div className="admin-row-body">
                  <div className="card-name">{food.name ?? 'Unnamed item'}</div>
                  <div className="admin-row-meta">
                    {categoryLabel(food.category)} · {formatPrice(effectivePrice(food))}
                    {food.hasDiscount && food.discount > 0 && (
                      <span className="badge-discount">−{food.discount}%</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className={`switch ${food.hasDiscount ? 'on' : 'off'}`}
                  role="switch"
                  aria-checked={food.hasDiscount}
                  aria-label={food.hasDiscount ? 'Turn discount off' : 'Turn discount on'}
                  onClick={() => onToggleDiscount(food)}
                >
                  <span className="switch-knob" />
                </button>

                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Edit"
                    onClick={() => startEdit(food)}
                  >
                    <Pencil />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label="Delete"
                    onClick={() => onDelete(food)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'orders' && (
        <div className="orders">
          {orderError && <p className="admin-error">{orderError}</p>}
          {orders.length === 0 && <p className="state-msg">No orders yet.</p>}

          {orders.map((order) => {
            const next = nextStatus(order.status)
            const closed =
              order.status === Status.Delivered || order.status === Status.Canceled
            const StatusIcon = STATUS_ICON[order.status]
            const NextIcon = next ? STATUS_ICON[next] : null

            return (
              <article key={order.id} className={`order-card ${closed ? 'is-closed' : ''}`}>
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

                <div className="order-actions">
                  {next && NextIcon && (
                    <button
                      type="button"
                      className="admin-add-btn"
                      onClick={() => onAdvance(order)}
                    >
                      <NextIcon size={16} /> Mark {STATUS_LABELS[next].toLowerCase()}
                    </button>
                  )}
                  {!closed && (
                    <button
                      type="button"
                      className="admin-ghost-btn"
                      onClick={() => onCancel(order)}
                    >
                      Cancel
                    </button>
                  )}
                  {closed && (
                    <button
                      type="button"
                      className="admin-ghost-btn danger"
                      onClick={() => onDeleteOrder(order)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
