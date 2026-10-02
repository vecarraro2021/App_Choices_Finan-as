routerAdd(
  'POST',
  '/backend/v1/documentos/convert-pdf',
  (e) => {
    const files = e.findUploadedFiles('arquivo')
    if (!files || files.length === 0) {
      throw new BadRequestError('Envie um arquivo PDF para conversão')
    }

    try {
      const { markdown, truncated } = $documents.toMarkdown({ file: files[0] })
      const mdStr = markdown || ''
      console.log('[convert_pdf] Arquivo:', files[0].originalName || files[0].name, 'Tamanho markdown:', mdStr.length)
      console.log('[convert_pdf] Amostra markdown (primeiros 500 chars):', mdStr.slice(0, 500))
      return e.json(200, {
        markdown: mdStr,
        truncated: Boolean(truncated),
      })
    } catch (err) {
      if (err && err.status === 422) {
        throw new BadRequestError(
          err.message ||
            'Não foi possível extrair texto deste PDF (pode ser digitalizado como imagem sem camada de texto ou protegido).',
        )
      }
      throw err
    }
  },
)

routerAdd(
  'POST',
  '/backend/v1/documentos/echo-markdown',
  (e) => {
    try {
      const files = e.findUploadedFiles('arquivo')
      if (!files || files.length === 0) {
        throw new BadRequestError('Nenhum arquivo enviado')
      }
      const { markdown, truncated } = $documents.toMarkdown({ file: files[0] })
      console.log('=== [ECHO-MARKDOWN FULL OUTPUT START] ===')
      console.log(markdown)
      console.log('=== [ECHO-MARKDOWN FULL OUTPUT END] ===')
      return e.json(200, {
        markdown,
        truncated,
      })
    } catch (err) {
      console.log('=== [ECHO-MARKDOWN ERROR] ===', err)
      return e.json(500, { error: String(err) })
    }
  },
)
