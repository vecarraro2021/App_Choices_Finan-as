import { Transaction, Category, Currency, UserSettings } from '@/types/finance'
import { formatCurrency } from '@/lib/formatters'

export interface InsightItem {
  id: string
  title: string
  description: string
  badgeText: string
  badgeColor: string // bg & text & border classes
  iconType: 'warning' | 'economy' | 'success' | 'repeat' | 'target'
  order: number
}

export interface GenerateInsightsParams {
  transactions: Transaction[]
  categories: Category[]
  currency: Currency
  intervalMonths: string[]
  monthlyAverage?: number
  userSettings?: UserSettings | null
}

/**
 * Generates financial insights/action items based on transactions, categories,
 * selected interval months, user currency, and user notification settings.
 */
export function generateFinancialInsights({
  transactions,
  categories,
  currency,
  intervalMonths,
  monthlyAverage = 0,
  userSettings,
}: GenerateInsightsParams): InsightItem[] {
  const result: InsightItem[] = []
  const monthsCount = Math.max(intervalMonths.length, 1)

  // Map subcategories to parent category
  const mainCategories = categories.filter((c) => c.type === 'main')
  const subToParent = new Map<string, string>()
  categories
    .filter((c) => c.type === 'sub' && c.parent)
    .forEach((c) => {
      subToParent.set(c.id, c.parent!)
    })

  const catTotals: Record<string, number> = {}
  const catMonthly: Record<string, Record<string, number>> = {}
  let totalSpent = 0

  transactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0
    totalSpent += amt
    let pId = tx.category
    if (pId && subToParent.has(pId)) {
      pId = subToParent.get(pId)
    }
    if (pId) {
      catTotals[pId] = (catTotals[pId] || 0) + amt
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : 'm')
      if (!catMonthly[pId]) catMonthly[pId] = {}
      catMonthly[pId][m] = (catMonthly[pId][m] || 0) + amt
    }
  })

  // 1. Categoria com estouro orçamentário (Atenção)
  // Respeita toggle notify_budget_overflow
  if (userSettings?.notify_budget_overflow !== false) {
    for (const cat of mainCategories) {
      const spent = catTotals[cat.id] || 0
      const totalBudget = (Number(cat.estimated) || 0) * monthsCount
      if (totalBudget > 0 && spent > totalBudget * 1.1) {
        const overPct = Math.round(((spent - totalBudget) / totalBudget) * 100)
        result.push({
          id: `over-${cat.id}`,
          title: `Gastos com ${cat.name} acima da meta`,
          description: `Seus gastos com ${cat.name.toLowerCase()} ultrapassaram o orçado em ${overPct}%. Considere revisar o limite mensal.`,
          badgeText: 'Atenção',
          badgeColor: 'bg-red-100 text-red-700 border-red-200',
          iconType: 'warning',
          order: 1,
        })
        break // Take the most prominent
      }
    }
  }

  // 2. Oportunidade de economia na maior categoria (Economia)
  const sortedCats = [...mainCategories].sort(
    (a, b) => (catTotals[b.id] || 0) - (catTotals[a.id] || 0),
  )
  if (sortedCats.length > 0 && totalSpent > 0) {
    const topCat = sortedCats[0]
    const topSpent = catTotals[topCat.id] || 0
    const potentialMonthlySavings = Math.round((topSpent / monthsCount) * 0.15)
    if (potentialMonthlySavings > 50) {
      result.push({
        id: `opt-${topCat.id}`,
        title: `Oportunidade de economia em ${topCat.name}`,
        description: `Identificamos concentração relevante. Potencial de economia de aproximadamente ${formatCurrency(potentialMonthlySavings, currency)}/mês com pequenos ajustes.`,
        badgeText: 'Economia',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        iconType: 'economy',
        order: 2,
      })
    }
  }

  // 3. Rebalancear orçamento ou tendência em categoria crescente (Atenção)
  // Respeita toggle notify_budget_overflow
  if (userSettings?.notify_budget_overflow !== false) {
    for (const cat of mainCategories) {
      if (!result.find((r) => r.id.includes(cat.id))) {
        const mObj = catMonthly[cat.id] || {}
        const recorded = Object.keys(mObj).sort()
        if (recorded.length >= 3) {
          const last3 = recorded.slice(-3).map((m) => mObj[m])
          if (last3[0] < last3[1] && last3[1] < last3[2]) {
            result.push({
              id: `trend-${cat.id}`,
              title: `Rebalancear orçamento de ${cat.name}`,
              description: `Tendência de aumento consecutivo nos últimos 3 meses analisados. Sugerimos monitorar e ajustar a meta.`,
              badgeText: 'Atenção',
              badgeColor: 'bg-red-100 text-red-700 border-red-200',
              iconType: 'warning',
              order: 3,
            })
            break
          }
        }
      }
    }
  }

  // 4. Meta dentro do planejado (No caminho)
  for (const cat of mainCategories) {
    const spent = catTotals[cat.id] || 0
    const totalBudget = (Number(cat.estimated) || 0) * monthsCount
    if (totalBudget > 0 && spent > 0 && spent <= totalBudget) {
      const belowPct = Math.round(((totalBudget - spent) / totalBudget) * 100)
      result.push({
        id: `ok-${cat.id}`,
        title: `Meta de ${cat.name} dentro do planejado`,
        description: `Parabéns! Seus gastos com ${cat.name.toLowerCase()} estão ${belowPct}% abaixo do orçado no período.`,
        badgeText: 'No caminho',
        badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        iconType: 'success',
        order: 4,
      })
      break
    }
  }

  // 5. Categoria de Assinaturas ou Serviços (Economia)
  const subCatMain = mainCategories.find(
    (c) => c.name.toLowerCase().includes('assinatura') || c.name.toLowerCase().includes('serviço'),
  )
  if (subCatMain && (catTotals[subCatMain.id] || 0) > 0) {
    const monthlySub = (catTotals[subCatMain.id] || 0) / monthsCount
    const estimatedSaving = Math.round(monthlySub * 0.25)
    result.push({
      id: `subs-${subCatMain.id}`,
      title: `Renegociar ${subCatMain.name}`,
      description: `Serviços recorrentes ativos identificados. Economia estimada em até ${formatCurrency(estimatedSaving, currency)}/mês ao revisar planos.`,
      badgeText: 'Economia',
      badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
      iconType: 'repeat',
      order: 5,
    })
  }

  // 6. Reserva de emergência (Alta prioridade)
  const computedAverage = monthlyAverage > 0 ? monthlyAverage : totalSpent / monthsCount
  result.push({
    id: 'emergency-reserve',
    title: 'Criar reserva de emergência',
    description: `Com base no seu perfil e run-rate, recomendamos manter uma reserva entre 3x e 6x a média mensal de gastos (${formatCurrency(computedAverage * 6, currency)}).`,
    badgeText: 'Alta prioridade',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    iconType: 'target',
    order: 6,
  })

  return result.sort((a, b) => a.order - b.order)
}
