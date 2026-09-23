/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Obter usuário principal Veronica
    let veronicaId = ''
    try {
      const veronica = app.findAuthRecordByEmail('_pb_users_auth_', 'veronica@souldelas.com')
      veronicaId = veronica.id
    } catch (e) {
      console.log('Veronica não encontrada por email, tentando buscar primeiro usuário:', e)
      const users = app.findRecordsByFilter('_pb_users_auth_', "email ~ 'veronica'", '', 1, 0)
      if (users.length > 0) {
        veronicaId = users[0].id
      }
    }

    if (!veronicaId) {
      throw new Error(
        'Usuário veronica@souldelas.com não encontrado para assumir os dados existentes.',
      )
    }

    const collectionsToUpdate = [
      'categories',
      'transactions',
      'income',
      'recurring_incomes',
      'alerts',
      'monthly_totals',
      'exchange_rates',
      'category_rules',
    ]

    // 2. Adicionar campo owner em cada coleção se não existir
    for (let i = 0; i < collectionsToUpdate.length; i++) {
      const colName = collectionsToUpdate[i]
      let col
      try {
        col = app.findCollectionByNameOrId(colName)
      } catch (_) {
        continue
      }

      if (!col.fields.getByName('owner')) {
        col.fields.add(
          new RelationField({
            name: 'owner',
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
            required: false, // permitir nulo temporariamente durante migração e para taxas globais
          }),
        )
        app.save(col)
      }
    }

    // 3. Preencher owner dos dados existentes
    // Para categories: como não tinham user antes, atribuir todas à Veronica
    app
      .db()
      .newQuery(`UPDATE categories SET owner = {:vId} WHERE owner IS NULL OR owner = ''`)
      .bind({ vId: veronicaId })
      .execute()

    // Para transactions: transferir para Veronica (conforme instrução 1 e 5: veronica fica dona de todos os dados atuais)
    app
      .db()
      .newQuery(`UPDATE transactions SET owner = {:vId}, user = {:vId}`)
      .bind({ vId: veronicaId })
      .execute()

    // Para income:
    app
      .db()
      .newQuery(`UPDATE income SET owner = {:vId}, user = {:vId}`)
      .bind({ vId: veronicaId })
      .execute()

    // Para alerts:
    app
      .db()
      .newQuery(`UPDATE alerts SET owner = {:vId}, user = {:vId}`)
      .bind({ vId: veronicaId })
      .execute()

    // Para monthly_totals:
    app
      .db()
      .newQuery(`UPDATE monthly_totals SET owner = {:vId}, user = {:vId}`)
      .bind({ vId: veronicaId })
      .execute()

    // Para recurring_incomes:
    // Apenas manter da Veronica com owner = veronicaId. Se houver de outro usuário (ex: demo), definir owner = user ou atribuir
    app
      .db()
      .newQuery(`UPDATE recurring_incomes SET owner = user WHERE owner IS NULL OR owner = ''`)
      .execute()
    app
      .db()
      .newQuery(`UPDATE recurring_incomes SET owner = {:vId} WHERE user = {:vId}`)
      .bind({ vId: veronicaId })
      .execute()

    // Para category_rules:
    app
      .db()
      .newQuery(`UPDATE category_rules SET owner = user WHERE owner IS NULL OR owner = ''`)
      .execute()
    app
      .db()
      .newQuery(`UPDATE category_rules SET owner = {:vId} WHERE user = {:vId}`)
      .bind({ vId: veronicaId })
      .execute()

    // Para exchange_rates: registros com manual_override = true e user vinculado ganham owner = user.
    // Registros automáticos de mercado (globais) ficam com owner = NULL (compartilhados para leitura).
    app
      .db()
      .newQuery(`UPDATE exchange_rates SET owner = user WHERE user IS NOT NULL AND user != ''`)
      .execute()

    // 4. Configurar Regras de Acesso (RLS) estritas
    // Categories: usuário só pode ler, ver, criar, atualizar e excluir categorias onde owner = @request.auth.id
    const catCol = app.findCollectionByNameOrId('categories')
    catCol.listRule = "@request.auth.id != '' && owner = @request.auth.id"
    catCol.viewRule = "@request.auth.id != '' && owner = @request.auth.id"
    catCol.createRule = "@request.auth.id != '' && @request.body.owner = @request.auth.id"
    catCol.updateRule = "@request.auth.id != '' && owner = @request.auth.id"
    catCol.deleteRule = "@request.auth.id != '' && owner = @request.auth.id"
    catCol.addIndex('idx_categories_owner', false, 'owner', '')
    app.save(catCol)

    // Transactions
    const txCol = app.findCollectionByNameOrId('transactions')
    txCol.listRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    txCol.viewRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    txCol.createRule =
      "@request.auth.id != '' && (@request.body.owner = @request.auth.id || @request.body.user = @request.auth.id)"
    txCol.updateRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    txCol.deleteRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    txCol.addIndex('idx_transactions_owner', false, 'owner', '')
    app.save(txCol)

    // Income
    const incCol = app.findCollectionByNameOrId('income')
    incCol.listRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    incCol.viewRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    incCol.createRule =
      "@request.auth.id != '' && (@request.body.owner = @request.auth.id || @request.body.user = @request.auth.id)"
    incCol.updateRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    incCol.deleteRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    incCol.addIndex('idx_income_owner', false, 'owner', '')
    app.save(incCol)

    // Recurring incomes
    const recCol = app.findCollectionByNameOrId('recurring_incomes')
    recCol.listRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    recCol.viewRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    recCol.createRule =
      "@request.auth.id != '' && (@request.body.owner = @request.auth.id || @request.body.user = @request.auth.id)"
    recCol.updateRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    recCol.deleteRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    recCol.addIndex('idx_recurring_incomes_owner', false, 'owner', '')
    app.save(recCol)

    // Alerts
    const altCol = app.findCollectionByNameOrId('alerts')
    altCol.listRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    altCol.viewRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    altCol.createRule =
      "@request.auth.id != '' && (@request.body.owner = @request.auth.id || @request.body.user = @request.auth.id)"
    altCol.updateRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    altCol.deleteRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    altCol.addIndex('idx_alerts_owner', false, 'owner', '')
    app.save(altCol)

    // Monthly totals
    const mtCol = app.findCollectionByNameOrId('monthly_totals')
    mtCol.listRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    mtCol.viewRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    mtCol.createRule =
      "@request.auth.id != '' && (@request.body.owner = @request.auth.id || @request.body.user = @request.auth.id)"
    mtCol.updateRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    mtCol.deleteRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    mtCol.addIndex('idx_monthly_totals_owner', false, 'owner', '')
    app.save(mtCol)

    // Exchange rates:
    // Leitura: qualquer usuário autenticado pode ler taxas globais (owner = null / '') ou suas próprias taxas customizadas
    // Escrita: usuário só pode criar/atualizar/excluir registros onde ele é o dono (não pode editar taxa global nem de outro usuário)
    const exCol = app.findCollectionByNameOrId('exchange_rates')
    exCol.listRule =
      "@request.auth.id != '' && (owner = '' || owner = null || owner = @request.auth.id || user = '' || user = null || user = @request.auth.id)"
    exCol.viewRule =
      "@request.auth.id != '' && (owner = '' || owner = null || owner = @request.auth.id || user = '' || user = null || user = @request.auth.id)"
    exCol.createRule =
      "@request.auth.id != '' && (@request.body.owner = @request.auth.id || @request.body.user = @request.auth.id)"
    exCol.updateRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    exCol.deleteRule =
      "@request.auth.id != '' && (owner = @request.auth.id || user = @request.auth.id)"
    exCol.addIndex('idx_exchange_rates_owner', false, 'owner', '')
    app.save(exCol)

    // 5. Seed de categorias padrão zeradas para os demais usuários existentes (ex: Usuário Demo)
    const usersWithoutCategories = app.findRecordsByFilter(
      '_pb_users_auth_',
      `id != '${veronicaId}'`,
      '',
      100,
      0,
    )

    const defaultTaxonomy = [
      {
        name: 'Moradia',
        color: '#2563EB',
        icon: 'Home',
        subcategories: [
          'Aluguel',
          'Mercado',
          'Internet',
          'Luz',
          'Água',
          'Limpeza',
          'Utensílios e Móveis',
          'Lavanderia',
          'Manutenção Residencial',
        ],
      },
      {
        name: 'Cuidados Pessoais',
        color: '#EC4899',
        icon: 'Heart',
        subcategories: [
          'Farmácia',
          'Plano de Saúde',
          'Exames e Consultas',
          'Academia',
          'Atividades Esportivas',
          'Equipamentos e Manutenção',
          'Terapias e Saúde Mental',
          'Vestuário e Roupas',
          'Salão e Cabelo',
          'Beleza e Estética',
          'Massagem',
        ],
      },
      {
        name: 'Transporte',
        color: '#F59E0B',
        icon: 'Car',
        subcategories: [
          'Combustível',
          'Uber / Táxi',
          'Seguro do Carro',
          'Pedágios e Estacionamento',
          'Manutenção do Carro',
          'Inspeção e Impostos Auto',
          'Aluguel ou Compra Automóvel',
        ],
      },
      {
        name: 'Lazer',
        color: '#10B981',
        icon: 'Coffee',
        subcategories: [
          'Restaurantes',
          'Alimentação Fora',
          'Eventos e Shows',
          'Passagens Aéreas',
          'Turismo e Hospedagem',
          'Passagens Locais',
        ],
      },
      {
        name: 'Educação',
        color: '#8B5CF6',
        icon: 'BookOpen',
        subcategories: ['Cursos Online', 'Mentorias', 'Materiais e Livros'],
      },
      {
        name: 'Assinaturas',
        color: '#06B6D4',
        icon: 'Layers',
        subcategories: [
          'Streaming (Netflix, Spotify)',
          'Armazenamento em Nuvem (Google, Apple)',
          'Software e Ferramentas (Figma, Loom)',
          'Inteligência Artificial (ChatGPT, Claude)',
        ],
      },
      {
        name: 'Impostos',
        color: '#6366F1',
        icon: 'FileText',
        subcategories: ['Impostos Governamentais', 'Contribuições e Taxas Oficiais'],
      },
      {
        name: 'Tarifas Financeiras',
        color: '#F97316',
        icon: 'CreditCard',
        subcategories: ['Taxas Bancárias', 'Juros e Taxas Cartão', 'Seguro Pix / Conta'],
      },
      {
        name: 'Serviços',
        color: '#14B8A6',
        icon: 'Briefcase',
        subcategories: ['Contabilidade'],
      },
      {
        name: 'Social',
        color: '#84CC16',
        icon: 'Gift',
        subcategories: ['Presentes', 'Doações'],
      },
      {
        name: 'Investimentos',
        color: '#059669',
        icon: 'TrendingUp',
        subcategories: ['Investimentos', 'Degiro', 'Consorcio', 'Outros investimentos'],
      },
      {
        name: 'Extras',
        color: '#64748B',
        icon: 'PlusCircle',
        subcategories: ['Eletrônicos', 'Material de Obra', 'Serviço de Obra', 'Não Categorizado'],
      },
    ]

    for (let u = 0; u < usersWithoutCategories.length; u++) {
      const otherUser = usersWithoutCategories[u]
      const otherUserId = otherUser.id

      // Checar se já tem categorias para não duplicar
      const existingUserCats = app.findRecordsByFilter(
        'categories',
        `owner = '${otherUserId}'`,
        '',
        1,
        0,
      )
      if (existingUserCats.length > 0) continue

      for (let i = 0; i < defaultTaxonomy.length; i++) {
        const item = defaultTaxonomy[i]
        const parentRecord = new Record(catCol)
        parentRecord.set('name', item.name)
        parentRecord.set('type', 'main')
        parentRecord.set('estimated', 0)
        parentRecord.set('color', item.color)
        parentRecord.set('icon', item.icon)
        parentRecord.set('owner', otherUserId)
        app.save(parentRecord)

        for (let j = 0; j < item.subcategories.length; j++) {
          const subName = item.subcategories[j]
          const subRecord = new Record(catCol)
          subRecord.set('name', subName)
          subRecord.set('type', 'sub')
          subRecord.set('parent', parentRecord.id)
          subRecord.set('estimated', 0)
          subRecord.set('color', item.color)
          subRecord.set('owner', otherUserId)
          app.save(subRecord)
        }
      }
    }
  },
  (app) => {
    // down logic
  },
)
