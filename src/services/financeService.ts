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

// ==================== PLANNING SPREADSHEET IMPORT ====================

/**
 * Uploads an XLSX/CSV file to the backend to be converted to Markdown via $documents.toMarkdown
 */
export async function convertSheetToMarkdown(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('arquivo', file)

  const token = pb.authStore.token
  const baseUrl = pb.baseURL || ''

  const res = await fetch(`${baseUrl}/backend/v1/documentos/convert-sheet`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(errorText || 'Falha ao converter arquivo no servidor')
  }

  const json = await res.json()
  return json.markdown || ''
}

/**
 * Executes the full planning sheet import into PocketBase:
 * 1. Synchronizes Categories (main and sub) with estimated values
 * 2. Optionally replaces existing source="importado" transactions for the selected months
 * 3. Batch inserts historical transactions (in EUR)
 */
export async function importPlanningData(params: {
  year: number
  sections: Array<{
    name: string
    items: Array<{
      name: string
      subgroup?: string
      estimated: number
      monthlyValues: Record<string, number>
    }>
  }>
  replaceExisting: boolean
  monthsToImport: number[] // e.g. [1, 2, 3, 4, 5, 6, 7, 8]
}): Promise<{
  mainCategoriesCreated: number
  subCategoriesCreated: number
  categoriesUpdated: number
  transactionsCreated: number
  transactionsDeleted: number
}> {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Usuário não autenticado')

  // 1. Fetch current categories
  const currentCategories = await getCategories()

  // Helper to normalize names
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')

  let mainCategoriesCreated = 0
  let subCategoriesCreated = 0
  let categoriesUpdated = 0

  // Palette for new main categories
  const defaultColors = [
    '#2563EB',
    '#EC4899',
    '#8B5CF6',
    '#F59E0B',
    '#10B981',
    '#06B6D4',
    '#6366F1',
    '#F97316',
    '#14B8A6',
    '#84CC16',
    '#64748B',
  ]

  // Track map of normalized main category names to category records
  const mainMap = new Map<string, Category>()
  currentCategories
    .filter((c) => c.type === 'main')
    .forEach((c) => {
      mainMap.set(norm(c.name), c)
    })

  // Map of subcategories: key `${parentNorm}::${subNorm}` -> Category
  const subMap = new Map<string, Category>()
  currentCategories
    .filter((c) => c.type === 'sub')
    .forEach((c) => {
      const parent = currentCategories.find((p) => p.id === c.parent)
      const parentKey = parent ? norm(parent.name) : 'none'
      subMap.set(`${parentKey}::${norm(c.name)}`, c)
      // Also map bare sub name for fallback
      if (!subMap.has(`none::${norm(c.name)}`)) {
        subMap.set(`none::${norm(c.name)}`, c)
      }
    })

  // Subcategorias conhecidas de Investimentos
  const INVESTMENT_SUBCATEGORY_NAMES = [
    'investimentos',
    'degiro',
    'consorcio',
    'outrosinvestimentos',
  ]

  // Process all sections
  for (const section of params.sections) {
    let effectiveSectionName = section.name
    let secNorm = norm(effectiveSectionName)
    let mainCat = mainMap.get(secNorm)

    if (!mainCat) {
      // Create main category with standard styling
      const isInvestMain = secNorm === 'investimentos'
      const color = isInvestMain ? '#059669' : defaultColors[mainMap.size % defaultColors.length]
      const icon = isInvestMain ? 'TrendingUp' : undefined

      mainCat = await createCategory({
        name: isInvestMain ? 'Investimentos' : section.name,
        type: 'main',
        color,
        icon,
        estimated: 0,
      })
      mainMap.set(secNorm, mainCat)
      mainCategoriesCreated++
    }

    // Process each subcategory in section
    for (const item of section.items) {
      const itemNorm = norm(item.name)
      // Se a subcategoria for de investimentos, garantir que a categoria mãe seja Investimentos
      let targetMainCat = mainCat
      let effectiveSecNorm = secNorm

      if (INVESTMENT_SUBCATEGORY_NAMES.includes(itemNorm)) {
        let investMain = mainMap.get('investimentos')
        if (!investMain) {
          investMain = await createCategory({
            name: 'Investimentos',
            type: 'main',
            color: '#059669',
            icon: 'TrendingUp',
            estimated: 0,
          })
          mainMap.set('investimentos', investMain)
          mainCategoriesCreated++
        }
        targetMainCat = investMain
        effectiveSecNorm = 'investimentos'
      }

      const subKey = `${effectiveSecNorm}::${itemNorm}`
      let subCat = subMap.get(subKey) || subMap.get(`none::${itemNorm}`)

      if (!subCat) {
        // Create subcategory
        subCat = await createCategory({
          name: item.name,
          type: 'sub',
          parent: targetMainCat.id,
          estimated: item.estimated || 0,
          color: targetMainCat.color,
        })
        subMap.set(subKey, subCat)
        subCategoriesCreated++
      } else {
        // Update estimated if provided (> 0)
        let needsUpdate = false
        const updateData: Partial<Category> = {}

        if (item.estimated > 0 && subCat.estimated !== item.estimated) {
          updateData.estimated = item.estimated
          needsUpdate = true
        }

        // Ensure parent is linked correctly to the appropriate main category
        if (!subCat.parent || subCat.parent !== targetMainCat.id) {
          updateData.parent = targetMainCat.id
          if (targetMainCat.color) {
            updateData.color = targetMainCat.color
          }
          needsUpdate = true
        }

        if (needsUpdate) {
          subCat = await updateCategory(subCat.id, updateData)
          categoriesUpdated++
        }
      }
    }
  }

  // 2. Format months to YYYY-MM
  const targetMonths = params.monthsToImport.map(
    (m) => `${params.year}-${String(m).padStart(2, '0')}`,
  )

  // 3. If replaceExisting, delete existing imported transactions for these months
  let transactionsDeleted = 0
  if (params.replaceExisting) {
    for (const monthStr of targetMonths) {
      const existing = await pb.collection('transactions').getFullList({
        filter: `user='${userId}' && source='importado' && month='${monthStr}'`,
      })
      for (const tx of existing) {
        try {
          await pb.collection('transactions').delete(tx.id)
          transactionsDeleted++
        } catch (e) {
          console.error('Erro ao deletar transação antiga:', e)
        }
      }
    }
  }

  // 4. Build historical transactions to insert
  const toInsert: Array<{
    date: string
    description: string
    amount: number
    category?: string
    source: 'importado'
    month: string
  }> = []

  for (const section of params.sections) {
    const secNorm = norm(section.name)
    for (const item of section.items) {
      const itemNorm = norm(item.name)
      const isInvest = INVESTMENT_SUBCATEGORY_NAMES.includes(itemNorm)
      const effectiveSec = isInvest ? 'investimentos' : secNorm
      const subCat =
        subMap.get(`${effectiveSec}::${itemNorm}`) ||
        subMap.get(`${secNorm}::${itemNorm}`) ||
        subMap.get(`none::${itemNorm}`)

      Object.entries(item.monthlyValues).forEach(([mIdxStr, val]) => {
        const mIdx = parseInt(mIdxStr, 10)
        if (params.monthsToImport.includes(mIdx) && val > 0) {
          const monthStr = `${params.year}-${String(mIdx).padStart(2, '0')}`
          const dateStr = `${monthStr}-01`

          toInsert.push({
            date: dateStr,
            description: `${item.name} (importado da planilha)`,
            amount: val, // Saved in EUR (app currency)
            category: subCat?.id,
            source: 'importado',
            month: monthStr,
          })
        }
      })
    }
  }

  // 5. Batch insert transactions
  const transactionsCreated = await createTransactionsBatch(toInsert)

  return {
    mainCategoriesCreated,
    subCategoriesCreated,
    categoriesUpdated,
    transactionsCreated,
    transactionsDeleted,
  }
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
