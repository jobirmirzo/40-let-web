import {
  Bike,
  CheckCircle2,
  ChefHat,
  CircleDollarSign,
  CupSoda,
  PartyPopper,
  Receipt,
  UtensilsCrossed,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { Category, Status } from './types'
import type { Food } from './types'

// The API's Category enum only has Food and Drink — there is no Dessert.
export const CATEGORIES: { id: Category; label: string; icon: LucideIcon }[] = [
  { id: Category.Food, label: 'Food', icon: UtensilsCrossed },
  { id: Category.Drink, label: 'Drinks', icon: CupSoda },
]

export const categoryLabel = (c: Category) =>
  CATEGORIES.find((x) => x.id === c)?.label ?? 'Other'

/** Stand-in art for items whose image failed to load or was never uploaded. */
export const categoryIcon = (c: Category): LucideIcon =>
  CATEGORIES.find((x) => x.id === c)?.icon ?? UtensilsCrossed

export const STATUS_LABELS: Record<Status, string> = {
  [Status.InProgress]: 'Placed',
  [Status.InPayment]: 'Awaiting payment',
  [Status.Canceled]: 'Canceled',
  [Status.PaymentDone]: 'Paid',
  [Status.Cooking]: 'Cooking',
  [Status.InDelivery]: 'On the way',
  [Status.Delivered]: 'Delivered',
}

export const STATUS_ICON: Record<Status, LucideIcon> = {
  [Status.InProgress]: Receipt,
  [Status.InPayment]: CircleDollarSign,
  [Status.Canceled]: XCircle,
  [Status.PaymentDone]: CheckCircle2,
  [Status.Cooking]: ChefHat,
  [Status.InDelivery]: Bike,
  [Status.Delivered]: PartyPopper,
}

/** The order a kitchen actually moves through, for the admin's next-step button. */
export const STATUS_FLOW: Status[] = [
  Status.InProgress,
  Status.InPayment,
  Status.PaymentDone,
  Status.Cooking,
  Status.InDelivery,
  Status.Delivered,
]

export function nextStatus(current: Status): Status | null {
  const i = STATUS_FLOW.indexOf(current)
  if (i === -1 || i === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[i + 1]
}

/** What the customer actually pays, after the item's own discount. */
export function effectivePrice(food: Food): number {
  if (!food.hasDiscount || food.discount <= 0) return food.price
  return food.price * (1 - Math.min(food.discount, 100) / 100)
}

/**
 * Prices come from the API in so'm (e.g. 45000), so they're shown whole with
 * thousands separators rather than with decimal places.
 */
const priceFormat = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 })

export const formatPrice = (n: number) => `${priceFormat.format(n)} so'm`
