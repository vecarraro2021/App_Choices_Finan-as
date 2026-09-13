migrate(
  (app) => {
    // 1. categories
    const categories = new Collection({
      name: 'categories',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'type', type: 'select', required: true, values: ['main', 'sub'], maxSelect: 1 },
        { name: 'estimated', type: 'number' },
        { name: 'color', type: 'text' },
        { name: 'icon', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_categories_type ON categories (type)'],
    })
    app.save(categories)

    // Add self-relation parent to categories
    categories.fields.add(
      new RelationField({
        name: 'parent',
        collectionId: categories.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    categories.addIndex('idx_categories_parent', false, 'parent', '')
    app.save(categories)

    // 2. transactions
    const transactions = new Collection({
      name: 'transactions',
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
        { name: 'date', type: 'date' },
        { name: 'description', type: 'text', required: true },
        { name: 'amount', type: 'number', required: true },
        { name: 'category', type: 'relation', collectionId: categories.id, maxSelect: 1 },
        { name: 'source', type: 'select', values: ['importado', 'manual'], maxSelect: 1 },
        { name: 'month', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_transactions_user ON transactions (user)',
        'CREATE INDEX idx_transactions_month ON transactions (month)',
        'CREATE INDEX idx_transactions_category ON transactions (category)',
        'CREATE INDEX idx_transactions_date ON transactions (date)',
      ],
    })
    app.save(transactions)

    // 3. income
    const income = new Collection({
      name: 'income',
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
        { name: 'month', type: 'text', required: true },
        { name: 'amount_brl', type: 'number', required: true },
        { name: 'amount_eur', type: 'number' },
        { name: 'description', type: 'text' },
        { name: 'date', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_income_user ON income (user)',
        'CREATE INDEX idx_income_month ON income (month)',
      ],
    })
    app.save(income)

    // 4. alerts
    const alerts = new Collection({
      name: 'alerts',
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
        {
          name: 'severity',
          type: 'select',
          required: true,
          values: ['critical', 'warning', 'info'],
          maxSelect: 1,
        },
        { name: 'title', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'suggestion', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_alerts_user ON alerts (user)',
        'CREATE INDEX idx_alerts_severity ON alerts (severity)',
      ],
    })
    app.save(alerts)

    // 5. monthly_totals
    const monthlyTotals = new Collection({
      name: 'monthly_totals',
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
        { name: 'month', type: 'text', required: true },
        { name: 'total_categories', type: 'number' },
        { name: 'total_official', type: 'number' },
        { name: 'divergence', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_monthly_totals_user ON monthly_totals (user)',
        'CREATE INDEX idx_monthly_totals_month ON monthly_totals (month)',
      ],
    })
    app.save(monthlyTotals)
  },
  (app) => {
    const toDelete = ['monthly_totals', 'alerts', 'income', 'transactions', 'categories']
    for (let i = 0; i < toDelete.length; i++) {
      try {
        const col = app.findCollectionByNameOrId(toDelete[i])
        app.delete(col)
      } catch (_) {}
    }
  },
)
