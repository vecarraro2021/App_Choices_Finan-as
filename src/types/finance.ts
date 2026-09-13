export type Currency = 'BRL' | 'EUR'

export const EUR_EXCHANGE_RATE = 6.0

export interface Category {
  id: string
  name: string
  type: 'main' | 'sub'
  parent?: string
  estimated?: number
  color?: string
  icon?: string
  created?: string
  updated?: string
  expand?: {
    parent?: Category
  }
}

export interface Transaction {
  id: string
  user: string
  date: string // YYYY-MM-DD
  description: string
  amount: number // Stored in BRL
  category?: string
  source: 'importado' | 'manual'
  month: string // YYYY-MM
  created?: string
  updated?: string
  expand?: {
    category?: Category
  }
}

export interface Income {
  id: string
  user: string
  month: string // YYYY-MM
  amount_brl: number
  amount_eur?: number
  description?: string
  date?: string
  created?: string
  updated?: string
}

export interface Alert {
  id: string
  user: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  suggestion: string
  created?: string
  updated?: string
}

export interface MonthlyTotal {
  id: string
  user: string
  month: string // YYYY-MM
  total_categories?: number
  total_official?: number
  divergence?: number
  created?: string
  updated?: string
}

export interface UserProfile {
  id: string
  email: string
  name?: string
  avatar?: string
}
