export type Currency = 'BRL' | 'EUR'

export const EUR_EXCHANGE_RATE = 6.0

export interface ExchangeRate {
  id: string
  user?: string
  owner?: string
  month: string // 'YYYY-MM'
  rate: number
  manual_override?: boolean
  created?: string
  updated?: string
}

export interface Category {
  id: string
  owner?: string
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
  owner?: string
  date: string // YYYY-MM-DD
  description: string
  amount: number // Stored in BRL
  amount_currency?: 'BRL' | 'EUR'
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
  owner?: string
  month: string // YYYY-MM
  amount_brl: number
  amount_eur?: number
  description?: string
  date?: string
  created?: string
  updated?: string
}

export interface RecurringIncome {
  id: string
  user: string
  owner?: string
  description: string
  amount_eur: number
  amount_brl: number
  active: boolean
  created?: string
  updated?: string
}

export interface Alert {
  id: string
  user: string
  owner?: string
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
  owner?: string
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

export type BankAccountType = 'checking' | 'savings' | 'international' | 'investment' | 'wallet'
export type BankAccountStatus = 'connected' | 'pending' | 'error' | 'disconnected'

export interface BankAccount {
  id: string
  owner: string
  name: string
  account_type: BankAccountType
  balance: number
  currency: 'BRL' | 'EUR' | 'USD'
  status: BankAccountStatus
  color?: string
  last_synced?: string
  created?: string
  updated?: string
}

export interface UserSettings {
  id: string
  owner: string
  notify_budget_overflow: boolean
  notify_atypical_transactions: boolean
  notify_accounting_divergence: boolean
  notify_monthly_summary: boolean
  created?: string
  updated?: string
}
