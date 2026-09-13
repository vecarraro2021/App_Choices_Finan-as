import { Category } from '@/types/finance'

// Keyword rules for matching descriptions to categories
const KEYWORD_MAP: Record<string, string[]> = {
  // Moradia
  aluguel: ['aluguel', 'condominio', 'locacao', 'imobiliaria', 'quintoandar', 'loft'],
  mercado: [
    'mercado',
    'supermercado',
    'pao de acucar',
    'carrefour',
    'assaí',
    'atacadao',
    'extra',
    'hortifruti',
    'feira',
    'padaria',
  ],
  internet: ['internet', 'claro', 'vivo fib', 'oi fibra', 'tim live', 'starlink', 'provedor'],
  luz: ['enel', 'light', 'cemig', 'copel', 'cpfl', 'eletropaulo', 'conta luz', 'energia'],
  água: ['sabesp', 'cedae', 'sanepar', 'copasa', 'conta agua', 'saneamento'],
  limpeza: ['diarista', 'faxina', 'limpeza', 'lavanderia', 'omo lavanderia'],

  // Cuidados Pessoais / Saúde
  farmácia: [
    'farmacia',
    'droga raia',
    'drogasil',
    'pacheco',
    'drogaria',
    'panvel',
    'medicamento',
    'remedio',
  ],
  'plano de saúde': [
    'unimed',
    'bradesco saude',
    'sulamerica',
    'amil',
    'notredame',
    'plano de saude',
    'convenio',
  ],
  'exames e consultas': [
    'consulta',
    'exame',
    'laboratorio',
    'fleury',
    'delboni',
    'lavoisier',
    'medico',
    'dentista',
    'oftalmo',
  ],
  academia: [
    'academia',
    'smart fit',
    'bluefit',
    'bodytech',
    'totalpass',
    'gympass',
    'crossfit',
    'natacao',
  ],
  'salão e cabelo': [
    'salao',
    'cabelo',
    'cabeleireiro',
    'barbearia',
    'unhas',
    'manicure',
    'estetica',
  ],

  // Transporte
  combustível: [
    'posto',
    'gasolina',
    'combustivel',
    'ipiranga',
    'shell',
    'petrobras',
    'etanol',
    'diesel',
    'gnv',
  ],
  'uber / táxi': ['uber', 'bolt', '99app', '99 pop', 'taxi', 'cabify'],
  'pedágios e estacionamento': [
    'sem parar',
    'veloe',
    'conectcar',
    'pedagio',
    'estacionamento',
    'estapar',
    'zona azul',
  ],
  'seguro do carro': [
    'porto seguro',
    'tokio marine',
    'itau seguros',
    'allianz',
    'seguro auto',
    'youse',
  ],
  'aluguel ou compra automóvel': [
    'localiza',
    'movida',
    'unidas',
    'concessionaria',
    'automovel',
    'compra veiculo',
    'carro',
  ],

  // Lazer
  restaurantes: [
    'restaurante',
    'bistro',
    'churrascaria',
    'pizzaria',
    'sushi',
    'hamburgueria',
    'bar ',
    'boteco',
  ],
  'alimentação fora': [
    'ifood',
    'rappi',
    'mcdonald',
    'burger king',
    'subway',
    'starbucks',
    'lanches',
  ],
  'eventos e shows': [
    'ticket',
    'sympla',
    'eventim',
    'ingresso',
    'show',
    'cinema',
    'cinemark',
    'teatro',
  ],
  'passagens aéreas': [
    'latam',
    'gol ',
    'azul linhas',
    'airline',
    'tap',
    'iberia',
    'decolar',
    'voo',
  ],
  'turismo e hospedagem': ['airbnb', 'booking', 'hotel', 'pousada', 'resort', 'hostel'],

  // Assinaturas
  'streaming (netflix, spotify)': [
    'netflix',
    'spotify',
    'amazon prime',
    'disney',
    'hbo',
    'max ',
    'globoplay',
    'youtube',
  ],
  'armazenamento em nuvem (google, apple)': [
    'google storage',
    'google one',
    'google gsuite',
    'apple.com/bill',
    'icloud',
    'dropbox',
  ],
  'software e ferramentas (figma, loom)': [
    'figma',
    'loom',
    'notion',
    'github',
    'slack',
    'adobe',
    'canva',
    'cursor',
    'godaddy',
  ],
  'inteligência artificial (chatgpt, claude)': [
    'openai',
    'chatgpt',
    'claude',
    'anthropic',
    'midjourney',
    'skip ai',
    'adapta',
  ],

  // Educação
  'cursos online': ['hotmart', 'udemy', 'coursera', 'alura', 'edx', 'awari'],
  mentorias: ['mentoria', 'coaching', 'consultoria'],
  'materiais e livros': ['amazon livros', 'livraria', 'saraiva', 'kindle'],

  // Tarifas Financeiras
  'taxas bancárias': ['tarifa', 'mensalidade conta', 'anuidade', 'taxa banco', 'iof'],
  'juros e taxas cartão': ['juros', 'encargos', 'multa atraso', 'rotativo'],

  // Serviços
  contabilidade: ['contabilizei', 'contabilidade', 'contador', 'honorarios'],

  // Investimentos
  investimentos: [
    'b3',
    'xp ',
    'btg',
    'rico',
    'clear',
    'inter dtvm',
    'tesouro direto',
    'cripto',
    'binance',
    'investimento',
    'renda fixa',
    'cdb',
    'lci',
    'lca',
    'fundos',
  ],
  degiro: ['degiro', 'flatex', 'corretora eur', 'bolsa europeia'],
  consorcio: ['consorcio', 'consorcio porto', 'consorcio bb', 'consorcio caixa'],
  'outros investimentos': ['previdencia', 'vgbl', 'pgbl', 'acoes', 'fii', 'etf'],

  // Extras
  'material de obra': ['leroy merlin', 'c&c', 'telhanorte', 'material de construcao', 'tintas'],
  'serviço de obra': ['marceneiro', 'pedreiro', 'eletricista', 'pintor', 'reforma'],
}

/**
 * Suggests a category ID given a transaction description.
 */
export interface CategoryMatchResult {
  categoryId?: string
  confidence: 'alta' | 'media' | 'nenhuma'
  matchedBy?: 'direct' | 'keyword'
}

/**
 * Detailed suggestion evaluation to differentiate confident matches from uncertain ones.
 */
export function evaluateCategoryMatch(
  description: string,
  categories: Category[],
): CategoryMatchResult {
  if (!description) return { confidence: 'nenhuma' }
  const descLower = description.toLowerCase()

  // 1. Direct subcategory / category name match (high confidence)
  for (const cat of categories) {
    const nameLower = cat.name.toLowerCase()
    // Skip very short or generic names to avoid false positives
    if (nameLower.length > 3 && descLower.includes(nameLower)) {
      return { categoryId: cat.id, confidence: 'alta', matchedBy: 'direct' }
    }
  }

  // 2. Keyword rules matching (medium confidence)
  for (const [catNameKey, keywords] of Object.entries(KEYWORD_MAP)) {
    const matched = keywords.some((kw) => descLower.includes(kw))
    if (matched) {
      const found = categories.find(
        (c) =>
          c.name.toLowerCase().includes(catNameKey.toLowerCase()) ||
          catNameKey.toLowerCase().includes(c.name.toLowerCase()),
      )
      if (found) {
        return { categoryId: found.id, confidence: 'media', matchedBy: 'keyword' }
      }
    }
  }

  return { confidence: 'nenhuma' }
}

/**
 * Suggests a category ID given a transaction description.
 */
export function suggestCategory(description: string, categories: Category[]): string | undefined {
  const match = evaluateCategoryMatch(description, categories)
  if (match.categoryId) {
    return match.categoryId
  }

  // 3. Fallback to "Não Categorizado" or "Extras" if available
  const uncategorized = categories.find(
    (c) => c.name.toLowerCase() === 'não categorizado' || c.name.toLowerCase() === 'extras',
  )
  return uncategorized?.id
}
