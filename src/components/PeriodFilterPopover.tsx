import React, { useMemo } from 'react'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { MONTH_NAMES_SHORT } from '@/lib/formatters'

export interface PeriodFilterPopoverProps {
  // Novo modelo: seleção de mês único
  selectedMonth?: string
  onMonthChange?: (val: string) => void
  // Compatibilidade retroativa caso chamado com startMonth/endMonth
  startMonth?: string
  endMonth?: string
  onStartMonthChange?: (val: string) => void
  onEndMonthChange?: (val: string) => void

  isFullYear: boolean
  onFullYearChange: (val: boolean) => void
  availableMonths: string[]
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function formatPeriodMonthLabel(mStr: string): string {
  if (!mStr || !mStr.includes('-')) return mStr
  const [year, month] = mStr.split('-')
  const idx = parseInt(month, 10) - 1
  if (idx >= 0 && idx < 12) {
    return `${MONTH_NAMES_SHORT[idx]} ${year}`
  }
  return mStr
}

export function PeriodFilterPopover({
  selectedMonth: directSelectedMonth,
  onMonthChange,
  startMonth,
  endMonth,
  onStartMonthChange,
  onEndMonthChange,
  isFullYear,
  onFullYearChange,
  availableMonths,
  isOpen,
  onOpenChange,
  className,
}: PeriodFilterPopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)

  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen

  // Determinar o mês selecionado corrente (suporta tanto directSelectedMonth quanto startMonth/endMonth)
  const activeMonth = directSelectedMonth || startMonth || endMonth || '2026-08'

  // Ano de referência para os 12 botões
  const referenceYear = useMemo(() => {
    if (activeMonth && activeMonth.includes('-')) {
      return activeMonth.split('-')[0]
    }
    if (availableMonths && availableMonths.length > 0) {
      const firstWithYear = availableMonths.find((m) => m.includes('-'))
      if (firstWithYear) return firstWithYear.split('-')[0]
    }
    return '2026'
  }, [activeMonth, availableMonths])

  // Mês selecionado no formato 1-12
  const activeMonthIndex = useMemo(() => {
    if (!activeMonth || !activeMonth.includes('-')) return -1
    return parseInt(activeMonth.split('-')[1], 10) - 1
  }, [activeMonth])

  const handleSelectMonth = (monthIndex: number) => {
    if (isFullYear) return
    const monthStr = String(monthIndex + 1).padStart(2, '0')
    const fullVal = `${referenceYear}-${monthStr}`

    if (onMonthChange) {
      onMonthChange(fullVal)
    }
    if (onStartMonthChange) {
      onStartMonthChange(fullVal)
    }
    if (onEndMonthChange) {
      onEndMonthChange(fullVal)
    }
  }

  const filterLabel = useMemo(() => {
    if (isFullYear) {
      const year = activeMonth ? activeMonth.split('-')[0] : referenceYear
      return `Ano ${year} Completo`
    }
    return formatPeriodMonthLabel(activeMonth)
  }, [isFullYear, activeMonth, referenceYear])

  // 12 meses divididos em duas linhas de 6 (Jan-Jun na 1ª, Jul-Dez na 2ª)
  const row1Months = useMemo(() => [0, 1, 2, 3, 4, 5], [])
  const row2Months = useMemo(() => [6, 7, 8, 9, 10, 11], [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={
            className ||
            'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-medium shadow-xs h-10 px-3.5 gap-2'
          }
        >
          <CalendarIcon className="h-4 w-4 text-slate-500" />
          <span className="text-xs sm:text-sm">{filterLabel}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-4 bg-white border-slate-200 shadow-lg">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-slate-900">Filtrar Período</h4>
            <p className="text-xs text-slate-500">Selecione o mês para recalcular os dados.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold transition-colors ${
                  isFullYear ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                Mês de referência
              </span>
              <span
                className={`text-[11px] font-medium transition-colors ${
                  isFullYear ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {referenceYear}
              </span>
            </div>

            {/* Grade de 12 botões: 2 linhas de 6 botões */}
            <div className="space-y-1.5" role="radiogroup" aria-label="Mês de referência">
              {/* Linha 1: Jan - Jun */}
              <div className="grid grid-cols-6 gap-1">
                {row1Months.map((idx) => {
                  const isSelected = !isFullYear && activeMonthIndex === idx
                  const monthName = MONTH_NAMES_SHORT[idx]
                  return (
                    <button
                      key={idx}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isFullYear}
                      onClick={() => handleSelectMonth(idx)}
                      className={`h-8 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 select-none flex items-center justify-center ${
                        isFullYear
                          ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
                          : isSelected
                            ? 'bg-blue-600 text-white font-semibold shadow-xs border border-blue-600 hover:bg-blue-700'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 active:bg-slate-200'
                      }`}
                    >
                      {monthName}
                    </button>
                  )
                })}
              </div>

              {/* Linha 2: Jul - Dez */}
              <div className="grid grid-cols-6 gap-1">
                {row2Months.map((idx) => {
                  const isSelected = !isFullYear && activeMonthIndex === idx
                  const monthName = MONTH_NAMES_SHORT[idx]
                  return (
                    <button
                      key={idx}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isFullYear}
                      onClick={() => handleSelectMonth(idx)}
                      className={`h-8 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 select-none flex items-center justify-center ${
                        isFullYear
                          ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
                          : isSelected
                            ? 'bg-blue-600 text-white font-semibold shadow-xs border border-blue-600 hover:bg-blue-700'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 active:bg-slate-200'
                      }`}
                    >
                      {monthName}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Toggle Ano Completo */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor="toggle-full-year"
                className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
              >
                Ano completo
              </Label>
              <p className="text-[11px] text-slate-400">Considerar todos os meses do ano</p>
            </div>
            <Switch
              id="toggle-full-year"
              checked={isFullYear}
              onCheckedChange={(checked) => {
                onFullYearChange(checked)
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
