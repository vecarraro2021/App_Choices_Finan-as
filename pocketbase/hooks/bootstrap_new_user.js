// pocketbase/hooks/bootstrap_new_user.js
// Quando um novo usuário é cadastrado no sistema, inicializa automaticamente
// a sua árvore padrão de categorias (12 principais + subcategorias com orçamentos zerados)
// e garante isolamento com ZERO transações ou receitas pré-existentes.

onRecordAfterCreateSuccess((e) => {
  e.next()

  try {
    const user = e.record
    const userId = user.id

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

    const catCol = $app.findCollectionByNameOrId('categories')

    // Checar se já existem categorias para esse usuário
    const existing = $app.findRecordsByFilter('categories', `owner = '${userId}'`, '', 1, 0)
    if (existing.length > 0) {
      return
    }

    for (let i = 0; i < defaultTaxonomy.length; i++) {
      const item = defaultTaxonomy[i]
      const parentRecord = new Record(catCol)
      parentRecord.set('name', item.name)
      parentRecord.set('type', 'main')
      parentRecord.set('estimated', 0)
      parentRecord.set('color', item.color)
      parentRecord.set('icon', item.icon)
      parentRecord.set('owner', userId)
      $app.save(parentRecord)

      for (let j = 0; j < item.subcategories.length; j++) {
        const subName = item.subcategories[j]
        const subRecord = new Record(catCol)
        subRecord.set('name', subName)
        subRecord.set('type', 'sub')
        subRecord.set('parent', parentRecord.id)
        subRecord.set('estimated', 0)
        subRecord.set('color', item.color)
        subRecord.set('owner', userId)
        $app.save(subRecord)
      }
    }

    console.log(`[bootstrap_new_user] Categorias criadas com sucesso para usuário: ${userId}`)
  } catch (err) {
    console.error('[bootstrap_new_user] Erro ao provisionar estrutura inicial:', err)
  }
}, 'users')
