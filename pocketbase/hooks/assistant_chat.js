routerAdd(
  'POST',
  '/backend/v1/assistant/chat',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) {
        return e.unauthorizedError('auth required')
      }

      const body = e.requestInfo().body || {}
      const message = (body.message || '').trim()
      if (!message) {
        return e.badRequestError('message is required')
      }

      const conversationId = body.conversation_id || null

      const result = $ai.agent('finance-assistant').chat({
        user_id: userId,
        conversation_id: conversationId,
        message: message,
      })

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations,
        message_id: result.message_id,
        tool_calls: result.tool_calls,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Assistente de IA indisponível no momento' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha na chamada do assistente' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'IA temporariamente indisponível' : err.message,
        })
      }
      console.log('Erro no chat do assistente:', err.message)
      return e.json(500, { error: 'Falha ao processar mensagem do assistente' })
    }
  },
  $apis.requireAuth(),
)
