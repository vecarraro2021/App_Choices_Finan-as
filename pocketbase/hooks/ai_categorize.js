routerAdd(
  'POST',
  '/backend/v1/ai/categorize',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) {
        return e.unauthorizedError('auth required')
      }

      const body = e.requestInfo().body || {}
      const items = Array.isArray(body.items) ? body.items : []
      if (items.length === 0) {
        return e.badRequestError('items array is required')
      }

      // 1. Carregar regras de aprendizado do usuário para enriquecer
      const rulesRecords = $app.findRecordsByFilter(
        'category_rules',
        "user = '" + userId + "'",
        '-created',
        200,
        0,
      )
      const learnedRules = rulesRecords.map((r) => ({
        pattern: (r.getString('pattern') || '').toLowerCase().trim(),
        categoryId: r.getString('category'),
      }))

      // 2. Carregar categorias da árvore
      const catRecords = $app.findRecordsByFilter('categories', '1=1', 'type,name', 200, 0)
      const categoriesMap = {}
      const categoriesList = catRecords.map((c) => {
        const id = c.id
        const name = c.getString('name')
        const type = c.getString('type')
        const parent = c.getString('parent')
        categoriesMap[id] = { id, name, type, parent }
        return { id, name, type, parent }
      })

      // Montar mapa com nome legível (ex: "Moradia > Aluguel" ou "Transporte > Uber / Táxi")
      const formattedCategories = categoriesList.map((c) => {
        if (c.type === 'sub' && c.parent && categoriesMap[c.parent]) {
          return {
            id: c.id,
            name: c.name,
            fullName: categoriesMap[c.parent].name + ' > ' + c.name,
            type: c.type,
          }
        }
        return {
          id: c.id,
          name: c.name,
          fullName: c.name,
          type: c.type,
        }
      })

      // 3. Processar itens
      const results = []
      const pendingForAi = []

      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const itemId = it.id || 'item-' + i
        const desc = (it.description || '').trim()
        const descLower = desc.toLowerCase()

        // Verificar primeiro se casa exatamente com uma regra aprendida
        let matchedRule = null
        for (let r = 0; r < learnedRules.length; r++) {
          const pattern = learnedRules[r].pattern
          if (pattern && (descLower === pattern || descLower.includes(pattern))) {
            matchedRule = learnedRules[r]
            break
          }
        }

        if (matchedRule && categoriesMap[matchedRule.categoryId]) {
          results.push({
            id: itemId,
            description: desc,
            chosenCategoryId: matchedRule.categoryId,
            confidence: 'alta',
            source: 'aprendido',
            needsHelp: false,
            suggestions: [
              {
                categoryId: matchedRule.categoryId,
                categoryName: categoriesMap[matchedRule.categoryId].name,
                confidence: 'alta',
                reason: 'Padrão confirmado anteriormente por você',
              },
            ],
          })
        } else {
          pendingForAi.push({
            indexInResults: results.length,
            id: itemId,
            description: desc,
            amount: it.amount,
          })
          results.push(null) // placeholder para preencher depois
        }
      }

      // Se temos itens para a IA classificar
      if (pendingForAi.length > 0) {
        // Formatar lista de categorias para o prompt
        const catCatalog = formattedCategories
          .map((c) => '- ID: ' + c.id + ' | Nome: ' + c.fullName)
          .join('\n')

        const itemsToClassify = pendingForAi
          .map(
            (p, idx) =>
              idx +
              1 +
              '. ID_ITEM: ' +
              p.id +
              ' | Descrição: "' +
              p.description +
              '"' +
              (p.amount ? ' | Valor: R$ ' + p.amount : ''),
          )
          .join('\n')

        const systemPrompt = `Você é um classificador financeiro de precisão para despesas pessoais no Brasil.
Seu objetivo é sugerir a melhor categoria ou subcategoria da árvore cadastrada para cada item da lista.

Árvore de Categorias disponíveis:
${catCatalog}

Regras estritas:
1. Responda APENAS com um objeto JSON válido, sem texto antes ou depois.
2. Formato esperado:
{
  "classifications": [
    {
      "id": "ID_ITEM",
      "suggestions": [
        { "categoryId": "ID_CATEGORIA", "confidence": "provavel" | "possivel", "reason": "motivo curto" }
      ],
      "needsHelp": true | false
    }
  ]
}
3. 'suggestions': lista de 1 a 3 opções ordenadas pela melhor correspondência. Use APENAS IDs reais da lista de categorias fornecida acima. Dê preferência a subcategorias em vez de categorias principais gerais.
4. Se a descrição for genérica demais, irreconhecível, ou não houver nenhuma correspondência plausível com confiança razoável (por exemplo "DOC", "PAGAMENTO 123", siglas aleatórias ou termos ambíguos), marque 'needsHelp': true e você pode enviar sugestões estimadas ou vazias se realmente não souber.
5. Se tiver boa confiança de onde encaixar (ex: "DROGASIL", "POSTO IPIRANGA", "UBER TRIP"), 'needsHelp' deve ser false e a primeira sugestão terá confidence 'provavel'.`

        try {
          const aiResponse = $ai.chat({
            model: 'fast',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: 'Classifique os seguintes lançamentos bancários:\n\n' + itemsToClassify,
              },
            ],
          })

          const rawContent = aiResponse.choices?.[0]?.message?.content || '{}'
          let parsed = { classifications: [] }
          try {
            // Limpar possíveis blocos markdown ```json
            let cleaned = rawContent.trim()
            if (cleaned.startsWith('```json')) {
              cleaned = cleaned.slice(7)
            } else if (cleaned.startsWith('```')) {
              cleaned = cleaned.slice(3)
            }
            if (cleaned.endsWith('```')) {
              cleaned = cleaned.slice(0, -3)
            }
            parsed = JSON.parse(cleaned.trim())
          } catch (jsonErr) {
            console.log(
              'Erro ao interpretar JSON da IA:',
              jsonErr.message,
              'Conteúdo bruto:',
              rawContent,
            )
          }

          const classMap = {}
          if (Array.isArray(parsed.classifications)) {
            for (let k = 0; k < parsed.classifications.length; k++) {
              const c = parsed.classifications[k]
              if (c && c.id) {
                classMap[c.id] = c
              }
            }
          }

          for (let p = 0; p < pendingForAi.length; p++) {
            const pend = pendingForAi[p]
            const aiItem = classMap[pend.id]
            const rawSuggestions =
              aiItem && Array.isArray(aiItem.suggestions) ? aiItem.suggestions : []

            // Filtrar apenas categorias válidas existentes
            const validSuggestions = []
            for (let s = 0; s < rawSuggestions.length; s++) {
              const sug = rawSuggestions[s]
              if (sug && sug.categoryId && categoriesMap[sug.categoryId]) {
                validSuggestions.push({
                  categoryId: sug.categoryId,
                  categoryName: categoriesMap[sug.categoryId].name,
                  confidence: sug.confidence === 'provavel' ? 'provavel' : 'possivel',
                  reason: sug.reason || '',
                })
              }
            }

            const needsHelp = aiItem?.needsHelp === true || validSuggestions.length === 0
            const primaryCat =
              validSuggestions.length > 0 && !needsHelp ? validSuggestions[0].categoryId : null

            results[pend.indexInResults] = {
              id: pend.id,
              description: pend.description,
              chosenCategoryId: primaryCat,
              confidence: validSuggestions.length > 0 ? validSuggestions[0].confidence : 'baixa',
              source: 'ia',
              needsHelp: needsHelp,
              suggestions: validSuggestions,
            }
          }
        } catch (aiErr) {
          console.log('Erro na chamada de IA para categorização:', aiErr.message)
          // Fallback gracioso para todos os pendentes
          for (let p = 0; p < pendingForAi.length; p++) {
            const pend = pendingForAi[p]
            results[pend.indexInResults] = {
              id: pend.id,
              description: pend.description,
              chosenCategoryId: null,
              confidence: 'baixa',
              source: 'manual',
              needsHelp: true,
              suggestions: [],
              error: 'IA indisponível no momento',
            }
          }
        }
      }

      return e.json(200, {
        results: results,
        total: results.length,
        needsHelpCount: results.filter((r) => r && r.needsHelp).length,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA indisponível no momento' })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, { error: status >= 500 ? 'Falha no serviço de IA' : err.message })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
