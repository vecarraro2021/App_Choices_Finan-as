migrate(
  (app) => {
    const categoriesCol = app.findCollectionByNameOrId('categories')

    // 1. Obter ou criar a Categoria Principal "Investimentos"
    // Padrão visual: verde esmeralda (#059669 ou #10B981), ícone TrendingUp
    let investMainRecord
    try {
      investMainRecord = app.findFirstRecordByData('categories', 'name', 'Investimentos')
      if (investMainRecord.getString('type') !== 'main') {
        // Se já existia uma com nome 'Investimentos' mas era 'sub', nós criamos uma principal dedicada ou renomeamos
        // Porém no banco 'Investimentos' atual é sub. Vamos verificar especificamente:
        investMainRecord = null
      }
    } catch (_) {
      investMainRecord = null
    }

    // Buscar se já existe categoria principal chamada "Investimentos"
    const existingMains = app.findRecordsByFilter(
      'categories',
      "type = 'main' && name = 'Investimentos'",
      '',
      1,
      0,
    )

    if (existingMains.length > 0) {
      investMainRecord = existingMains[0]
    } else {
      investMainRecord = new Record(categoriesCol)
      investMainRecord.set('name', 'Investimentos')
      investMainRecord.set('type', 'main')
      investMainRecord.set('estimated', 0)
      investMainRecord.set('color', '#059669') // Verde esmeralda apropriado para investimentos
      investMainRecord.set('icon', 'TrendingUp')
      app.save(investMainRecord)
    }

    const investMainId = investMainRecord.id

    // 2. Subcategorias a mover/criar sob "Investimentos":
    // "Investimentos", "Degiro", "Consorcio", "Outros investimentos"
    const targetSubs = ['Investimentos', 'Degiro', 'Consorcio', 'Outros investimentos']

    for (let i = 0; i < targetSubs.length; i++) {
      const subName = targetSubs[i]
      // Procurar se já existe subcategoria com este nome
      const existingSubs = app.findRecordsByFilter(
        'categories',
        "type = 'sub' && name = '" + subName + "'",
        '',
        1,
        0,
      )

      if (existingSubs.length > 0) {
        const subRecord = existingSubs[0]
        // Se ela estiver apontando para outra categoria (ex: Extras), mover para Investimentos preservando estimated
        if (subRecord.getString('parent') !== investMainId) {
          subRecord.set('parent', investMainId)
          subRecord.set('color', '#059669')
          app.save(subRecord)
        }
      } else {
        // Criar subcategoria se ainda não existir
        const newSub = new Record(categoriesCol)
        newSub.set('name', subName)
        newSub.set('type', 'sub')
        newSub.set('parent', investMainId)
        newSub.set('estimated', 0)
        newSub.set('color', '#059669')
        app.save(newSub)
      }
    }

    // 3. Atualizar o estimated da categoria principal Investimentos
    // como a soma dos orçamentos estimados de suas subcategorias
    const currentSubs = app.findRecordsByFilter(
      'categories',
      "type = 'sub' && parent = '" + investMainId + "'",
      '',
      100,
      0,
    )
    let totalInvestEstimated = 0
    for (let j = 0; j < currentSubs.length; j++) {
      totalInvestEstimated += currentSubs[j].getInt('estimated') || 0
    }
    investMainRecord.set('estimated', totalInvestEstimated)
    app.save(investMainRecord)

    // 4. Também recalcular o estimated da categoria principal "Extras"
    try {
      const extrasMains = app.findRecordsByFilter(
        'categories',
        "type = 'main' && name = 'Extras'",
        '',
        1,
        0,
      )
      if (extrasMains.length > 0) {
        const extrasRecord = extrasMains[0]
        const extrasSubs = app.findRecordsByFilter(
          'categories',
          "type = 'sub' && parent = '" + extrasRecord.id + "'",
          '',
          100,
          0,
        )
        let totalExtrasEstimated = 0
        for (let k = 0; k < extrasSubs.length; k++) {
          totalExtrasEstimated += extrasSubs[k].getInt('estimated') || 0
        }
        extrasRecord.set('estimated', totalExtrasEstimated)
        app.save(extrasRecord)
      }
    } catch (_) {}
  },
  (app) => {
    // Reverter: devolver subcategorias para Extras se necessário
    try {
      const extrasMains = app.findRecordsByFilter(
        'categories',
        "type = 'main' && name = 'Extras'",
        '',
        1,
        0,
      )
      if (extrasMains.length > 0) {
        const extrasId = extrasMains[0].id
        const targetSubs = ['Investimentos', 'Degiro', 'Consorcio', 'Outros investimentos']
        for (let i = 0; i < targetSubs.length; i++) {
          const subs = app.findRecordsByFilter(
            'categories',
            "type = 'sub' && name = '" + targetSubs[i] + "'",
            '',
            1,
            0,
          )
          if (subs.length > 0) {
            subs[0].set('parent', extrasId)
            app.save(subs[0])
          }
        }
      }

      const investMains = app.findRecordsByFilter(
        'categories',
        "type = 'main' && name = 'Investimentos'",
        '',
        1,
        0,
      )
      if (investMains.length > 0) {
        app.delete(investMains[0])
      }
    } catch (_) {}
  },
)
