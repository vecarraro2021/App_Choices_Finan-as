export interface DiagnosticQuestion {
  id: number
  sectionId: number
  sectionNumber: string
  sectionTitle: string
  text: string
  leftLabel: string
  rightLabel: string
  inverted: boolean // true = resposta 5 é ruim, resposta 1 é boa
}

export interface DiagnosticSection {
  id: number
  number: string
  title: string
  description?: string
  questionIds: number[]
}

export const DIAGNOSTIC_SECTIONS: DiagnosticSection[] = [
  {
    id: 1,
    number: '01',
    title: 'Controle do dia a dia',
    questionIds: [1, 2, 3, 4],
  },
  {
    id: 2,
    number: '02',
    title: 'Capacidade de absorver choques',
    questionIds: [5, 6, 7],
  },
  {
    id: 3,
    number: '03',
    title: 'Progresso em direção a metas',
    questionIds: [8, 9, 10],
  },
  {
    id: 4,
    number: '04',
    title: 'Liberdade e peso de dívidas',
    questionIds: [11, 12, 13],
  },
  {
    id: 5,
    number: '05',
    title: 'Clareza de direção',
    questionIds: [14, 15, 16],
  },
]

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  // 01 — Controle do dia a dia
  {
    id: 1,
    sectionId: 1,
    sectionNumber: '01',
    sectionTitle: 'Controle do dia a dia',
    text: 'Você sabe, com razoável precisão, quanto gastou no mês passado.',
    leftLabel: 'Não faço ideia',
    rightLabel: 'Sei o valor exato',
    inverted: false,
  },
  {
    id: 2,
    sectionId: 1,
    sectionNumber: '01',
    sectionTitle: 'Controle do dia a dia',
    text: "Você é surpreendido(a) por um gasto que 'esqueceu' que existia (assinatura, conta, parcela).",
    leftLabel: 'Nunca acontece',
    rightLabel: 'Acontece sempre',
    inverted: true,
  },
  {
    id: 3,
    sectionId: 1,
    sectionNumber: '01',
    sectionTitle: 'Controle do dia a dia',
    text: 'Você sabe quanto tem disponível até o fim do mês, sem checar o app do banco.',
    leftLabel: 'Não faço ideia',
    rightLabel: 'Sei com precisão',
    inverted: false,
  },
  {
    id: 4,
    sectionId: 1,
    sectionNumber: '01',
    sectionTitle: 'Controle do dia a dia',
    text: '“Minhas despesas fixas mensais me deixam confortável.”',
    leftLabel: 'Mentira',
    rightLabel: 'Verdade',
    inverted: false,
  },

  // 02 — Capacidade de absorver choques
  {
    id: 5,
    sectionId: 2,
    sectionNumber: '02',
    sectionTitle: 'Capacidade de absorver choques',
    text: 'Se um gasto inesperado grande surgisse amanhã, você cobriria sem recorrer a dívida.',
    leftLabel: 'De jeito nenhum',
    rightLabel: 'Sem problema',
    inverted: false,
  },
  {
    id: 6,
    sectionId: 2,
    sectionNumber: '02',
    sectionTitle: 'Capacidade de absorver choques',
    text: 'Sua reserva de emergência hoje é:',
    leftLabel: 'Inexistente',
    rightLabel: 'Confortável',
    inverted: false,
  },
  {
    id: 7,
    sectionId: 2,
    sectionNumber: '02',
    sectionTitle: 'Capacidade de absorver choques',
    text: 'Pensar em imprevistos financeiros te gera ansiedade.',
    leftLabel: 'Nunca',
    rightLabel: 'Sempre',
    inverted: true,
  },

  // 03 — Progresso em direção a metas
  {
    id: 8,
    sectionId: 3,
    sectionNumber: '03',
    sectionTitle: 'Progresso em direção a metas',
    text: 'Você tem uma meta financeira clara para os próximos 12 meses.',
    leftLabel: 'Nenhuma meta',
    rightLabel: 'Muito clara',
    inverted: false,
  },
  {
    id: 9,
    sectionId: 3,
    sectionNumber: '03',
    sectionTitle: 'Progresso em direção a metas',
    text: 'Nos últimos 6 meses, você avançou em direção a algum objetivo financeiro.',
    leftLabel: 'Fiquei parado(a)',
    rightLabel: 'Avancei bastante',
    inverted: false,
  },
  {
    id: 10,
    sectionId: 3,
    sectionNumber: '03',
    sectionTitle: 'Progresso em direção a metas',
    text: 'Você revisa ou ajusta seus planos financeiros.',
    leftLabel: 'Nunca',
    rightLabel: 'Regularmente',
    inverted: false,
  },

  // 04 — Liberdade e peso de dívidas
  {
    id: 11,
    sectionId: 4,
    sectionNumber: '04',
    sectionTitle: 'Liberdade e peso de dívidas',
    text: 'Parte do seu dinheiro de hoje está comprometida com dívidas ou parcelamentos passados.',
    leftLabel: 'Nada comprometido',
    rightLabel: 'Totalmente comprometido',
    inverted: true,
  },
  {
    id: 12,
    sectionId: 4,
    sectionNumber: '04',
    sectionTitle: 'Liberdade e peso de dívidas',
    text: 'Suas dívidas atuais impediriam uma decisão importante (trocar de emprego, viajar, investir).',
    leftLabel: 'Não impediriam',
    rightLabel: 'Impediriam totalmente',
    inverted: true,
  },
  {
    id: 13,
    sectionId: 4,
    sectionNumber: '04',
    sectionTitle: 'Liberdade e peso de dívidas',
    text: 'Você sabe exatamente quanto deve, somando todas as fontes.',
    leftLabel: 'Não faço ideia',
    rightLabel: 'Sei o valor exato',
    inverted: false,
  },

  // 05 — Clareza de direção
  {
    id: 14,
    sectionId: 5,
    sectionNumber: '05',
    sectionTitle: 'Clareza de direção',
    text: 'Você tem uma visão clara de onde quer estar daqui a 5 anos.',
    leftLabel: 'Nenhuma clareza',
    rightLabel: 'Visão muito clara',
    inverted: false,
  },
  {
    id: 15,
    sectionId: 5,
    sectionNumber: '05',
    sectionTitle: 'Clareza de direção',
    text: 'Em decisões financeiras importantes, você sabe o que está buscando.',
    leftLabel: 'Me sinto perdido(a)',
    rightLabel: 'Sei exatamente',
    inverted: false,
  },
  {
    id: 16,
    sectionId: 5,
    sectionNumber: '05',
    sectionTitle: 'Clareza de direção',
    text: 'Você adia decisões financeiras porque não tem certeza do que quer.',
    leftLabel: 'Nunca',
    rightLabel: 'Sempre',
    inverted: true,
  },
]

export interface DiagnosticScores {
  score_controle: number
  score_choques: number
  score_metas: number
  score_dividas: number
  score_clareza: number
  overall_score: number
}

/**
 * Normaliza uma resposta de escala 1 a 5 para 0 a 100 pontos.
 * Se invertida: 1 => 100, 2 => 75, 3 => 50, 4 => 25, 5 => 0
 * Se direta: 1 => 0, 2 => 25, 3 => 50, 4 => 75, 5 => 100
 */
export function normalizeAnswerScore(rawVal: number, inverted: boolean): number {
  const clamped = Math.max(1, Math.min(5, Number(rawVal) || 3))
  const directScore = ((clamped - 1) / 4) * 100
  return inverted ? 100 - directScore : directScore
}

/**
 * Calcula os scores por dimensão e o score geral a partir das 16 respostas
 */
export function calculateDiagnosticScores(
  answers: Record<number | string, number>,
): DiagnosticScores {
  const getSectionScore = (qIds: number[]): number => {
    let sum = 0
    let count = 0
    for (const qId of qIds) {
      const q = DIAGNOSTIC_QUESTIONS.find((item) => item.id === qId)
      if (!q) continue
      const raw = answers[qId] ?? answers[String(qId)]
      if (raw !== undefined && raw !== null) {
        sum += normalizeAnswerScore(raw, q.inverted)
        count++
      }
    }
    if (count === 0) return 50
    return Math.round(sum / count)
  }

  const score_controle = getSectionScore([1, 2, 3, 4])
  const score_choques = getSectionScore([5, 6, 7])
  const score_metas = getSectionScore([8, 9, 10])
  const score_dividas = getSectionScore([11, 12, 13])
  const score_clareza = getSectionScore([14, 15, 16])

  // Média simples das 5 dimensões (0–100)
  const overall_score = Math.round(
    (score_controle + score_choques + score_metas + score_dividas + score_clareza) / 5,
  )

  return {
    score_controle,
    score_choques,
    score_metas,
    score_dividas,
    score_clareza,
    overall_score,
  }
}

/**
 * Retorna uma interpretação textual do nível de saúde financeira
 */
export function getScoreClassification(score: number): {
  label: string
  color: string
  badgeBg: string
  badgeText: string
  description: string
} {
  if (score >= 80) {
    return {
      label: 'Excelente',
      color: '#10B981',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeText: 'Alta solidez',
      description:
        'Sua saúde financeira apresenta alto grau de previsibilidade, controle e capacidade de absorver choques.',
    }
  }
  if (score >= 65) {
    return {
      label: 'Boa / Equilibrada',
      color: '#3B82F6',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeText: 'Equilíbrio',
      description:
        'Você mantém uma boa base de organização, com pequenas oportunidades de ajuste no fluxo ou metas.',
    }
  }
  if (score >= 45) {
    return {
      label: 'Em Atenção',
      color: '#F59E0B',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeText: 'Requer atenção',
      description:
        'Algumas dimensões demandam cuidado, especialmente quanto à previsibilidade de gastos ou reserva.',
    }
  }
  return {
    label: 'Crítica / Vulnerável',
    color: '#EF4444',
    badgeBg: 'bg-red-50 text-red-700 border-red-200',
    badgeText: 'Vulnerável',
    description:
      'Há vulnerabilidade financeira relevante, peso de dívidas ou ausência de reserva para choques inesperados.',
  }
}

/**
 * Gera o resumo estruturado em texto para o consultor financeiro
 */
export function generateDiagnosticSummary(
  scores: DiagnosticScores,
  answers: Record<number | string, number>,
): string {
  const dimensions = [
    { name: 'Controle do dia a dia', score: scores.score_controle },
    { name: 'Capacidade de absorver choques', score: scores.score_choques },
    { name: 'Progresso em direção a metas', score: scores.score_metas },
    { name: 'Liberdade e peso de dívidas', score: scores.score_dividas },
    { name: 'Clareza de direção', score: scores.score_clareza },
  ]

  // Ordenar por score para identificar pontos mais fortes e mais frágeis
  const sorted = [...dimensions].sort((a, b) => a.score - b.score)
  const weak = sorted.filter((d) => d.score < 55)
  const strong = sorted.filter((d) => d.score >= 70)

  const classification = getScoreClassification(scores.overall_score)

  let summary = `DIAGNÓSTICO BÚSSOLA FINANCEIRA (Score Geral: ${scores.overall_score}/100 - ${classification.label})\n`
  summary += `Scores por dimensão:\n`
  dimensions.forEach((d) => {
    summary += `- ${d.name}: ${d.score}/100\n`
  })

  summary += `\nPontos críticos que demandam foco imediato:\n`
  if (weak.length > 0) {
    weak.forEach((w) => {
      summary += `- ${w.name} (${w.score}/100): necessita de suporte prioritário e planos graduais de melhora.\n`
    })
  } else {
    summary += `- Nenhuma dimensão abaixo de 55 pontos. Situação operacional estável.\n`
  }

  summary += `\nPontos fortes:\n`
  if (strong.length > 0) {
    strong.forEach((s) => {
      summary += `- ${s.name} (${s.score}/100): alavanca positiva para acelerar outros objetivos.\n`
    })
  } else {
    summary += `- Desenvolvimento balanceado em nível intermediário.\n`
  }

  // Resumo de dores específicas baseadas em perguntas-chave
  const ansReserva = answers[6] ?? answers['6']
  const ansAnsiedade = answers[7] ?? answers['7']
  const ansDividas = answers[11] ?? answers['11']
  const ansMeta12m = answers[8] ?? answers['8']

  summary += `\nDores e contextos específicos relatados:\n`
  if (ansReserva !== undefined && ansReserva <= 2) {
    summary += `- Reserva de emergência: baixa ou inexistente (resposta ${ansReserva}/5).\n`
  }
  if (ansAnsiedade !== undefined && ansAnsiedade >= 4) {
    summary += `- Ansiedade com imprevistos: alta (resposta ${ansAnsiedade}/5).\n`
  }
  if (ansDividas !== undefined && ansDividas >= 3) {
    summary += `- Comprometimento com dívidas: perceptível (resposta ${ansDividas}/5).\n`
  }
  if (ansMeta12m !== undefined && ansMeta12m >= 4) {
    summary += `- Possui meta clara para os próximos 12 meses (resposta ${ansMeta12m}/5).\n`
  }

  return summary.trim()
}
