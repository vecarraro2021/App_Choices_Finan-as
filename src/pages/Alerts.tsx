import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getAllTransactions,
  getCategories,
  getIncomes,
  getMonthlyTotals,
} from '@/services/financeService'
import { computeAndSyncAlerts } from '@/lib/alertsEngine'
import { Alert, Category, Income, MonthlyTotal, Transaction } from '@/types/finance'
import { ShieldAlert, AlertTriangle, Info, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

export default function AlertsView() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState({ critical: 0, warning: 0, info: 0 })

  const runEngine = async () => {
    try {
      setRefreshing(true)
      const [txs, cats, incs, mTotals] = await Promise.all([
        getAllTransactions(),
        getCategories(),
        getIncomes(),
        getMonthlyTotals(),
      ])

      const computed = await computeAndSyncAlerts(txs, incs, cats, mTotals)

      const mapped: Alert[] = computed.map((c, i) => ({
        id: `alert-${i}`,
        user: user?.id || '',
        severity: c.severity,
        title: c.title,
        description: c.description,
        suggestion: c.suggestion,
      }))

      setAlerts(mapped)
      setStats({
        critical: mapped.filter((a) => a.severity === 'critical').length,
        warning: mapped.filter((a) => a.severity === 'warning').length,
        info: mapped.filter((a) => a.severity === 'info').length,
      })

      toast({
        title: 'Diagnósticos recalculados',
        description: `${mapped.length} alertas e recomendações atualizados.`,
      })
    } catch (err) {
      console.error('Erro ao reprocessar alertas:', err)
      toast({
        title: 'Erro ao recalcular',
        description: 'Não foi possível reavaliar os alertas.',
        variant: 'destructive',
      })
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    runEngine()
  }, [user?.id])

  useRealtime('transactions', () => runEngine())
  useRealtime('income', () => runEngine())
  useRealtime('categories', () => runEngine())

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Alertas, Inconsistências & Insights
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Motor analítico de regras financeiras baseado nos seus lançamentos, receitas e
            orçamentos.
          </p>
        </div>

        <Button
          onClick={runEngine}
          disabled={refreshing}
          variant="outline"
          className="border-slate-300 hover:bg-slate-100 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          {refreshing ? 'Recalculando regras...' : 'Recalcular Alertas'}
        </Button>
      </div>

      {/* Summary severity cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-700">
              Pontos Críticos
            </CardTitle>
            <ShieldAlert className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 tabular-nums">{stats.critical}</div>
            <p className="text-xs text-red-600/80 mt-1">Ausência de receita ou déficit severo</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Avisos e Desvios
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 tabular-nums">{stats.warning}</div>
            <p className="text-xs text-amber-600/80 mt-1">Orçamento superado ou picos pontuais</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Insights Estratégicos
            </CardTitle>
            <Info className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 tabular-nums">{stats.info}</div>
            <p className="text-xs text-blue-600/80 mt-1">Concentração e oportunidades de corte</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts list */}
      {alerts.length > 0 ? (
        <div className="space-y-4">
          {alerts.map((item, index) => (
            <Card
              key={item.id || index}
              className={`border transition-all shadow-xs ${
                item.severity === 'critical'
                  ? 'border-red-300 bg-white hover:border-red-400'
                  : item.severity === 'warning'
                    ? 'border-amber-300 bg-white hover:border-amber-400'
                    : 'border-blue-300 bg-white hover:border-blue-400'
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      item.severity === 'critical'
                        ? 'bg-red-100 text-red-600'
                        : item.severity === 'warning'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {item.severity === 'critical' && <ShieldAlert className="h-5 w-5" />}
                    {item.severity === 'warning' && <AlertTriangle className="h-5 w-5" />}
                    {item.severity === 'info' && <Info className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <h3 className="font-bold text-base text-slate-900">{item.title}</h3>
                      <Badge
                        className={`w-fit text-[11px] font-bold uppercase px-2 py-0.5 ${
                          item.severity === 'critical'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : item.severity === 'warning'
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {item.severity === 'critical'
                          ? 'Crítico'
                          : item.severity === 'warning'
                            ? 'Atenção'
                            : 'Insight'}
                      </Badge>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>

                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/80 text-xs text-slate-800">
                      <span className="font-bold text-slate-900 block mb-0.5">
                        💡 Ação / Recomendação Estratégica:
                      </span>
                      {item.suggestion}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Nenhum desvio ou ponto de atenção detectado
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Seus lançamentos estão equilibrados ou sua base ainda aguarda importação de lançamentos
            e receitas.
          </p>
        </Card>
      )}
    </div>
  )
}
