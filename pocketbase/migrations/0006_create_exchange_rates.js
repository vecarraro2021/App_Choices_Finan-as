migrate(
  (app) => {
    // 1. Create exchange_rates collection
    const exchangeRates = new Collection({
      name: 'exchange_rates',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'month',
          type: 'text',
          required: true,
        },
        {
          name: 'rate',
          type: 'number',
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_exchange_rates_month_user ON exchange_rates (month, user)',
        'CREATE INDEX idx_exchange_rates_month ON exchange_rates (month)',
      ],
    })
    app.save(exchangeRates)

    // 2. Seed default 2026 rates (Jan 2026 to Dec 2026)
    // Realistic average rates around 6.0 (or default 6.00)
    const seedRates = [
      { month: '2026-01', rate: 6.08 },
      { month: '2026-02', rate: 6.12 },
      { month: '2026-03', rate: 6.15 },
      { month: '2026-04', rate: 6.05 },
      { month: '2026-05', rate: 6.1 },
      { month: '2026-06', rate: 6.18 },
      { month: '2026-07', rate: 6.14 },
      { month: '2026-08', rate: 6.09 },
      { month: '2026-09', rate: 6.0 },
      { month: '2026-10', rate: 6.0 },
      { month: '2026-11', rate: 6.0 },
      { month: '2026-12', rate: 6.0 },
    ]

    for (const item of seedRates) {
      try {
        const record = new Record(exchangeRates)
        record.set('month', item.month)
        record.set('rate', item.rate)
        app.save(record)
      } catch (e) {
        console.log('Exchange rate seed error or already exists:', item.month, e)
      }
    }
  },
  (app) => {
    try {
      const exchangeRates = app.findCollectionByNameOrId('exchange_rates')
      app.delete(exchangeRates)
    } catch (_) {}
  },
)
