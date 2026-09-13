migrate(
  (app) => {
    // Remover todas as transações (lançamentos de saída/despesa)
    // Preserva intactas as categorias, subcategorias, orçamentos estimados,
    // receitas pontuais, receitas recorrentes e taxas de câmbio.
    app.db().newQuery('DELETE FROM transactions').execute()
    // Limpar alertas antigos calculados sobre as transações apagadas
    app.db().newQuery('DELETE FROM alerts').execute()
  },
  (app) => {
    // Reversão não aplicável pois os registros apagados eram dados transitórios/históricos
    // que o usuário importará novamente mês a mês adaptando as categorias.
  },
)
