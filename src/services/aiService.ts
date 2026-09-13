import pb from '@/lib/pocketbase/client'

export interface CategorySuggestion {
  categoryId: string
  categoryName: string
  confidence: 'alta' | 'provavel' | 'possivel'
  reason?: string
}

export interface CategorizeResultItem {
  id: string
  description: string
  chosenCategoryId: string | null
  confidence: 'alta' | 'provavel' | 'possivel' | 'baixa'
  source: 'aprendido' | 'ia' | 'manual'
  needsHelp: boolean
  suggestions: CategorySuggestion[]
  error?: string
}

export interface CategorizeBatchResponse {
  results: CategorizeResultItem[]
  total: number
  needsHelpCount: number
}

export interface CategoryRule {
  id: string
  user: string
  pattern: string
  category: string
  source?: string
  created: string
  updated: string
  expand?: {
    category?: {
      id: string
      name: string
    }
  }
}

/**
 * Consulta o backend para categorização assistida por IA.
 * Avalia regras aprendidas e consulta o modelo nativo com a árvore de categorias.
 */
export async function categorizeTransactionsWithAI(
  items: Array<{ id: string; description: string; amount?: number }>,
): Promise<CategorizeBatchResponse> {
  if (!items || items.length === 0) {
    return { results: [], total: 0, needsHelpCount: 0 }
  }

  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  const res = await fetch(`${baseUrl}/backend/v1/ai/categorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ items }),
  })

  if (!res.ok) {
    let errorMsg = `Erro ${res.status} ao categorizar com IA`
    try {
      const errJson = await res.json()
      if (errJson.error) errorMsg = errJson.error
    } catch {
      /* intentionally ignored */
    }
    throw new Error(errorMsg)
  }

  return (await res.json()) as CategorizeBatchResponse
}

/**
 * Registra um padrão de aprendizado para que futuras importações reconheçam a categoria automaticamente.
 */
export async function learnCategoryRule(
  pattern: string,
  categoryId: string,
  source = 'user_confirmed',
): Promise<{ success: boolean; ruleId?: string }> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  const res = await fetch(`${baseUrl}/backend/v1/ai/learn-rule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      pattern,
      categoryId,
      source,
    }),
  })

  if (!res.ok) {
    let errorMsg = `Erro ao salvar regra aprendida`
    try {
      const errJson = await res.json()
      if (errJson.error) errorMsg = errJson.error
    } catch {
      /* intentionally ignored */
    }
    throw new Error(errorMsg)
  }

  return await res.json()
}

/**
 * Lista as regras aprendidas pelo usuário.
 */
export async function getLearnedRules(): Promise<CategoryRule[]> {
  try {
    const records = await pb.collection('category_rules').getFullList<CategoryRule>({
      sort: '-created',
      expand: 'category',
    })
    return records
  } catch (err) {
    console.warn('Não foi possível carregar regras aprendidas:', err)
    return []
  }
}

/**
 * Envia mensagem para o Assistente Financeiro nativo Skip Cloud.
 */
export async function sendAssistantChatMessage(
  message: string,
  conversationId?: string | null,
): Promise<{
  conversation_id: string
  content: string
  citations?: any[]
  message_id: string
  tool_calls?: any[]
}> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  const res = await fetch(`${baseUrl}/backend/v1/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId || null,
    }),
  })

  if (!res.ok) {
    let errorMsg = 'Falha ao comunicar com assistente'
    try {
      const errJson = await res.json()
      if (errJson.error) errorMsg = errJson.error
    } catch {
      /* intentionally ignored */
    }
    throw new Error(errorMsg)
  }

  return await res.json()
}
