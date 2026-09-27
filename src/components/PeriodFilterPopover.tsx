import React, { useMemo } from 'react'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { MONTH_NAMES_SHORT } from '@/lib/formatters'

export interface PeriodFilterPopoverProps {
  startMonth: string
  endMonth: string
  isFullYear: boolean
  onStartMonthChange: (val: string) => void
  onEndMonthChange: (val: string) => void
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
  startMonth,
  endMonth,
  isFullYear,
  onStartMonthChange,
  onEndMonthChange,
  onFullYearChange,
  availableMonths,
  isOpen,
  onOpenChange,
  className,
}: PeriodFilterPopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)

  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen

  const filterLabel = useMemo(() => {
    if (isFullYear) {
      const year = startMonth ? startMonth.split('-')[0] : '2026'
      return `Ano ${year} Completo`
    }
    if (startMonth === endMonth) {
      return formatPeriodMonthLabel(startMonth)
    }
    const s = startMonth <= endMonth ? startMonth : endMonth
    const e = startMonth <= endMonth ? endMonth : startMonth
    return `${formatPeriodMonthLabel(s)} - ${formatPeriodMonthLabel(e)}`
  }, [isFullYear, startMonth, endMonth])

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
      <PopoverContent align="end" className="w-80 p-4 bg-white border-slate-200 shadow-lg">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-slate-900">Filtrar Período</h4>
            <p className="text-xs text-slate-500">
              Selecione o mês inicial e o mês final para recalcular os dados.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="select-start-month"
                className={`text-xs font-semibold transition-colors ${
                  isFullYear ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Início
              </label>
              <Select
                value={startMonth}
                disabled={isFullYear}
                onValueChange={(val) => {
                  onStartMonthChange(val)
                }}
              >
                <SelectTrigger
                  id="select-start-month"
                  disabled={isFullYear}
                  className={`w-full text-xs h-9 border-slate-200 transition-opacity ${
                    isFullYear
                      ? 'bg-slate-100/70 text-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-slate-50 text-slate-800'
                  }`}
                >
                  <SelectValue placeholder="Mês inicial" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {availableMonths.map((m) => (
                    <SelectItem key={`start-${m}`} value={m} className="text-xs">
                      {formatPeriodMonthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="select-end-month"
                className={`text-xs font-semibold transition-colors ${
                  isFullYear ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Fim
              </label>
              <Select
                value={endMonth}
                disabled={isFullYear}
                onValueChange={(val) => {
                  onEndMonthChange(val)
                }}
              >
                <SelectTrigger
                  id="select-end-month"
                  disabled={isFullYear}
                  className={`w-full text-xs h-9 border-slate-200 transition-opacity ${
                    isFullYear
                      ? 'bg-slate-100/70 text-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-slate-50 text-slate-800'
                  }`}
                >
                  <SelectValue placeholder="Mês final" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {availableMonths.map((m) => (
                    <SelectItem key={`end-${m}`} value={m} className="text-xs">
                      {formatPeriodMonthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
