import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES } from './menu'
import type { Category, MenuItem } from './types'
import { createFood, fetchFoods, setFoodActive } from './api'
import { useTheme } from './useTheme'
import './App.css'
import './Admin.css'

const categoryLabel = (c: Category) =>
  CATEGORIES.find((x) => x.id === c)?.label ?? c

export default function AdminPage() {
  const [theme, toggleTheme] = useTheme()
  const [foods, setFoods] = useState<MenuItem[]>([])

  // New-food form fields
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState<Category>('food')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchFoods().then(setFoods)
  }, [])

  const canSubmit = useMemo(
    () => name.trim() !== '' && Number(price) > 0 && !saving,
    [name, price, saving],
  )

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  function resetForm() {
    setName('')
    setPrice('')
    setCategory('food')
    setDescription('')
    setImage(undefined)
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const created = await createFood({
        name: name.trim(),
        price: Number(price),
        category,
        description: description.trim() || undefined,
        image,
      })
      setFoods((list) => [created, ...list])
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add item')
    } finally {
      setSaving(false)
    }
  }

  async function onToggleActive(item: MenuItem) {
    const next = !item.active
    // Optimistic update
    setFoods((list) =>
      list.map((m) => (m.id === item.id ? { ...m, active: next } : m)),
    )
    try {
      await setFoodActive(item.id, next)
    } catch {
      // Revert on failure
      setFoods((list) =>
        list.map((m) => (m.id === item.id ? { ...m, active: !next } : m)),
      )
    }
  }

  return (
    <div className="app admin">
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <header className="app-header">
        <h1>Menu Admin</h1>
        <p>Add items and turn them on or off for customers</p>
      </header>

      {/* Add food */}
      <form className="admin-form" onSubmit={onAdd}>
        <label className="image-picker">
          {image ? (
            <img className="image-preview" src={image} alt="" />
          ) : (
            <span className="image-placeholder">📷<br />Add photo</span>
          )}
          <input type="file" accept="image/*" onChange={onPickImage} hidden />
        </label>

        <input
          className="field"
          type="text"
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="field-row">
          <input
            className="field"
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <input
          className="field"
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error && <p className="admin-error">{error}</p>}

        <button type="submit" className="admin-add-btn" disabled={!canSubmit}>
          {saving ? 'Adding…' : 'Add item'}
        </button>
      </form>

      {/* Existing items */}
      <h2 className="admin-list-title">Items ({foods.length})</h2>
      <div className="admin-list">
        {foods.map((item) => (
          <div
            key={item.id}
            className={`admin-row ${item.active ? '' : 'is-inactive'}`}
          >
            {item.image ? (
              <img className="card-img" src={item.image} alt="" />
            ) : (
              <div className="card-emoji">{item.emoji}</div>
            )}
            <div className="admin-row-body">
              <div className="card-name">{item.name}</div>
              <div className="admin-row-meta">
                {categoryLabel(item.category)} · ${item.price.toFixed(2)}
              </div>
            </div>

            <button
              type="button"
              className={`switch ${item.active ? 'on' : 'off'}`}
              role="switch"
              aria-checked={item.active}
              aria-label={item.active ? 'Deactivate' : 'Activate'}
              onClick={() => onToggleActive(item)}
            >
              <span className="switch-knob" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
