routerAdd(
  'POST',
  '/backend/v1/documentos/convert-sheet',
  (e) => {
    const files = e.findUploadedFiles('arquivo')
    if (!files || files.length === 0) {
      throw new BadRequestError('Envie um arquivo para conversão')
    }

    try {
      const { markdown, truncated } = $documents.toMarkdown({ file: files[0] })
      return e.json(200, { markdown: markdown, truncated: truncated })
    } catch (err) {
      if (err && err.status === 422) {
        throw new BadRequestError(err.message || 'Não foi possível extrair o texto da planilha')
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
