routerAdd(
  'POST',
  '/backend/v1/ai/learn-rule',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) {
        return e.unauthorizedError('auth required')
      }

      const body = e.requestInfo().body || {}
      const pattern = (body.pattern || '').trim()
      const categoryId = (body.categoryId || '').trim()

      if (!pattern || !categoryId) {
        return e.badRequestError('pattern and categoryId are required')
      }

      // Verificar se categoria existe
      try {
        $app.findRecordById('categories', categoryId)
      } catch (_) {
        return e.badRequestError('category not found')
      }

      const patternLower = pattern.toLowerCase()
      const collection = $app.findCollectionByNameOrId('category_rules')

      // Verificar se já existe uma regra igual para este usuário
      let existingRecord = null
      try {
        const records = $app.findRecordsByFilter(
          'category_rules',
          "user = '" + userId + "' && pattern = '" + patternLower.replace(/'/g, "\\'") + "'",
          '-created',
          1,
          0,
        )
        if (records && records.length > 0) {
          existingRecord = records[0]
        }
      } catch (_) {}

      if (existingRecord) {
        existingRecord.set('category', categoryId)
        existingRecord.set('source', body.source || 'user_confirmed')
        $app.save(existingRecord)
        return e.json(200, {
          success: true,
          action: 'updated',
          ruleId: existingRecord.id,
        })
      }

      const newRecord = new Record(collection)
      newRecord.set('user', userId)
      newRecord.set('pattern', patternLower)
      newRecord.set('category', categoryId)
      newRecord.set('source', body.source || 'user_confirmed')
      $app.save(newRecord)

      return e.json(200, {
        success: true,
        action: 'created',
        ruleId: newRecord.id,
      })
    } catch (err) {
      console.log('Erro ao salvar regra aprendida:', err.message)
      return e.json(500, { error: err.message || 'Erro ao salvar padrão' })
    }
  },
  $apis.requireAuth(),
)
