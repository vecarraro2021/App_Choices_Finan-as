import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getCategories,
  getAllTransactions,
  getMonthlyTotals,
  updateCategory,
  upsertMonthlyTotal,
} from '@/services/financeService'
import { Category, Transaction, MonthlyTotal } from '@/types/finance'
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

export default function BudgetVsActualView() {
  const { user, currency } = useAuth()
  const { toast } = useToast()

  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

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
      const [cats, txs, mTotals] = await Promise.all([
        getCategories(),
        getAllTransactions(),
        getMonthlyTotals(),
      ])
      setCategories(cats)
      setTransactions(txs)
      setMonthlyTotals(mTotals)
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

  // Open Edit Estimate Modal
  const handleOpenEstimateModal = (cat: Category) => {
    setEditingCategory(cat)
    setNewEstimate(String(cat.estimated || 0))
  }

  // Save new estimate
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
            <CardDescription className="text-xs">
              Valores em formato Real / Orçado. Células vermelhas indicam estouro orçamentário.
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
                  {activeMonths.map((m) => (
                    <th key={m} className="py-3 px-3 text-center whitespace-nowrap min-w-[130px]">
                      {formatMonthShort(m)}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">Total Período</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixData.rows.map((row) => {
                  const isExpanded = !!expandedCategories[row.id]
                  const hasSub = row.subcategories.length > 0

                  return (
                    <React.Fragment key={row.id}>
                      {/* Main Category Row */}
                      <tr className="hover:bg-slate-50/70 transition-colors font-medium">
                        <td className="py-3 px-4 sticky left-0 bg-white z-10 shadow-xs flex items-center justify-between gap-2">
                          <div
                            className="flex items-center gap-2 cursor-pointer select-none"
                            onClick={() => hasSub && toggleExpand(row.id)}
                          >
                            {hasSub ? (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                              )
                            ) : (
                              <div className="w-4" />
                            )}
                            <span className="font-bold text-slate-900">{row.name}</span>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-blue-600"
                            onClick={() => {
                              const found = categories.find((c) => c.id === row.id)
                              if (found) handleOpenEstimateModal(found)
                            }}
                            title="Editar orçamento estimado desta categoria"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </td>

                        <td className="py-3 px-3 text-right tabular-nums text-slate-500 whitespace-nowrap">
                          {formatCurrency(row.estimatedMonthly, currency)}
                        </td>

                        {/* Month columns */}
                        {activeMonths.map((m) => {
                          const cell = row.monthly[m]
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
                            >
                              <div className="font-bold text-xs">
                                {formatCurrency(act, currency)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                / {formatCurrency(est, currency)}
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
                        row.subcategories.map((sub) => (
                          <tr
                            key={sub.id}
                            className="bg-slate-50/40 text-slate-600 hover:bg-slate-100/50 transition-colors"
                          >
                            <td className="py-2.5 px-4 pl-9 sticky left-0 bg-slate-50 z-10 shadow-xs flex items-center justify-between">
                              <span className="text-slate-700 text-xs">↳ {sub.name}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-slate-400 hover:text-blue-600"
                                onClick={() => {
                                  const found = categories.find((c) => c.id === sub.id)
                                  if (found) handleOpenEstimateModal(found)
                                }}
                              >
                                <Edit className="h-2.5 w-2.5" />
                              </Button>
                            </td>

                            <td className="py-2.5 px-3 text-right tabular-nums text-slate-400 text-xs">
                              {sub.estimatedMonthly > 0
                                ? formatCurrency(sub.estimatedMonthly, currency)
                                : '-'}
                            </td>

                            {activeMonths.map((m) => {
                              const sCell = sub.monthly[m]
                              const sAct = sCell?.actual || 0
                              return (
                                <td
                                  key={m}
                                  className="py-2.5 px-2 text-center tabular-nums text-xs text-slate-600"
                                >
                                  {sAct > 0 ? formatCurrency(sAct, currency) : '—'}
                                </td>
                              )
                            })}

                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-slate-700 text-xs">
                              {formatCurrency(sub.totalActual, currency)}
                            </td>
                          </tr>
                        ))}
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
                    const act = mTot?.actual || 0
                    const est = mTot?.estimated || 0
                    const isOver = est > 0 && act > est

                    return (
                      <td
                        key={m}
                        className={`py-3.5 px-2 text-center tabular-nums text-xs ${
                          isOver ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        <div>{formatCurrency(act, currency)}</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          / {formatCurrency(est, currency)}
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
