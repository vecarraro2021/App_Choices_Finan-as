import { describe, it, expect } from 'vitest'
import {
  calculateDiagnosticScores,
  normalizeAnswerScore,
  generateDiagnosticSummary,
  DIAGNOSTIC_QUESTIONS,
  DIAGNOSTIC_SECTIONS,
} from './diagnosticEngine'

describe('Bússola Financeira - Diagnostic Engine', () => {
  it('contém exatamente 16 perguntas e 5 seções', () => {
    expect(DIAGNOSTIC_QUESTIONS).toHaveLength(16)
    expect(DIAGNOSTIC_SECTIONS).toHaveLength(5)
  })

  it('inverte corretamente as perguntas 2, 7, 11, 12 e 16', () => {
    const invertedIds = [2, 7, 11, 12, 16]
    for (const q of DIAGNOSTIC_QUESTIONS) {
      if (invertedIds.includes(q.id)) {
        expect(q.inverted).toBe(true)
      } else {
        expect(q.inverted).toBe(false)
      }
    }
  })

  it('calcula a normalização direta e invertida (escala 1 a 5 para 0 a 100)', () => {
    // Direta: 1 -> 0, 3 -> 50, 5 -> 100
    expect(normalizeAnswerScore(1, false)).toBe(0)
    expect(normalizeAnswerScore(3, false)).toBe(50)
    expect(normalizeAnswerScore(5, false)).toBe(100)

    // Invertida: 1 -> 100, 3 -> 50, 5 -> 0
    expect(normalizeAnswerScore(1, true)).toBe(100)
    expect(normalizeAnswerScore(3, true)).toBe(50)
    expect(normalizeAnswerScore(5, true)).toBe(0)
  })

  it('calcula score perfeito (100 em todas as dimensões)', () => {
    // Para ser 100: perguntas diretas = 5, perguntas invertidas = 1
    const perfectAnswers: Record<number, number> = {}
    for (const q of DIAGNOSTIC_QUESTIONS) {
      perfectAnswers[q.id] = q.inverted ? 1 : 5
    }

    const scores = calculateDiagnosticScores(perfectAnswers)
    expect(scores.score_controle).toBe(100)
    expect(scores.score_choques).toBe(100)
    expect(scores.score_metas).toBe(100)
    expect(scores.score_dividas).toBe(100)
    expect(scores.score_clareza).toBe(100)
    expect(scores.overall_score).toBe(100)
  })

  it('calcula score mínimo (0 em todas as dimensões)', () => {
    // Para ser 0: perguntas diretas = 1, perguntas invertidas = 5
    const worstAnswers: Record<number, number> = {}
    for (const q of DIAGNOSTIC_QUESTIONS) {
      worstAnswers[q.id] = q.inverted ? 5 : 1
    }

    const scores = calculateDiagnosticScores(worstAnswers)
    expect(scores.score_controle).toBe(0)
    expect(scores.score_choques).toBe(0)
    expect(scores.score_metas).toBe(0)
    expect(scores.score_dividas).toBe(0)
    expect(scores.score_clareza).toBe(0)
    expect(scores.overall_score).toBe(0)
  })

  it('gera resumo estruturado em texto para o agente consultor', () => {
    const mixedAnswers: Record<number, number> = {
      1: 4,
      2: 2,
      3: 4,
      4: 3,
      5: 2,
      6: 1, // reserva inexistente
      7: 5, // ansiedade sempre
      8: 4,
      9: 3,
      10: 3,
      11: 4,
      12: 3,
      13: 5,
      14: 3,
      15: 4,
      16: 2,
    }

    const scores = calculateDiagnosticScores(mixedAnswers)
    const summary = generateDiagnosticSummary(scores, mixedAnswers)

    expect(summary).toContain('DIAGNÓSTICO BÚSSOLA FINANCEIRA')
    expect(summary).toContain('Controle do dia a dia')
    expect(summary).toContain('Capacidade de absorver choques')
    expect(summary).toContain('Reserva de emergência: baixa ou inexistente')
    expect(summary).toContain('Ansiedade com imprevistos: alta')
  })
})
