// ---------------------------------------------------------------------------
// Mirrors the 40Let API (see 40Let/Models and 40Let/Features).
// Enum values are the numeric ones the API serialises — keep them in sync with
// 40Let/Enum/Enum.cs.
// ---------------------------------------------------------------------------

/** 40Let/Enum/Enum.cs — Category */
export const Category = {
  Food: 1,
  Drink: 2,
} as const
export type Category = (typeof Category)[keyof typeof Category]

/** 40Let/Enum/Enum.cs — Status */
export const Status = {
  InProgress: 1,
  InPayment: 2,
  Canceled: 3,
  PaymentDone: 4,
  Cooking: 5,
  InDelivery: 6,
  Delivered: 7,
} as const
export type Status = (typeof Status)[keyof typeof Status]

/** GET /foods — `Image` arrives as a presigned URL, not the raw object key. */
export interface Food {
  id: number
  name: string | null
  price: number
  category: Category
  image: string | null
  /** Percent off, 0–100. Only applied when `hasDiscount` is true. */
  discount: number
  hasDiscount: boolean
}

/** POST/PUT /foods — sent as multipart/form-data. */
export interface FoodInput {
  name: string
  price: number
  category: Category
  discount: number
  hasDiscount: boolean
  /** Raw file to upload. Omit on update to keep the current image. */
  imageFile?: File | null
}

/** A line of an order. */
export interface OrderItem {
  id: number
  orderId: number
  foodId: number
  quantity: number
  unitPrice: number
  discount: number
  totalPrice: number
}

/** GET /orders */
export interface Order {
  id: number
  status: Status
  discount: number
  hasPromoCode: boolean
  totalPrice: number
  createdAt: string
  items: OrderItem[]
}

/** POST/PUT /orders */
export interface OrderInput {
  status: Status
  discount: number
  hasPromoCode: boolean
  totalPrice: number
  items: {
    foodId: number
    quantity: number
    unitPrice: number
    discount: number
    totalPrice: number
  }[]
}

/** GET /users */
export interface BotUser {
  id: number
  fullname: string | null
  phoneNumber: string | null
  chatId: number
  role: string | null
}

/** POST /checks */
export interface CheckInput {
  orderId: number
  withdrawal: number
  orderedCount: number
  withPromoCode: boolean
  discountedAmount: number
  discount: number
}

// ---------------------------------------------------------------------------
// UI-only types
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'customer'

export interface CartLine {
  food: Food
  qty: number
}

export interface Coords {
  latitude: number
  longitude: number
}
