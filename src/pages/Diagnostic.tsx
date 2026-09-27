import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  getLatestDiagnostic,
  getDiagnosticHistory,
  saveDiagnostic,
} from '@/services/diagnosticService'
import { DiagnosticRecord } from '@/types/finance'
import { DiagnosticFormWizard } from '@/components/DiagnosticFormWizard'
import { DiagnosticResultView } from '@/components/DiagnosticResultView'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Compass,
  RotateCcw,
  History,
  ArrowLeft,
  Calendar,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

export default function DiagnosticPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [latestDiagnostic, setLatestDiagnostic] = useState<DiagnosticRecord | null>(null)
  const [history, setHistory] = useState<DiagnosticRecord[]>([])

  // Modo de exibição: 'view' (ver mais recente) | 'form' (preencher/refazer) | 'history' (histórico)
  const [mode, setMode] = useState<'view' | 'form' | 'history'>('view')

  // Respostas do formulário
  const [answers, setAnswers] = useState<Record<number, number>>({})

  const loadDiagnostics = async () => {
    try {
      setLoading(true)
      const [latest, list] = await Promise.all([
        getLatestDiagnostic(user?.id),
        getDiagnosticHistory(user?.id),
      ])
      setLatestDiagnostic(latest)
      setHistory(list)

      // Se nunca preencheu, abrir direto no formulário
      if (!latest) {
        setMode('form')
      } else {
        setMode('view')
      }
    } catch (err) {
      console.error('Erro ao carregar diagnósticos:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar suas avaliações da Bússola Financeira.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDiagnostics()
  }, [user?.id])

  const handleAnswerChange = (qId: number, val: number) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }))
  }

  const handleStartRetake = () => {
    // Pré-preencher com as respostas anteriores caso existam para conveniência
    if (latestDiagnostic?.answers) {
      const parsed: Record<number, number> = {}
      for (const [k, v] of Object.entries(latestDiagnostic.answers)) {
        parsed[Number(k)] = Number(v)
      }
      setAnswers(parsed)
    } else {
      setAnswers({})
    }
    setMode('form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaveAnswers = async () => {
    try {
      setSubmitting(true)
      const saved = await saveDiagnostic({
        answers,
      })
      toast({
        title: 'Bússola Financeira atualizada!',
        description: `Novo diagnóstico registrado como versão ${saved.version}.`,
      })
      setLatestDiagnostic(saved)
      setHistory((prev) => [saved, ...prev])
      setMode('view')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error('Erro ao salvar diagnóstico:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Não foi possível registrar seu diagnóstico.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Carregando Bússola Financeira...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
              <Compass className="h-3.5 w-3.5" />
              Diagnóstico de Saúde Financeira
            </span>
            {latestDiagnostic && (
              <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600">
                Versão {latestDiagnostic.version}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bússola Financeira</h1>
          <p className="text-sm text-slate-500">
            Avalie sua clareza, absorção de choques, metas, peso de dívidas e controle do dia a dia.
          </p>
        </div>

        {/* Botões de Ação Topo */}
        <div className="flex items-center gap-2">
          {mode === 'view' && (
            <>
              {history.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMode('history')}
                  className="text-xs border-slate-300"
                >
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  Histórico ({history.length})
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleStartRetake}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 shadow-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Refazer Diagnóstico
              </Button>
            </>
          )}

          {mode !== 'view' && latestDiagnostic && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode('view')}
              className="text-xs border-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Ver Atual
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo de acordo com o modo */}
      {mode === 'view' && latestDiagnostic && (
        <DiagnosticResultView
          diagnostic={latestDiagnostic}
          onRetake={handleStartRetake}
          onContinueToDashboard={() => navigate('/')}
          isRetakeFlow={true}
        />
      )}

      {mode === 'form' && (
        <DiagnosticFormWizard
          answers={answers}
          onAnswerChange={handleAnswerChange}
          onComplete={handleSaveAnswers}
          isSubmitting={submitting}
          submitButtonText={submitting ? 'Gravando...' : 'Gravar Diagnóstico'}
          extraTopContent={
            <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">
                  {latestDiagnostic
                    ? `Você está criando a Versão ${(latestDiagnostic.version || 1) + 1} da sua Bússola Financeira.`
                    : 'Preencha as 16 perguntas objetivas para mapear sua saúde financeira.'}
                </p>
                <p className="text-blue-700">
                  Suas respostas anteriores ficam preservadas no histórico para acompanhar sua
                  evolução.
                </p>
              </div>
            </div>
          }
        />
      )}

      {mode === 'history' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">
              Evolução e Histórico de Preenchimentos
            </h2>
            <Button variant="outline" size="sm" onClick={() => setMode('view')} className="text-xs">
              Voltar ao Diagnóstico Atual
            </Button>
          </div>

          <div className="space-y-3">
            {history.map((item) => (
              <Card
                key={item.id}
                className="border-slate-200 bg-white hover:border-slate-300 transition-all rounded-xl"
              >
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 font-bold text-xs">Versão {item.version}</Badge>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {item.created
                          ? new Date(item.created).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Data não registrada'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 max-w-xl line-clamp-2 mt-1">
                      {item.summary?.slice(0, 160) || 'Sem resumo'}...
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-2xl font-black text-slate-900 tabular-nums">
                        {item.overall_score}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">/100</span>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Score Geral
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLatestDiagnostic(item)
                        setMode('view')
                      }}
                      className="text-xs"
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
