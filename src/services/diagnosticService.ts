import pb from '@/lib/pocketbase/client'
import { DiagnosticRecord } from '@/types/finance'
import { calculateDiagnosticScores, generateDiagnosticSummary } from '@/lib/diagnosticEngine'

export interface SaveDiagnosticParams {
  ownerId?: string
  answers: Record<number | string, number>
}

/**
 * Salva um novo preenchimento do diagnóstico para o usuário autenticado.
 * Calcula automaticamente a próxima versão incremental do usuário.
 */
export async function saveDiagnostic(params: SaveDiagnosticParams): Promise<DiagnosticRecord> {
  const currentUserId = params.ownerId || pb.authStore.record?.id
  if (!currentUserId) {
    throw new Error('Usuário autenticado obrigatório para salvar o diagnóstico')
  }

  // 1. Descobrir a última versão do usuário
  let nextVersion = 1
  try {
    const latestList = await pb.collection('diagnostics').getList<DiagnosticRecord>(1, 1, {
      filter: `owner = '${currentUserId}'`,
      sort: '-version',
    })
    if (latestList.items.length > 0 && latestList.items[0].version) {
      nextVersion = Number(latestList.items[0].version) + 1
    }
  } catch (err) {
    console.warn('Erro ao consultar versão anterior de diagnostics:', err)
  }

  // 2. Calcular scores e resumo
  const scores = calculateDiagnosticScores(params.answers)
  const summary = generateDiagnosticSummary(scores, params.answers)

  // 3. Montar payload de respostas (chaves string)
  const answersPayload: Record<string, number> = {}
  for (const [k, v] of Object.entries(params.answers)) {
    answersPayload[String(k)] = Number(v)
  }

  const recordData = {
    owner: currentUserId,
    answers: answersPayload,
    score_controle: scores.score_controle,
    score_choques: scores.score_choques,
    score_metas: scores.score_metas,
    score_dividas: scores.score_dividas,
    score_clareza: scores.score_clareza,
    overall_score: scores.overall_score,
    summary,
    version: nextVersion,
  }

  const saved = await pb.collection('diagnostics').create<DiagnosticRecord>(recordData)
  return saved
}

/**
 * Retorna o diagnóstico mais recente do usuário autenticado (ou null se nunca preencheu).
 */
export async function getLatestDiagnostic(userId?: string): Promise<DiagnosticRecord | null> {
  const targetUser = userId || pb.authStore.record?.id
  if (!targetUser) return null

  try {
    const list = await pb.collection('diagnostics').getList<DiagnosticRecord>(1, 1, {
      filter: `owner = '${targetUser}'`,
      sort: '-version,-created',
    })
    if (list.items.length > 0) {
      return list.items[0]
    }
    return null
  } catch (err) {
    console.warn('Erro ao buscar último diagnóstico:', err)
    return null
  }
}

/**
 * Retorna o histórico completo de diagnósticos do usuário, do mais recente para o mais antigo.
 */
export async function getDiagnosticHistory(userId?: string): Promise<DiagnosticRecord[]> {
  const targetUser = userId || pb.authStore.record?.id
  if (!targetUser) return []

  try {
    const list = await pb.collection('diagnostics').getFullList<DiagnosticRecord>({
      filter: `owner = '${targetUser}'`,
      sort: '-version,-created',
    })
    return list
  } catch (err) {
    console.warn('Erro ao listar histórico de diagnósticos:', err)
    return []
  }
}
