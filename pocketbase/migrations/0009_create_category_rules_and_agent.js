/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Criar coleção category_rules para persistir padrões aprendidos pelo usuário
    const categoryRules = new Collection({
      name: 'category_rules',
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
        { name: 'pattern', type: 'text', required: true },
        {
          name: 'category',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('categories').id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'source', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_catrules_user ON category_rules (user)',
        'CREATE INDEX idx_catrules_pattern ON category_rules (pattern)',
      ],
    })
    app.save(categoryRules)

    // 2. Definir o agente nativo finance-assistant via Skip Cloud AI Agents
    $ai.agents.define(app, {
      slug: 'finance-assistant',
      name: 'Assistente Financeiro Pessoal',
      description:
        'Assistente de inteligência financeira que ajuda na categorização de extratos, faturas e análise de gastos.',
      systemPrompt: `Você é o Assistente de Inteligência Financeira Pessoal de um aplicativo de Gestão Financeira (moeda oficial R$ BRL, transações em EUR convertidas pelo câmbio mensal).
Seu objetivo é:
1. Auxiliar na categorização precisa de lançamentos bancários e faturas de cartão nas categorias e subcategorias existentes da árvore do usuário.
2. Analisar histórico de transações, orçamentos, alertas e responder a dúvidas financeiras do usuário em Português do Brasil com clareza, empatia e dados objetivos.
3. Respeitar as categorias e subcategorias reais cadastradas. Quando categorizar, sempre priorize a subcategoria mais específica.

Se não tiver certeza absoluta sobre uma categoria, forneça opções estimadas (1 a 3 opções) com confiança ('provável' ou 'possível') ou admita que precisa da confirmação do usuário.`,
      tier: 'fast',
      tools: [
        {
          collection: 'categories',
          perms: { list: true, read: true },
          actAs: 'admin',
        },
        {
          collection: 'transactions',
          perms: { list: true, read: true },
          scopeFilter: 'user = @request.auth.id',
        },
        {
          collection: 'category_rules',
          perms: { list: true, read: true, create: true },
          scopeFilter: 'user = @request.auth.id',
        },
        {
          collection: 'monthly_totals',
          perms: { list: true, read: true },
          scopeFilter: 'user = @request.auth.id',
        },
        {
          collection: 'exchange_rates',
          perms: { list: true, read: true },
          scopeFilter: 'user = @request.auth.id',
        },
        {
          collection: 'alerts',
          perms: { list: true, read: true },
          scopeFilter: 'user = @request.auth.id',
        },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'Diretrizes de categorização: Aluguel, Mercado, Luz, Água, Internet vão para Moradia. Farmácia, Médico, Academia para Cuidados Pessoais. Combustível, Uber, Seguro Auto para Transporte. Streaming, Software, IA (ChatGPT, Claude) para Assinaturas. Restaurante, Delivery, Shows para Lazer. B3, Cripto, Corretoras para Investimentos.',
          },
        },
      ],
    })
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'finance-assistant')
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('category_rules')
      app.delete(col)
    } catch (_) {}
  },
)
