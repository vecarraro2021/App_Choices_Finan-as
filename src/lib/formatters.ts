import { Currency, EUR_EXCHANGE_RATE } from '@/types/finance'

/**
 * Formats a monetary value according to the chosen currency.
 * Input value is expected to be in BRL.
 */
export function formatCurrency(
  valueInBRL: number | undefined | null,
  currency: Currency = 'BRL',
): string {
  if (valueInBRL === undefined || valueInBRL === null || isNaN(valueInBRL)) {
    return currency === 'BRL' ? 'R$ 0,00' : '€ 0,00'
  }

  const finalValue = currency === 'EUR' ? valueInBRL / EUR_EXCHANGE_RATE : valueInBRL

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency === 'BRL' ? 'BRL' : 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(finalValue)
}

/**
 * Formats percentage
 */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '0%'
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Converts YYYY-MM string to Portuguese month name (e.g. '2026-01' -> 'Janeiro 2026' or 'Jan 2026')
 */
export const MONTH_NAMES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export const MONTH_NAMES_LONG = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function formatMonthShort(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr
  const parts = monthStr.split('-')
  const monthIdx = parseInt(parts[1], 10) - 1
  const year = parts[0]
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${MONTH_NAMES_SHORT[monthIdx]}/${year.slice(2)}`
  }
  return monthStr
}

export function formatMonthLong(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr
  const parts = monthStr.split('-')
  const monthIdx = parseInt(parts[1], 10) - 1
  const year = parts[0]
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${MONTH_NAMES_LONG[monthIdx]} de ${year}`
  }
  return monthStr
}

export function getMonthFromDate(dateStr: string): string {
  if (!dateStr) {
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${mm}`
  }
  return dateStr.slice(0, 7)
}
