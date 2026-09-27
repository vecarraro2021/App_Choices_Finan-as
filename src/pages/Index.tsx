import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getAllTransactions,
  getCategories,
  getIncomes,
  getRecurringIncomes,
  getMonthlyTotals,
  getExchangeRates,
  getRateForMonth,
  getUserSettings,
  getBankAccounts,
} from '@/services/financeService'
import { computeAndSyncAlerts } from '@/lib/alertsEngine'
import {
  Transaction,
  Category,
  Income,
  RecurringIncome,
  Alert,
  MonthlyTotal,
  ExchangeRate,
  BankAccount,
} from '@/types/finance'
import {
  formatCurrency,
  formatPercent,
  formatMonthShort,
  MONTH_NAMES_SHORT,
} from '@/lib/formatters'
import { CountUp } from '@/components/CountUp'
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  UploadCloud,
  ArrowRight,
  ShieldAlert,
  Info,
  Calendar as CalendarIcon,
  Layers,
  Sparkles,
  Scale,
  ChevronDown,
  CheckCircle2,
  Check,
  Target,
  Repeat,
  Compass,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLatestDiagnostic } from '@/services/diagnosticService'
import { DiagnosticRecord } from '@/types/finance'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { InsightsList } from '@/components/InsightsList'
import { generateFinancialInsights } from '@/lib/insightsEngine'
import { PeriodFilterPopover, formatPeriodMonthLabel } from '@/components/PeriodFilterPopover'

export default function Index() {
  const { user, currency } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [latestDiagnostic, setLatestDiagnostic] = useState<DiagnosticRecord | null>(null)

  // Date Filter State
  const [startMonth, setStartMonth] = useState<string>('2026-08')
  const [endMonth, setEndMonth] = useState<string>('2026-08')
  const [isFullYear, setIsFullYear] = useState<boolean>(false)
  const [hasInitializedDefaultMonth, setHasInitializedDefaultMonth] = useState<boolean>(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Load initial data
  const loadData = async () => {
    try {
      const [txs, cats, incs, recIncs, mTotals, ratesList, settings, banks, diag] =
        await Promise.all([
          getAllTransactions(),
          getCategories(),
          getIncomes(),
          getRecurringIncomes(),
          getMonthlyTotals(),
          getExchangeRates(),
          getUserSettings(),
          getBankAccounts(),
          getLatestDiagnostic(user?.id),
        ])
      setTransactions(txs)
      setCategories(cats)
      setIncomes(incs)
      setRecurringIncomes(recIncs)
      setMonthlyTotals(mTotals)
      setExchangeRates(ratesList)
      setBankAccounts(banks)
      setLatestDiagnostic(diag)

      // Compute and sync dynamic alerts
      const computed = await computeAndSyncAlerts(
        txs,
        incs,
        cats,
        mTotals,
        recIncs,
        settings,
        ratesList,
      )
      setAlerts(
        computed.map((c, i) => ({
          id: `comp-${i}`,
          user: user?.id || '',
          severity: c.severity,
          title: c.title,
          description: c.description,
          suggestion: c.suggestion,
          deficitMonths: c.deficitMonths,
        })),
      )
    } catch (err) {
      console.error('Erro ao carregar dados do painel:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  // Real-time subscriptions
  useRealtime('transactions', () => loadData())
  useRealtime('income', () => loadData())
  useRealtime('recurring_incomes', () => loadData())
  useRealtime('categories', () => loadData())
  useRealtime('bank_accounts', () => loadData())
  useRealtime('diagnostics', () => loadData())

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

  // Available months options for dropdown selectors (derived from data or 2026 default)
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    // Include all 2026 months by default
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
      // Full year: all months with data or entire year interval
      // Determine the reference year from data or current year (default 2026)
      const refYear =
        monthsWithData.length > 0
          ? monthsWithData[0].split('-')[0]
          : startMonth
            ? startMonth.split('-')[0]
            : '2026'

      const startOfYear = `${refYear}-01`
      const endOfYear = `${refYear}-12`

      // If there are months with data, cover from earliest to latest data month,
      // or the full 12 months of the year
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

      // Interval months for recurring incomes & calculations:
      // If there are specific data months in the year, use all months in the year up to the latest or all 12
      // Using all 12 months for "Ano completo"
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

    // Calculate all distinct months that fall within the selected interval [s, e]
    // Generate consecutive month strings between s and e
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

  // Total Income (Entrada) for the period: Punctual Incomes + Recurring Incomes * months
  const totalIncome = useMemo(() => {
    const { incs, intervalMonths } = filteredData
    const activeRecurring = recurringIncomes.filter((r) => r.active)

    // Sum punctual incomes in the period
    let punctualSum = 0
    incs.forEach((inc) => {
      const mRate = getRateForMonth(inc.month, exchangeRates)
      const valBrl = Number(inc.amount_brl) || (Number(inc.amount_eur) || 0) * mRate
      punctualSum += valBrl
    })

    // Sum recurring income for each month in the interval
    let recurringSum = 0
    intervalMonths.forEach((m) => {
      const mRate = getRateForMonth(m, exchangeRates)
      activeRecurring.forEach((r) => {
        recurringSum += Number(r.amount_brl) || (Number(r.amount_eur) || 0) * mRate
      })
    })

    return punctualSum + recurringSum
  }, [filteredData, recurringIncomes, exchangeRates])

  // Calculations for Metrics: Total Saída, Total Orçado, Estourado vs Orçado
  const metrics = useMemo(() => {
    const { txs, intervalMonths } = filteredData

    // Total spending in BRL
    const totalSpending = txs.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0)

    // Months count: number of distinct months in the selected interval
    // If the interval has months, use that count
    const monthsCount = intervalMonths.length > 0 ? intervalMonths.length : 1
    const monthlyAverage = monthsCount > 0 ? totalSpending / monthsCount : 0

    // Monthly budget sum across main categories (from their subcategories)
    const mainCats = categories.filter((c) => c.type === 'main')
    const monthlyBudget = mainCats.reduce((acc, main) => {
      const subs = categories.filter((c) => c.parent === main.id)
      if (subs.length > 0) {
        return acc + subs.reduce((subSum, s) => subSum + (Number(s.estimated) || 0), 0)
      }
      return acc + (Number(main.estimated) || 0)
    }, 0)

    // Total Budget for the whole selected period = monthly budget * number of months
    const totalBudget = monthlyBudget * monthsCount

    // Estourado vs Orçado
    const diff = totalSpending - totalBudget
    const overBudgetPct = totalBudget > 0 ? (diff / totalBudget) * 100 : 0
    const isOverBudget = diff > 0

    // Highest spending month inside the period
    const spendingByMonth: Record<string, number> = {}
    txs.forEach((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : 'Outros')
      spendingByMonth[m] = (spendingByMonth[m] || 0) + (Number(tx.amount) || 0)
    })

    let highestMonth = ''
    let highestAmount = 0
    Object.entries(spendingByMonth).forEach(([m, amt]) => {
      if (amt > highestAmount) {
        highestAmount = amt
        highestMonth = m
      }
    })

    return {
      totalSpending,
      totalBudget,
      monthlyBudget,
      diff,
      overBudgetPct,
      isOverBudget,
      monthlyAverage,
      monthsCount,
      highestMonth,
      highestAmount,
      hasTransactions: txs.length > 0,
    }
  }, [filteredData, categories])

  // Bank Accounts metrics: Saldo Disponível & Reserva Financeira
  const bankMetrics = useMemo(() => {
    const currentMonthKey = new Date().toISOString().slice(0, 7)
    const currentEurRate = getRateForMonth(currentMonthKey, exchangeRates)

    const totalBalanceBrl = bankAccounts.reduce((sum, acc) => {
      const val = Number(acc.balance) || 0
      if (acc.currency === 'EUR') {
        return sum + val * currentEurRate
      }
      return sum + val
    }, 0)

    // Calculate months of expenses reserve: totalBalanceBrl / monthlyAverage
    const monthsOfRunway = metrics.monthlyAverage > 0 ? totalBalanceBrl / metrics.monthlyAverage : 0

    // Most recent sync date across accounts
    const dates = bankAccounts
      .map((a) => (a.last_synced ? new Date(a.last_synced).getTime() : 0))
      .filter((d) => d > 0)
    const lastSyncDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date()

    return {
      totalBalanceBrl,
      monthsOfRunway,
      hasAccounts: bankAccounts.length > 0,
      lastSyncDate,
    }
  }, [bankAccounts, exchangeRates, metrics.monthlyAverage])

  // Bar Chart Data: Real vs. Orçado for each month in the selected period
  const barChartData = useMemo(() => {
    const { txs, intervalMonths } = filteredData
    const mainCats = categories.filter((c) => c.type === 'main')
    const monthlyBudget = mainCats.reduce((acc, main) => {
      const subs = categories.filter((c) => c.parent === main.id)
      if (subs.length > 0) {
        return acc + subs.reduce((subSum, s) => subSum + (Number(s.estimated) || 0), 0)
      }
      return acc + (Number(main.estimated) || 0)
    }, 0)

    const monthMap: Record<string, number> = {}
    txs.forEach((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : 'Sem data')
      monthMap[m] = (monthMap[m] || 0) + (Number(tx.amount) || 0)
    })

    // Show all months in the interval, or months that have transactions if interval is huge
    return intervalMonths.map((m) => {
      const realAmount = monthMap[m] || 0
      const mRate = getRateForMonth(m, exchangeRates)
      return {
        month: formatMonthShort(m),
        monthKey: m,
        rate: mRate,
        real: currency === 'EUR' ? realAmount / mRate : realAmount,
        orcado: currency === 'EUR' ? monthlyBudget / mRate : monthlyBudget,
      }
    })
  }, [filteredData, categories, currency, exchangeRates])

  // Category Distribution List (Replaces Donut)
  const categoryDistribution = useMemo(() => {
    const { txs } = filteredData
    const mainCategories = categories.filter((c) => c.type === 'main')
    const catMap = new Map<
      string,
      { id: string; name: string; color: string; total: number; estimated: number }
    >()

    mainCategories.forEach((c) => {
      catMap.set(c.id, {
        id: c.id,
        name: c.name,
        color: c.color || '#2563EB',
        total: 0,
        estimated: Number(c.estimated) || 0,
      })
    })

    const subToParent = new Map<string, string>()
    categories
      .filter((c) => c.type === 'sub' && c.parent)
      .forEach((c) => {
        subToParent.set(c.id, c.parent!)
      })

    let totalAll = 0
    txs.forEach((tx) => {
      const amt = Number(tx.amount) || 0
      totalAll += amt
      let targetCatId = tx.category

      if (targetCatId && subToParent.has(targetCatId)) {
        targetCatId = subToParent.get(targetCatId)
      }

      if (targetCatId && catMap.has(targetCatId)) {
        catMap.get(targetCatId)!.total += amt
      } else {
        // Extras / Uncategorized
        const extrasKey = Array.from(catMap.keys()).find(
          (k) => catMap.get(k)?.name.toLowerCase() === 'extras',
        )
        if (extrasKey) {
          catMap.get(extrasKey)!.total += amt
        }
      }
    })

    const list = Array.from(catMap.values())
      .filter((item) => item.total > 0)
      .map((item) => {
        const pct = totalAll > 0 ? (item.total / totalAll) * 100 : 0
        return {
          ...item,
          percentage: pct,
        }
      })
      .sort((a, b) => b.total - a.total)

    return {
      items: list,
      totalAll,
    }
  }, [filteredData, categories])

  // Dynamic AI Agent Insights for the selected period
  const agentInsights = useMemo(() => {
    return generateFinancialInsights({
      transactions: filteredData.txs,
      categories,
      currency,
      intervalMonths: filteredData.intervalMonths,
      monthlyAverage: metrics.monthlyAverage,
    })
  }, [filteredData, categories, currency, metrics.monthlyAverage])

  // Format today's date in PT-BR for "Atualizado em DD/MM/YYYY"
  const formattedToday = useMemo(() => {
    const today = bankMetrics.lastSyncDate
    const d = String(today.getDate()).padStart(2, '0')
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const y = today.getFullYear()
    return `${d}/${m}/${y}`
  }, [bankMetrics.lastSyncDate])

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            {latestDiagnostic && (
              <button
                onClick={() => navigate('/diagnostico')}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Ver sua Bússola Financeira"
              >
                <Compass className="h-3 w-3" />
                <span>Bússola: {latestDiagnostic.overall_score}/100</span>
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Visão resumida do seu planejamento financeiro
          </p>
        </div>

        {/* Seletor de Período por Data */}
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

          <Button
            onClick={() => navigate('/extratos')}
            className="hidden sm:flex bg-blue-600 hover:bg-blue-700 font-semibold shadow-xs text-xs h-10 px-3.5"
          >
            <UploadCloud className="mr-1.5 h-4 w-4" />
            Importar Extratos
          </Button>
        </div>
      </div>

      {/* Convite para Diagnóstico caso o usuário ainda não o tenha feito */}
      {!loading && !latestDiagnostic && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <Compass className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                Descubra a saúde real das suas finanças com a Bússola Financeira
              </h3>
              <p className="text-xs text-blue-100 mt-0.5 max-w-2xl">
                Responda ao questionário de 16 perguntas em 3 minutos para mapear seu controle
                diário, reserva, metas e peso de dívidas.
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/diagnostico')}
            className="bg-white text-blue-700 hover:bg-blue-50 font-semibold text-xs h-9 px-4 shrink-0 shadow-sm self-start sm:self-auto"
          >
            <span>Fazer Diagnóstico</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {/* 2. LINHA DE 3 CARDS DE MÉTRICA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: TOTAL ENTRADA */}
        <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow bg-white rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL ENTRADA
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-0">
            <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
              <CountUp value={totalIncome} currency={currency} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.monthsCount === 1
                ? '1 mês analisado'
                : `${metrics.monthsCount} meses analisados`}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: TOTAL SAÍDA */}
        <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow bg-white rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL SAÍDA
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Scale className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-0">
            <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
              <CountUp value={metrics.totalSpending} currency={currency} />
            </div>
            <p className="text-xs text-slate-500 mt-1">Soma das metas por categoria</p>
          </CardContent>
        </Card>

        {/* Card 3: ESTOURADO VS ORÇADO (Badge vermelho alinhado com o valor, sem overflow) */}
        <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow bg-white rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              ESTOURADO VS ORÇADO
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                metrics.isOverBudget ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {metrics.isOverBudget ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-2xl font-bold tracking-tight tabular-nums ${
                  metrics.isOverBudget ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                <CountUp value={Math.abs(metrics.diff)} currency={currency} />
              </span>
              {metrics.totalBudget > 0 && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums shrink-0 ${
                    metrics.isOverBudget
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {metrics.isOverBudget ? '+' : '-'}
                  {Math.abs(metrics.overBudgetPct).toFixed(1).replace('.', ',')}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.isOverBudget ? 'Acima do planejado' : 'Dentro do orçamento'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3 & 4. SEÇÃO DO MEIO: GASTO REAL VS ORÇADO (2/3) + RESERVA & SALDO (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Card Grande: Gasto Real vs. Orçado (2/3 = col-span-8) */}
        <Card className="lg:col-span-8 border-slate-200/80 shadow-xs bg-white rounded-xl flex flex-col justify-between">
          <CardHeader className="pb-2 pt-5 px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Gasto Real vs. Orçado
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Comparação mensal da execução orçamentária ({currency})
                </CardDescription>
              </div>
              {metrics.highestMonth && (
                <div className="text-xs font-semibold text-red-600">
                  Pico de Gasto {formatMonthShort(metrics.highestMonth)} (
                  {formatCurrency(metrics.highestAmount, currency)})
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-3 flex-1">
            {barChartData.length > 0 ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      stroke="#E2E8F0"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      stroke="#E2E8F0"
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val: any, _name: any, item: any) => {
                        const mRate = item?.payload?.rate || 6.0
                        return [
                          formatCurrency(
                            Number(val) * (currency === 'EUR' ? mRate : 1),
                            currency,
                            mRate,
                          ),
                        ]
                      }}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar
                      dataKey="orcado"
                      name="Orçado"
                      fill="#E2E8F0"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="real"
                      name="Gasto Real"
                      fill="#3B82F6"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col h-[280px] items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <TrendingDown className="h-6 w-6 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Sem dados para o período</p>
                <p className="text-xs text-slate-500 mt-1">
                  Selecione outro intervalo ou importe extratos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna Direita: Reserva Financeira + Saldo Disponível (1/3 = col-span-4) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-5">
          {/* Card: RESERVA FINANCEIRA */}
          <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow bg-white rounded-xl flex-1 flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                RESERVA FINANCEIRA
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Scale className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
                <CountUp value={bankMetrics.totalBalanceBrl} currency={currency} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {bankMetrics.hasAccounts
                  ? `${bankMetrics.monthsOfRunway.toFixed(1).replace('.', ',')}x a média mensal de gastos`
                  : 'Cadastre suas contas em Configurações > Bancos'}
              </p>
            </CardContent>
          </Card>

          {/* Card: SALDO DISPONÍVEL */}
          <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow bg-white rounded-xl flex-1 flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                SALDO DISPONÍVEL
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Scale className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
                <CountUp value={bankMetrics.totalBalanceBrl} currency={currency} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {bankMetrics.hasAccounts
                  ? `Atualizado em ${formattedToday}`
                  : 'Cadastre suas contas em Configurações > Bancos'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5 & 6. SEÇÃO INFERIOR: AÇÕES & INSIGHTS (1/2) + DISTRIBUIÇÃO POR CATEGORIA (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card Esquerdo: Ações & Insights do Agente Financeiro */}
        <Card className="border-slate-200/80 shadow-xs bg-white rounded-xl flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 pt-5 px-6 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900">
                Ações & Insights do Agente Financeiro
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Sugestões personalizadas baseadas na análise dos seus dados financeiros.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 py-4">
              <InsightsList insights={agentInsights} limit={6} />
            </CardContent>
          </div>

          <div className="px-6 py-3.5 border-t border-slate-100 text-center">
            <button
              onClick={() => navigate('/categorias')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              Ver todas as categorias
            </button>
          </div>
        </Card>

        {/* Card Direito: Distribuição por Categoria (Barras horizontais estilizadas) */}
        <Card className="border-slate-200/80 shadow-xs bg-white rounded-xl flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 pt-5 px-6 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900">
                Distribuição por Categoria
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Principais ralos e destinos do seu dinheiro
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 py-4">
              {categoryDistribution.items.length > 0 ? (
                <div className="space-y-4">
                  {categoryDistribution.items.slice(0, 11).map((cat) => (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 truncate pr-2">{cat.name}</span>
                        <div className="tabular-nums shrink-0">
                          <span className="font-bold text-slate-900">
                            {formatCurrency(cat.total, currency)}
                          </span>
                          <span className="text-slate-400 font-normal ml-1">
                            ({cat.percentage.toFixed(1).replace('.', ',')}%)
                          </span>
                        </div>
                      </div>
                      {/* Barra de progresso fina colorida */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(cat.percentage, 100)}%`,
                            backgroundColor: cat.color || '#3B82F6',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Nenhuma transação encontrada no período selecionado.
                </div>
              )}
            </CardContent>
          </div>

          <div className="px-6 py-3.5 border-t border-slate-100 text-center">
            <button
              onClick={() => navigate('/categorias')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              Ver todas as categorias
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
