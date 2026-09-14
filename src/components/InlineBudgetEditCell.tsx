import React, { useState, useEffect, useRef } from 'react'
import {
  Check,
  X,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  AlertCircle,
  Edit3,
  Loader2,
} from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'

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
// 2. INLINE ACTUAL CELL (Edição direta na célula sem modal)
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
  editable?: boolean // Se a célula permite edição inline (ex.: subcategorias ou linhas permitidas)
  onSaveTotal?: (newTotalBrl: number) => Promise<void>
  onAdjustmentCreated?: () => void
  onCreateAdjustmentTx?: (data: {
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
  editable = true,
  onSaveTotal,
  onAdjustmentCreated,
  onCreateAdjustmentTx,
}: InlineActualCellProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isCommittingRef = useRef(false)
  const isCancelledRef = useRef(false)

  const monthShort = formatMonthShort(month)
  const effectiveName = subCategoryName ? `${categoryName} › ${subCategoryName}` : categoryName

  // Valor atual na moeda ativa
  const currentDisplayAmount = currency === 'EUR' && rate > 0 ? value / rate : value

  // Inicia edição ao clicar
  const startEditing = () => {
    if (!editable || isSaving) return
    isCancelledRef.current = false
    isCommittingRef.current = false

    if (Math.abs(currentDisplayAmount) > 0.001) {
      setInputValue(
        currentDisplayAmount.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      )
    } else {
      setInputValue('')
    }
    setIsEditing(true)
  }

  // Auto-foco e seleção ao entrar no modo de edição
  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 30)
    }
  }, [isEditing])

  // Salvar alteração (Enter ou blur)
  const commitChange = async () => {
    if (isCancelledRef.current || isCommittingRef.current || !isEditing) return
    isCommittingRef.current = true

    const parsed = parseAmount(inputValue)
    // Se o usuário limpou o campo ou digitou 0, valor total = 0
    const targetDisplayVal = isNaN(parsed) ? 0 : Math.max(0, parsed)

    // Converter para BRL se estiver em EUR
    const targetBrl = currency === 'EUR' && rate > 0 ? targetDisplayVal * rate : targetDisplayVal

    // Se o valor não mudou, simplesmente fecha sem disparar request
    if (Math.abs(targetBrl - value) < 0.01) {
      setIsEditing(false)
      isCommittingRef.current = false
      return
    }

    try {
      setIsSaving(true)

      if (onSaveTotal) {
        await onSaveTotal(targetBrl)
      } else if (onCreateAdjustmentTx) {
        // Fallback usando onCreateAdjustmentTx se onSaveTotal não for fornecido
        const deltaBrl = targetBrl - value
        const effectiveCatId = subCategoryId || categoryId
        await onCreateAdjustmentTx({
          date: `${month}-01`,
          month,
          category: effectiveCatId,
          amount: deltaBrl,
          source: 'manual',
          description: `Ajuste contábil em ${effectiveName} (${monthShort})`,
        })
        onAdjustmentCreated?.()
      }

      setIsEditing(false)
    } catch (err) {
      console.error('Erro ao salvar valor Real inline:', err)
      toast({
        title: 'Erro ao salvar valor Real',
        description: 'Não foi possível salvar o ajuste. O valor foi restaurado.',
        variant: 'destructive',
      })
      // Reverter o estado
      setIsEditing(false)
    } finally {
      setIsSaving(false)
      isCommittingRef.current = false
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitChange()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      isCancelledRef.current = true
      setIsEditing(false)
    }
  }

  const handleBlur = () => {
    if (!isCancelledRef.current) {
      commitChange()
    }
  }

  const displayText =
    value > 0
      ? formatCurrency(value, currency, rate)
      : value < 0
        ? formatCurrency(value, currency, rate)
        : currency === 'BRL'
          ? 'R$ 0,00'
          : '€ 0,00'

  // Se estiver salvando
  if (isSaving) {
    return (
      <div className="inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold select-none">
        <Loader2 className="h-3 w-3 animate-spin text-blue-600 shrink-0" />
        <span className="tabular-nums opacity-75">Salvando...</span>
      </div>
    )
  }

  // Se estiver no modo de edição inline
  if (isEditing) {
    const symbol = currency === 'BRL' ? 'R$' : '€'
    return (
      <div className="relative inline-flex items-center min-w-[110px] max-w-[140px] mx-auto animate-in fade-in duration-150">
        <span className="absolute left-2 text-[11px] text-slate-400 font-semibold select-none pointer-events-none">
          {symbol}
        </span>
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="0,00"
          disabled={isSaving}
          className="h-7 pl-7 pr-2 py-0 text-xs font-bold tabular-nums text-center bg-white border-blue-500 ring-2 ring-blue-400/40 shadow-xs focus-visible:ring-blue-500 rounded"
          aria-label={`Editar valor real de ${effectiveName} em ${monthShort}`}
        />
      </div>
    )
  }

  // Se não for editável (ex.: apenas display de resumo)
  if (!editable) {
    return <span className={`tabular-nums font-inherit ${className}`}>{displayText}</span>
  }

  // Exibição normal com trigger de clique inline
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={startEditing}
            className={`group inline-flex items-center justify-center gap-1 cursor-pointer select-none rounded px-1.5 py-0.5 -mx-1 transition-all hover:bg-blue-50 hover:text-blue-900 border-b border-transparent hover:border-dashed hover:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-400 ${className}`}
            aria-label={`Clique para editar o valor real de ${effectiveName} em ${monthShort}`}
          >
            <span className="tabular-nums font-inherit">{displayText}</span>
            <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-70 text-blue-600 transition-opacity ml-0.5 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="text-xs bg-slate-900 text-slate-50 py-1 px-2.5 shadow-md"
        >
          <span>Clique para editar o Real ({currency})</span>
          {currency === 'EUR' && (
            <span className="block text-[10px] text-slate-300">
              Câmbio: € 1 = R$ {rate.toFixed(2)}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
