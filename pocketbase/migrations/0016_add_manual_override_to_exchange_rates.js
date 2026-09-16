migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('exchange_rates')
    if (!col.fields.getByName('manual_override')) {
      col.fields.add(
        new BoolField({
          name: 'manual_override',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('exchange_rates')
      col.fields.removeByName('manual_override')
      app.save(col)
    } catch (_) {}
  },
)
