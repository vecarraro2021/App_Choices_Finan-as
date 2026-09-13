migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Seed demo user (demo@financeiro.app / Skip@Pass)
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'demo@financeiro.app')
    } catch (_) {
      const record = new Record(users)
      record.setEmail('demo@financeiro.app')
      record.setPassword('Skip@Pass')
      record.setVerified(true)
      record.set('name', 'Usuário Demo')
      app.save(record)
    }

    // Also seed veronica@souldelas.com as indicated in spec
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'veronica@souldelas.com')
    } catch (_) {
      const record = new Record(users)
      record.setEmail('veronica@souldelas.com')
      record.setPassword('Skip@Pass')
      record.setVerified(true)
      record.set('name', 'Veronica')
      app.save(record)
    }

    // 2. Seed Default Category Taxonomy (names and estimated budget defaults, NO transactions!)
    const categoriesCol = app.findCollectionByNameOrId('categories')

    const taxonomy = [
      {
        name: 'Moradia',
        color: '#2563EB',
        icon: 'Home',
        estimated: 4476,
        subcategories: [
          { name: 'Aluguel', estimated: 2500 },
          { name: 'Mercado', estimated: 1000 },
          { name: 'Internet', estimated: 70 },
          { name: 'Luz', estimated: 30 },
          { name: 'Água', estimated: 26 },
          { name: 'Limpeza', estimated: 300 },
          { name: 'Utensílios e Móveis', estimated: 400 },
          { name: 'Lavanderia', estimated: 50 },
          { name: 'Manutenção Residencial', estimated: 100 },
        ],
      },
      {
        name: 'Cuidados Pessoais',
        color: '#EC4899',
        icon: 'Heart',
        estimated: 4539,
        subcategories: [
          { name: 'Farmácia', estimated: 300 },
          { name: 'Plano de Saúde', estimated: 415 },
          { name: 'Exames e Consultas', estimated: 300 },
          { name: 'Academia', estimated: 924 },
          { name: 'Atividades Esportivas', estimated: 200 },
          { name: 'Equipamentos e Manutenção', estimated: 500 },
          { name: 'Terapias e Saúde Mental', estimated: 500 },
          { name: 'Vestuário e Roupas', estimated: 500 },
          { name: 'Salão e Cabelo', estimated: 200 },
          { name: 'Beleza e Estética', estimated: 500 },
          { name: 'Massagem', estimated: 200 },
        ],
      },
      {
        name: 'Transporte',
        color: '#F59E0B',
        icon: 'Car',
        estimated: 2358,
        subcategories: [
          { name: 'Combustível', estimated: 1000 },
          { name: 'Uber / Táxi', estimated: 200 },
          { name: 'Seguro do Carro', estimated: 188 },
          { name: 'Pedágios e Estacionamento', estimated: 200 },
          { name: 'Manutenção do Carro', estimated: 400 },
          { name: 'Inspeção e Impostos Auto', estimated: 320 },
          { name: 'Aluguel ou Compra Automóvel', estimated: 0 },
        ],
      },
      {
        name: 'Lazer',
        color: '#10B981',
        icon: 'Coffee',
        estimated: 3600,
        subcategories: [
          { name: 'Restaurantes', estimated: 1000 },
          { name: 'Alimentação Fora', estimated: 800 },
          { name: 'Eventos e Shows', estimated: 200 },
          { name: 'Passagens Aéreas', estimated: 800 },
          { name: 'Turismo e Hospedagem', estimated: 1000 },
          { name: 'Passagens Locais', estimated: 100 },
        ],
      },
      {
        name: 'Educação',
        color: '#8B5CF6',
        icon: 'BookOpen',
        estimated: 1880,
        subcategories: [
          { name: 'Cursos Online', estimated: 112 },
          { name: 'Mentorias', estimated: 1668 },
          { name: 'Materiais e Livros', estimated: 100 },
        ],
      },
      {
        name: 'Assinaturas',
        color: '#06B6D4',
        icon: 'Layers',
        estimated: 371,
        subcategories: [
          { name: 'Streaming (Netflix, Spotify)', estimated: 40 },
          { name: 'Armazenamento em Nuvem (Google, Apple)', estimated: 143 },
          { name: 'Software e Ferramentas (Figma, Loom)', estimated: 114 },
          { name: 'Inteligência Artificial (ChatGPT, Claude)', estimated: 120 },
        ],
      },
      {
        name: 'Impostos',
        color: '#6366F1',
        icon: 'FileText',
        estimated: 812,
        subcategories: [
          { name: 'Impostos Governamentais', estimated: 639 },
          { name: 'Contribuições e Taxas Oficiais', estimated: 173 },
        ],
      },
      {
        name: 'Tarifas Financeiras',
        color: '#F97316',
        icon: 'CreditCard',
        estimated: 319,
        subcategories: [
          { name: 'Taxas Bancárias', estimated: 112 },
          { name: 'Juros e Taxas Cartão', estimated: 200 },
          { name: 'Seguro Pix / Conta', estimated: 7 },
        ],
      },
      {
        name: 'Serviços',
        color: '#14B8A6',
        icon: 'Briefcase',
        estimated: 460,
        subcategories: [{ name: 'Contabilidade', estimated: 460 }],
      },
      {
        name: 'Social',
        color: '#84CC16',
        icon: 'Gift',
        estimated: 400,
        subcategories: [
          { name: 'Presentes', estimated: 300 },
          { name: 'Doações', estimated: 100 },
        ],
      },
      {
        name: 'Extras',
        color: '#64748B',
        icon: 'PlusCircle',
        estimated: 300,
        subcategories: [
          { name: 'Eletrônicos', estimated: 300 },
          { name: 'Investimentos', estimated: 0 },
          { name: 'Material de Obra', estimated: 0 },
          { name: 'Serviço de Obra', estimated: 0 },
          { name: 'Não Categorizado', estimated: 0 },
        ],
      },
    ]

    for (let i = 0; i < taxonomy.length; i++) {
      const item = taxonomy[i]
      let parentRecord
      try {
        parentRecord = app.findFirstRecordByData('categories', 'name', item.name)
      } catch (_) {
        parentRecord = new Record(categoriesCol)
        parentRecord.set('name', item.name)
        parentRecord.set('type', 'main')
        parentRecord.set('estimated', item.estimated)
        parentRecord.set('color', item.color)
        parentRecord.set('icon', item.icon)
        app.save(parentRecord)
      }

      if (item.subcategories && item.subcategories.length > 0) {
        for (let j = 0; j < item.subcategories.length; j++) {
          const sub = item.subcategories[j]
          try {
            app.findFirstRecordByData('categories', 'name', sub.name)
          } catch (_) {
            const subRecord = new Record(categoriesCol)
            subRecord.set('name', sub.name)
            subRecord.set('type', 'sub')
            subRecord.set('parent', parentRecord.id)
            subRecord.set('estimated', sub.estimated || 0)
            subRecord.set('color', item.color)
            app.save(subRecord)
          }
        }
      }
    }
  },
  (app) => {
    // down logic
  },
)
