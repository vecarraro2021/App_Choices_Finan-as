migrate(
  (app) => {
    // Sincronizar o campo estimated de cada categoria principal existente
    // com a soma exata dos orçamentos de suas subcategorias filhas.
    // Preserva rigorosamente todas as categorias, subcategorias, transações e owners.
    const allCategories = app.findRecordsByFilter('categories', '1=1', '', 0, 0)

    // Agrupar soma dos orçamentos das filhas por parent id
    const subSumByParent = {}
    for (const cat of allCategories) {
      const type = cat.getString('type')
      const parent = cat.getString('parent')
      const est = cat.getFloat('estimated') || 0
      if (type === 'sub' && parent) {
        subSumByParent[parent] = (subSumByParent[parent] || 0) + est
      }
    }

    // Atualizar categorias principais cujo estimated divirja da soma das filhas
    for (const cat of allCategories) {
      if (cat.getString('type') === 'main') {
        const id = cat.id
        const expectedEstimated = Math.round((subSumByParent[id] || 0) * 100) / 100
        const currentEstimated = cat.getFloat('estimated') || 0
        if (Math.abs(expectedEstimated - currentEstimated) > 0.001) {
          cat.set('estimated', expectedEstimated)
          app.save(cat)
        }
      }
    }
  },
  (app) => {
    // Reverter não é necessário nem destrutivo
  },
)
