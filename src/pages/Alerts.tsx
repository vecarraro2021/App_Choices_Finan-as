import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getAllTransactions,
  getCategories,
  getUserSettings,
  getIncomes,
  getRecurringIncomes,
  getExchangeRates,
} from '@/services/financeService'
import {
  Category,
  Transaction,
  UserSettings,
  Income,
  RecurringIncome,
  ExchangeRate,
} from '@/types/finance'
import {
  formatCurrency,
  formatMonthShort,
  formatMonthLong,
  MONTH_NAMES_SHORT,
} from '@/lib/formatters'
import { RefreshCw, AlertTriangle, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { InsightsList } from '@/components/InsightsList'
import { generateFinancialInsights } from '@/lib/insightsEngine'
import { calculateMonthlyDeficits, DeficitMonthItem } from '@/lib/alertsEngine'
import { PeriodFilterPopover, formatPeriodMonthLabel } from '@/components/PeriodFilterPopover'

export default function AlertsView() {
  const { user, currency } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)

  // Period Filter State (Same pattern as Dashboard & Receitas)
  const [startMonth, setStartMonth] = useState<string>('2026-08')
  const [endMonth, setEndMonth] = useState<string>('2026-08')
  const [isFullYear, setIsFullYear] = useState<boolean>(false)
  const [hasInitializedDefaultMonth, setHasInitializedDefaultMonth] = useState<boolean>(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const loadData = async () => {
    try {
      setRefreshing(true)
      const [txs, cats, settings, incs, recIncs, rates] = await Promise.all([
        getAllTransactions(),
        getCategories(),
        getUserSettings(),
        getIncomes(),
        getRecurringIncomes(),
        getExchangeRates(),
      ])

      setTransactions(txs)
      setCategories(cats)
      setUserSettings(settings)
      setIncomes(incs)
      setRecurringIncomes(recIncs)
      setExchangeRates(rates)
    } catch (err) {
      console.error('Erro ao carregar dados de insights:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os dados de insights.',
        variant: 'destructive',
      })
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  useRealtime('transactions', () => loadData())
  useRealtime('categories', () => loadData())
  useRealtime('user_settings', () => loadData())
  useRealtime('income', () => loadData())
  useRealtime('recurring_incomes', () => loadData())

  // Distinct months that actually contain data
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

  // Compute filtered transactions and intervalMonths based on selected period
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

  // Calculate monthly average spending for the period
  const periodMonthlyAverage = useMemo(() => {
    const totalSpent = filteredData.txs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    const count = Math.max(filteredData.intervalMonths.length, 1)
    return totalSpent / count
  }, [filteredData])

  // Calculate deficits strictly for the selected period
  const periodDeficitMonths = useMemo(() => {
    if (userSettings?.notify_monthly_summary === false) {
      return []
    }
    return calculateMonthlyDeficits(
      filteredData.txs,
      filteredData.incs,
      recurringIncomes,
      exchangeRates,
    )
  }, [filteredData, recurringIncomes, exchangeRates, userSettings])

  // Generate insights using shared engine over the selected period
  const insights = useMemo(() => {
    return generateFinancialInsights({
      transactions: filteredData.txs,
      categories,
      currency,
      intervalMonths: filteredData.intervalMonths,
      monthlyAverage: periodMonthlyAverage,
      userSettings,
    })
  }, [filteredData, categories, currency, periodMonthlyAverage, userSettings])

  // Quick stats from generated insights + deficit alert
  const stats = useMemo(() => {
    const hasDeficitAlert = periodDeficitMonths.length > 0
    return {
      critical:
        insights.filter((i) => i.badgeText === 'Atenção').length + (hasDeficitAlert ? 1 : 0),
      economy: insights.filter((i) => i.badgeText === 'Economia').length,
      success: insights.filter((i) => i.badgeText === 'No caminho').length,
      priority: insights.filter((i) => i.badgeText === 'Alta prioridade').length,
      total: insights.length + (hasDeficitAlert ? 1 : 0),
    }
  }, [insights, periodDeficitMonths])

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Alertas & Insights</h1>
          <p className="text-sm text-slate-500 mt-1">
            Motor analítico de regras financeiras baseado nos seus lançamentos e orçamentos.
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

          <Button
            onClick={loadData}
            disabled={refreshing}
            variant="outline"
            className="border-slate-300 hover:bg-slate-100 flex items-center gap-2 h-10 px-3.5 text-xs sm:text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">
              {refreshing ? 'Recalculando...' : 'Recalcular'}
            </span>
          </Button>
        </div>
      </div>

      {/* 2. Resumo de estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50/40">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-red-700">
              Atenção
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            <div className="text-2xl font-bold text-red-700 tabular-nums">{stats.critical}</div>
            <p className="text-xs text-red-600/80 mt-0.5">Estouros e tendências de alta</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
              Economia
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            <div className="text-2xl font-bold text-blue-700 tabular-nums">{stats.economy}</div>
            <p className="text-xs text-blue-600/80 mt-0.5">Oportunidades de otimização</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              No caminho
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">{stats.success}</div>
            <p className="text-xs text-emerald-600/80 mt-0.5">Metas dentro do planejado</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/40">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
              Prioridades
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            <div className="text-2xl font-bold text-purple-700 tabular-nums">{stats.priority}</div>
            <p className="text-xs text-purple-600/80 mt-0.5">Reserva e planejamento</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Alerta de Saúde Financeira: Despesas excedem receitas com detalhamento por mês (restrito ao período) */}
      {periodDeficitMonths.length > 0 && userSettings?.notify_monthly_summary !== false && (
        <Card className="border-red-200 bg-red-50/50 shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="pb-3 pt-5 px-6 bg-red-100/40 border-b border-red-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-700 shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base font-bold text-red-900">
                    Alerta de Saúde Financeira: Despesas excedem receitas
                  </CardTitle>
                  <Badge variant="destructive" className="text-[10px] font-semibold">
                    Atenção
                  </Badge>
                </div>
                <CardDescription className="text-xs text-red-700/90 mt-1">
                  Foram identificados {periodDeficitMonths.length}{' '}
                  {periodDeficitMonths.length === 1 ? 'mês' : 'meses'} no período selecionado onde o
                  custo de vida superou a soma da renda recorrente + pontual declarada (déficit
                  acumulado de{' '}
                  <span className="font-bold">
                    {formatCurrency(
                      periodDeficitMonths.reduce((sum, d) => sum + d.deficit, 0),
                      currency,
                    )}
                  </span>
                  ).
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-6 py-4 space-y-3">
            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Detalhamento dos meses com saldo negativo no período:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {periodDeficitMonths.map((item) => (
                <div
                  key={item.month}
                  className="p-3 bg-white rounded-lg border border-red-200/80 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">
                      {formatMonthLong(item.month)}
                    </span>
                    <span className="text-[11px] font-bold text-red-600 tabular-nums">
                      - {formatCurrency(item.deficit, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>Receitas: {formatCurrency(item.income, currency)}</span>
                    <span>Despesas: {formatCurrency(item.expense, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Sugestão: Avalie despesas não recorrentes nos meses deficitários, otimize custos fixos
              ou incremente as fontes de receita para evitar consumo de reservas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 4. Card com a lista compartilhada de insights */}
      <Card className="border-slate-200/80 shadow-xs bg-white rounded-xl">
        <CardHeader className="pb-3 pt-5 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Insights & Recomendações
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              {isFullYear
                ? 'Sugestões consolidadas calculadas sobre todo o ano selecionado.'
                : filteredData.effectiveStart === filteredData.effectiveEnd
                  ? `Sugestões calculadas exclusivamente para ${formatPeriodMonthLabel(filteredData.effectiveStart)}.`
                  : `Sugestões calculadas para o intervalo de ${formatPeriodMonthLabel(filteredData.effectiveStart)} até ${formatPeriodMonthLabel(filteredData.effectiveEnd)}.`}
            </CardDescription>
          </div>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
          </span>
        </CardHeader>

        <CardContent className="px-6 py-5">
          <InsightsList
            insights={insights}
            emptyMessage={
              isFullYear
                ? 'Nenhum insight identificado para o ano completo.'
                : `Nenhum desvio ou insight identificado para o período selecionado.`
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
