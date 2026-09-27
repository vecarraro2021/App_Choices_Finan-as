import React, { useState } from 'react'
import {
  DIAGNOSTIC_SECTIONS,
  DIAGNOSTIC_QUESTIONS,
  DiagnosticSection,
  DiagnosticQuestion,
} from '@/lib/diagnosticEngine'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

interface DiagnosticFormWizardProps {
  answers: Record<number, number>
  onAnswerChange: (questionId: number, value: number) => void
  onComplete: () => void
  isSubmitting?: boolean
  submitButtonText?: string
  extraTopContent?: React.ReactNode
}

export function DiagnosticFormWizard({
  answers,
  onAnswerChange,
  onComplete,
  isSubmitting = false,
  submitButtonText = 'Avançar',
  extraTopContent,
}: DiagnosticFormWizardProps) {
  // Passos: 0 a 4 (uma para cada seção de perguntas 1 a 5)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)

  const currentSection = DIAGNOSTIC_SECTIONS[currentSectionIndex]
  const currentQuestions = DIAGNOSTIC_QUESTIONS.filter((q) => q.sectionId === currentSection.id)

  // Total de perguntas respondidas
  const answeredCount = Object.keys(answers).filter(
    (k) => answers[Number(k)] !== undefined && answers[Number(k)] !== null,
  ).length
  const totalQuestions = DIAGNOSTIC_QUESTIONS.length
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100)

  // Checar se todas as perguntas da seção atual foram respondidas
  const isCurrentSectionComplete = currentQuestions.every(
    (q) => answers[q.id] !== undefined && answers[q.id] !== null,
  )

  const handleNext = () => {
    if (currentSectionIndex < DIAGNOSTIC_SECTIONS.length - 1) {
      setCurrentSectionIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      onComplete()
    }
  }

  const handleBack = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {extraTopContent}

      {/* Barra de Progresso Superior Exata: "X de 16 respondidas" + % */}
      <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            {answeredCount} de {totalQuestions} respondidas
          </span>
          <span className="text-blue-600 font-bold tabular-nums">{progressPercent}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
          <span>
            Seção {currentSectionIndex + 1} de {DIAGNOSTIC_SECTIONS.length}: {currentSection.title}
          </span>
          <span>
            {totalQuestions - answeredCount === 0
              ? 'Tudo pronto'
              : `Faltam ${totalQuestions - answeredCount}`}
          </span>
        </div>
      </div>

      {/* Card da Seção Atual */}
      <Card className="border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
            {currentSection.number}
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {currentSection.title}
          </h2>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-8">
          {currentQuestions.map((q, idx) => {
            const selectedVal = answers[q.id]

            return (
              <div
                key={q.id}
                className="space-y-3.5 pb-6 last:pb-0 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 mt-0.5">
                    {q.id}
                  </span>
                  <Label className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    {q.text}
                  </Label>
                </div>

                {/* Escala de 5 pontos (1 a 5) com botões e rótulos nos extremos */}
                <div className="pl-9 space-y-2">
                  <div className="grid grid-cols-5 gap-2 sm:gap-3">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const isSelected = selectedVal === val
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => onAnswerChange(q.id, val)}
                          className={`h-11 sm:h-12 rounded-xl border text-sm sm:text-base font-bold transition-all flex items-center justify-center cursor-pointer select-none ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                              : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {val}
                        </button>
                      )
                    })}
                  </div>

                  {/* Rótulos nos Extremos */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span className="text-left font-medium max-w-[45%] text-slate-600">
                      {q.leftLabel}
                    </span>
                    <span className="text-right font-medium max-w-[45%] text-slate-600">
                      {q.rightLabel}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Navegação entre seções */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentSectionIndex === 0 || isSubmitting}
              className="border-slate-200 text-xs sm:text-sm font-semibold h-10 px-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Button>

            <Button
              type="button"
              onClick={handleNext}
              disabled={!isCurrentSectionComplete || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold h-10 px-6 shadow-xs"
            >
              <span>
                {currentSectionIndex < DIAGNOSTIC_SECTIONS.length - 1
                  ? 'Avançar seção'
                  : submitButtonText}
              </span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
