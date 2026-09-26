import {
  Transaction,
  Income,
  RecurringIncome,
  Category,
  ExchangeRate,
  MonthlyTotal,
  UserSettings,
} from '@/types/finance'
import { clearAndSaveAlerts, getRateForMonth } from '@/services/financeService'
import { formatCurrency, formatMonthLong, formatMonthShort } from '@/lib/formatters'

export interface DeficitMonthItem {
  month: string
  deficit: number
  income: number
  expense: number
}

export interface ComputedAlert {
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  suggestion: string
  deficitMonths?: DeficitMonthItem[]
}

// Re-export insights engine for convenience and single import surface
export {
  generateFinancialInsights,
  type InsightItem,
  type GenerateInsightsParams,
} from './insightsEngine'

/**
 * Shared helper to calculate monthly deficits comparing total monthly expenses
 * against punctual income + active recurring incomes (converted via monthly exchange rate).
 */
export function calculateMonthlyDeficits(
  transactions: Transaction[],
  incomes: Income[],
  recurringIncomes: RecurringIncome[],
  exchangeRates: ExchangeRate[] = [],
): DeficitMonthItem[] {
  const activeRecurringList = recurringIncomes.filter((r) => r.active)

  const expensesByMonth: Record<string, number> = {}
  transactions.forEach((tx) => {
    const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
    if (m) {
      expensesByMonth[m] = (expensesByMonth[m] || 0) + (Number(tx.amount) || 0)
    }
  })

  const punctualByMonth: Record<string, number> = {}
  incomes.forEach((inc) => {
    const mRate = getRateForMonth(inc.month, exchangeRates)
    const valBrl = Number(inc.amount_brl) || (Number(inc.amount_eur) || 0) * mRate
    punctualByMonth[inc.month] = (punctualByMonth[inc.month] || 0) + valBrl
  })

  const deficitMonths: DeficitMonthItem[] = []
  const sortedMonths = Object.keys(expensesByMonth).sort()

  sortedMonths.forEach((m) => {
    const mRate = getRateForMonth(m, exchangeRates)
    const recurringForMonth = activeRecurringList.reduce((acc, r) => {
      return acc + (Number(r.amount_brl) || (Number(r.amount_eur) || 0) * mRate)
    }, 0)
    const inc = (punctualByMonth[m] || 0) + recurringForMonth
    const exp = expensesByMonth[m] || 0
    if (exp > inc) {
      deficitMonths.push({
        month: m,
        deficit: exp - inc,
        income: inc,
        expense: exp,
      })
    }
  })

  return deficitMonths
}

/**
 * Computes alerts dynamically based on actual database records:
 * (a) Alerta de Saúde Financeira: Despesas excedem receitas (agregado com detalhamento mensal) -> critical
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
  userSettings?: UserSettings | null,
  exchangeRates: ExchangeRate[] = [],
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
    const mRate = getRateForMonth(m, exchangeRates)
    const valBrl = Number(inc.amount_brl) || (Number(inc.amount_eur) || 0) * mRate
    incomeByMonth[m] = (incomeByMonth[m] || 0) + valBrl
  }

  // Rule (a1): Meses com despesa mas absolutamente zero receita (recorrente + pontual)
  const monthsWithExpenses = Object.keys(expensesByMonth).sort()
  if (userSettings?.notify_monthly_summary !== false) {
    for (const m of monthsWithExpenses) {
      const punctualInc = incomeByMonth[m] || 0
      const mRate = getRateForMonth(m, exchangeRates)
      const recurringForMonth = recurringIncomes
        .filter((r) => r.active)
        .reduce((sum, r) => sum + (Number(r.amount_brl) || (Number(r.amount_eur) || 0) * mRate), 0)
      const incVal = punctualInc + recurringForMonth
      const expVal = expensesByMonth[m]
      if (incVal === 0 && expVal > 0) {
        alerts.push({
          severity: 'critical',
          title: `Ponto Cego: Sem receita registrada em ${formatMonthShort(m)}`,
          description: `Há um total de ${formatCurrency(expVal, 'BRL')} em despesas registradas em ${formatMonthLong(m)}, porém nenhuma entrada financeira vinculada. Sem receita, não é possível calcular taxa de poupança ou saúde financeira real.`,
          suggestion: `Acesse a aba "Receitas" e cadastre suas receitas recorrentes automáticas ou pontuais deste mês.`,
        })
      }
    }
  }

  // Rule (a2): Alerta de Saúde Financeira: Despesas excedem receitas (migrado de Receitas)
  // Respeita toggle de notificações: associado a notify_monthly_summary
  if (userSettings?.notify_monthly_summary !== false) {
    const deficitMonths = calculateMonthlyDeficits(
      transactions,
      incomes,
      recurringIncomes,
      exchangeRates,
    )
    if (deficitMonths.length > 0) {
      const totalDeficit = deficitMonths.reduce((sum, d) => sum + d.deficit, 0)
      const monthsCount = deficitMonths.length
      alerts.push({
        severity: 'critical',
        title: 'Alerta de Saúde Financeira: Despesas excedem receitas',
        description: `Foram identificados ${monthsCount} ${
          monthsCount === 1 ? 'mês' : 'meses'
        } com saldo operacional negativo onde o custo de vida superou a soma da renda recorrente + pontual declarada (déficit acumulado de ${formatCurrency(totalDeficit, 'BRL')}).`,
        suggestion: `Avalie despesas não recorrentes nos meses deficitários, otimize custos fixos ou incremente as fontes de receita para evitar consumo de reservas.`,
        deficitMonths,
      })
    }
  }

  // Build category dictionary
  const categoryMap = new Map<string, Category>()
  categories.forEach((c) => categoryMap.set(c.id, c))

  // Rule (b): Monthly category budget exceeded (filtrado por userSettings.notify_budget_overflow)
  if (userSettings?.notify_budget_overflow !== false) {
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
  }

  // Rule (c): Category concentration > 25% of total spending (filtrado por userSettings.notify_monthly_summary)
  if (userSettings?.notify_monthly_summary !== false && totalSpending > 0) {
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

  // Rule (d): Atypical Spike (> 2.5x historical category monthly average) (filtrado por userSettings.notify_atypical_transactions)
  if (userSettings?.notify_atypical_transactions !== false && monthsWithExpenses.length >= 2) {
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

  // Rule (e): Divergence between sum of categories and official total (filtrado por userSettings.notify_accounting_divergence)
  if (userSettings?.notify_accounting_divergence !== false) {
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
  }
  // Sort: critical -> warning -> info
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // Sync to database in background (alerts serialized for persistent store)
  try {
    await clearAndSaveAlerts(alerts)
  } catch (err) {
    console.error('Falha ao sincronizar alertas no banco:', err)
  }

  return alerts
}
