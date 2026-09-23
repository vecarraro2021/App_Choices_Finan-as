migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('transactions')
    if (!col.fields.getByName('amount_currency')) {
      col.fields.add(
        new SelectField({
          name: 'amount_currency',
          values: ['BRL', 'EUR'],
          maxSelect: 1,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('transactions')
    const field = col.fields.getByName('amount_currency')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
