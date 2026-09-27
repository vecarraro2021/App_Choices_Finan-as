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
import { formatCurrency } from '@/lib/formatters'
import { RefreshCw, Lightbulb, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { InsightsList } from '@/components/InsightsList'
import { generateFinancialInsights } from '@/lib/insightsEngine'
import { calculateMonthlyDeficits } from '@/lib/alertsEngine'
import { PeriodFilterPopover, formatPeriodMonthLabel } from '@/components/PeriodFilterPopover'
import { ConsultantSidebarPanel } from '@/components/ConsultantSidebarPanel'
import { getLatestDiagnostic } from '@/services/diagnosticService'
import { DiagnosticRecord } from '@/types/finance'

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
  const [latestDiagnostic, setLatestDiagnostic] = useState<DiagnosticRecord | null>(null)

  // Period Filter State (Same pattern as Dashboard & Receitas)
  const [startMonth, setStartMonth] = useState<string>('2026-08')
  const [endMonth, setEndMonth] = useState<string>('2026-08')
  const [isFullYear, setIsFullYear] = useState<boolean>(false)
  const [hasInitializedDefaultMonth, setHasInitializedDefaultMonth] = useState<boolean>(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const loadData = async () => {
    try {
      setRefreshing(true)
      const [txs, cats, settings, incs, recIncs, rates, diag] = await Promise.all([
        getAllTransactions(),
        getCategories(),
        getUserSettings(),
        getIncomes(),
        getRecurringIncomes(),
        getExchangeRates(),
        getLatestDiagnostic(user?.id),
      ])

      setTransactions(txs)
      setCategories(cats)
      setUserSettings(settings)
      setIncomes(incs)
      setRecurringIncomes(recIncs)
      setExchangeRates(rates)
      setLatestDiagnostic(diag)
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
  useRealtime('diagnostics', () => loadData())

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

  // Calculation of Potential Savings (Economia) from insights and opportunities
  const totalPotentialSavings = useMemo(() => {
    let sum = 0
    // Extrai valores numéricos de economia das descrições ou categorias analisadas
    const monthsCount = Math.max(filteredData.intervalMonths.length, 1)

    // Agrupar gastos por categoria principal no período
    const mainCategories = categories.filter((c) => c.type === 'main')
    const subToParent = new Map<string, string>()
    categories
      .filter((c) => c.type === 'sub' && c.parent)
      .forEach((c) => {
        subToParent.set(c.id, c.parent!)
      })

    const catTotals: Record<string, number> = {}
    filteredData.txs.forEach((tx) => {
      const amt = Number(tx.amount) || 0
      let pId = tx.category
      if (pId && subToParent.has(pId)) {
        pId = subToParent.get(pId)
      }
      if (pId) {
        catTotals[pId] = (catTotals[pId] || 0) + amt
      }
    })

    // Oportunidade 1: Top categoria (15% de economia mensal)
    const sortedCats = [...mainCategories].sort(
      (a, b) => (catTotals[b.id] || 0) - (catTotals[a.id] || 0),
    )
    if (sortedCats.length > 0) {
      const topSpent = catTotals[sortedCats[0].id] || 0
      const pot = Math.round((topSpent / monthsCount) * 0.15)
      if (pot > 50) sum += pot
    }

    // Oportunidade 2: Assinaturas ou Serviços (25% de economia)
    const subCatMain = mainCategories.find(
      (c) =>
        c.name.toLowerCase().includes('assinatura') || c.name.toLowerCase().includes('serviço'),
    )
    if (subCatMain && (catTotals[subCatMain.id] || 0) > 0) {
      const monthlySub = (catTotals[subCatMain.id] || 0) / monthsCount
      const potSub = Math.round(monthlySub * 0.25)
      sum += potSub
    }

    // Se houver insights identificados, assegurar que há um potencial consistente
    // Multiplicado pela quantidade de meses do período para dar o potencial do período
    const periodSavings = sum * monthsCount

    // Fallback razoável se não houver gastos suficientes: 0
    return periodSavings
  }, [filteredData, categories])

  // Calculation of Deterministic Financial Health Score (0-100)
  const healthScore = useMemo(() => {
    // Score baseado em:
    // 1. Proporção despesas / receitas (peso 40 pts)
    // 2. Ausência de déficits operacionais (peso 35 pts)
    // 3. Categorias dentro do orçamento (peso 25 pts)

    let totalPeriodExpenses = filteredData.txs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    let totalPeriodIncome = 0

    // Soma receitas pontuais
    filteredData.incs.forEach((inc) => {
      const valBrl = Number(inc.amount_brl) || (Number(inc.amount_eur) || 0) * 6.0
      totalPeriodIncome += valBrl
    })

    // Soma receitas recorrentes pelos meses do intervalo
    const activeRecurring = recurringIncomes.filter((r) => r.active)
    filteredData.intervalMonths.forEach(() => {
      activeRecurring.forEach((r) => {
        totalPeriodIncome += Number(r.amount_brl) || (Number(r.amount_eur) || 0) * 6.0
      })
    })

    // Se não há dados, retorna 72 como default de equilíbrio ou cálculo neutro
    if (totalPeriodExpenses === 0 && totalPeriodIncome === 0) {
      return 72
    }

    // Componente 1: Proporção Poupança / Cobertura (0-40)
    let part1 = 30
    if (totalPeriodIncome > 0) {
      const expenseRatio = totalPeriodExpenses / totalPeriodIncome
      if (expenseRatio <= 0.6) part1 = 40
      else if (expenseRatio <= 0.8) part1 = 35
      else if (expenseRatio <= 1.0) part1 = 28
      else if (expenseRatio <= 1.2) part1 = 15
      else part1 = 5
    }

    // Componente 2: Déficits no período (0-35)
    let part2 = 35
    if (periodDeficitMonths.length > 0) {
      // Perde pontos proporcionalmente aos meses com déficit
      const deficitRatio =
        periodDeficitMonths.length / Math.max(filteredData.intervalMonths.length, 1)
      part2 = Math.max(5, Math.round(35 * (1 - deficitRatio)))
    }

    // Componente 3: % Categorias dentro do orçamento (0-25)
    let part3 = 20
    const mainCats = categories.filter((c) => c.type === 'main' && Number(c.estimated) > 0)
    if (mainCats.length > 0) {
      // Quantas categorias estouraram nos insights
      const overflowInsightsCount = insights.filter((i) => i.badgeText === 'Atenção').length
      const withinRatio = Math.max(0, (mainCats.length - overflowInsightsCount) / mainCats.length)
      part3 = Math.round(25 * withinRatio)
    }

    const calculatedObjective = Math.min(100, Math.max(10, part1 + part2 + part3))

    // Se houver diagnóstico, combinar score objetivo (dados de transações) com score do diagnóstico (blend 50/50)
    if (latestDiagnostic && typeof latestDiagnostic.overall_score === 'number') {
      const blended = Math.round(0.5 * calculatedObjective + 0.5 * latestDiagnostic.overall_score)
      return Math.min(100, Math.max(10, blended))
    }

    return calculatedObjective
  }, [filteredData, recurringIncomes, periodDeficitMonths, categories, insights, latestDiagnostic])

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Alertas & Insights</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitoramento inteligente dos seus gastos com alertas automáticos e recomendações
            personalizadas.
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

      {/* Layout Principal: Conteúdo à Esquerda + Painel Lateral de Chat à Direita (350px em desktop) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Coluna de Conteúdo (Alertas, Métricas e Insights) */}
        <div className="flex-1 min-w-0 space-y-6 w-full">
          {/* 2. Três Cards no Topo da Página conforme imagem de referência */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: INSIGHTS */}
            <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow bg-white rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  INSIGHTS
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                  <Lightbulb className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-5 pt-0">
                <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
                  {insights.length}
                </div>
                <p className="text-xs text-slate-500 mt-1">Oportunidades identificadas</p>
              </CardContent>
            </Card>

            {/* Card 2: ECONOMIA */}
            <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow bg-white rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  ECONOMIA
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-5 pt-0">
                <div className="text-2xl font-bold text-emerald-600 tracking-tight tabular-nums">
                  {formatCurrency(totalPotentialSavings, currency)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Potencial de economia</p>
              </CardContent>
            </Card>

            {/* Card 3: SAÚDE FINANCEIRA */}
            <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow bg-white rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  SAÚDE FINANCEIRA
                </span>
                {latestDiagnostic && (
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full">
                    Bússola v{latestDiagnostic.version}
                  </span>
                )}
              </CardHeader>
              <CardContent className="px-6 pb-5 pt-0 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-blue-600 tracking-tight tabular-nums">
                      {healthScore}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">/100</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {latestDiagnostic
                      ? 'Score combinado (dados + Bússola)'
                      : 'Score baseado no período'}
                  </p>
                </div>

                {/* Donut / Anel de Progresso Azul */}
                <div className="relative h-14 w-14 shrink-0 flex items-center justify-center">
                  <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <path
                      className="text-slate-100"
                      strokeWidth="3.8"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Foreground progress circle */}
                    <path
                      className="text-blue-500 transition-all duration-1000 ease-out"
                      strokeDasharray={`${healthScore}, 100`}
                      strokeDashoffset="0"
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3. Card com a lista mantida e preservada de insights */}
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

        {/* Coluna Direita: Painel Lateral do Consultor Financeiro (Desktop fixo 350px / empilhado em telas menores) */}
        <div className="w-full lg:w-[350px] shrink-0">
          <div className="lg:sticky lg:top-20">
            <ConsultantSidebarPanel userName={user?.name || user?.email} />
          </div>
        </div>
      </div>
    </div>
  )
}
