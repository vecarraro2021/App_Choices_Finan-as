import pb from '@/lib/pocketbase/client'
import {
  streamAgentChat,
  displayableMessages,
  type AgentMessage,
  type DisplayMessage,
  type StreamAgentChatHandlers,
  type StreamAgentChatResult,
} from '@/lib/skipAi'

export interface AgentConversationItem {
  id: string
  title?: string
  created: string
  updated: string
  last_message_at?: string
}

export interface SendMessageOptions {
  message: string
  conversationId?: string | null
  title?: string
  handlers?: StreamAgentChatHandlers
  signal?: AbortSignal
  /** Ids (PocketBase) dos anexos já enviados para /consultor/attachments */
  attachmentIds?: string[]
}

export interface ConsultantAttachment {
  id: string
  file_name: string
  mime_type: string
  kind: 'pdf' | 'image'
  /** nome do arquivo salvo no storage do PocketBase (para montar a URL) */
  file: string
  size?: number
  created?: string
}

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_POCKETBASE_URL
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl
  }
  return ''
}

export async function listConsultantConversations(): Promise<AgentConversationItem[]> {
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/backend/v1/consultor/conversations`, {
    headers: {
      Authorization: pb.authStore.token || '',
    },
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `Erro ao carregar conversas (${res.status})`)
  }
  const data = await res.json()
  return data.conversations || data.items || data || []
}

export async function listConsultantMessages(conversationId: string): Promise<DisplayMessage[]> {
  const baseUrl = getBaseUrl()
  const res = await fetch(
    `${baseUrl}/backend/v1/consultor/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      headers: {
        Authorization: pb.authStore.token || '',
      },
    },
  )
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `Erro ao carregar histórico (${res.status})`)
  }
  const payload = await res.json()
  const rawMessages: AgentMessage[] = payload.messages || []
  const display = displayableMessages(rawMessages)

  // Anexos da conversa (PDF/imagens) — casados por conversation_id no backend.
  // Cada usuário vê apenas os anexos dele (regra da coleção), e as mensagens
  // do usuário aparecem na ordem do histórico: associa na mesma sequência.
  const rawAttachments: Array<{
    id: string
    file_name: string
    mime_type: string
    kind: string
    file: string
    created: string
  }> = payload.attachments || []

  if (rawAttachments.length > 0) {
    let attIdx = 0
    for (const m of display) {
      if (m.role !== 'user') continue
      if (attIdx >= rawAttachments.length) break
      const att = rawAttachments[attIdx]
      m.attachments = [att]
      attIdx += 1
    }
  }

  return display
}

/** Envia um arquivo (PDF ou imagem) para a coleção consultor_attachments. */
export async function uploadConsultantAttachment(
  file: File,
  conversationId: string | null,
): Promise<ConsultantAttachment> {
  const baseUrl = getBaseUrl()
  const formData = new FormData()
  formData.append('file', file, file.name)
  if (conversationId) {
    formData.append('conversation_id', conversationId)
  }
  const res = await fetch(`${baseUrl}/backend/v1/consultor/attachments`, {
    method: 'POST',
    headers: {
      Authorization: pb.authStore.token || '',
    },
    body: formData,
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `Erro ao enviar anexo (${res.status})`)
  }
  return (await res.json()) as ConsultantAttachment
}

export async function sendConsultantMessage({
  message,
  conversationId,
  title,
  attachmentIds,
  handlers = {},
  signal,
}: SendMessageOptions): Promise<StreamAgentChatResult & { conversationId: string }> {
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/backend/v1/consultor/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token || '',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId || null,
      title: title || undefined,
      attachment_ids: attachmentIds && attachmentIds.length > 0 ? attachmentIds : undefined,
    }),
    signal,
  })

  const headerConvId = res.headers.get('X-Conversation-Id')

  const result = await streamAgentChat(res, {
    ...handlers,
    signal,
  })

  const finalConvId = headerConvId || result.conversation_id || conversationId || ''

  return {
    ...result,
    conversationId: finalConvId,
  }
}
