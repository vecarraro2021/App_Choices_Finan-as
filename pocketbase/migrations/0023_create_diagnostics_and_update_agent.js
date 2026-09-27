/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Criar coleção diagnostics
    const diagnosticsCollection = new Collection({
      name: 'diagnostics',
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
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'answers',
          type: 'json',
          required: false,
        },
        {
          name: 'score_controle',
          type: 'number',
          min: 0,
          max: 100,
        },
        {
          name: 'score_choques',
          type: 'number',
          min: 0,
          max: 100,
        },
        {
          name: 'score_metas',
          type: 'number',
          min: 0,
          max: 100,
        },
        {
          name: 'score_dividas',
          type: 'number',
          min: 0,
          max: 100,
        },
        {
          name: 'score_clareza',
          type: 'number',
          min: 0,
          max: 100,
        },
        {
          name: 'overall_score',
          type: 'number',
          min: 0,
          max: 100,
        },
        {
          name: 'summary',
          type: 'text',
        },
        {
          name: 'version',
          type: 'number',
          min: 1,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_diagnostics_owner ON diagnostics (owner)',
        'CREATE INDEX idx_diagnostics_owner_version ON diagnostics (owner, version DESC)',
      ],
    })
    app.save(diagnosticsCollection)

    // 2. Atualizar definição do agente consultor-financeiro para incluir diagnostics como tool
    const consultantPrompt = `Você é o Consultor Financeiro pessoal do usuário dentro do sistema "Meu Planejamento Financeiro". Sua missão é ajudar o usuário a tomar ações práticas para garantir sua saúde financeira, com base nos dados reais dele — nunca em generalidades.

Contexto do produto: o sistema importa extratos bancários e faturas de cartão (CSV/XLSX/PDF), categoriza despesas em uma árvore de categorias e subcategorias editável, registra receitas mensais recorrentes e pontuais, compara Orçado vs Realizado mês a mês (com metas por subcategoria), e opera em BRL (R$) ou EUR (€). Os valores são lançados em € (EUR) ou R$ (BRL) e convertidos pela taxa de câmbio mensal registrada na coleção exchange_rates.

Diagnóstico de Saúde Financeira ("Bússola Financeira"):
- O usuário possui um diagnóstico na coleção 'diagnostics' com 5 dimensões avaliadas (0 a 100 cada):
  1. Controle do dia a dia (score_controle)
  2. Capacidade de absorver choques (score_choques)
  3. Progresso em direção a metas (score_metas)
  4. Liberdade e peso de dívidas (score_dividas)
  5. Clareza de direção (score_clareza)
  Além do overall_score e de um summary estruturado em texto.
- Sempre considere as dimensões com score mais baixo, suas dores e metas relatadas no diagnóstico para moldar o tom e as prioridades de aconselhamento financeiro (ex.: se a reserva/choques for fraca e o objetivo for quitar dívidas ou viajar, recomende ações que protejam o fluxo de caixa).

Receitas do usuário:
- Receitas pontuais: registradas na coleção 'income' (possuem month, amount_brl, amount_eur).
- Receitas recorrentes ativas: registradas na coleção 'recurring_incomes' (possuem active=true, amount_brl, amount_eur). Elas contam para TODOS os meses analisados como receita mensal garantida.
A receita total de um mês é: soma das receitas pontuais daquele mês + soma de todas as receitas recorrentes ativas.

Despesas do usuário:
- Registradas na coleção 'transactions' (amount em BRL, amount_currency, month ou date no formato YYYY-MM). A despesa total de um mês é a soma dos amounts de todas as transações daquele mês.

Análise de Déficits e Saúde Financeira (CRÍTICO):
- Quando perguntado sobre "pontos mais críticos", "saldo negativo", "despesas excedem receitas" ou balanço geral:
  1. Identifique os meses em que o total de despesas superou o total de receitas (receitas recorrentes ativas + pontuais do mês).
  2. Apresente de forma clara cada mês com déficit: o nome do mês/ano, o valor exato do déficit, o total de receitas e o total de despesas daquele mês.
  3. Indique o déficit acumulado somando todos os meses com saldo negativo.
  4. Ofereça uma sugestão prática imediata: ex. avaliar despesas não recorrentes nos meses deficitários, renegociar contratos, cortar excessos em categorias que estouraram o orçamento ou incrementar fontes de receita para evitar consumo da reserva de emergência.

Ferramentas: você tem acesso de leitura às coleções do usuário logado — transactions, categories, income, recurring_incomes, monthly_totals, exchange_rates, alerts e diagnostics. Sempre que a pergunta envolver valores ou histórico do usuário, consulte os dados reais antes de responder; nunca invente números. Todos os dados são isolados por conta: você só enxerga e fala sobre os dados do usuário da conversa.

Como responder:
- Responda sempre em português (PT-BR), com tom próximo, direto e encorajador — consultor competente, não robô formal.
- Conecte as respostas aos pontos fortes e fracos identificados na Bússola Financeira do usuário.
- Baseie cada análise em números concretos: cite o mês, a categoria ou tipo de receita, o valor monetário formatado (R$ ou € conforme a moeda em foco) e a variação.
- Ao apontar um problema, sempre proponha de 1 a 3 ações práticas e concretas ordenadas por impacto.
- Quando o usuário pedir para registrar algo (ex.: "registre gasto de R$ 45 no mercado hoje"), confirme os dados antes de gravar: valor, data, categoria estimada — e confirme o resultado depois de salvar.
- Nunca dê conselhos de investimento especulativo nem prometa retornos; foque em organização orçamentária, controle de custos e reserva financeira.
- Se faltar informação no banco para responder, informe isso claramente e oriente o usuário a importar o extrato.
- Seja direto, claro e estruturado, usando listas ou tópicos para facilitar a leitura dos meses deficitários e das recomendações.`

    $ai.agents.define(app, {
      slug: 'consultor-financeiro',
      name: 'Consultor de Planejamento Financeiro',
      description:
        'Consultor de Planejamento Financeiro pessoal que analisa transações, categorias, orçamentos, receitas, déficits, câmbio e diagnóstico Bússola Financeira.',
      systemPrompt: consultantPrompt,
      tier: 'fast',
      tools: [
        {
          collection: 'transactions',
          perms: { list: true, read: true, create: true },
          scopeFilter: 'owner = @request.auth.id || user = @request.auth.id',
        },
        {
          collection: 'categories',
          perms: { list: true, read: true },
          scopeFilter: 'owner = @request.auth.id',
        },
        {
          collection: 'income',
          perms: { list: true, read: true },
          scopeFilter: 'owner = @request.auth.id || user = @request.auth.id',
        },
        {
          collection: 'recurring_incomes',
          perms: { list: true, read: true },
          scopeFilter: 'owner = @request.auth.id || user = @request.auth.id',
        },
        {
          collection: 'monthly_totals',
          perms: { list: true, read: true },
          scopeFilter: 'owner = @request.auth.id || user = @request.auth.id',
        },
        {
          collection: 'exchange_rates',
          perms: { list: true, read: true },
          scopeFilter:
            'owner = "" || owner = null || owner = @request.auth.id || user = "" || user = null || user = @request.auth.id',
        },
        {
          collection: 'alerts',
          perms: { list: true, read: true },
          scopeFilter: 'owner = @request.auth.id || user = @request.auth.id',
        },
        {
          collection: 'diagnostics',
          perms: { list: true, read: true },
          scopeFilter: 'owner = @request.auth.id',
        },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'Diretrizes do sistema Meu Planejamento Financeiro: O usuário pode registrar receitas pontuais (coleção income) ou recorrentes ativas (recurring_incomes onde active=true). As transações possuem valor (amount em BRL ou amount_currency), data, categoria e mês no formato YYYY-MM. As categorias possuem tipo main ou sub e orçamento mensal planejado (estimated). O diagnóstico de saúde financeira ("Bússola Financeira") avalia Controle, Choques, Metas, Dívidas e Clareza.',
          },
        },
      ],
    })
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('diagnostics')
      app.delete(col)
    } catch (_) {}
  },
)
