import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Compass,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  User,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { DiagnosticFormWizard } from '@/components/DiagnosticFormWizard'
import { DiagnosticResultView } from '@/components/DiagnosticResultView'
import {
  calculateDiagnosticScores,
  generateDiagnosticSummary,
  DIAGNOSTIC_QUESTIONS,
} from '@/lib/diagnosticEngine'
import { DiagnosticRecord } from '@/types/finance'

export default function OnboardingView() {
  const navigate = useNavigate()
  const { register } = useAuth()

  // Etapas do fluxo de Onboarding para não autenticados:
  // 1: Apresentação inicial (Hero + logo + tagline)
  // 2: Questionário Bússola Financeira (5 seções)
  // 3: Criação de conta (grava usuário + diagnóstico)
  // 4: Exibição do resultado do diagnóstico antes de seguir ao dashboard
  const [step, setStep] = useState<'welcome' | 'quiz' | 'account' | 'result'>('welcome')

  // Respostas (questionId -> 1..5)
  const [answers, setAnswers] = useState<Record<number, number>>({})

  // Form de criação de conta
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Diagnóstico salvo após criação de conta
  const [savedDiagnostic, setSavedDiagnostic] = useState<Partial<DiagnosticRecord> | null>(null)

  const handleAnswerChange = (questionId: number, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  // Concluir questionário e ir para o passo de criação de conta
  const handleQuizComplete = () => {
    setStep('account')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Submeter cadastro e gravar tudo na coleção diagnostics
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Cria usuário e grava diagnóstico via AuthContext.register
      const newUser = await register(name.trim(), email.trim(), password, answers)

      // 2. Montar objeto do diagnóstico para exibir a tela de resultado
      const scores = calculateDiagnosticScores(answers)
      const summary = generateDiagnosticSummary(scores, answers)

      setSavedDiagnostic({
        owner: newUser.id,
        score_controle: scores.score_controle,
        score_choques: scores.score_choques,
        score_metas: scores.score_metas,
        score_dividas: scores.score_dividas,
        score_clareza: scores.score_clareza,
        overall_score: scores.overall_score,
        summary,
        version: 1,
      })

      setStep('result')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error('Erro ao criar conta no onboarding:', err)
      setError(
        err?.message?.includes('email')
          ? 'Este e-mail já está em uso. Faça login ou utilize outro e-mail.'
          : 'Erro ao criar conta. Verifique os dados informados.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Header com Logo e link discreto "Já tenho conta" em toda a jornada */}
      <header className="w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <TrendingUp className="h-5 w-5 stroke-[2.5]" />
            </div>
            <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
              Meu Planejamento Financeiro
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">Já tem uma conta?</span>
            <Link
              to="/login"
              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline px-3 py-1.5 rounded-lg transition-colors border border-slate-200 sm:border-transparent"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal de acordo com a etapa */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {step === 'welcome' && (
          <div className="max-w-2xl mx-auto text-center space-y-8 animate-fade-in py-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                <Compass className="h-4 w-4 text-blue-600" />
                <span>Diagnóstico Bússola Financeira</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Gestão financeira pessoal a partir dos seus extratos.
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
                Descubra em menos de 3 minutos a real saúde das suas finanças através de 5
                dimensões: controle diário, capacidade de absorver choques, metas, peso de dívidas e
                clareza de futuro.
              </p>
            </div>

            {/* Três destaques rápidos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left pt-2">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <div className="font-bold text-slate-900 text-sm mb-1">16 perguntas objetivas</div>
                <div className="text-xs text-slate-500">
                  Escala de 1 a 5, sem necessidade de consultar extratos neste primeiro momento.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <div className="font-bold text-slate-900 text-sm mb-1">Score por dimensão</div>
                <div className="text-xs text-slate-500">
                  Visualização detalhada de pontos fortes e riscos no seu orçamento.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <div className="font-bold text-slate-900 text-sm mb-1">Consultor IA contextual</div>
                <div className="text-xs text-slate-500">
                  Seu diagnóstico orienta recomendações personalizadas direto no seu painel.
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={() => {
                  setStep('quiz')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-12 px-8 rounded-xl shadow-md shadow-blue-500/20"
              >
                <span>Iniciar Diagnóstico Bússola</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 'quiz' && (
          <DiagnosticFormWizard
            answers={answers}
            onAnswerChange={handleAnswerChange}
            onComplete={handleQuizComplete}
            submitButtonText="Avançar para Criar Conta"
          />
        )}

        {step === 'account' && (
          <div className="max-w-md mx-auto space-y-6 animate-fade-in py-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Diagnóstico Concluído</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Crie sua conta para ver seu resultado
              </h2>
              <p className="text-xs text-slate-500">
                Seu diagnóstico e scores serão gravados com segurança na sua nova conta.
              </p>
            </div>

            <Card className="border-slate-200 shadow-md bg-white rounded-2xl">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={handleAccountSubmit} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="account-name" className="text-xs font-semibold text-slate-700">
                      Seu Nome Completo
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="account-name"
                        type="text"
                        placeholder="Ex: Veronica Silva"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-sm focus-visible:bg-white"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="account-email" className="text-xs font-semibold text-slate-700">
                      E-mail
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="account-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-sm focus-visible:bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="account-password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Senha (mínimo 8 caracteres)
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="account-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-sm focus-visible:bg-white"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-11 rounded-xl shadow-md shadow-blue-500/20 mt-2"
                  >
                    {submitting ? 'Gravando diagnóstico...' : 'Criar Conta e Ver Resultado'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setStep('quiz')}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      ← Revisar respostas da Bússola
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'result' && savedDiagnostic && (
          <DiagnosticResultView
            diagnostic={savedDiagnostic}
            onContinueToDashboard={() => navigate('/')}
            isRetakeFlow={false}
          />
        )}
      </main>

      {/* Footer simples com indicação de segurança */}
      <footer className="w-full border-t border-slate-200/80 bg-white py-4 px-4 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>Dados isolados por usuário e conexão criptografada</span>
          </div>
          <p>© {new Date().getFullYear()} Meu Planejamento Financeiro · Bússola Financeira</p>
        </div>
      </footer>
    </div>
  )
}
