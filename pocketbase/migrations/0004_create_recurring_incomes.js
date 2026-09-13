migrate(
  (app) => {
    // 1. Create recurring_incomes collection
    const recurringIncomes = new Collection({
      name: 'recurring_incomes',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'description', type: 'text', required: true },
        { name: 'amount_eur', type: 'number', required: true },
        { name: 'amount_brl', type: 'number', required: true },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_recurring_incomes_user ON recurring_incomes (user)'],
    })
    app.save(recurringIncomes)

    // 2. Seed recurring income for users:
    // User requested: "Considere que minha receita mensal é de 5.00 euroes mensal, faça que esta entrada seja automatica"
    // Interpretation: € 5.000,00 mensal (R$ 30.000,00 na cotação fixa de 6.0), ativa
    const emailsToSeed = ['veronica@souldelas.com', 'demo@financeiro.app']

    for (let i = 0; i < emailsToSeed.length; i++) {
      const email = emailsToSeed[i]
      try {
        const userRecord = app.findAuthRecordByEmail('_pb_users_auth_', email)
        if (!userRecord) continue

        // Check if recurring income already exists for this user to make it idempotent
        const existing = app.findRecordsByFilter(
          'recurring_incomes',
          `user = '${userRecord.id}' && description ~ 'Salário'`,
          '-created',
          1,
          0,
        )

        if (!existing || existing.length === 0) {
          const rec = new Record(recurringIncomes)
          rec.set('user', userRecord.id)
          rec.set('description', 'Salário Mensal Recorrente')
          rec.set('amount_eur', 5000)
          rec.set('amount_brl', 30000)
          rec.set('active', true)
          app.save(rec)
        }
      } catch (_) {
        // Ignore if user not found
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('recurring_incomes')
      app.delete(col)
    } catch (_) {}
  },
)
