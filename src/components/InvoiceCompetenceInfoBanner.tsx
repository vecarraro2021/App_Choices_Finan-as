import React, { useState, useEffect } from 'react'
import { Info, X, Calendar, CheckCircle2, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_STORAGE_KEY = 'hide_invoice_competence_info_banner_session'

export function InvoiceCompetenceInfoBanner() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      const isDismissed = sessionStorage.getItem(DISMISS_STORAGE_KEY) === 'true'
      setDismissed(isDismissed)
    } catch {
      setDismissed(false)
    }
  }, [])

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, 'true')
    } catch {
      // ignore storage errors
    }
    setDismissed(true)
  }

  if (dismissed) {
    return null
  }

  return null
}
