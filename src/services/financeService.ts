import pb from '@/lib/pocketbase/client'
import {
  Category,
  Transaction,
  Income,
  RecurringIncome,
  Alert,
  MonthlyTotal,
} from '@/types/finance'

// ==================== CATEGORIES ====================
export async function getCategories(): Promise<Category[]> {
  const records = await pb.collection('categories').getFullList<Category>({
    sort: 'name',
    expand: 'parent',
  })
  return records
}

export async function createCategory(data: Partial<Category>): Promise<Category> {
  return await pb.collection('categories').create<Category>(data)
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  return await pb.collection('categories').update<Category>(id, data)
}

export async function deleteCategory(id: string, reassignToId?: string): Promise<void> {
  if (reassignToId) {
    // Reassign transactions using this category
    const transactions = await pb.collection('transactions').getFullList({
      filter: `category = '${id}'`,
    })
    for (const tx of transactions) {
      await pb.collection('transactions').update(tx.id, { category: reassignToId })
    }
  }
  await pb.collection('categories').delete(id)
}

// ==================== TRANSACTIONS ====================
export async function getTransactions(options?: {
  month?: string
  category?: string
  search?: string
  page?: number
  perPage?: number
}): Promise<{ items: Transaction[]; totalItems: number; totalPages: number }> {
  const filters: string[] = []

  if (options?.month) {
    filters.push(`month = '${options.month}'`)
  }
  if (options?.category) {
    filters.push(`category = '${options.category}'`)
  }
  if (options?.search) {
    filters.push(`description ~ '${options.search.replace(/'/g, "\\'")}'`)
  }

  const result = await pb
    .collection('transactions')
    .getList<Transaction>(options?.page || 1, options?.perPage || 50, {
      filter: filters.length > 0 ? filters.join(' && ') : undefined,
      sort: '-date,-created',
      expand: 'category,category.parent',
    })

  return {
    items: result.items,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  }
}

export async function getAllTransactions(filter?: string): Promise<Transaction[]> {
  return await pb.collection('transactions').getFullList<Transaction>({
    filter,
    sort: '-date',
    expand: 'category,category.parent',
  })
}

export async function createTransaction(data: {
  date: string
  description: string
  amount: number
  category?: string
  source: 'importado' | 'manual'
  month: string
}): Promise<Transaction> {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Usuário não autenticado')

  return await pb.collection('transactions').create<Transaction>({
    ...data,
    user: userId,
  })
}

export async function createTransactionsBatch(
  transactions: Array<{
    date: string
    description: string
    amount: number
    category?: string
    source: 'importado' | 'manual'
    month: string
  }>,
): Promise<number> {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Usuário não autenticado')

  let successCount = 0
  for (const item of transactions) {
    try {
      await pb.collection('transactions').create({
        ...item,
        user: userId,
      })
      successCount++
    } catch (e) {
      console.error('Erro ao importar lançamento:', item, e)
    }
  }
  return successCount
}

export async function updateTransaction(
  id: string,
  data: Partial<Transaction>,
): Promise<Transaction> {
  return await pb.collection('transactions').update<Transaction>(id, data)
}

export async function deleteTransaction(id: string): Promise<void> {
  await pb.collection('transactions').delete(id)
}

// ==================== INCOME ====================
export async function getIncomes(filter?: string): Promise<Income[]> {
  return await pb.collection('income').getFullList<Income>({
    filter,
    sort: '-month,-date',
  })
}

export async function createIncome(data: {
  month: string
  amount_brl: number
  amount_eur?: number
  description?: string
  date?: string
}): Promise<Income> {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Usuário não autenticado')

  return await pb.collection('income').create<Income>({
    ...data,
    user: userId,
  })
}

export async function updateIncome(id: string, data: Partial<Income>): Promise<Income> {
  return await pb.collection('income').update<Income>(id, data)
}

export async function deleteIncome(id: string): Promise<void> {
  await pb.collection('income').delete(id)
}

// ==================== RECURRING INCOMES ====================
export async function getRecurringIncomes(filter?: string): Promise<RecurringIncome[]> {
  return await pb.collection('recurring_incomes').getFullList<RecurringIncome>({
    filter,
    sort: '-created',
  })
}

export async function createRecurringIncome(data: {
  description: string
  amount_eur: number
  amount_brl: number
  active?: boolean
}): Promise<RecurringIncome> {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Usuário não autenticado')

  return await pb.collection('recurring_incomes').create<RecurringIncome>({
    ...data,
    active: data.active !== undefined ? data.active : true,
    user: userId,
  })
}

export async function updateRecurringIncome(
  id: string,
  data: Partial<RecurringIncome>,
): Promise<RecurringIncome> {
  return await pb.collection('recurring_incomes').update<RecurringIncome>(id, data)
}

export async function deleteRecurringIncome(id: string): Promise<void> {
  await pb.collection('recurring_incomes').delete(id)
}

/**
 * Agregador de receita por mês:
 * Soma receitas pontuais daquele mês + a soma de todas as receitas recorrentes ativas.
 */
export function calculateMonthIncome(
  month: string,
  incomes: Income[],
  recurringIncomes: RecurringIncome[],
): { brl: number; eur: number } {
  const activeRecurring = recurringIncomes.filter((r) => r.active)
  const recurringBrl = activeRecurring.reduce((sum, r) => sum + (Number(r.amount_brl) || 0), 0)
  const recurringEur = activeRecurring.reduce(
    (sum, r) => sum + (Number(r.amount_eur) || (Number(r.amount_brl) || 0) / 6.0),
    0,
  )

  const monthIncomes = incomes.filter((i) => i.month === month)
  const punctualBrl = monthIncomes.reduce((sum, i) => sum + (Number(i.amount_brl) || 0), 0)
  const punctualEur = monthIncomes.reduce(
    (sum, i) => sum + (Number(i.amount_eur) || (Number(i.amount_brl) || 0) / 6.0),
    0,
  )

  return {
    brl: punctualBrl + recurringBrl,
    eur: punctualEur + recurringEur,
  }
}

// ==================== MONTHLY TOTALS ====================
export async function getMonthlyTotals(): Promise<MonthlyTotal[]> {
  return await pb.collection('monthly_totals').getFullList<MonthlyTotal>({
    sort: 'month',
  })
}

export async function upsertMonthlyTotal(data: {
  month: string
  total_categories?: number
  total_official?: number
  divergence?: number
}): Promise<MonthlyTotal> {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Usuário não autenticado')

  try {
    const existing = await pb.collection('monthly_totals').getFirstListItem(`month='${data.month}'`)
    return await pb.collection('monthly_totals').update<MonthlyTotal>(existing.id, data)
  } catch (_) {
    return await pb.collection('monthly_totals').create<MonthlyTotal>({
      ...data,
      user: userId,
    })
  }
}

// ==================== ALERTS ====================
export async function getAlerts(): Promise<Alert[]> {
  return await pb.collection('alerts').getFullList<Alert>({
    sort: '-created',
  })
}

export async function clearAndSaveAlerts(
  alertsList: Array<{
    severity: 'critical' | 'warning' | 'info'
    title: string
    description: string
    suggestion: string
  }>,
): Promise<void> {
  const userId = pb.authStore.record?.id
  if (!userId) return

  // Clear existing alerts for this user
  const existing = await pb.collection('alerts').getFullList({
    filter: `user='${userId}'`,
  })

  for (const item of existing) {
    try {
      await pb.collection('alerts').delete(item.id)
    } catch {
      /* intentionally ignored */
    }
  }

  // Insert new ones
  for (const item of alertsList) {
    try {
      await pb.collection('alerts').create({
        ...item,
        user: userId,
      })
    } catch {
      /* intentionally ignored */
    }
  }
}
