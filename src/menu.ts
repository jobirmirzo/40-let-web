import type { Category, MenuItem } from './types'

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'food', label: 'Food', emoji: '🍔' },
  { id: 'drink', label: 'Drinks', emoji: '🥤' },
  { id: 'dessert', label: 'Dessert', emoji: '🍰' },
]

export const MENU: MenuItem[] = [
  { id: 'burger', name: 'Classic Burger', price: 8.5, category: 'food', emoji: '🍔', description: 'Beef patty, cheese, lettuce', active: true },
  { id: 'pizza', name: 'Margherita Pizza', price: 11, category: 'food', emoji: '🍕', description: 'Tomato, mozzarella, basil', active: true },
  { id: 'fries', name: 'French Fries', price: 3.5, category: 'food', emoji: '🍟', description: 'Crispy golden fries', active: true },
  { id: 'sushi', name: 'Sushi Set', price: 14, category: 'food', emoji: '🍣', description: '8 pieces, chef choice', active: true },
  { id: 'salad', name: 'Green Salad', price: 6, category: 'food', emoji: '🥗', description: 'Fresh mixed greens', active: true },

  { id: 'cola', name: 'Cola', price: 2, category: 'drink', emoji: '🥤', description: 'Chilled 0.5L', active: true },
  { id: 'coffee', name: 'Coffee', price: 3, category: 'drink', emoji: '☕', description: 'Freshly brewed', active: true },
  { id: 'juice', name: 'Orange Juice', price: 3.5, category: 'drink', emoji: '🧃', description: 'Freshly squeezed', active: true },
  { id: 'water', name: 'Water', price: 1, category: 'drink', emoji: '💧', description: 'Still, 0.5L', active: true },

  { id: 'icecream', name: 'Ice Cream', price: 4, category: 'dessert', emoji: '🍨', description: 'Two scoops', active: true },
  { id: 'cake', name: 'Chocolate Cake', price: 5, category: 'dessert', emoji: '🍰', description: 'Rich and moist', active: true },
  { id: 'donut', name: 'Donut', price: 2.5, category: 'dessert', emoji: '🍩', description: 'Glazed', active: true },
]
