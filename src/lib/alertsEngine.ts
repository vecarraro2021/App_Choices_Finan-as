import {
  Transaction,
  Income,
  RecurringIncome,
  Category,
  Alert,
  MonthlyTotal,
} from '@/types/finance'
import { clearAndSaveAlerts } from '@/services/financeService'
import { formatCurrency, formatMonthLong, formatMonthShort } from '@/lib/formatters'

export interface ComputedAlert {
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  suggestion: string
}

/**
 * Computes alerts dynamically based on actual database records:
 * (a) Sem receita registrada em mês com despesas -> critical (receitas recorrentes ativas cobrem automaticamente)
 * (b) Orçamento mensal superado -> warning com % (mês e categoria)
 * (c) Categoria concentra > 25% do gasto total -> info
 * (d) Pico atípico: categoria com gasto mensal > 2.5x da própria média histórica -> warning
 * (e) Divergência numérica entre soma de categorias e total oficial -> warning
 */
export async function computeAndSyncAlerts(
  transactions: Transaction[],
  incomes: Income[],
  categories: Category[],
  monthlyTotals: MonthlyTotal[] = [],
  recurringIncomes: RecurringIncome[] = [],
): Promise<ComputedAlert[]> {
  const alerts: ComputedAlert[] = []

  const activeRecurringSumBrl = recurringIncomes
    .filter((r) => r.active)
    .reduce((sum, r) => sum + (Number(r.amount_brl) || 0), 0)

  if (transactions.length === 0 && incomes.length === 0 && activeRecurringSumBrl === 0) {
    return alerts
  }

  // 1. Group transactions by month and by category
  const expensesByMonth: Record<string, number> = {}
  const expensesByCategoryMonth: Record<string, Record<string, number>> = {}
  const expensesByCategoryTotal: Record<string, number> = {}
  let totalSpending = 0

  for (const tx of transactions) {
    const m = tx.month || (tx.date ? tx.date.slice(0, 7) : 'Indefinido')
    const catId = tx.category || 'uncategorized'
    const amount = Number(tx.amount) || 0

    expensesByMonth[m] = (expensesByMonth[m] || 0) + amount
    totalSpending += amount

    if (!expensesByCategoryMonth[catId]) {
      expensesByCategoryMonth[catId] = {}
    }
    expensesByCategoryMonth[catId][m] = (expensesByCategoryMonth[catId][m] || 0) + amount
    expensesByCategoryTotal[catId] = (expensesByCategoryTotal[catId] || 0) + amount
  }

  // Group income by month (punctual + active recurring)
  const incomeByMonth: Record<string, number> = {}
  for (const inc of incomes) {
    const m = inc.month
    incomeByMonth[m] = (incomeByMonth[m] || 0) + (Number(inc.amount_brl) || 0)
  }

  // Rule (a): No income registered in a month with expenses -> Critical
  const monthsWithExpenses = Object.keys(expensesByMonth).sort()
  for (const m of monthsWithExpenses) {
    const punctualInc = incomeByMonth[m] || 0
    const incVal = punctualInc + activeRecurringSumBrl
    const expVal = expensesByMonth[m]
    if (incVal === 0 && expVal > 0) {
      alerts.push({
        severity: 'critical',
        title: `Ponto Cego: Sem receita registrada em ${formatMonthShort(m)}`,
        description: `Há um total de ${formatCurrency(expVal, 'BRL')} em despesas registradas em ${formatMonthLong(m)}, porém nenhuma entrada financeira vinculada. Sem receita, não é possível calcular taxa de poupança ou saúde financeira real.`,
        suggestion: `Acesse a aba "Receitas" e cadastre suas receitas recorrentes automáticas ou pontuais deste mês.`,
      })
    } else if (incVal > 0 && expVal > incVal) {
      const deficit = expVal - incVal
      alerts.push({
        severity: 'warning',
        title: `Despesas excedem receitas em ${formatMonthShort(m)}`,
        description: `Gastos (${formatCurrency(expVal, 'BRL')}) superaram os ganhos (${formatCurrency(incVal, 'BRL')}) em ${formatCurrency(deficit, 'BRL')}.`,
        suggestion: `Avalie despesas não recorrentes no mês ou ajuste os aportes para evitar endividamento.`,
      })
    }
  }

  // Build category dictionary
  const categoryMap = new Map<string, Category>()
  categories.forEach((c) => categoryMap.set(c.id, c))

  // Rule (b): Monthly category budget exceeded
  // Compare estimated for main categories vs actual
  for (const cat of categories) {
    if (cat.type === 'main' && cat.estimated && cat.estimated > 0) {
      for (const m of monthsWithExpenses) {
        // Find subcategories belonging to this main category
        const subCatIds = categories.filter((sc) => sc.parent === cat.id).map((sc) => sc.id)
        const relatedCatIds = [cat.id, ...subCatIds]

        let spentInCatMonth = 0
        for (const cid of relatedCatIds) {
          spentInCatMonth += expensesByCategoryMonth[cid]?.[m] || 0
        }

        if (spentInCatMonth > cat.estimated * 1.15) {
          const pct = Math.round(((spentInCatMonth - cat.estimated) / cat.estimated) * 100)
          alerts.push({
            severity: 'warning',
            title: `Orçamento de ${cat.name} estourado em ${formatMonthShort(m)} (+${pct}%)`,
            description: `Gasto de ${formatCurrency(spentInCatMonth, 'BRL')} superou o orçamento estimado de ${formatCurrency(cat.estimated, 'BRL')}.`,
            suggestion: `Verifique os lançamentos da categoria ${cat.name} em ${formatMonthShort(m)} e analise possíveis cortes para o próximo ciclo.`,
          })
        }
      }
    }
  }

  // Rule (c): Category concentration > 25% of total spending
  if (totalSpending > 0) {
    for (const cat of categories) {
      if (cat.type === 'main') {
        const subCatIds = categories.filter((sc) => sc.parent === cat.id).map((sc) => sc.id)
        const relatedCatIds = [cat.id, ...subCatIds]

        let spentInCat = 0
        for (const cid of relatedCatIds) {
          spentInCat += expensesByCategoryTotal[cid] || 0
        }

        const share = spentInCat / totalSpending
        if (share > 0.25) {
          const sharePct = Math.round(share * 100)
          alerts.push({
            severity: 'info',
            title: `Alta concentração em ${cat.name} (${sharePct}% dos gastos)`,
            description: `A categoria ${cat.name} representa ${formatCurrency(spentInCat, 'BRL')} (${sharePct}%) de todo o montante desembolsado no período.`,
            suggestion: `Como é o maior centro de custos da sua vida financeira, pequenas otimizações percentuais aqui geram o maior impacto financeiro em reais.`,
          })
        }
      }
    }
  }

  // Rule (d): Atypical Spike (> 2.5x historical category monthly average)
  if (monthsWithExpenses.length >= 2) {
    for (const cat of categories) {
      if (cat.type === 'main') {
        const subCatIds = categories.filter((sc) => sc.parent === cat.id).map((sc) => sc.id)
        const relatedCatIds = [cat.id, ...subCatIds]

        const monthlySpents: { month: string; amount: number }[] = []
        for (const m of monthsWithExpenses) {
          let mSpent = 0
          for (const cid of relatedCatIds) {
            mSpent += expensesByCategoryMonth[cid]?.[m] || 0
          }
          if (mSpent > 0) {
            monthlySpents.push({ month: m, amount: mSpent })
          }
        }

        if (monthlySpents.length >= 3) {
          const totalCatAmount = monthlySpents.reduce((acc, curr) => acc + curr.amount, 0)
          for (const entry of monthlySpents) {
            const othersTotal = totalCatAmount - entry.amount
            const othersAvg = othersTotal / (monthlySpents.length - 1)

            if (othersAvg > 100 && entry.amount > othersAvg * 2.5) {
              alerts.push({
                severity: 'warning',
                title: `Pico atípico em ${cat.name} no mês ${formatMonthShort(entry.month)}`,
                description: `Gasto de ${formatCurrency(entry.amount, 'BRL')} ficou muito acima da média habitual de outros meses (${formatCurrency(othersAvg, 'BRL')}).`,
                suggestion: `Identifique se foi um gasto extraordinário pontual (ex: compra de veículo ou reforma) e considere isolá-lo de projeções recorrentes.`,
              })
            }
          }
        }
      }
    }
  }

  // Rule (e): Divergence between sum of categories and official total
  for (const mt of monthlyTotals) {
    if (mt.divergence && Math.abs(mt.divergence) > 1) {
      alerts.push({
        severity: 'warning',
        title: `Divergência contábil em ${formatMonthShort(mt.month)} (${formatCurrency(mt.divergence, 'BRL')})`,
        description: `A soma dos lançamentos por categoria difere do total oficial informado para o mês de ${formatMonthLong(mt.month)}.`,
        suggestion: `Audite as transações deste mês para verificar itens não classificados ou valores faltantes no extrato.`,
      })
    }
  }

  // Sort: critical -> warning -> info
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // Sync to database in background
  try {
    await clearAndSaveAlerts(alerts)
  } catch (err) {
    console.error('Falha ao sincronizar alertas no banco:', err)
  }

  return alerts
}
