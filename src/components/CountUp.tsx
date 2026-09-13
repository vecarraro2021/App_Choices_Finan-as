import React, { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { Currency } from '@/types/finance'

interface CountUpProps {
  value: number
  currency: Currency
  duration?: number
}

export const CountUp: React.FC<CountUpProps> = ({ value, currency, duration = 600 }) => {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startVal = displayValue
    const diff = value - startVal

    if (diff === 0) return

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const easeOutProgress = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(startVal + diff * easeOutProgress)

      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setDisplayValue(value)
      }
    }

    const animId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(animId)
  }, [value, duration])

  return <span className="tabular-nums">{formatCurrency(displayValue, currency)}</span>
}
