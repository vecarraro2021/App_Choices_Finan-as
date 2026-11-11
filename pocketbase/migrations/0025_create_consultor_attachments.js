// Cria a coleção consultor_attachments para anexos (PDF/imagens) do chat
// do "Meu Consultor". Isolamento por usuário via campo owner obrigatório.
migrate(
  (app) => {
    const collection = new Collection({
      name: 'consultor_attachments',
      type: 'base',
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conversation_id',
          type: 'text',
          required: false,
          max: 100,
        },
        {
          name: 'message_id',
          type: 'text',
          required: false,
          max: 100,
        },
        {
          name: 'file_name',
          type: 'text',
          required: false,
          max: 300,
        },
        {
          name: 'mime_type',
          type: 'select',
          values: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
          required: true,
          maxSelect: 1,
        },
        {
          name: 'kind',
          type: 'select',
          values: ['pdf', 'image'],
          required: true,
          maxSelect: 1,
        },
        {
          name: 'file',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
          protected: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_consultor_attachments_owner ON consultor_attachments (owner)',
        'CREATE INDEX idx_consultor_attachments_conv ON consultor_attachments (conversation_id)',
        'CREATE INDEX idx_consultor_attachments_message ON consultor_attachments (message_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('consultor_attachments')
    app.delete(collection)
  },
)
