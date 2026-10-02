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
      return e.json(200, {
        markdown: markdown || '',
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
  $apis.requireAuth(),
)
