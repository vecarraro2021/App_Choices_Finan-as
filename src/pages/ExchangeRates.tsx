import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getExchangeRates,
  upsertExchangeRate,
  bulkUpsertExchangeRates,
  getRateForMonth,
} from '@/services/financeService'
import { ExchangeRate, EUR_EXCHANGE_RATE } from '@/types/finance'
import { MONTH_NAMES_LONG, MONTH_NAMES_SHORT } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeftRight,
  Save,
  CheckCircle2,
  Sparkles,
  Info,
  Calendar,
  Layers,
  TrendingUp,
  Percent,
  RefreshCw,
  Sliders,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function ExchangeRatesView() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [editedRates, setEditedRates] = useState<Record<string, string>>({})
  const [savingMonth, setSavingMonth] = useState<string | null>(null)
  const [globalRateInput, setGlobalRateInput] = useState<string>('6.00')
  const [applyingGlobal, setApplyingGlobal] = useState(false)

  // 12 months array for selected year: '2026-01' -> '2026-12'
  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, '0')
      return `${selectedYear}-${mm}`
    })
  }, [selectedYear])

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await getExchangeRates()
      setRates(list)

      // Initialize inputs from loaded rates or fallback
      const initialMap: Record<string, string> = {}
      yearMonths.forEach((m) => {
        const r = list.find((item) => item.month === m)
        initialMap[m] = r?.rate ? String(r.rate) : String(EUR_EXCHANGE_RATE)
      })
      setEditedRates(initialMap)
    } catch (e) {
      console.error(e)
      toast({
        title: 'Erro ao carregar taxas de câmbio',
        description: 'Não foi possível buscar as cotações mensais.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id, selectedYear])

  useRealtime('exchange_rates', () => loadData())

  const handleRateChange = (m: string, value: string) => {
    setEditedRates((prev) => ({
      ...prev,
      [m]: value,
    }))
  }

  // Save single month rate inline
  const handleSaveMonth = async (m: string) => {
    const rawVal = editedRates[m] || '6.0'
    const num = parseFloat(rawVal.replace(',', '.'))
    if (isNaN(num) || num <= 0) {
      toast({
        title: 'Valor de taxa inválido',
        description: 'Informe um número maior que zero (ex: 6.12)',
        variant: 'destructive',
      })
      return
    }

    try {
      setSavingMonth(m)
      await upsertExchangeRate(m, Number(num.toFixed(4)))
      toast({
        title: 'Taxa atualizada!',
        description: `Câmbio para ${m} definido como R$ ${num.toFixed(2)} / € 1.`,
      })
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar taxa',
        description: err.message || 'Falha ao gravar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setSavingMonth(null)
    }
  }

  // Apply single rate to all 12 months
  const handleApplyToAllMonths = async () => {
    const num = parseFloat(globalRateInput.replace(',', '.'))
    if (isNaN(num) || num <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe uma taxa válida para replicar em todos os meses.',
        variant: 'destructive',
      })
      return
    }

    try {
      setApplyingGlobal(true)
      const toUpdate = yearMonths.map((m) => ({
        month: m,
        rate: Number(num.toFixed(4)),
      }))

      await bulkUpsertExchangeRates(toUpdate)

      toast({
        title: 'Taxa aplicada com sucesso!',
        description: `Todos os 12 meses de ${selectedYear} agora usam a taxa R$ ${num.toFixed(2)}.`,
      })
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao aplicar taxa global',
        description: err.message || 'Falha ao atualizar registros.',
        variant: 'destructive',
      })
    } finally {
      setApplyingGlobal(false)
    }
  }

  // Calculate stats
  const stats = useMemo(() => {
    const yearValues = yearMonths.map((m) => {
      const found = rates.find((r) => r.month === m)
      return found?.rate ? Number(found.rate) : EUR_EXCHANGE_RATE
    })

    const avg = yearValues.reduce((a, b) => a + b, 0) / yearValues.length
    const min = Math.min(...yearValues)
    const max = Math.max(...yearValues)
    return { avg, min, max }
  }, [rates, yearMonths])

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Taxas de Câmbio Mensais (EUR → BRL)
            </h1>
            <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold text-xs">
              Moeda Oficial: R$ (BRL)
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Cada lançamento e orçamento é convertido para Real (R$) utilizando a taxa média do mês
            correspondente da despesa/receita.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            {[2025, 2026, 2027].map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1 rounded-md transition-all ${
                  selectedYear === yr
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="border-slate-300 hover:bg-slate-100 h-9"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Info Card Explaining Monthly Conversion */}
      <Card className="border-blue-200 bg-blue-50/50 shadow-xs">
        <CardContent className="p-4 flex items-start gap-3 text-xs text-blue-900">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-blue-950">
              Como funciona o câmbio por mês de lançamento:
            </p>
            <p className="leading-relaxed text-blue-900/90">
              Ao cadastrar uma transação em <strong>Março/2026</strong>, o sistema aplicará a taxa
              específica de Março (ex: <strong>R$ {editedRates['2026-03'] || '6,15'}</strong>). Se
              nenhuma taxa for configurada para determinado mês, o sistema utiliza o fallback seguro
              de <strong>6,00</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats & Bulk Update Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Bulk Tool */}
        <Card className="lg:col-span-7 border-slate-200 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-600" />
              Aplicar Taxa Unificada para Todo o Ano de {selectedYear}
            </CardTitle>
            <CardDescription className="text-xs">
              Preencha um valor padrão e replique para todos os 12 meses de {selectedYear} de uma só
              vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full flex items-center gap-2">
                <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
                  € 1,00 = R$
                </span>
                <Input
                  type="text"
                  placeholder="Ex: 6.10"
                  value={globalRateInput}
                  onChange={(e) => setGlobalRateInput(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <Button
                onClick={handleApplyToAllMonths}
                disabled={applyingGlobal}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-semibold h-9 text-xs shadow-xs"
              >
                {applyingGlobal ? 'Aplicando...' : `Aplicar a Jan–Dez ${selectedYear}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="lg:col-span-5 border-slate-200 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Resumo Estatístico ({selectedYear})
            </CardTitle>
            <CardDescription className="text-xs">
              Média e extremos das cotações cadastradas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Média Anual
                </span>
                <span className="text-sm font-bold text-blue-700 tabular-nums">
                  R$ {stats.avg.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Mínima
                </span>
                <span className="text-sm font-bold text-emerald-700 tabular-nums">
                  R$ {stats.min.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Máxima
                </span>
                <span className="text-sm font-bold text-amber-700 tabular-nums">
                  R$ {stats.max.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid of 12 Months */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Grade de Cotação Mensal ({selectedYear})
            </CardTitle>
            <CardDescription className="text-xs">
              Edite a taxa inline e clique em Salvar para atualizar individualmente
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {yearMonths.map((m, idx) => {
              const monthName = MONTH_NAMES_LONG[idx]
              const currentInput = editedRates[m] ?? String(EUR_EXCHANGE_RATE)
              const savedRec = rates.find((r) => r.month === m)
              const savedRate = savedRec?.rate ? Number(savedRec.rate) : EUR_EXCHANGE_RATE
              const hasDiff = parseFloat(currentInput.replace(',', '.')) !== savedRate
              const isSaving = savingMonth === m

              return (
                <div
                  key={m}
                  className={`p-3.5 rounded-xl border transition-all ${
                    hasDiff
                      ? 'border-amber-300 bg-amber-50/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-xs font-bold text-slate-900">{monthName}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0"
                    >
                      {m}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-semibold">€ 1 =</span>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-2 text-xs text-slate-400">R$</span>
                        <Input
                          type="text"
                          value={currentInput}
                          onChange={(e) => handleRateChange(m, e.target.value)}
                          className="h-8 pl-7 text-xs font-bold tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help text-slate-500 hover:text-slate-800">
                              Exemplo: € 1.000 ={' '}
                              <strong className="text-slate-700">
                                R${' '}
                                {(
                                  1000 * (parseFloat(currentInput.replace(',', '.')) || 6)
                                ).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                              </strong>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            Cada lançamento deste mês será convertido por este multiplicador.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <Button
                        size="sm"
                        onClick={() => handleSaveMonth(m)}
                        disabled={isSaving}
                        className={`h-7 px-2.5 text-xs font-semibold ${
                          hasDiff
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {isSaving ? 'Salvando...' : hasDiff ? 'Salvar' : 'Salvo'}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
