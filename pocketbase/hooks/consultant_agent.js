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
      const attachmentIds = Array.isArray(body.attachment_ids) ? body.attachment_ids : []
      if (!message && attachmentIds.length === 0) {
        return e.badRequestError('message is required')
      }

      const conversationId = body.conversation_id || null
      const title = body.title || (message.length > 40 ? message.slice(0, 37) + '...' : message)

      const conv = $ai.agent('consultor-financeiro').getOrCreateConversation({
        user_id: userId,
        id: conversationId,
        title: title,
      })

      // Buscar diagnóstico mais recente do usuário para injetar no contexto da mensagem se relevante
      let effectiveMessage = message
      try {
        const diagnostics = $app.findRecordsByFilter(
          'diagnostics',
          `owner = '${userId}'`,
          '-version,-created',
          1,
          0,
        )
        if (diagnostics.length > 0) {
          const latestDiag = diagnostics[0]
          const summaryText = latestDiag.getString('summary')
          const scoreGeral = latestDiag.getInt('overall_score')
          const scoreControle = latestDiag.getInt('score_controle')
          const scoreChoques = latestDiag.getInt('score_choques')
          const scoreMetas = latestDiag.getInt('score_metas')
          const scoreDividas = latestDiag.getInt('score_dividas')
          const scoreClareza = latestDiag.getInt('score_clareza')

          const diagContext = `[Contexto da Bússola Financeira do Usuário: Score Geral ${scoreGeral}/100. Dimensões: Controle=${scoreControle}, Choques/Reserva=${scoreChoques}, Metas=${scoreMetas}, Dívidas=${scoreDividas}, Clareza=${scoreClareza}. ${summaryText ? 'Resumo: ' + summaryText : ''}]\n\n`
          effectiveMessage = diagContext + message
        }
      } catch (diagErr) {
        // Silenciosamente prossegue se não encontrar ou se houver erro
      }

      // Anexos: extrair texto de PDFs com $documents.toMarkdown (pipeline existente)
      // e injetar no contexto da mensagem enviada ao agente.
      const attachmentsMeta = []
      if (attachmentIds.length > 0) {
        const MAX_ATTACHMENTS = 3
        if (attachmentIds.length > MAX_ATTACHMENTS) {
          return e.badRequestError('Máximo de ' + MAX_ATTACHMENTS + ' anexos por mensagem')
        }

        const attachmentBlocks = []
        for (let i = 0; i < attachmentIds.length; i++) {
          const attId = attachmentIds[i]
          let rec
          try {
            rec = $app.findRecordById('consultor_attachments', attId)
          } catch (_) {
            continue
          }
          // Isolamento: só pode usar anexo do próprio usuário
          if (rec.getString('owner') !== userId) continue

          attachmentsMeta.push({
            id: rec.id,
            file_name: rec.getString('file_name'),
            kind: rec.getString('kind'),
          })

          const kind = rec.getString('kind')
          if (kind !== 'pdf') continue // imagens: modelo atual não consome imagem; arquivo fica salvo e visível

          // Reaproveita o mesmo pipeline de conversão de PDF da importação de
          // extratos/faturas ($documents.toMarkdown, ver hooks/convert_pdf.js):
          // abre o arquivo do storage, converte e injeta o texto no contexto.
          let fsys = null
          let reader = null
          try {
            const fileKey = rec.baseFilesPath() + '/' + rec.getString('file')
            fsys = $app.newFilesystem()
            reader = fsys.getReader(fileKey)
            const mpf = $filesystem.fileFromMultipart(toString(reader))
            const { markdown, truncated } = $documents.toMarkdown({ file: mpf })
            const mdStr = (markdown || '').trim()
            if (mdStr.length > 0) {
              const header =
                '[Conteúdo do arquivo anexado: ' +
                (rec.getString('file_name') || 'documento.pdf') +
                (truncated ? ' — texto truncado por tamanho' : '') +
                ']\n'
              attachmentBlocks.push(header + mdStr.slice(0, 60000))
            } else {
              attachmentBlocks.push(
                '[Arquivo anexado: ' +
                  (rec.getString('file_name') || 'documento.pdf') +
                  ' — o arquivo não tem texto extraível. Informe o usuário que você recebeu o arquivo mas não conseguiu ler o conteúdo dele.]',
              )
            }
          } catch (pdfErr) {
            const status = pdfErr && pdfErr.status
            if (status === 422) {
              attachmentBlocks.push(
                '[Arquivo anexado: ' +
                  (rec.getString('file_name') || 'documento.pdf') +
                  ' — não foi possível extrair texto (PDF pode ser digitalizado/imagem sem camada de texto). Informe o usuário que você recebeu o arquivo mas não conseguiu ler o conteúdo dele.]',
              )
            } else {
              console.log('[consultor_agent] Falha ao converter PDF anexado:', pdfErr)
              attachmentBlocks.push(
                '[Arquivo anexado: ' +
                  (rec.getString('file_name') || 'documento.pdf') +
                  ' — não foi possível extrair o texto. Informe o usuário que você recebeu o arquivo mas não conseguiu ler o conteúdo dele.]',
              )
            }
          } finally {
            try {
              if (reader) reader.close()
            } catch (_) {}
            try {
              if (fsys) fsys.close()
            } catch (_) {}
          }
        }

        if (attachmentBlocks.length > 0) {
          effectiveMessage =
            effectiveMessage +
            (effectiveMessage ? '\n\n' : '') +
            attachmentBlocks.join('\n\n---\n\n')
        }
      }

      // Atualiza os registros de anexos com o message_id da conversa
      // (não temos o id da mensagem do usuário antes do chat; faremos após,
      // no GET de messages, casando por conversation_id — ver abaixo).

      const iter = $ai.agent('consultor-financeiro').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: effectiveMessage,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)
      e.response.header().set('X-Attachment-Ids', attachmentIds.join(','))
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

      // Anexos da conversa (para exibir chips/miniaturas no histórico).
      // Como message_id não é conhecido no upload, casamos por conversation_id
      // e cada usuário associa os anexos dele às mensagens dele na ordem.
      let attachments = []
      try {
        const attRecords = $app.findRecordsByFilter(
          'consultor_attachments',
          `owner = '${userId}' && conversation_id = '${convId}'`,
          '-created',
          50,
          0,
        )
        attachments = attRecords.map((r) => ({
          id: r.id,
          file_name: r.getString('file_name'),
          mime_type: r.getString('mime_type'),
          kind: r.getString('kind'),
          file: r.getString('file'),
          created: r.getString('created'),
        }))
      } catch (attErr) {
        console.log('[consultor_agent] Erro ao buscar anexos da conversa:', attErr)
      }

      return e.json(200, { ...result, attachments })
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

// Upload de anexo (PDF ou imagem) para a conversa do consultor.
// O arquivo é salvo na coleção consultor_attachments, com owner do usuário logado.
routerAdd(
  'POST',
  '/backend/v1/consultor/attachments',
  (e) => {
    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')

    try {
      const body = e.requestInfo().body || {}
      const files = e.findUploadedFiles('file')
      if (!files || files.length === 0) {
        return e.badRequestError('Envie um arquivo (PDF ou imagem)')
      }
      const f = files[0]
      const mime = f.type || ''
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      if (allowed.indexOf(mime) === -1) {
        return e.badRequestError('Tipo de arquivo não suportado. Envie PDF, JPG, PNG ou WEBP.')
      }
      if (f.size > 10 * 1024 * 1024) {
        return e.badRequestError('Arquivo muito grande. O limite é 10 MB.')
      }

      const kind = mime === 'application/pdf' ? 'pdf' : 'image'
      const fileName = f.originalName || f.name || (kind === 'pdf' ? 'documento.pdf' : 'imagem')
      const collection = $app.findCollectionByNameOrId('consultor_attachments')

      const rec = new Record(collection)
      rec.set('owner', userId)
      rec.set(
        'conversation_id',
        typeof body.conversation_id === 'string' ? body.conversation_id : '',
      )
      rec.set('file_name', fileName)
      rec.set('mime_type', mime)
      rec.set('kind', kind)
      rec.set('file', f)
      $app.save(rec)

      return e.json(200, {
        id: rec.id,
        file_name: rec.getString('file_name'),
        mime_type: mime,
        kind: kind,
        file: rec.getString('file'),
        size: f.size,
        created: rec.getString('created'),
      })
    } catch (err) {
      console.log('[consultor_agent] Erro no upload de anexo:', err)
      return e.json(500, { error: 'Não foi possível salvar o anexo. Tente novamente.' })
    }
  },
  $apis.requireAuth(),
)
