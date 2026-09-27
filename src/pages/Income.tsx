import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getIncomes,
  getRecurringIncomes,
  getAllTransactions,
  createIncome,
  updateIncome,
  deleteIncome,
  createRecurringIncome,
  updateRecurringIncome,
  deleteRecurringIncome,
  getExchangeRates,
  getRateForMonth,
} from '@/services/financeService'
import { Income, RecurringIncome, Transaction, ExchangeRate } from '@/types/finance'
import { calculateMonthlyDeficits } from '@/lib/alertsEngine'
import {
  formatCurrency,
  formatPercent,
  formatMonthLong,
  formatMonthShort,
  MONTH_NAMES_SHORT,
} from '@/lib/formatters'
import { parseAmount } from '@/lib/fileParser'
import { useToast } from '@/hooks/use-toast'
import { PeriodFilterPopover, formatPeriodMonthLabel } from '@/components/PeriodFilterPopover'
import {
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  PiggyBank,
  Calendar,
  Wallet,
  Repeat,
  CheckCircle2,
  Power,
  Info,
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

export default function IncomeView() {
  const { user, currency } = useAuth()
  const { toast } = useToast()

  const [incomes, setIncomes] = useState<Income[]>([])
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)

  // Period Filter State
  const [startMonth, setStartMonth] = useState<string>('2026-08')
  const [endMonth, setEndMonth] = useState<string>('2026-08')
  const [isFullYear, setIsFullYear] = useState<boolean>(false)
  const [hasInitializedDefaultMonth, setHasInitializedDefaultMonth] = useState<boolean>(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Add Punctual Income modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [month, setMonth] = useState('2026-01')
  const [amountBrl, setAmountBrl] = useState('')
  const [amountEur, setAmountEur] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  // Edit Punctual Income modal state
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [editMonth, setEditMonth] = useState('')
  const [editAmountBrl, setEditAmountBrl] = useState('')
  const [editAmountEur, setEditAmountEur] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDate, setEditDate] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Recurring Income modal state (Add / Edit)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState<RecurringIncome | null>(null)
  const [recDescription, setRecDescription] = useState('')
  const [recAmountEur, setRecAmountEur] = useState('5000')
  const [recAmountBrl, setRecAmountBrl] = useState('30000')
  const [recActive, setRecActive] = useState(true)
  const [savingRecurring, setSavingRecurring] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [incList, recList, txList, rates] = await Promise.all([
        getIncomes(),
        getRecurringIncomes(),
        getAllTransactions(),
        getExchangeRates(),
      ])
      setIncomes(incList)
      setRecurringIncomes(recList)
      setTransactions(txList)
      setExchangeRates(rates)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  useRealtime('income', () => loadData())
  useRealtime('recurring_incomes', () => loadData())
  useRealtime('transactions', () => loadData())

  // Distinct months that actually contain data (transactions or incomes)
  const monthsWithData = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
      if (m && m.length === 7) set.add(m)
    })
    incomes.forEach((inc) => {
      const m = inc.month || (inc.date ? inc.date.slice(0, 7) : '')
      if (m && m.length === 7) set.add(m)
    })
    return Array.from(set).sort()
  }, [transactions, incomes])

  // Available months options for dropdown selectors
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    for (let i = 1; i <= 12; i++) {
      set.add(`2026-${String(i).padStart(2, '0')}`)
    }
    monthsWithData.forEach((m) => set.add(m))
    return Array.from(set).sort()
  }, [monthsWithData])

  // Initialize default filter to the most recent month with data upon loading
  useEffect(() => {
    if (!loading && !hasInitializedDefaultMonth) {
      let latestMonth = '2026-08'
      if (monthsWithData.length > 0) {
        latestMonth = monthsWithData[monthsWithData.length - 1]
      } else if (availableMonths.length > 0) {
        latestMonth = availableMonths[availableMonths.length - 1]
      }
      setStartMonth(latestMonth)
      setEndMonth(latestMonth)
      setHasInitializedDefaultMonth(true)
    }
  }, [loading, monthsWithData, availableMonths, hasInitializedDefaultMonth])

  // Filtered transactions & incomes based on startMonth, endMonth, and isFullYear
  const filteredData = useMemo(() => {
    if (isFullYear) {
      const refYear =
        monthsWithData.length > 0
          ? monthsWithData[0].split('-')[0]
          : startMonth
            ? startMonth.split('-')[0]
            : '2026'

      const startOfYear = `${refYear}-01`
      const endOfYear = `${refYear}-12`

      const txs = transactions.filter((tx) => {
        const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
        if (!m) return false
        return m.startsWith(refYear) || (m >= startOfYear && m <= endOfYear)
      })

      const incs = incomes.filter((inc) => {
        const m = inc.month || (inc.date ? inc.date.slice(0, 7) : '')
        if (!m) return false
        return m.startsWith(refYear) || (m >= startOfYear && m <= endOfYear)
      })

      const intervalMonths: string[] = []
      for (let i = 1; i <= 12; i++) {
        intervalMonths.push(`${refYear}-${String(i).padStart(2, '0')}`)
      }

      return {
        txs,
        incs,
        intervalMonths,
        effectiveStart: startOfYear,
        effectiveEnd: endOfYear,
      }
    }

    const s = startMonth <= endMonth ? startMonth : endMonth
    const e = startMonth <= endMonth ? endMonth : startMonth

    const txs = transactions.filter((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
      if (!m) return false
      return m >= s && m <= e
    })

    const incs = incomes.filter((inc) => {
      const m = inc.month || (inc.date ? inc.date.slice(0, 7) : '')
      if (!m) return false
      return m >= s && m <= e
    })

    const intervalMonths: string[] = []
    let curr = s
    while (curr <= e) {
      intervalMonths.push(curr)
      const [y, m] = curr.split('-').map(Number)
      if (m === 12) {
        curr = `${y + 1}-01`
      } else {
        curr = `${y}-${String(m + 1).padStart(2, '0')}`
      }
    }

    return {
      txs,
      incs,
      intervalMonths,
      effectiveStart: s,
      effectiveEnd: e,
    }
  }, [isFullYear, transactions, incomes, monthsWithData, startMonth, endMonth])

  // Metrics calculation considering punctual + recurring strictly for the selected period
  const metrics = useMemo(() => {
    const { txs, incs, intervalMonths } = filteredData
    const activeRecurringList = recurringIncomes.filter((r) => r.active)

    const currentM = new Date().toISOString().slice(0, 7)
    const activeRecurringMonthlyBrl = activeRecurringList.reduce((acc, r) => {
      if (r.amount_brl) return acc + Number(r.amount_brl)
      const rMonthRate = getRateForMonth(currentM, exchangeRates)
      return acc + (Number(r.amount_eur) || 0) * rMonthRate
    }, 0)
    const activeRecurringMonthlyEur = activeRecurringList.reduce(
      (acc, r) => acc + (Number(r.amount_eur) || 0),
      0,
    )

    const monthsCount = intervalMonths.length > 0 ? intervalMonths.length : 1

    // Total punctual income in BRL for the period (using each income's month rate)
    const totalPunctualBrl = incs.reduce((acc, inc) => {
      const rMonthRate = getRateForMonth(inc.month, exchangeRates)
      const valBrl = Number(inc.amount_brl) || (Number(inc.amount_eur) || 0) * rMonthRate
      return acc + valBrl
    }, 0)

    // For recurring: calculate sum month by month according to each month's rate in intervalMonths
    let totalRecurringBrl = 0
    intervalMonths.forEach((m) => {
      const mRate = getRateForMonth(m, exchangeRates)
      activeRecurringList.forEach((r) => {
        totalRecurringBrl += Number(r.amount_brl) || (Number(r.amount_eur) || 0) * mRate
      })
    })

    const totalIncome = totalPunctualBrl + totalRecurringBrl

    // Total expenses in BRL for the period
    const totalExpenses = txs.reduce((acc, tx) => {
      return acc + (Number(tx.amount) || 0)
    }, 0)

    // Average monthly income = total / months in interval
    const avgMonthlyIncome = totalIncome / monthsCount

    // Savings rate = (income - expenses) / income
    const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0

    // Monthly deficit check restricted to period transactions and punctual incomes
    const deficitMonths = calculateMonthlyDeficits(txs, incs, recurringIncomes, exchangeRates)

    return {
      activeRecurringMonthlyBrl,
      activeRecurringMonthlyEur,
      totalIncome,
      avgMonthlyIncome,
      totalExpenses,
      savingsRate,
      deficitMonths,
      monthsCount,
    }
  }, [filteredData, recurringIncomes, exchangeRates])

  // Handle Add Punctual Income
  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amountBrl || !month) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    try {
      setSaving(true)
      const monthRate = getRateForMonth(month, exchangeRates)
      const valBrl = parseAmount(amountBrl)
      const valEur = amountEur ? parseAmount(amountEur) : valBrl / monthRate

      await createIncome({
        month,
        amount_brl: valBrl,
        amount_eur: valEur,
        description: description || undefined,
        date: date || undefined,
      })

      toast({ title: 'Receita registrada com sucesso!' })
      setShowAddModal(false)
      setAmountBrl('')
      setAmountEur('')
      setDescription('')
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao registrar receita', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Open Edit Modal for Punctual Income
  const handleOpenEdit = (inc: Income) => {
    setEditingIncome(inc)
    setEditMonth(inc.month)
    setEditAmountBrl(String(inc.amount_brl))
    setEditAmountEur(inc.amount_eur ? String(inc.amount_eur) : '')
    setEditDesc(inc.description || '')
    setEditDate(inc.date ? inc.date.slice(0, 10) : '')
  }

  // Save Edit for Punctual Income
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingIncome) return

    try {
      setSavingEdit(true)
      const monthRate = getRateForMonth(editMonth, exchangeRates)
      const valBrl = parseAmount(editAmountBrl)
      const valEur = editAmountEur ? parseAmount(editAmountEur) : valBrl / monthRate

      await updateIncome(editingIncome.id, {
        month: editMonth,
        amount_brl: valBrl,
        amount_eur: valEur,
        description: editDesc || undefined,
        date: editDate || undefined,
      })

      toast({ title: 'Receita atualizada!' })
      setEditingIncome(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao atualizar receita', variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete Punctual Income
  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta entrada pontual?')) return
    try {
      await deleteIncome(id)
      toast({ title: 'Receita removida.' })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao remover receita', variant: 'destructive' })
    }
  }

  // ==================== RECURRING INCOME HANDLERS ====================
  const handleOpenAddRecurring = () => {
    setEditingRecurring(null)
    setRecDescription('')
    setRecAmountEur('5000')
    setRecAmountBrl('30000')
    setRecActive(true)
    setShowRecurringModal(true)
  }

  const handleOpenEditRecurring = (rec: RecurringIncome) => {
    setEditingRecurring(rec)
    setRecDescription(rec.description)
    setRecAmountEur(String(rec.amount_eur))
    setRecAmountBrl(String(rec.amount_brl))
    setRecActive(rec.active)
    setShowRecurringModal(true)
  }

  const handleToggleRecurringActive = async (rec: RecurringIncome) => {
    try {
      await updateRecurringIncome(rec.id, { active: !rec.active })
      toast({
        title: !rec.active
          ? 'Receita recorrente ativada!'
          : 'Receita recorrente pausada/desativada.',
      })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recDescription || !recAmountEur) {
      toast({ title: 'Preencha a descrição e o valor', variant: 'destructive' })
      return
    }

    try {
      setSavingRecurring(true)
      const defaultRate = getRateForMonth(new Date().toISOString().slice(0, 7), exchangeRates)
      const eur = parseAmount(recAmountEur)
      const brl = recAmountBrl ? parseAmount(recAmountBrl) : eur * defaultRate

      if (editingRecurring) {
        await updateRecurringIncome(editingRecurring.id, {
          description: recDescription,
          amount_eur: eur,
          amount_brl: brl,
          active: recActive,
        })
        toast({ title: 'Receita recorrente atualizada!' })
      } else {
        await createRecurringIncome({
          description: recDescription,
          amount_eur: eur,
          amount_brl: brl,
          active: recActive,
        })
        toast({ title: 'Receita recorrente cadastrada!' })
      }

      setShowRecurringModal(false)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar receita recorrente', variant: 'destructive' })
    } finally {
      setSavingRecurring(false)
    }
  }

  const handleDeleteRecurring = async (id: string) => {
    if (
      !confirm(
        'Deseja realmente excluir esta receita recorrente? Ela deixará de contar automaticamente para os meses.',
      )
    )
      return
    try {
      await deleteRecurringIncome(id)
      toast({ title: 'Receita recorrente removida.' })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao remover receita recorrente', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Receitas</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Adicione suas receitas recorrentes ou entradas pontuais
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PeriodFilterPopover
            startMonth={startMonth}
            endMonth={endMonth}
            isFullYear={isFullYear}
            onStartMonthChange={setStartMonth}
            onEndMonthChange={setEndMonth}
            onFullYearChange={setIsFullYear}
            availableMonths={availableMonths}
            isOpen={isFilterOpen}
            onOpenChange={setIsFilterOpen}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Card 1: Receita Recorrente Mensal */}
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Receita Recorrente Mensal
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Repeat className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 tracking-tight tabular-nums">
              {formatCurrency(metrics.activeRecurringMonthlyBrl, currency)}
            </div>
            <p className="text-xs text-emerald-600/90 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 inline" />
              Automático para todos os meses (
              {currency === 'EUR' ? '€ 5.000,00' : '€ 5.000 / R$ 30k'})
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total de Receitas (Período) */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Receita Total no Período
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
              {formatCurrency(metrics.totalIncome, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.monthsCount === 1
                ? '1 mês analisado'
                : `${metrics.monthsCount} meses analisados`}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Média Mensal de Entradas */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Média Mensal do Período
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
              {formatCurrency(metrics.avgMonthlyIncome, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Capacidade mensal de geração de renda</p>
          </CardContent>
        </Card>

        {/* Card 4: Taxa de Poupança Estimada */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Taxa de Poupança Estimada
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <PiggyBank className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums ${
                metrics.savingsRate >= 0.2
                  ? 'text-emerald-600'
                  : metrics.savingsRate > 0
                    ? 'text-amber-600'
                    : 'text-red-600'
              }`}
            >
              {formatPercent(metrics.savingsRate)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.savingsRate > 0
                ? 'Margem positiva poupada do total recebido'
                : 'Déficit orçamentário (despesas > receitas)'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: RECURRING INCOMES (AUTOMATIC) */}
      <Card className="border-emerald-200/80 shadow-xs overflow-hidden">
        <CardHeader className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-slate-900">
                Receitas Recorrentes Mensais ({recurringIncomes.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-600 mt-0.5">
              Entradas fixas computadas automaticamente em todos os meses (passados e futuros) sem
              necessidade de lançamento manual.
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={handleOpenAddRecurring}
            className="bg-emerald-600 hover:bg-emerald-700 text-xs shadow-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar Recorrência
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {recurringIncomes.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Nenhuma receita recorrente configurada. Cadastre para automatizar seus rendimentos
              mensais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Descrição da Receita</th>
                    <th className="py-3 px-4">Periodicidade</th>
                    <th className="py-3 px-4 text-right">Valor em EUR (€)</th>
                    <th className="py-3 px-4 text-right">Valor em BRL (R$)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recurringIncomes.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>{rec.description}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <Badge
                          variant="secondary"
                          className="bg-slate-100 text-slate-700 text-[10px] font-medium"
                        >
                          Mensal Recorrente (todos os meses)
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                        €{' '}
                        {Number(rec.amount_eur).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 tabular-nums">
                        {formatCurrency(rec.amount_brl, 'BRL')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleRecurringActive(rec)}
                          className={`h-6 text-[10px] font-semibold px-2 rounded-full ${
                            rec.active
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Clique para ativar/pausar esta receita recorrente"
                        >
                          <Power className="h-3 w-3 mr-1" />
                          {rec.active ? 'Ativa' : 'Pausada'}
                        </Button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-blue-600"
                          onClick={() => handleOpenEditRecurring(rec)}
                          title="Editar receita recorrente"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-red-600"
                          onClick={() => handleDeleteRecurring(rec.id)}
                          title="Excluir receita recorrente"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: PUNCTUAL INCOMES TABLE (FILTRADA PELO PERÍODO) */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Entradas Pontuais & Variáveis no Período ({filteredData.incs.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Lançamentos específicos filtrados pelo período selecionado (
              {isFullYear
                ? 'Ano completo'
                : `${formatPeriodMonthLabel(filteredData.effectiveStart)} até ${formatPeriodMonthLabel(filteredData.effectiveEnd)}`}
              )
            </CardDescription>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddModal(true)}
            className="text-xs border-slate-300"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Adicionar Lançamento Pontual
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Carregando receitas...</div>
          ) : filteredData.incs.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                Nenhuma entrada pontual encontrada no período selecionado
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                Suas receitas recorrentes continuam ativas para todos os meses do intervalo. Ajuste
                o filtro ou adicione entradas pontuais específicas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/70 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Mês de Referência</th>
                    <th className="py-3 px-4">Data Registro</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4 text-right">Valor em BRL (R$)</th>
                    <th className="py-3 px-4 text-right">Valor em EUR (€)</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.incs.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {formatMonthLong(inc.month)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-500">
                        {inc.date ? inc.date.slice(0, 10).split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {inc.description || 'Renda / Receita Pontual'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 tabular-nums">
                        {formatCurrency(inc.amount_brl, 'BRL')}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums font-medium">
                        {(() => {
                          const rateUsed = getRateForMonth(inc.month, exchangeRates)
                          const eurVal = inc.amount_eur
                            ? Number(inc.amount_eur)
                            : Number(inc.amount_brl) / rateUsed
                          return (
                            <div className="flex flex-col items-end">
                              <span>
                                €{' '}
                                {eurVal.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                (taxa R$ {rateUsed.toFixed(2)})
                              </span>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-blue-600"
                          onClick={() => handleOpenEdit(inc)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-red-600"
                          onClick={() => handleDelete(inc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: ADD/EDIT RECURRING INCOME */}
      <Dialog open={showRecurringModal} onOpenChange={setShowRecurringModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRecurring ? 'Editar Receita Recorrente' : 'Nova Receita Recorrente Mensal'}
            </DialogTitle>
            <DialogDescription>
              Esta receita é contabilizada automaticamente como entrada em todos os meses sem
              precisar de inserção manual.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRecurring} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rec-desc">Descrição da Renda Recorrente</Label>
              <Input
                id="rec-desc"
                placeholder="Ex: Salário mensal, Pro-labore, Renda fixa"
                value={recDescription}
                onChange={(e) => setRecDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rec-eur">Valor em EUR (€)</Label>
                <Input
                  id="rec-eur"
                  placeholder="Ex: 5000,00"
                  value={recAmountEur}
                  onChange={(e) => {
                    setRecAmountEur(e.target.value)
                    const parsed = parseAmount(e.target.value)
                    const curRate = getRateForMonth(
                      new Date().toISOString().slice(0, 7),
                      exchangeRates,
                    )
                    if (parsed > 0) {
                      setRecAmountBrl((parsed * curRate).toFixed(2))
                    }
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rec-brl">Valor em BRL (R$)</Label>
                <Input
                  id="rec-brl"
                  placeholder="Ex: 30000,00"
                  value={recAmountBrl}
                  onChange={(e) => {
                    setRecAmountBrl(e.target.value)
                    const parsed = parseAmount(e.target.value)
                    const curRate = getRateForMonth(
                      new Date().toISOString().slice(0, 7),
                      exchangeRates,
                    )
                    if (parsed > 0) {
                      setRecAmountEur((parsed / curRate).toFixed(2))
                    }
                  }}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                id="rec-active"
                checked={recActive}
                onChange={(e) => setRecActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <Label
                htmlFor="rec-active"
                className="text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Ativa (aplicar automaticamente para todos os meses)
              </Label>
            </div>

            <div className="rounded-lg bg-blue-50 p-2.5 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                A conversão mensal utilizará a cotação média de cada mês na tabela orçamentária e
                gráficos.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowRecurringModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingRecurring}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {savingRecurring
                  ? 'Salvando...'
                  : editingRecurring
                    ? 'Salvar Alterações'
                    : 'Criar Recorrência'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: ADD PUNCTUAL INCOME */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Entrada Pontual</DialogTitle>
            <DialogDescription>
              Adicione valores extraordinários pontuais recebidos em um mês específico (13º, PLR,
              bônus).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveIncome} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="i-month">Mês de Referência (YYYY-MM)</Label>
              <Input
                id="i-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="i-desc">Descrição / Origem</Label>
              <Input
                id="i-desc"
                placeholder="Ex: 13º Salário, Distribuição de Lucros, Consultoria"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="i-brl">Valor (R$ BRL)</Label>
                <Input
                  id="i-brl"
                  placeholder="Ex: 15.000,00"
                  value={amountBrl}
                  onChange={(e) => {
                    setAmountBrl(e.target.value)
                    const parsed = parseAmount(e.target.value)
                    const mRate = getRateForMonth(month, exchangeRates)
                    if (parsed > 0) {
                      setAmountEur((parsed / mRate).toFixed(2))
                    }
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="i-eur">Valor (€ EUR opcional)</Label>
                <Input
                  id="i-eur"
                  placeholder="Ex: 2.500,00"
                  value={amountEur}
                  onChange={(e) => setAmountEur(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="i-date">Data do Recebimento</Label>
              <Input
                id="i-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? 'Registrando...' : 'Salvar Entrada'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDIT PUNCTUAL INCOME */}
      <Dialog open={!!editingIncome} onOpenChange={(open) => !open && setEditingIncome(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Entrada Pontual</DialogTitle>
            <DialogDescription>Ajuste os valores ou mês da entrada financeira.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="e-month">Mês de Referência (YYYY-MM)</Label>
              <Input
                id="e-month"
                type="month"
                value={editMonth}
                onChange={(e) => setEditMonth(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-desc">Descrição</Label>
              <Input id="e-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-brl">Valor (R$ BRL)</Label>
                <Input
                  id="e-brl"
                  value={editAmountBrl}
                  onChange={(e) => setEditAmountBrl(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-eur">Valor (€ EUR)</Label>
                <Input
                  id="e-eur"
                  value={editAmountEur}
                  onChange={(e) => setEditAmountEur(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-date">Data</Label>
              <Input
                id="e-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingIncome(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEdit}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {savingEdit ? 'Salvando...' : 'Atualizar Receita'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
