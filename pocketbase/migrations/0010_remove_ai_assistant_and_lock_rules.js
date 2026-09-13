/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Remover o agente nativo finance-assistant
    try {
      $ai.agents.delete(app, 'finance-assistant')
    } catch (_) {}

    // 2. Trancar a coleção category_rules para não ficar acessível no app (regras superuser apenas)
    try {
      const col = app.findCollectionByNameOrId('category_rules')
      col.listRule = null
      col.viewRule = null
      col.createRule = null
      col.updateRule = null
      col.deleteRule = null
      app.save(col)
    } catch (_) {}
  },
  (app) => {
    // Rollback: restaurar regras em category_rules se necessário
    try {
      const col = app.findCollectionByNameOrId('category_rules')
      col.listRule = "@request.auth.id != '' && user = @request.auth.id"
      col.viewRule = "@request.auth.id != '' && user = @request.auth.id"
      col.createRule = "@request.auth.id != '' && @request.body.user = @request.auth.id"
      col.updateRule = "@request.auth.id != '' && user = @request.auth.id"
      col.deleteRule = "@request.auth.id != '' && user = @request.auth.id"
      app.save(col)
    } catch (_) {}
  },
)
