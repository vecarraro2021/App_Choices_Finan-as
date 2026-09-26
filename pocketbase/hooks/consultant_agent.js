// pocketbase/hooks/consultant_agent.js
// Endpoints dedicados para o agente nativo "Consultor de Planejamento Financeiro"
// Isolamento por usuário autenticado (e.auth.id)

routerAdd(
  'POST',
  '/backend/v1/consultor/chat',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (!message) return e.badRequestError('message is required')

      const conversationId = body.conversation_id || null
      const title = body.title || (message.length > 40 ? message.slice(0, 37) + '...' : message)

      const conv = $ai.agent('consultor-financeiro').getOrCreateConversation({
        user_id: userId,
        id: conversationId,
        title: title,
      })

      const iter = $ai.agent('consultor-financeiro').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)
      $response.stream(e, iter)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha na requisição ao consultor' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'IA temporariamente indisponível' : err.message,
        })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/consultor/conversations',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')
      const limit = parseInt(e.requestInfo().query?.limit || '50', 10) || 50

      const result = $ai.agent('consultor-financeiro').listConversations({
        user_id: userId,
        limit: limit,
      })

      return e.json(200, result)
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Erro ao listar conversas' : err.message,
        })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/consultor/conversations/{conversationId}/messages',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')
      const convId = e.request.pathValue('conversationId')
      if (!convId) return e.badRequestError('conversationId required')

      const result = $ai.agent('consultor-financeiro').listMessages({
        conversation_id: convId,
        user_id: userId,
      })

      return e.json(200, result)
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Erro ao carregar mensagens' : err.message,
        })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
