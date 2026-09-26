import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getAllTransactions, getCategories, getUserSettings } from '@/services/financeService'
import { Category, Transaction, UserSettings } from '@/types/finance'
import { formatMonthShort, MONTH_NAMES_SHORT } from '@/lib/formatters'
import { Calendar as CalendarIcon, RefreshCw, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { InsightsList } from '@/components/InsightsList'
import { generateFinancialInsights } from '@/lib/insightsEngine'

export default function AlertsView() {
  const { user, currency } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)

  // Filter state: 'all' for all months consolidated, or specific month string 'YYYY-MM'
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const loadData = async () => {
    try {
      setRefreshing(true)
      const [txs, cats, settings] = await Promise.all([
        getAllTransactions(),
        getCategories(),
        getUserSettings(),
      ])

      setTransactions(txs)
      setCategories(cats)
      setUserSettings(settings)
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

  // Available months options (derived from transactions or 2026 default, same as Dashboard)
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    // Include 2026 months by default
    for (let i = 1; i <= 12; i++) {
      set.add(`2026-${String(i).padStart(2, '0')}`)
    }
    transactions.forEach((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
      if (m && m.length === 7) set.add(m)
    })
    return Array.from(set).sort()
  }, [transactions])

  // Helper format for month dropdown label (e.g. "Jan 2026")
  const formatMonthLabel = (mStr: string) => {
    if (!mStr || !mStr.includes('-')) return mStr
    const [year, month] = mStr.split('-')
    const idx = parseInt(month, 10) - 1
    if (idx >= 0 && idx < 12) {
      return `${MONTH_NAMES_SHORT[idx]} ${year}`
    }
    return mStr
  }

  // Label for trigger button
  const filterTriggerLabel = useMemo(() => {
    if (selectedMonth === 'all') {
      return 'Todos os meses'
    }
    return formatMonthLabel(selectedMonth)
  }, [selectedMonth])

  // Compute filtered transactions and intervalMonths
  const filteredData = useMemo(() => {
    if (selectedMonth === 'all') {
      // Find all distinct months with data, or fallback to full 2026
      const set = new Set<string>()
      transactions.forEach((tx) => {
        const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
        if (m && m.length === 7) set.add(m)
      })
      const distinct = Array.from(set).sort()
      const interval = distinct.length > 0 ? distinct : availableMonths
      return {
        txs: transactions,
        intervalMonths: interval,
      }
    }

    const txs = transactions.filter((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
      return m === selectedMonth
    })

    return {
      txs,
      intervalMonths: [selectedMonth],
    }
  }, [selectedMonth, transactions, availableMonths])

  // Generate insights using shared engine
  const insights = useMemo(() => {
    return generateFinancialInsights({
      transactions: filteredData.txs,
      categories,
      currency,
      intervalMonths: filteredData.intervalMonths,
      userSettings,
    })
  }, [filteredData, categories, currency, userSettings])

  // Quick stats from generated insights
  const stats = useMemo(() => {
    return {
      critical: insights.filter((i) => i.badgeText === 'Atenção').length,
      economy: insights.filter((i) => i.badgeText === 'Economia').length,
      success: insights.filter((i) => i.badgeText === 'No caminho').length,
      priority: insights.filter((i) => i.badgeText === 'Alta prioridade').length,
      total: insights.length,
    }
  }, [insights])

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
          {/* Dropdown de filtro por mês com ícone de calendário */}
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-medium shadow-xs h-10 px-3.5 gap-2"
              >
                <CalendarIcon className="h-4 w-4 text-slate-500" />
                <span className="text-xs sm:text-sm">{filterTriggerLabel}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4 bg-white border-slate-200 shadow-lg">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-slate-900">Filtrar por Mês</h4>
                  <p className="text-xs text-slate-500">
                    Selecione um mês específico ou veja o consolidado de todos os meses.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Período</label>
                  <Select
                    value={selectedMonth}
                    onValueChange={(val) => {
                      setSelectedMonth(val)
                      setIsFilterOpen(false)
                    }}
                  >
                    <SelectTrigger className="w-full text-xs h-9 bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="all" className="text-xs font-medium">
                        Todos os meses (Período completo)
                      </SelectItem>
                      {availableMonths.map((m) => (
                        <SelectItem key={`filter-${m}`} value={m} className="text-xs">
                          {formatMonthLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Predefinições Rápidas */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 px-2 text-slate-600"
                    onClick={() => {
                      setSelectedMonth('all')
                      setIsFilterOpen(false)
                    }}
                  >
                    Todos os meses
                  </Button>
                  {availableMonths.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2 text-slate-600"
                      onClick={() => {
                        // Select current/latest month
                        const current = new Date().toISOString().slice(0, 7)
                        const target = availableMonths.includes(current)
                          ? current
                          : availableMonths[availableMonths.length - 1]
                        setSelectedMonth(target)
                        setIsFilterOpen(false)
                      }}
                    >
                      Mês atual
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

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

      {/* 3. Card com a lista compartilhada de insights */}
      <Card className="border-slate-200/80 shadow-xs bg-white rounded-xl">
        <CardHeader className="pb-3 pt-5 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Insights & Recomendações
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              {selectedMonth === 'all'
                ? 'Sugestões consolidadas calculadas sobre todo o período disponível.'
                : `Sugestões calculadas exclusivamente para ${formatMonthLabel(selectedMonth)}.`}
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
              selectedMonth === 'all'
                ? 'Nenhum insight identificado para o período completo.'
                : `Nenhum desvio ou insight identificado para ${formatMonthLabel(selectedMonth)}.`
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
