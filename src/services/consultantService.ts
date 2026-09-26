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
  return displayableMessages(rawMessages)
}

export async function sendConsultantMessage({
  message,
  conversationId,
  title,
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
