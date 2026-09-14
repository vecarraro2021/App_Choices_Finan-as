import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getCategories,
  getAllTransactions,
  getMonthlyTotals,
  updateCategory,
  upsertMonthlyTotal,
  getExchangeRates,
  getRateForMonth,
  createTransaction,
  setActualCategoryMonthlyTotal,
} from '@/services/financeService'
import { Category, Transaction, MonthlyTotal, ExchangeRate } from '@/types/finance'
import { InlineEstimateCell, InlineActualCell } from '@/components/InlineBudgetEditCell'
import { formatCurrency, formatPercent, formatMonthShort } from '@/lib/formatters'
import { parseAmount } from '@/lib/fileParser'
import { useToast } from '@/hooks/use-toast'
import {
  Scale,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Edit,
  Sliders,
  DollarSign,
  TrendingDown,
  GripVertical,
  MoveRight,
  CornerDownRight,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CategorySelectCombobox } from '@/components/CategorySelectCombobox'

export default function BudgetVsActualView() {
  const { user, currency } = useAuth()
  const { toast } = useToast()

  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Drag and Drop state
  const [draggedSubId, setDraggedSubId] = useState<string | null>(null)
  const [dragOverMainId, setDragOverMainId] = useState<string | null>(null)

  // Move Subcategory Modal (Mobile / Accessibility / Action button)
  const [movingSubCategory, setMovingSubCategory] = useState<Category | null>(null)
  const [targetParentId, setTargetParentId] = useState<string>('')
  const [moving, setMoving] = useState(false)

  // Modal to edit estimated budget
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [newEstimate, setNewEstimate] = useState('')
  const [savingEstimate, setSavingEstimate] = useState(false)

  // Modal to set official total for a month
  const [showOfficialModal, setShowOfficialModal] = useState(false)
  const [officialMonth, setOfficialMonth] = useState('2026-01')
  const [officialAmount, setOfficialAmount] = useState('')
  const [savingOfficial, setSavingOfficial] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [cats, txs, mTotals, rates] = await Promise.all([
        getCategories(),
        getAllTransactions(),
        getMonthlyTotals(),
        getExchangeRates(),
      ])
      setCategories(cats)
      setTransactions(txs)
      setMonthlyTotals(mTotals)
      setExchangeRates(rates)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  useRealtime('categories', () => loadData())
  useRealtime('transactions', () => loadData())
  useRealtime('monthly_totals', () => loadData())

  // Detect months with transactions or standard planning months
  const activeMonths = useMemo(() => {
    const monthsSet = new Set<string>([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
    ])
    transactions.forEach((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
      if (m) monthsSet.add(m)
    })
    return Array.from(monthsSet).sort()
  }, [transactions])

  // Aggregate spending by category and subcategory per month
  const matrixData = useMemo(() => {
    const spendingMap: Record<string, Record<string, number>> = {}
    const subToParent = new Map<string, string>()

    categories.forEach((c) => {
      if (c.type === 'sub' && c.parent) {
        subToParent.set(c.id, c.parent)
      }
    })

    transactions.forEach((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : 'Sem data')
      const catId = tx.category || 'none'
      const amt = Number(tx.amount) || 0

      if (!spendingMap[catId]) spendingMap[catId] = {}
      spendingMap[catId][m] = (spendingMap[catId][m] || 0) + amt
    })

    // Main categories
    const mainCats = categories.filter((c) => c.type === 'main')

    const rows = mainCats.map((main) => {
      const subCats = categories.filter((c) => c.parent === main.id)

      // Month-by-month spending for this main category (sum of subcats + direct)
      const monthlyValues: Record<string, { actual: number; estimated: number }> = {}
      let totalActual = 0

      activeMonths.forEach((m) => {
        let actual = spendingMap[main.id]?.[m] || 0
        subCats.forEach((sc) => {
          actual += spendingMap[sc.id]?.[m] || 0
        })

        monthlyValues[m] = {
          actual,
          estimated: Number(main.estimated) || 0,
        }
        totalActual += actual
      })

      // Subcategories breakdown
      const subRows = subCats.map((sc) => {
        const scMonthly: Record<string, { actual: number; estimated: number }> = {}
        let scTotalActual = 0

        activeMonths.forEach((m) => {
          const act = spendingMap[sc.id]?.[m] || 0
          scMonthly[m] = {
            actual: act,
            estimated: Number(sc.estimated) || 0,
          }
          scTotalActual += act
        })

        return {
          id: sc.id,
          name: sc.name,
          estimatedMonthly: Number(sc.estimated) || 0,
          monthly: scMonthly,
          totalActual: scTotalActual,
        }
      })

      return {
        id: main.id,
        name: main.name,
        color: main.color,
        estimatedMonthly: Number(main.estimated) || 0,
        monthly: monthlyValues,
        totalActual,
        subcategories: subRows,
      }
    })

    // Total row per month
    const totalsPerMonth: Record<string, { actual: number; estimated: number }> = {}
    let grandTotalActual = 0
    let grandTotalEstimated = 0

    activeMonths.forEach((m) => {
      let mActual = 0
      let mEstimated = 0
      rows.forEach((r) => {
        mActual += r.monthly[m]?.actual || 0
        mEstimated += r.monthly[m]?.estimated || 0
      })
      totalsPerMonth[m] = { actual: mActual, estimated: mEstimated }
      grandTotalActual += mActual
      grandTotalEstimated += mEstimated
    })

    const totalOverBudget = Math.max(grandTotalActual - grandTotalEstimated, 0)

    return {
      rows,
      totalsPerMonth,
      grandTotalActual,
      grandTotalEstimated,
      totalOverBudget,
    }
  }, [categories, transactions, activeMonths])

  // Toggle Category Expand
  const toggleExpand = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }))
  }

  // Move subcategory function (identical semantics to Categories.tsx)
  const handleMoveSubCategory = async (subCatId: string, newParentId: string) => {
    const subToMove = categories.find((c) => c.id === subCatId)
    if (!subToMove || subToMove.parent === newParentId) {
      return
    }

    const targetParent = categories.find((c) => c.id === newParentId && c.type === 'main')
    if (!targetParent) {
      toast({ title: 'Categoria de destino inválida', variant: 'destructive' })
      return
    }

    // Optimistic UI update
    const previousCategories = [...categories]
    setCategories((prev) =>
      prev.map((c) =>
        c.id === subCatId ? { ...c, parent: newParentId, color: targetParent.color || c.color } : c,
      ),
    )

    // Automatically expand target parent so user sees the moved item immediately in the matrix
    setExpandedCategories((prev) => ({ ...prev, [newParentId]: true }))

    try {
      await updateCategory(subCatId, {
        parent: newParentId,
        color: targetParent.color || undefined,
      })

      toast({
        title: 'Subcategoria movida!',
        description: `"${subToMove.name}" agora pertence a "${targetParent.name}".`,
      })
    } catch (err) {
      console.error('Erro ao mover subcategoria:', err)
      // Rollback optimistic update
      setCategories(previousCategories)
      toast({
        title: 'Erro ao mover subcategoria',
        description: 'Não foi possível atualizar no servidor.',
        variant: 'destructive',
      })
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, subId: string) => {
    e.dataTransfer.setData('text/plain', subId)
    e.dataTransfer.setData('application/json', JSON.stringify({ id: subId }))
    e.dataTransfer.effectAllowed = 'move'
    setDraggedSubId(subId)
  }

  const handleDragEnd = () => {
    setDraggedSubId(null)
    setDragOverMainId(null)
  }

  const handleDragOverMain = (e: React.DragEvent, mainId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverMainId !== mainId) {
      setDragOverMainId(mainId)
    }
  }

  const handleDragLeaveMain = (e: React.DragEvent, mainId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }
    if (dragOverMainId === mainId) {
      setDragOverMainId(null)
    }
  }

  const handleDropOnMain = async (e: React.DragEvent, targetMainId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverMainId(null)

    const subId = e.dataTransfer.getData('text/plain') || draggedSubId
    setDraggedSubId(null)

    if (!subId) return
    await handleMoveSubCategory(subId, targetMainId)
  }

  // Open Move Dialog (Mobile / Actions / Accessibility)
  const handleOpenMove = (sub: Category) => {
    setMovingSubCategory(sub)
    const currentParentId = sub.parent
    const otherMain = categories.find((m) => m.type === 'main' && m.id !== currentParentId)
    setTargetParentId(otherMain ? otherMain.id : '')
  }

  const handleConfirmMove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!movingSubCategory || !targetParentId) return

    setMoving(true)
    try {
      await handleMoveSubCategory(movingSubCategory.id, targetParentId)
      setMovingSubCategory(null)
    } finally {
      setMoving(false)
    }
  }

  // Open Edit Estimate Modal
  const handleOpenEstimateModal = (cat: Category) => {
    setEditingCategory(cat)
    setNewEstimate(String(cat.estimated || 0))
  }

  // Save new estimate (from modal)
  const handleSaveEstimate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory) return

    try {
      setSavingEstimate(true)
      const est = parseAmount(newEstimate)
      await updateCategory(editingCategory.id, { estimated: est })
      toast({ title: 'Orçamento estimado atualizado!' })
      setEditingCategory(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao atualizar estimado', variant: 'destructive' })
    } finally {
      setSavingEstimate(false)
    }
  }

  // Quick Inline Save for category/subcategory estimate
  const handleInlineSaveEstimate = async (categoryId: string, newAmountBrl: number) => {
    try {
      await updateCategory(categoryId, { estimated: newAmountBrl })
      toast({
        title: 'Orçamento atualizado!',
        description: `Novo teto mensal definido como ${formatCurrency(newAmountBrl, currency)}.`,
      })
      loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao atualizar orçamento',
        description: 'Não foi possível salvar a alteração.',
        variant: 'destructive',
      })
      throw err
    }
  }

  // Inline save for actual value in a subcategory / month cell
  const handleInlineSaveActual = async (
    categoryId: string,
    month: string,
    newTotalBrl: number,
    label?: string,
  ) => {
    try {
      await setActualCategoryMonthlyTotal({
        categoryId,
        month,
        newTotalBrl,
        description: `Ajuste contábil em ${label || 'categoria'} (${formatMonthShort(month)})`,
      })
      toast({
        title: 'Valor Real atualizado!',
        description: `Total de ${formatMonthShort(month)} definido como ${formatCurrency(newTotalBrl, currency)}.`,
      })
      loadData()
    } catch (err) {
      console.error('Erro ao atualizar valor real inline:', err)
      throw err
    }
  }

  // Create manual adjustment transaction when user edits Real cell
  const handleCreateAdjustmentTx = async (data: {
    date: string
    description: string
    amount: number
    category?: string
    source: 'manual'
    month: string
  }) => {
    try {
      await createTransaction(data)
      toast({
        title: 'Lançamento de ajuste salvo!',
        description: `${data.description} (${formatCurrency(data.amount, currency)}) registrado com sucesso.`,
      })
      loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao registrar ajuste',
        description: 'Não foi possível salvar o lançamento.',
        variant: 'destructive',
      })
      throw err
    }
  }

  // Save official monthly total for divergence tracking
  const handleSaveOfficialTotal = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSavingOfficial(true)
      const official = parseAmount(officialAmount)
      const categorySum = matrixData.totalsPerMonth[officialMonth]?.actual || 0
      const divergence = categorySum - official

      await upsertMonthlyTotal({
        month: officialMonth,
        total_official: official,
        total_categories: categorySum,
        divergence,
      })

      toast({ title: `Total oficial de ${formatMonthShort(officialMonth)} salvo!` })
      setShowOfficialModal(false)
      setOfficialAmount('')
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar total oficial', variant: 'destructive' })
    } finally {
      setSavingOfficial(false)
    }
  }

  // Check divergences from monthly_totals
  const activeDivergences = useMemo(() => {
    return monthlyTotals.filter((mt) => mt.divergence && Math.abs(mt.divergence) > 1)
  }, [monthlyTotals])

  // Helper to format numeric values for pt-BR CSV (decimal comma, no thousands separator for clean Excel data)
  const formatCsvNumber = (valInBrl: number, monthRate?: number): string => {
    if (valInBrl === undefined || valInBrl === null || isNaN(valInBrl)) {
      return '0,00'
    }
    const effRate =
      monthRate && monthRate > 0 ? monthRate : getRateForMonth(undefined, exchangeRates)
    const converted = currency === 'EUR' ? valInBrl / effRate : valInBrl
    return converted.toFixed(2).replace('.', ',')
  }

  const escapeCsvCell = (cell: string): string => {
    if (cell.includes(';') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
  }

  // Export CSV Handler
  const handleExportCSV = () => {
    try {
      const currencySuffix = currency === 'EUR' ? ' (EUR)' : ' (BRL)'
      const sep = ';'

      // 1. Header row
      const headers = [
        'Categoria',
        'Subcategoria',
        `Meta/Mês${currencySuffix}`,
        ...activeMonths.map((m) => `${formatMonthShort(m)}${currencySuffix}`),
        `Total Período${currencySuffix}`,
      ]

      const csvRows: string[][] = []
      csvRows.push(headers)

      // 2. Exchange rate info row
      const exchangeRateRow = [
        'Câmbio (€1 = R$)',
        currency === 'EUR' ? 'Conversão ativa em EUR' : 'Referência de câmbio',
        `€1 = R$ ${getRateForMonth(undefined, exchangeRates).toFixed(2).replace('.', ',')}`,
        ...activeMonths.map((m) => {
          const r = getRateForMonth(m, exchangeRates)
          return `€1 = R$ ${r.toFixed(2).replace('.', ',')}`
        }),
        '-',
      ]
      csvRows.push(exchangeRateRow)

      // 3. Data rows by category and subcategory
      matrixData.rows.forEach((row) => {
        const defaultRate = getRateForMonth(undefined, exchangeRates)

        // Subcategories first if any
        if (row.subcategories.length > 0) {
          row.subcategories.forEach((sub) => {
            const subCols = [
              row.name,
              sub.name,
              formatCsvNumber(sub.estimatedMonthly, defaultRate),
              ...activeMonths.map((m) => {
                const sCell = sub.monthly[m]
                const mRate = getRateForMonth(m, exchangeRates)
                return formatCsvNumber(sCell?.actual || 0, mRate)
              }),
              formatCsvNumber(sub.totalActual, defaultRate),
            ]
            csvRows.push(subCols)
          })

          // Total row for category
          const catTotalCols = [
            row.name,
            '— Total —',
            formatCsvNumber(row.estimatedMonthly, defaultRate),
            ...activeMonths.map((m) => {
              const mCell = row.monthly[m]
              const mRate = getRateForMonth(m, exchangeRates)
              return formatCsvNumber(mCell?.actual || 0, mRate)
            }),
            formatCsvNumber(row.totalActual, defaultRate),
          ]
          csvRows.push(catTotalCols)
        } else {
          // Category has no subcategories: export single row
          const catCols = [
            row.name,
            '-',
            formatCsvNumber(row.estimatedMonthly, defaultRate),
            ...activeMonths.map((m) => {
              const mCell = row.monthly[m]
              const mRate = getRateForMonth(m, exchangeRates)
              return formatCsvNumber(mCell?.actual || 0, mRate)
            }),
            formatCsvNumber(row.totalActual, defaultRate),
          ]
          csvRows.push(catCols)
        }
      })

      // 4. Grand Total Row
      const grandEstimatedMonthly =
        activeMonths.length > 0 ? matrixData.grandTotalEstimated / activeMonths.length : 0
      const defaultRate = getRateForMonth(undefined, exchangeRates)

      const grandTotalCols = [
        'TOTAL GERAL',
        '— Soma das Categorias —',
        formatCsvNumber(grandEstimatedMonthly, defaultRate),
        ...activeMonths.map((m) => {
          const mTot = matrixData.totalsPerMonth[m]
          const mRate = getRateForMonth(m, exchangeRates)
          return formatCsvNumber(mTot?.actual || 0, mRate)
        }),
        formatCsvNumber(matrixData.grandTotalActual, defaultRate),
      ]
      csvRows.push(grandTotalCols)

      // Build CSV String with UTF-8 BOM
      const csvContent =
        '\uFEFF' + csvRows.map((cols) => cols.map(escapeCsvCell).join(sep)).join('\r\n')

      // Determine export year or period label
      const years = Array.from(new Set(activeMonths.map((m) => m.slice(0, 4)).filter(Boolean)))
      const periodLabel = years.length > 0 ? years.join('-') : '2026'
      const fileName = `orcado-vs-realizado-${periodLabel}.csv`

      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'CSV exportado com sucesso!',
        description: `Arquivo ${fileName} baixado na moeda ${currency}.`,
      })
    } catch (err) {
      console.error('Erro ao exportar CSV:', err)
      toast({
        title: 'Erro ao exportar CSV',
        description: 'Não foi possível gerar a planilha CSV.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orçado vs. Realizado</h1>
          <p className="text-sm text-slate-500 mt-1">
            Matriz analítica de acompanhamento orçamentário mensal com expansão de subcategorias.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="border-slate-300 hover:bg-slate-100 text-slate-700"
            title="Exportar matriz analítica em planilha CSV (Excel)"
          >
            <Download className="mr-2 h-4 w-4 text-emerald-600" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowOfficialModal(true)}
            className="border-slate-300 hover:bg-slate-100"
          >
            <Scale className="mr-2 h-4 w-4 text-blue-600" />
            Declarar Total Oficial (Auditoria)
          </Button>
        </div>
      </div>

      {/* Divergence Banner when category sums differ from declared total */}
      {activeDivergences.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900">
                Divergência Contábil Detectada entre Soma das Categorias e Total Oficial
              </h3>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                A soma dos lançamentos das categorias difere do valor total declarado na sua
                planilha ou extrato nos seguintes meses:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeDivergences.map((div) => (
                  <Badge
                    key={div.month}
                    variant="outline"
                    className="border-amber-400 bg-amber-100/60 text-amber-900 font-semibold text-xs py-1 px-2"
                  >
                    {formatMonthShort(div.month)}: divergência de{' '}
                    {formatCurrency(div.divergence, currency)} (Categorias:{' '}
                    {formatCurrency(div.total_categories, currency)} vs Oficial:{' '}
                    {formatCurrency(div.total_official, currency)})
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matrix Table */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Matriz Orçamentária por Categoria e Mês
            </CardTitle>
            <CardDescription className="text-xs flex flex-wrap items-center gap-1.5 mt-0.5">
              <span>
                Valores em formato Real / Orçado. Células vermelhas indicam estouro orçamentário.
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium text-[11px] border border-blue-100">
                <GripVertical className="h-3 w-3" /> Arraste subcategorias entre categorias para
                reorganizar
              </span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10 w-64 shadow-xs">
                    Categoria
                  </th>
                  <th className="py-3 px-3 text-right">Meta/Mês</th>
                  {activeMonths.map((m) => {
                    const r = getRateForMonth(m, exchangeRates)
                    return (
                      <th key={m} className="py-3 px-3 text-center whitespace-nowrap min-w-[130px]">
                        <div>{formatMonthShort(m)}</div>
                        <div className="text-[9px] font-normal text-slate-400 capitalize">
                          € 1 = R$ {r.toFixed(2)}
                        </div>
                      </th>
                    )
                  })}
                  <th className="py-3 px-4 text-right">Total Período</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixData.rows.map((row) => {
                  const isExpanded = !!expandedCategories[row.id]
                  const hasSub = row.subcategories.length > 0
                  const isDropTarget = dragOverMainId === row.id
                  const isCurrentParentOfDragged =
                    draggedSubId && row.subcategories.some((s) => s.id === draggedSubId)

                  return (
                    <React.Fragment key={row.id}>
                      {/* Main Category Row */}
                      <tr
                        onDragOver={(e) => handleDragOverMain(e, row.id)}
                        onDragLeave={(e) => handleDragLeaveMain(e, row.id)}
                        onDrop={(e) => handleDropOnMain(e, row.id)}
                        className={`transition-colors font-medium ${
                          isDropTarget
                            ? 'bg-blue-100/70 ring-2 ring-inset ring-blue-400'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td
                          className={`py-3 px-4 sticky left-0 z-10 shadow-xs transition-colors ${
                            isDropTarget ? 'bg-blue-100/90' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div
                              className="flex items-center gap-2 cursor-pointer select-none min-w-0"
                              onClick={() => hasSub && toggleExpand(row.id)}
                            >
                              {hasSub ? (
                                isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                                )
                              ) : (
                                <div className="w-4 shrink-0" />
                              )}
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.color || '#2563EB' }}
                              />
                              <span className="font-bold text-slate-900 truncate">{row.name}</span>

                              {isDropTarget && !isCurrentParentOfDragged && (
                                <span className="text-[11px] font-semibold text-blue-700 bg-blue-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1 animate-pulse shrink-0">
                                  <CornerDownRight className="h-3 w-3" /> Solte aqui para mover
                                </span>
                              )}
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-blue-600 shrink-0"
                              onClick={() => {
                                const found = categories.find((c) => c.id === row.id)
                                if (found) handleOpenEstimateModal(found)
                              }}
                              title="Editar orçamento estimado desta categoria"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right tabular-nums text-slate-500 whitespace-nowrap">
                          <InlineEstimateCell
                            value={row.estimatedMonthly}
                            currency={currency}
                            rate={getRateForMonth(undefined, exchangeRates)}
                            categoryId={row.id}
                            categoryName={row.name}
                            onSave={(val) => handleInlineSaveEstimate(row.id, val)}
                            className="font-medium"
                          />
                        </td>

                        {/* Month columns */}
                        {activeMonths.map((m) => {
                          const cell = row.monthly[m]
                          const mRate = getRateForMonth(m, exchangeRates)
                          const act = cell?.actual || 0
                          const est = cell?.estimated || 0
                          const isOver = est > 0 && act > est
                          const pctOver = est > 0 ? (act - est) / est : 0

                          return (
                            <td
                              key={m}
                              className={`py-3 px-2 text-center tabular-nums whitespace-nowrap transition-colors ${
                                isOver
                                  ? 'bg-red-50/60 text-red-900 border-l border-r border-red-100'
                                  : 'text-slate-800'
                              }`}
                              title={`Mês ${m}: taxa R$ ${mRate.toFixed(2)} / €`}
                            >
                              <div className="font-bold text-xs">
                                <InlineActualCell
                                  value={act}
                                  currency={currency}
                                  rate={mRate}
                                  month={m}
                                  categoryId={row.id}
                                  categoryName={row.name}
                                  isOverBudget={isOver}
                                  editable={false}
                                  onSaveTotal={(val) =>
                                    handleInlineSaveActual(row.id, m, val, row.name)
                                  }
                                  onCreateAdjustmentTx={handleCreateAdjustmentTx}
                                  onAdjustmentCreated={loadData}
                                />
                              </div>
                              {isOver && (
                                <span className="inline-block mt-0.5 text-[9px] font-bold text-red-600 bg-red-100 px-1 py-0.2 rounded">
                                  +{formatPercent(pctOver)}
                                </span>
                              )}
                            </td>
                          )
                        })}

                        <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(row.totalActual, currency)}
                        </td>
                      </tr>

                      {/* Subcategories (when expanded) */}
                      {isExpanded &&
                        row.subcategories.map((sub) => {
                          const isBeingDragged = draggedSubId === sub.id
                          const foundSub = categories.find((c) => c.id === sub.id)

                          return (
                            <tr
                              key={sub.id}
                              className={`transition-colors ${
                                isBeingDragged
                                  ? 'opacity-40 bg-blue-50/80 border-y border-dashed border-blue-400'
                                  : 'bg-slate-50/40 text-slate-600 hover:bg-slate-100/50'
                              }`}
                            >
                              <td
                                draggable
                                onDragStart={(e) => handleDragStart(e, sub.id)}
                                onDragEnd={handleDragEnd}
                                className={`py-2.5 px-4 pl-6 sticky left-0 z-10 shadow-xs cursor-grab active:cursor-grabbing group transition-colors ${
                                  isBeingDragged ? 'bg-blue-50/90' : 'bg-slate-50'
                                }`}
                                title="Arraste para mover para outra categoria"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div
                                      className="text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                                      title="Clique e arraste para mover para outra categoria"
                                    >
                                      <GripVertical className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="text-slate-400 shrink-0 text-xs">↳</span>
                                    <span className="text-slate-700 text-xs truncate font-medium">
                                      {sub.name}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-slate-400 hover:text-blue-600"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (foundSub) handleOpenMove(foundSub)
                                      }}
                                      title="Mover para outra categoria..."
                                    >
                                      <MoveRight className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-slate-400 hover:text-blue-600"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (foundSub) handleOpenEstimateModal(foundSub)
                                      }}
                                      title="Editar orçamento estimado desta subcategoria"
                                    >
                                      <Edit className="h-2.5 w-2.5" />
                                    </Button>
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-right tabular-nums text-slate-400 text-xs">
                                <InlineEstimateCell
                                  value={sub.estimatedMonthly}
                                  currency={currency}
                                  rate={getRateForMonth(undefined, exchangeRates)}
                                  categoryId={sub.id}
                                  categoryName={row.name}
                                  subCategoryName={sub.name}
                                  onSave={(val) => handleInlineSaveEstimate(sub.id, val)}
                                  emptyLabel="-"
                                  className="text-slate-500"
                                />
                              </td>

                              {activeMonths.map((m) => {
                                const sCell = sub.monthly[m]
                                const sAct = sCell?.actual || 0
                                const sRate = getRateForMonth(m, exchangeRates)
                                return (
                                  <td
                                    key={m}
                                    className="py-2.5 px-2 text-center tabular-nums text-xs text-slate-600"
                                  >
                                    <InlineActualCell
                                      value={sAct}
                                      currency={currency}
                                      rate={sRate}
                                      month={m}
                                      categoryId={row.id}
                                      categoryName={row.name}
                                      subCategoryId={sub.id}
                                      subCategoryName={sub.name}
                                      editable={true}
                                      onSaveTotal={(val) =>
                                        handleInlineSaveActual(
                                          sub.id,
                                          m,
                                          val,
                                          `${row.name} › ${sub.name}`,
                                        )
                                      }
                                      onCreateAdjustmentTx={handleCreateAdjustmentTx}
                                      onAdjustmentCreated={loadData}
                                    />
                                  </td>
                                )
                              })}

                              <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-slate-700 text-xs">
                                {formatCurrency(sub.totalActual, currency)}
                              </td>
                            </tr>
                          )
                        })}
                    </React.Fragment>
                  )
                })}

                {/* TOTAL ROW */}
                <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900">
                  <td className="py-3.5 px-4 sticky left-0 bg-slate-100 z-10 shadow-xs uppercase text-xs">
                    TOTAL (Soma das Categorias)
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums text-xs">
                    {formatCurrency(matrixData.grandTotalEstimated / activeMonths.length, currency)}
                  </td>
                  {activeMonths.map((m) => {
                    const mTot = matrixData.totalsPerMonth[m]
                    const mRate = getRateForMonth(m, exchangeRates)
                    const act = mTot?.actual || 0
                    const est = mTot?.estimated || 0
                    const isOver = est > 0 && act > est

                    return (
                      <td
                        key={m}
                        className={`py-3.5 px-2 text-center tabular-nums text-xs ${
                          isOver ? 'text-red-700' : 'text-slate-900'
                        }`}
                        title={`Mês ${m}: taxa R$ ${mRate.toFixed(2)}`}
                      >
                        <div>{formatCurrency(act, currency, mRate)}</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          / {formatCurrency(est, currency, mRate)}
                        </div>
                      </td>
                    )
                  })}
                  <td className="py-3.5 px-4 text-right tabular-nums text-sm text-blue-700">
                    {formatCurrency(matrixData.grandTotalActual, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footer Summary Banner */}
      <Card className="border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 shrink-0">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Gasto Fora do Planejado no Período
              </span>
              <div className="text-xl font-bold text-red-600 tabular-nums">
                {formatCurrency(matrixData.totalOverBudget, currency)}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 max-w-sm">
            Diferença acumulada entre o valor real despendido e as metas estipuladas por categoria
            para os meses avaliados.
          </p>
        </div>
      </Card>

      {/* MOVE SUBCATEGORY MODAL (Mobile / Accessible Alternative) */}
      <Dialog
        open={!!movingSubCategory}
        onOpenChange={(open) => !open && setMovingSubCategory(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-blue-600" />
              Mover Subcategoria
            </DialogTitle>
            <DialogDescription>
              Altere a categoria mãe de <strong>{movingSubCategory?.name}</strong> para reorganizar
              a matriz orçamentária.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmMove} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nova Categoria Principal</Label>
              <CategorySelectCombobox
                categories={categories.filter((c) => c.type === 'main')}
                value={targetParentId}
                onChange={setTargetParentId}
                excludeCategoryId={movingSubCategory?.parent}
                placeholder="Selecione a categoria principal de destino"
                searchPlaceholder="Buscar categoria principal..."
                emptyText="Nenhuma categoria encontrada."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setMovingSubCategory(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={moving || !targetParentId || targetParentId === movingSubCategory?.parent}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {moving ? 'Movendo...' : 'Mover Subcategoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT ESTIMATE MODAL */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Orçamento Estimado</DialogTitle>
            <DialogDescription>
              Defina o teto mensal de gastos planejado para <strong>{editingCategory?.name}</strong>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEstimate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-est">Orçamento Estimado Mensal (R$ BRL)</Label>
              <Input
                id="c-est"
                type="text"
                placeholder="Ex: 4.500,00"
                value={newEstimate}
                onChange={(e) => setNewEstimate(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEstimate}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingEstimate ? 'Salvando...' : 'Atualizar Estimado'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AUDIT / OFFICIAL TOTAL MODAL */}
      <Dialog open={showOfficialModal} onOpenChange={setShowOfficialModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Declarar Total Oficial do Mês</DialogTitle>
            <DialogDescription>
              Insira o total informado no resumo do seu extrato/planilha para rastrear divergências
              contábeis.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveOfficialTotal} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="o-month">Mês</Label>
              <Input
                id="o-month"
                type="month"
                value={officialMonth}
                onChange={(e) => setOfficialMonth(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="o-amt">Total Declarado / Oficial (R$ BRL)</Label>
              <Input
                id="o-amt"
                placeholder="Ex: 22.339,00"
                value={officialAmount}
                onChange={(e) => setOfficialAmount(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowOfficialModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingOfficial}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingOfficial ? 'Gravando...' : 'Salvar Total Oficial'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
