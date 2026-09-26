/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Criar coleção bank_accounts
    try {
      app.findCollectionByNameOrId('bank_accounts')
    } catch (_) {
      const bankAccounts = new Collection({
        name: 'bank_accounts',
        type: 'base',
        listRule: "@request.auth.id != '' && owner = @request.auth.id",
        viewRule: "@request.auth.id != '' && owner = @request.auth.id",
        createRule: "@request.auth.id != '' && @request.body.owner = @request.auth.id",
        updateRule: "@request.auth.id != '' && owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
        fields: [
          {
            name: 'owner',
            type: 'relation',
            required: true,
            collectionId: users.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'name', type: 'text', required: true },
          {
            name: 'account_type',
            type: 'select',
            required: true,
            values: ['checking', 'savings', 'international', 'investment', 'wallet'],
            maxSelect: 1,
          },
          { name: 'balance', type: 'number', required: false },
          {
            name: 'currency',
            type: 'select',
            required: true,
            values: ['BRL', 'EUR', 'USD'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['connected', 'pending', 'error', 'disconnected'],
            maxSelect: 1,
          },
          { name: 'color', type: 'text' },
          { name: 'last_synced', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_bank_accounts_owner ON bank_accounts (owner)',
          'CREATE INDEX idx_bank_accounts_status ON bank_accounts (status)',
        ],
      })
      app.save(bankAccounts)
    }

    // 2. Criar coleção user_settings
    try {
      app.findCollectionByNameOrId('user_settings')
    } catch (_) {
      const userSettings = new Collection({
        name: 'user_settings',
        type: 'base',
        listRule: "@request.auth.id != '' && owner = @request.auth.id",
        viewRule: "@request.auth.id != '' && owner = @request.auth.id",
        createRule: "@request.auth.id != '' && @request.body.owner = @request.auth.id",
        updateRule: "@request.auth.id != '' && owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
        fields: [
          {
            name: 'owner',
            type: 'relation',
            required: true,
            collectionId: users.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'notify_budget_overflow', type: 'bool' },
          { name: 'notify_atypical_transactions', type: 'bool' },
          { name: 'notify_accounting_divergence', type: 'bool' },
          { name: 'notify_monthly_summary', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_user_settings_owner ON user_settings (owner)'],
      })
      app.save(userSettings)
    }
  },
  (app) => {
    try {
      const bankAccounts = app.findCollectionByNameOrId('bank_accounts')
      app.delete(bankAccounts)
    } catch (_) {}

    try {
      const userSettings = app.findCollectionByNameOrId('user_settings')
      app.delete(userSettings)
    } catch (_) {}
  },
)
