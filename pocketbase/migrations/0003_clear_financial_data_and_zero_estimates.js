migrate(
  (app) => {
    // 1. Zerar o orçamento estimado de TODAS as categorias (principais e subcategorias)
    app.db().newQuery('UPDATE categories SET estimated = 0').execute()

    // 2. Limpar quaisquer registros em transactions, income, alerts e monthly_totals
    app.db().newQuery('DELETE FROM transactions').execute()
    app.db().newQuery('DELETE FROM income').execute()
    app.db().newQuery('DELETE FROM alerts').execute()
    app.db().newQuery('DELETE FROM monthly_totals').execute()
  },
  (app) => {
    // Reversão não é necessária pois os orçamentos estimados podem ser reinseridos pelo usuário
  },
)
