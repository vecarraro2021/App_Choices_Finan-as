import React, { useState, useEffect, useRef } from 'react'
import { Check, X, ArrowRight, ExternalLink, PlusCircle, AlertCircle, Edit3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatMonthShort } from '@/lib/formatters'
import { parseAmount } from '@/lib/fileParser'
import { Currency } from '@/types/finance'
import { useNavigate } from 'react-router-dom'

// ========================================================
// 1. INLINE EDIT CELL FOR ESTIMATE / BUDGET (Orçado / Meta)
// ========================================================
interface InlineEstimateCellProps {
  value: number // in BRL
  currency: Currency
  rate: number
  categoryName: string
  categoryId: string
  subCategoryName?: string
  monthLabel?: string
  onSave: (newAmountBrl: number) => Promise<void>
  className?: string
  prefix?: string
  compact?: boolean
  emptyLabel?: string
}

export function InlineEstimateCell({
  value,
  currency,
  rate,
  categoryName,
  categoryId,
  subCategoryName,
  monthLabel,
  onSave,
  className = '',
  prefix = '',
  compact = false,
  emptyLabel = '-',
}: InlineEstimateCellProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Current display value in current selected currency
  const displayValueInCurrency = currency === 'EUR' && rate > 0 ? value / rate : value

  // When opening popover, populate input with formatted value in currently active currency
  useEffect(() => {
    if (open) {
      if (displayValueInCurrency > 0) {
        setInputValue(
          displayValueInCurrency.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        )
      } else {
        setInputValue('')
      }
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [open, displayValueInCurrency])

  const handleCommit = async () => {
    if (isSaving) return
    const parsed = parseAmount(inputValue)
    // Convert entered value back to BRL if user is in EUR view
    const newAmountBrl = currency === 'EUR' && rate > 0 ? parsed * rate : parsed

    if (Math.abs(newAmountBrl - value) < 0.009 && !isNaN(parsed)) {
      setOpen(false)
      return
    }

    try {
      setIsSaving(true)
      await onSave(Math.max(0, newAmountBrl))
      setOpen(false)
    } catch (e) {
      console.error('Erro ao salvar orçamento inline:', e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCommit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const displayText = value > 0 ? formatCurrency(value, currency, rate) : emptyLabel

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`group inline-flex items-center gap-1 cursor-pointer select-none transition-all rounded px-1 -mx-1 hover:bg-blue-50/80 hover:text-blue-900 border-b border-transparent hover:border-dashed hover:border-blue-400 focus:outline-hidden focus:ring-1 focus:ring-blue-400 ${className}`}
                aria-label={`Editar orçamento de ${categoryName}`}
              >
                {prefix && <span>{prefix}</span>}
                <span className="tabular-nums font-inherit">{displayText}</span>
                <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-70 text-blue-600 transition-opacity ml-0.5 shrink-0" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="text-xs bg-slate-900 text-slate-50 py-1 px-2.5 shadow-md"
          >
            <span>Clique para editar o orçamento ({currency})</span>
            {currency === 'EUR' && (
              <span className="block text-[10px] text-slate-300">
                Câmbio: € 1 = R$ {rate.toFixed(2)}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        align="center"
        side="top"
        className="w-72 p-3 text-xs shadow-lg border-slate-200"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div>
              <p className="font-bold text-slate-800 leading-tight">
                Editar Orçado {monthLabel ? `• ${monthLabel}` : '• Meta Mensal'}
              </p>
              <p className="text-[11px] text-slate-500 truncate max-w-[210px]">
                {subCategoryName ? `${categoryName} ↳ ${subCategoryName}` : categoryName}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] font-semibold uppercase px-1.5 py-0.5">
              {currency}
            </Badge>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-600">
              Novo teto orçado ({currency === 'BRL' ? 'R$' : '€'})
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-2 text-slate-400 font-medium select-none">
                {currency === 'BRL' ? 'R$' : '€'}
              </span>
              <Input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0,00"
                disabled={isSaving}
                className="pl-7 pr-16 h-8 text-xs font-semibold tabular-nums"
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isSaving}
                  onClick={handleCommit}
                  className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  title="Confirmar (Enter)"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isSaving}
                  onClick={() => setOpen(false)}
                  className="h-6 w-6 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title="Cancelar (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
            <span>
              {currency === 'EUR' ? (
                <>Taxa do mês: € 1 = R$ {rate.toFixed(2)}</>
              ) : (
                <>Salvo na moeda padrão (BRL)</>
              )}
            </span>
            <span className="text-[9px] text-slate-400">Enter salva • Esc cancela</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ========================================================
// 2. INLINE ACTUAL CELL WITH POP-OPTIONS (Real Clicável)
// ========================================================
interface InlineActualCellProps {
  value: number // in BRL
  currency: Currency
  rate: number
  month: string // YYYY-MM
  categoryId: string
  categoryName: string
  subCategoryId?: string
  subCategoryName?: string
  isOverBudget?: boolean
  className?: string
  onAdjustmentCreated?: () => void
  onCreateAdjustmentTx: (data: {
    date: string
    description: string
    amount: number // in BRL
    category?: string
    source: 'manual'
    month: string
  }) => Promise<void>
}

export function InlineActualCell({
  value,
  currency,
  rate,
  month,
  categoryId,
  categoryName,
  subCategoryId,
  subCategoryName,
  isOverBudget = false,
  className = '',
  onAdjustmentCreated,
  onCreateAdjustmentTx,
}: InlineActualCellProps) {
  const navigate = useNavigate()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Quick Adjustment Modal State
  const [adjType, setAdjType] = useState<'increase' | 'decrease' | 'target'>('target')
  const [targetAmountInput, setTargetAmountInput] = useState('')
  const [deltaAmountInput, setDeltaAmountInput] = useState('')
  const [adjDescription, setAdjDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const monthShort = formatMonthShort(month)
  const effectiveCatId = subCategoryId || categoryId
  const effectiveName = subCategoryName ? `${categoryName} › ${subCategoryName}` : categoryName

  const currentDisplayAmount = currency === 'EUR' && rate > 0 ? value / rate : value

  // When opening the adjustment dialog
  const handleOpenAdjustmentModal = (type: 'target' | 'increase' | 'decrease') => {
    setAdjType(type)
    setPopoverOpen(false)
    setAdjDescription(`Ajuste contábil em ${effectiveName} (${monthShort})`)
    if (type === 'target') {
      setTargetAmountInput(
        currentDisplayAmount.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      )
    } else {
      setDeltaAmountInput('')
    }
    setDialogOpen(true)
  }

  // Handle navigate to transactions page filtered
  const handleGoToTransactions = () => {
    setPopoverOpen(false)
    const targetCat = subCategoryId || categoryId
    navigate(`/transacoes?month=${month}&category=${targetCat}`)
  }

  // Submit manual adjustment
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let adjustmentDeltaInDisplay = 0
      if (adjType === 'target') {
        const targetVal = parseAmount(targetAmountInput)
        adjustmentDeltaInDisplay = targetVal - currentDisplayAmount
      } else if (adjType === 'increase') {
        adjustmentDeltaInDisplay = Math.abs(parseAmount(deltaAmountInput))
      } else if (adjType === 'decrease') {
        adjustmentDeltaInDisplay = -Math.abs(parseAmount(deltaAmountInput))
      }

      if (Math.abs(adjustmentDeltaInDisplay) < 0.01) {
        setDialogOpen(false)
        return
      }

      // Convert delta to BRL
      const deltaBrl =
        currency === 'EUR' && rate > 0 ? adjustmentDeltaInDisplay * rate : adjustmentDeltaInDisplay

      const signText = deltaBrl > 0 ? '+' : ''
      const defaultDesc = `Ajuste manual (${signText}${formatCurrency(deltaBrl, currency, rate)}) - ${monthShort}`

      await onCreateAdjustmentTx({
        date: `${month}-01`,
        month: month,
        category: effectiveCatId,
        amount: deltaBrl,
        source: 'manual',
        description: adjDescription.trim() || defaultDesc,
      })

      setDialogOpen(false)
      onAdjustmentCreated?.()
    } catch (err) {
      console.error('Falha ao criar transação de ajuste:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayText =
    value > 0
      ? formatCurrency(value, currency, rate)
      : value < 0
        ? formatCurrency(value, currency, rate)
        : 'R$ 0,00'

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`group inline-flex items-center gap-1 cursor-pointer select-none rounded px-1 -mx-1 transition-all hover:bg-blue-50/90 hover:text-blue-900 border-b border-transparent hover:border-dashed hover:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-400 ${className}`}
                  aria-label={`Ver ou ajustar valor real de ${effectiveName} em ${monthShort}`}
                >
                  <span className="tabular-nums font-inherit">{displayText}</span>
                  <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-70 text-blue-600 transition-opacity ml-0.5 shrink-0" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="text-xs bg-slate-900 text-slate-50 py-1 px-2.5 shadow-md"
            >
              <span>Clique para editar/ajustar o Real ({currency})</span>
              {currency === 'EUR' && (
                <span className="block text-[10px] text-slate-300">
                  Câmbio: € 1 = R$ {rate.toFixed(2)}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <PopoverContent
          align="center"
          side="top"
          className="w-80 p-3.5 text-xs shadow-xl border-slate-200"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between pb-1.5 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600">
                  Valor Real • {monthShort}
                </span>
                <h4 className="font-bold text-slate-900 leading-tight text-xs truncate max-w-[210px]">
                  {effectiveName}
                </h4>
              </div>
              <Badge
                variant={isOverBudget ? 'destructive' : 'secondary'}
                className="text-[10px] tabular-nums"
              >
                {formatCurrency(value, currency, rate)}
              </Badge>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              O valor Real é a soma de lançamentos registrados no mês. Como prefere editar este
              total?
            </p>

            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenAdjustmentModal('target')}
                className="w-full justify-between h-8 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
              >
                <span className="flex items-center gap-1.5">
                  <PlusCircle className="h-3.5 w-3.5 text-blue-600" />
                  Definir novo valor total (Ajuste)
                </span>
                <span className="text-[10px] text-slate-400">Recomendado</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGoToTransactions}
                className="w-full justify-between h-8 text-xs font-semibold hover:bg-slate-50"
              >
                <span className="flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                  Ver lançamentos detalhados do mês
                </span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
              </Button>
            </div>

            {currency === 'EUR' && (
              <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Taxa de câmbio aplicada:</span>
                <span className="font-medium text-slate-600">€ 1 = R$ {rate.toFixed(2)}</span>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* MODAL DE AJUSTE MANUAL */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <PlusCircle className="h-5 w-5 text-blue-600" />
              Ajustar Valor Real de {monthShort}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Altere o valor realizado para <strong>{effectiveName}</strong>. Um lançamento de
              ajuste contábil será registrado sem corromper transações existentes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAdjustment} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Valor Atual ({currency})
                </span>
                <div className="font-bold text-slate-800 tabular-nums">
                  {formatCurrency(value, currency, rate)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Mês de Referência
                </span>
                <div className="font-bold text-slate-800">{monthShort}</div>
              </div>
            </div>

            {/* Target vs Delta selector */}
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setAdjType('target')}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  adjType === 'target'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Definir Novo Total
              </button>
              <button
                type="button"
                onClick={() => setAdjType('increase')}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  adjType === 'increase'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Adicionar Gasto
              </button>
              <button
                type="button"
                onClick={() => setAdjType('decrease')}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  adjType === 'decrease'
                    ? 'bg-white text-rose-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                - Abater / Estorno
              </button>
            </div>

            {adjType === 'target' ? (
              <div className="space-y-1.5">
                <Label htmlFor="target-input" className="text-xs font-semibold text-slate-700">
                  Novo Total Realizado ({currency})
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-medium">
                    {currency === 'BRL' ? 'R$' : '€'}
                  </span>
                  <Input
                    id="target-input"
                    type="text"
                    value={targetAmountInput}
                    onChange={(e) => setTargetAmountInput(e.target.value)}
                    placeholder="0,00"
                    className="pl-8 text-sm font-semibold tabular-nums"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Diferença a ser criada:{' '}
                  <strong className="text-slate-800">
                    {(() => {
                      const tgt = parseAmount(targetAmountInput)
                      const diff = tgt - currentDisplayAmount
                      const sign = diff >= 0 ? '+' : ''
                      return `${sign}${currency === 'BRL' ? 'R$ ' : '€ '}${diff.toLocaleString(
                        'pt-BR',
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      )}`
                    })()}
                  </strong>
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="delta-input" className="text-xs font-semibold text-slate-700">
                  {adjType === 'increase' ? 'Valor a Adicionar' : 'Valor a Abater'} ({currency})
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-medium">
                    {currency === 'BRL' ? 'R$' : '€'}
                  </span>
                  <Input
                    id="delta-input"
                    type="text"
                    value={deltaAmountInput}
                    onChange={(e) => setDeltaAmountInput(e.target.value)}
                    placeholder="0,00"
                    className="pl-8 text-sm font-semibold tabular-nums"
                    autoFocus
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="adj-desc" className="text-xs font-semibold text-slate-700">
                Descrição do Ajuste (opcional)
              </Label>
              <Input
                id="adj-desc"
                type="text"
                value={adjDescription}
                onChange={(e) => setAdjDescription(e.target.value)}
                placeholder="Ex: Ajuste contábil manual, acerto de extrato..."
                className="text-xs"
              />
            </div>

            {currency === 'EUR' && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Você está visualizando em <strong>EUR</strong>. O valor digitado será convertido
                  pela taxa do mês (€ 1 = R$ {rate.toFixed(2)}) e salvo em BRL no banco.
                </span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold"
              >
                {isSubmitting ? 'Salvando...' : 'Confirmar Ajuste'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
