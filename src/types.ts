export type Category = 'food' | 'drink' | 'dessert'

export interface MenuItem {
  id: string
  name: string
  price: number
  category: Category
  emoji: string
  description?: string
  /** Optional image (data URL or hosted URL). Falls back to `emoji` when absent. */
  image?: string
  /** Inactive items are hidden from customers but kept in the admin list. */
  active: boolean
}

export type Role = 'admin' | 'customer'

/** Payload for creating a new menu item from the admin page. */
export interface NewFood {
  name: string
  price: number
  category: Category
  description?: string
  image?: string
}

export interface CartLine {
  item: MenuItem
  qty: number
}

export interface Coords {
  latitude: number
  longitude: number
}

export interface OrderPayload {
  lines: {
    id: string
    name: string
    price: number
    qty: number
  }[]
  total: number
  location: Coords | null
  createdAt: string
}
