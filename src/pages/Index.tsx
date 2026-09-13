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
} from '@/services/financeService'
import { computeAndSyncAlerts } from '@/lib/alertsEngine'
import {
  Transaction,
  Category,
  Income,
  RecurringIncome,
  MonthlyTotal,
  Alert,
} from '@/types/finance'
import { formatCurrency, formatPercent, formatMonthShort } from '@/lib/formatters'
import { CountUp } from '@/components/CountUp'
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  UploadCloud,
  ArrowRight,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  PieChart,
  Pie,
  Cell,
} from 'recharts'

export default function Index() {
  const { user, currency } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])

  // Load initial data
  const loadData = async () => {
    try {
      const [txs, cats, incs, recIncs, mTotals] = await Promise.all([
        getAllTransactions(),
        getCategories(),
        getIncomes(),
        getRecurringIncomes(),
        getMonthlyTotals(),
      ])

      setTransactions(txs)
      setCategories(cats)
      setIncomes(incs)
      setRecurringIncomes(recIncs)
      setMonthlyTotals(mTotals)

      // Compute and sync dynamic alerts (considering active recurring incomes)
      const computed = await computeAndSyncAlerts(txs, incs, cats, mTotals, recIncs)
      setAlerts(
        computed.map((c, i) => ({
          id: `comp-${i}`,
          user: user?.id || '',
          severity: c.severity,
          title: c.title,
          description: c.description,
          suggestion: c.suggestion,
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

  // Calculations for Metrics
  const metrics = useMemo(() => {
    const totalSpending = transactions.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0)

    // Get unique months with transactions
    const monthsSet = new Set<string>()
    transactions.forEach((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
      if (m) monthsSet.add(m)
    })

    const hasTransactions = transactions.length > 0
    const monthsCount = hasTransactions ? Math.max(monthsSet.size, 1) : 0
    const monthlyAverage = monthsCount > 0 ? totalSpending / monthsCount : 0

    // Sum monthly budget for all main categories
    const monthlyBudget = categories
      .filter((c) => c.type === 'main')
      .reduce((acc, c) => acc + (Number(c.estimated) || 0), 0)

    // If transactions exist, multiply by months count, otherwise by 1 month reference
    const totalBudget = hasTransactions ? monthlyBudget * monthsCount : monthlyBudget
    const overBudget = totalSpending - totalBudget
    const overBudgetPct = totalBudget > 0 ? overBudget / totalBudget : 0
    const isZeroState = totalSpending === 0 && totalBudget === 0

    // Find highest spending month
    const spendingByMonth: Record<string, number> = {}
    transactions.forEach((tx) => {
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
      monthlyAverage,
      totalBudget,
      overBudget,
      overBudgetPct,
      isZeroState,
      hasTransactions,
      highestMonth,
      highestAmount,
      monthsCount,
    }
  }, [transactions, categories])

  // Data for Monthly Bar Chart (Real vs Orcado)
  const barChartData = useMemo(() => {
    const monthlyBudget = categories
      .filter((c) => c.type === 'main')
      .reduce((acc, c) => acc + (Number(c.estimated) || 0), 0)

    const monthMap: Record<string, number> = {}
    transactions.forEach((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : 'Sem data')
      monthMap[m] = (monthMap[m] || 0) + (Number(tx.amount) || 0)
    })

    const sortedMonths = Object.keys(monthMap).sort()
    return sortedMonths.map((m) => {
      const realAmount = monthMap[m]
      return {
        month: formatMonthShort(m),
        real: currency === 'EUR' ? realAmount / 6.0 : realAmount,
        orcado: currency === 'EUR' ? monthlyBudget / 6.0 : monthlyBudget,
      }
    })
  }, [transactions, categories, currency])

  // Data for Category Donut Chart
  const donutChartData = useMemo(() => {
    const mainCategories = categories.filter((c) => c.type === 'main')
    const catMap = new Map<string, { name: string; color: string; total: number }>()

    mainCategories.forEach((c) => {
      catMap.set(c.id, {
        name: c.name,
        color: c.color || '#2563EB',
        total: 0,
      })
    })

    // Subcategory to parent category map
    const subToParent = new Map<string, string>()
    categories
      .filter((c) => c.type === 'sub' && c.parent)
      .forEach((c) => {
        subToParent.set(c.id, c.parent!)
      })

    let totalAll = 0
    transactions.forEach((tx) => {
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

    const result = Array.from(catMap.values())
      .filter((item) => item.total > 0)
      .map((item) => ({
        name: item.name,
        value:
          currency === 'EUR'
            ? Number((item.total / 6.0).toFixed(2))
            : Number(item.total.toFixed(2)),
        rawTotal: item.total,
        percentage: totalAll > 0 ? (item.total / totalAll) * 100 : 0,
        color: item.color,
      }))
      .sort((a, b) => b.value - a.value)

    return result
  }, [transactions, categories, currency])

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Executive Summary Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Resumo Executivo</h1>
            <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 text-xs">
              Planejamento 2026
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Consolidado analítico a partir de suas faturas de cartão de crédito e extratos
            bancários.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/extratos')}
            className="bg-blue-600 hover:bg-blue-700 font-semibold shadow-sm"
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Importar Extratos
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/orcado-vs-realizado')}
            className="border-slate-300 hover:bg-slate-100"
          >
            Matriz Orçado vs Real
          </Button>
        </div>
      </div>

      {/* Empty State when no transactions yet */}
      {transactions.length === 0 && !loading && (
        <Card className="border-dashed border-2 border-slate-300 bg-white/80 p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-4">
            <UploadCloud className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Nenhum lançamento financeiro registrado
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            A base de dados inicia limpa para manter sua privacidade. Faça o upload das suas faturas
            em CSV ou XLSX na tela de importação para alimentar seus gráficos e gerar diagnósticos.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => navigate('/extratos')} className="bg-blue-600 hover:bg-blue-700">
              <UploadCloud className="mr-2 h-4 w-4" />
              Importar Extratos Agora
            </Button>
          </div>
        </Card>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Gasto */}
        <Card className="border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Gasto
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              <CountUp value={metrics.totalSpending} currency={currency} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.hasTransactions
                ? `${metrics.monthsCount} ${metrics.monthsCount === 1 ? 'mês analisado' : 'meses analisados'}`
                : 'Nenhum mês analisado'}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Média Mensal */}
        <Card className="border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Média Mensal
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              <CountUp value={metrics.monthlyAverage} currency={currency} />
            </div>
            <p className="text-xs text-slate-500 mt-1">Run-rate de gastos mensais</p>
          </CardContent>
        </Card>

        {/* Card 3: Total Orçado */}
        <Card className="border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Orçado
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              <CountUp value={metrics.totalBudget} currency={currency} />
            </div>
            <p className="text-xs text-slate-500 mt-1">Soma das metas por categoria</p>
          </CardContent>
        </Card>

        {/* Card 4: Estourado vs Orçado */}
        <Card className="border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estourado vs Orçado
            </CardTitle>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                metrics.isZeroState
                  ? 'bg-slate-100 text-slate-400'
                  : metrics.overBudget > 0
                    ? 'bg-red-50 text-red-600'
                    : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {metrics.isZeroState ? (
                <Layers className="h-4 w-4" />
              ) : metrics.overBudget > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {metrics.isZeroState ? (
              <>
                <div className="text-2xl font-bold tracking-tight text-slate-400">—</div>
                <p className="text-xs text-slate-500 mt-1">Sem dados ainda</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className={`text-2xl font-bold tracking-tight ${
                      metrics.overBudget > 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    <CountUp value={Math.abs(metrics.overBudget)} currency={currency} />
                  </div>
                  {metrics.overBudget > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                      +{formatPercent(metrics.overBudgetPct)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {metrics.overBudget > 0 ? 'Acima do planejado' : 'Dentro do orçamento'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bar Chart: Gasto Real vs Orçado */}
        <Card className="lg:col-span-7 border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Gasto Real vs. Orçado
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparação mensal da execução orçamentária ({currency})
                </CardDescription>
              </div>
              {metrics.highestMonth && (
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Pico de Gasto</span>
                  <span className="text-xs font-bold text-red-600">
                    {formatMonthShort(metrics.highestMonth)} (
                    {formatCurrency(metrics.highestAmount, currency)})
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {barChartData.length > 0 ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      stroke="#CBD5E1"
                    />
                    <YAxis tick={{ fill: '#64748B', fontSize: 12 }} stroke="#CBD5E1" />
                    <Tooltip
                      formatter={(val: any) => [
                        formatCurrency(Number(val) * (currency === 'EUR' ? 6 : 1), currency),
                      ]}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey="real" name="Gasto Real" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="orcado" name="Orçado" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col h-[280px] items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Sem dados mensais para exibir
                </p>
                <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
                  Importe seus extratos para visualizar o comparativo mensal de Real vs. Orçado.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/extratos')}
                  className="text-xs border-slate-300"
                >
                  <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                  Importar Extratos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut Chart: Gastos por Categoria */}
        <Card className="lg:col-span-5 border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900">
              Gastos por Categoria
            </CardTitle>
            <CardDescription className="text-xs">
              Distribuição percentual das despesas no período
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {donutChartData.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {donutChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [
                          formatCurrency(Number(val) * (currency === 'EUR' ? 6 : 1), currency),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Custom Compact Legend */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full mt-2 max-h-[120px] overflow-y-auto text-xs">
                  {donutChartData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-slate-700"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate max-w-[100px]">{item.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-[280px] items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-2.5">
                  <Layers className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Sem transações categorizadas</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
                  A rosca de categorias será preenchida conforme suas despesas forem importadas e
                  classificadas.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/categorias')}
                  className="text-xs border-slate-300"
                >
                  Ver Categorias
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts Panel */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Alertas e Estratégias Recentes
            </CardTitle>
            <CardDescription className="text-xs">
              Diagnósticos gerados automaticamente a partir dos dados do seu banco
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/alertas')}
            className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
          >
            Ver todos ({alerts.length})
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.slice(0, 3).map((alert, idx) => (
                <div
                  key={alert.id || idx}
                  className={`flex items-start gap-3 rounded-lg p-3.5 border text-sm transition-all ${
                    alert.severity === 'critical'
                      ? 'bg-red-50/70 border-red-200 text-red-950'
                      : alert.severity === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-blue-50/70 border-blue-200 text-blue-950'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {alert.severity === 'critical' && (
                      <ShieldAlert className="h-5 w-5 text-red-600" />
                    )}
                    {alert.severity === 'warning' && (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    )}
                    {alert.severity === 'info' && <Info className="h-5 w-5 text-blue-600" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wide">
                        {alert.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] uppercase font-bold px-1.5 py-0 ${
                          alert.severity === 'critical'
                            ? 'bg-red-200 text-red-800'
                            : alert.severity === 'warning'
                              ? 'bg-amber-200 text-amber-800'
                              : 'bg-blue-200 text-blue-800'
                        }`}
                      >
                        {alert.severity === 'critical'
                          ? 'Crítico'
                          : alert.severity === 'warning'
                            ? 'Atenção'
                            : 'Insight'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{alert.description}</p>
                    <div className="mt-1 pt-1 border-t border-black/5 text-xs font-medium text-slate-800">
                      💡 <strong>Ação proposta:</strong> {alert.suggestion}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-500">
              Nenhum alerta ativo. Seus gastos estão em conformidade ou aguardando importação de
              dados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
