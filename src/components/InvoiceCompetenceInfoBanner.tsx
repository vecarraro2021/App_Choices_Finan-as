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

  return (
    <div
      role="region"
      aria-label="Informações sobre competência da fatura"
      className="relative overflow-hidden rounded-xl border border-blue-200/80 bg-blue-50/70 p-4 text-slate-800 shadow-xs transition-all dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-slate-200"
    >
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100/90 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
          <Info className="h-4 w-4" />
        </div>

        <div className="flex-1 space-y-1.5 pr-6 sm:pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-blue-950 dark:text-blue-100">
              Como tratamos a competência da fatura
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-200/70 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
              <Calendar className="h-3 w-3" />
              Regra padrão
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            Faturas de cartão cobrem um ciclo (ex.: <strong>31/ago a 30/set</strong>). Por padrão,
            todos os gastos da fatura são lançados no mês de competência — <strong>setembro</strong>{' '}
            — mesmo que a compra tenha sido feita no mês anterior. Assim, meses já fechados não
            recebem lançamentos novos.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                No preview da importação: escolha{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-medium">
                  &ldquo;Datar pela data original&rdquo;
                </strong>{' '}
                se preferir a data exata da compra.
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                Para lançamentos já importados: selecione as linhas e clique em{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-medium">
                  &ldquo;Realocar para o mês...&rdquo;
                </strong>
                .
              </span>
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="absolute right-2 top-2 h-7 w-7 rounded-md text-slate-400 hover:bg-blue-100/60 hover:text-slate-700 dark:hover:bg-blue-900/40 dark:hover:text-slate-200"
          title="Fechar aviso nesta sessão"
          aria-label="Fechar aviso de competência"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
