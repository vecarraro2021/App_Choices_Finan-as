migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('categories')
    if (!col.fields.getByName('note')) {
      col.fields.add(new TextField({ name: 'note', max: 2000 }))
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('categories')
    if (col.fields.getByName('note')) {
      col.fields.removeByName('note')
      app.save(col)
    }
  },
)
