import React from 'react'
import { DiagnosticRecord } from '@/types/finance'
import {
  calculateDiagnosticScores,
  getScoreClassification,
  DIAGNOSTIC_SECTIONS,
} from '@/lib/diagnosticEngine'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Compass,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  Target,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

interface DiagnosticResultViewProps {
  diagnostic: Partial<DiagnosticRecord>
  onContinueToDashboard?: () => void
  onRetake?: () => void
  isRetakeFlow?: boolean
}

export function DiagnosticResultView({
  diagnostic,
  onContinueToDashboard,
  onRetake,
  isRetakeFlow = false,
}: DiagnosticResultViewProps) {
  const scores = {
    score_controle: diagnostic.score_controle ?? 50,
    score_choques: diagnostic.score_choques ?? 50,
    score_metas: diagnostic.score_metas ?? 50,
    score_dividas: diagnostic.score_dividas ?? 50,
    score_clareza: diagnostic.score_clareza ?? 50,
    overall_score: diagnostic.overall_score ?? 50,
  }

  const classification = getScoreClassification(scores.overall_score)

  const dimensionCards = [
    {
      title: 'Controle do dia a dia',
      score: scores.score_controle,
      desc: 'Clareza de despesas passadas, previsibilidade e conforto com fixos.',
      color:
        scores.score_controle >= 70
          ? 'text-emerald-600'
          : scores.score_controle >= 45
            ? 'text-blue-600'
            : 'text-amber-600',
      barColor:
        scores.score_controle >= 70
          ? 'bg-emerald-500'
          : scores.score_controle >= 45
            ? 'bg-blue-500'
            : 'bg-amber-500',
    },
    {
      title: 'Capacidade de absorver choques',
      score: scores.score_choques,
      desc: 'Robustez da reserva de emergência e tranquilidade diante de imprevistos.',
      color:
        scores.score_choques >= 70
          ? 'text-emerald-600'
          : scores.score_choques >= 45
            ? 'text-blue-600'
            : 'text-amber-600',
      barColor:
        scores.score_choques >= 70
          ? 'bg-emerald-500'
          : scores.score_choques >= 45
            ? 'bg-blue-500'
            : 'bg-amber-500',
    },
    {
      title: 'Progresso em direção a metas',
      score: scores.score_metas,
      desc: 'Metas para 12 meses, avanços recentes e revisões periódicas.',
      color:
        scores.score_metas >= 70
          ? 'text-emerald-600'
          : scores.score_metas >= 45
            ? 'text-blue-600'
            : 'text-amber-600',
      barColor:
        scores.score_metas >= 70
          ? 'bg-emerald-500'
          : scores.score_metas >= 45
            ? 'bg-blue-500'
            : 'bg-amber-500',
    },
    {
      title: 'Liberdade e peso de dívidas',
      score: scores.score_dividas,
      desc: 'Comprometimento da renda com passados e liberdade de tomada de decisão.',
      color:
        scores.score_dividas >= 70
          ? 'text-emerald-600'
          : scores.score_dividas >= 45
            ? 'text-blue-600'
            : 'text-amber-600',
      barColor:
        scores.score_dividas >= 70
          ? 'bg-emerald-500'
          : scores.score_dividas >= 45
            ? 'bg-blue-500'
            : 'bg-amber-500',
    },
    {
      title: 'Clareza de direção',
      score: scores.score_clareza,
      desc: 'Visão de futuro em 5 anos e segurança ao fazer escolhas financeiras.',
      color:
        scores.score_clareza >= 70
          ? 'text-emerald-600'
          : scores.score_clareza >= 45
            ? 'text-blue-600'
            : 'text-amber-600',
      barColor:
        scores.score_clareza >= 70
          ? 'bg-emerald-500'
          : scores.score_clareza >= 45
            ? 'bg-blue-500'
            : 'bg-amber-500',
    },
  ]

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* Card Principal: Score Geral */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl">
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 sm:p-8 text-white relative">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-blue-100">
                <Compass className="h-3.5 w-3.5 text-blue-200" />
                <span>
                  Resultado Bússola Financeira{' '}
                  {diagnostic.version ? `· Versão ${diagnostic.version}` : ''}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Seu Diagnóstico Financeiro
              </h2>
              <p className="text-sm text-blue-100 max-w-xl">{classification.description}</p>
            </div>

            {/* Círculo do Score Geral */}
            <div className="flex flex-col items-center justify-center self-center sm:self-auto shrink-0 bg-white/10 rounded-2xl p-5 border border-white/20 backdrop-blur-sm min-w-[150px]">
              <span className="text-xs uppercase tracking-wider font-semibold text-blue-200">
                Score Geral
              </span>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-white tabular-nums">
                  {scores.overall_score}
                </span>
                <span className="text-sm font-semibold text-blue-200">/100</span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white mt-1">
                {classification.label}
              </span>
            </div>
          </div>
        </div>

        {/* Resumo do consultor inteligente */}
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>Resumo Estruturado para o Consultor Financeiro</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line font-sans">
              {diagnostic.summary ||
                'Diagnóstico calculado com base nas suas 16 respostas nas 5 dimensões.'}
            </p>
          </div>

          {/* As 5 Dimensões */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Desempenho por Dimensão (0 a 100)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dimensionCards.map((dim, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{dim.title}</span>
                    <span className={`text-base font-extrabold tabular-nums ${dim.color}`}>
                      {dim.score}
                      <span className="text-xs font-medium text-slate-400">/100</span>
                    </span>
                  </div>
                  {/* Barra de Progresso */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${dim.barColor}`}
                      style={{ width: `${Math.min(100, Math.max(0, dim.score))}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{dim.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            {onRetake ? (
              <Button
                variant="outline"
                onClick={onRetake}
                className="w-full sm:w-auto text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Refazer Diagnóstico
              </Button>
            ) : (
              <div />
            )}

            {onContinueToDashboard && (
              <Button
                onClick={onContinueToDashboard}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-6 h-10 shadow-sm"
              >
                <span>{isRetakeFlow ? 'Voltar ao Dashboard' : 'Entrar no Dashboard'}</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
