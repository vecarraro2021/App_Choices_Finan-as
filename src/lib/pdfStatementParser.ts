/**
 * Parser inteligente de extratos bancários e faturas de cartão de crédito em PDF.
 * Suporta formatos de bancos e emissores do Brasil e de Portugal:
 * - Nubank, Itaú, Bradesco, Santander, Banco do Brasil, Inter, C6 Bank, XP, Caixa
 * - Millennium BCP, Caixa Geral de Depósitos (CGD), Novo Banco, ActivoBank, Santander Totta, Revolut
 * - Faturas de cartão com "pagamento recebido", estorno, compras parceladas
 * - Datas: dd/mm/yyyy, dd/mm/yy, dd/mm, yyyy-mm-dd, e meses por extenso (05 Jan, 12 Out)
 * - Valores: R$ 1.234,56, € 1.234,56, 1,234.56, valores com sinal negativo ou positivo
 */
import { normalizeDate } from './fileParser'

export interface PDFParsedTransaction {
  id: string
  date: string // YYYY-MM-DD
  rawDate: string
  description: string
  amount: number // Valor positivo
  currency: 'BRL' | 'EUR'
  type: 'debit' | 'credit'
  rawLine: string
  month: string // YYYY-MM
}

export interface PDFParseResult {
  transactions: PDFParsedTransaction[]
  detectedYear?: number
  detectedCurrency?: 'BRL' | 'EUR'
  totalLinesScanned: number
  unrecognizedLines: string[]
  reason?: string
}

// Meses em português para extratos que usam formato "15 JAN" ou "15 Jan 2026"
const PT_MONTHS: Record<string, string> = {
  jan: '01',
  fev: '02',
  feb: '02',
  mar: '03',
  abr: '04',
  apr: '04',
  mai: '05',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  aug: '08',
  set: '09',
  sep: '09',
  out: '10',
  oct: '10',
  nov: '11',
  dez: '12',
  dec: '12',
}

/**
 * Remove cabeçalhos, rodapés e linhas irrelevantes comumente encontradas em extratos e faturas.
 */
function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase().trim()
  if (!lower) return true

  // Ignorar linhas de página, aviso ou sumário
  if (/^p[aá]gina\s+\d+(\s+de\s+\d+|\s*\/\s*\d+)?$/i.test(lower)) return true
  if (/^extrato\s+(de\s+conta|banc[aá]rio|mensal|consolidado)/i.test(lower)) return true
  if (/^fatura\s+(do\s+cart[aã]o|fechada|aberta|detalhada)/i.test(lower)) return true
  if (/^saldo\s+(anterior|inicial|final|atual|dispon[ií]vel|bloqueado)/i.test(lower)) return true
  if (
    /^total\s+(da\s+fatura|desta\s+fatura|dos\s+lan[çc]amentos|a\s+pagar|gasto|em\s+compras)/i.test(
      lower,
    )
  )
    return true
  if (
    /^(vencimento|pagamento\s+m[ií]nimo|limite\s+total|limite\s+dispon[ií]vel|encargos|juros|iof)/i.test(
      lower,
    )
  )
    return true
  if (
    /^(data|lan[çc]amento|hist[oó]rico|descri[çc][aã]o|documento|movimento|valor|cr[eé]dito|d[eé]bito)\s*(\t|;|\||\s{2,})/i.test(
      lower,
    )
  )
    return true
  if (
    /^(ouvidoria|sac|atendimento|central\s+de\s+relacionamento|cnpj|banco|ag[eê]ncia|conta\s+corrente)/i.test(
      lower,
    )
  )
    return true
  if (lower.length > 250) return true // Linhas excessivamente longas são quase sempre termos legais

  return false
}

/**
 * Tenta inferir o ano de referência do extrato examinando o cabeçalho ou o texto global.
 */
function inferDocumentYear(fullText: string): number {
  const currentYear = new Date().getFullYear()

  // Procura padrões como "Referência: 09/2026", "Setembro de 2026", "2026-09", "Extrato de 2026", "Vencimento: ... 2026"
  const yearMatch = fullText.match(
    /(?:refer[eê]ncia|per[ií]odo|vencimento|extrato|fatura|data de emiss[aã]o)[\s\S]{0,40}\b(202[0-9])\b/i,
  )
  if (yearMatch) {
    const yr = parseInt(yearMatch[1], 10)
    if (yr >= 2020 && yr <= 2035) return yr
  }

  // Procura primeira data com 4 dígitos no texto
  const genericYear = fullText.match(/\b\d{1,2}[/-]\d{1,2}[/-](202[0-9])\b/)
  if (genericYear) {
    const yr = parseInt(genericYear[1], 10)
    if (yr >= 2020 && yr <= 2035) return yr
  }

  return currentYear
}

/**
 * Detecta moeda provável (€ para bancos portugueses/europeus ou R$ para brasileiros)
 */
function inferDocumentCurrency(fullText: string): 'BRL' | 'EUR' {
  const euroCount = (fullText.match(/€|eur\b|millennium|cgd|activo|novo banco/gi) || []).length
  const realCount = (
    fullText.match(/r\$|brl\b|nubank|ita[uú]|bradesco|inter|c6|santander brasil/gi) || []
  ).length

  if (euroCount > realCount) return 'EUR'
  return 'BRL'
}

/**
 * Extrai o valor monetário de uma substring
 */
function extractAmount(str: string): { amount: number; isNegative: boolean } | null {
  // Procura formatos:
  // - "1.234,56", "1234,56", "1,234.56", "1234.56"
  // - Com ou sem sinal (+ ou - ou D ou C ou CR)
  // - Com ou sem R$ ou €
  const cleaned = str.trim()

  const match = cleaned.match(
    /([-+]?)\s*(?:R\$|€|EUR|BRL)?\s*([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})\s*([+-]|D|C|CR)?$/i,
  )

  if (!match) return null

  const prefixSign = match[1]
  const rawNum = match[2]
  const suffixSign = (match[3] || '').toUpperCase()

  let isNegative = prefixSign === '-' || suffixSign === '-' || suffixSign === 'D'

  // Normalizar valor para float:
  // Se tem vírgula e ponto (1.234,56 ou 1,234.56)
  let numStr = rawNum
  if (numStr.includes(',') && numStr.includes('.')) {
    if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
      // 1.234,56 -> formato BR/PT
      numStr = numStr.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 -> formato US
      numStr = numStr.replace(/,/g, '')
    }
  } else if (numStr.includes(',')) {
    numStr = numStr.replace(',', '.')
  }

  const parsed = parseFloat(numStr)
  if (isNaN(parsed) || parsed === 0) return null

  return {
    amount: Math.abs(parsed),
    isNegative,
  }
}

/**
 * Tenta parsear uma data no início ou fim de uma linha
 */
function extractDate(
  line: string,
  docYear: number,
): { dateStr: string; normDate: string; remainingText: string } | null {
  // 1. Formato DD/MM/YYYY ou DD-MM-YYYY
  const fullDateMatch = line.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b\s*(.*)$/)
  if (fullDateMatch) {
    const d = fullDateMatch[1].padStart(2, '0')
    const m = fullDateMatch[2].padStart(2, '0')
    let y = fullDateMatch[3]
    if (y.length === 2) y = '20' + y
    return {
      dateStr: `${fullDateMatch[1]}/${fullDateMatch[2]}/${fullDateMatch[3]}`,
      normDate: `${y}-${m}-${d}`,
      remainingText: fullDateMatch[4].trim(),
    }
  }

  // 2. Formato YYYY-MM-DD (ISO)
  const isoMatch = line.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b\s*(.*)$/)
  if (isoMatch) {
    const y = isoMatch[1]
    const m = isoMatch[2].padStart(2, '0')
    const d = isoMatch[3].padStart(2, '0')
    return {
      dateStr: `${d}/${m}/${y}`,
      normDate: `${y}-${m}-${d}`,
      remainingText: isoMatch[4].trim(),
    }
  }

  // 3. Formato DD/MM (comum em faturas de cartão de crédito)
  const shortDateMatch = line.match(/^(\d{1,2})[/.-](\d{1,2})\b(?!\s*[/.-]\s*\d)\s*(.*)$/)
  if (shortDateMatch) {
    const d = shortDateMatch[1].padStart(2, '0')
    const m = shortDateMatch[2].padStart(2, '0')
    const dayNum = parseInt(d, 10)
    const monthNum = parseInt(m, 10)
    // Validação básica para evitar falsos positivos (ex: "1/2 entrada")
    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
      return {
        dateStr: `${d}/${m}`,
        normDate: `${docYear}-${m}-${d}`,
        remainingText: shortDateMatch[3].trim(),
      }
    }
  }

  // 4. Formato "15 Jan" ou "15 Jan 2026"
  const textMonthMatch = line.match(/^(\d{1,2})\s+([A-Za-z]{3})\.?(?:\s+(\d{2,4}))?\b\s*(.*)$/i)
  if (textMonthMatch) {
    const d = textMonthMatch[1].padStart(2, '0')
    const monthKey = textMonthMatch[2].toLowerCase()
    const m = PT_MONTHS[monthKey]
    if (m) {
      let y = textMonthMatch[3] ? textMonthMatch[3] : String(docYear)
      if (y.length === 2) y = '20' + y
      return {
        dateStr: `${textMonthMatch[1]} ${textMonthMatch[2]}`,
        normDate: `${y}-${m}-${d}`,
        remainingText: textMonthMatch[4].trim(),
      }
    }
  }

  return null
}

/**
 * Tenta parsear uma única linha ou linha composta como transação bancária/cartão
 */
function tryParseTransactionLine(
  line: string,
  docYear: number,
  defaultCurrency: 'BRL' | 'EUR',
): PDFParsedTransaction | null {
  const trimmed = line.trim()
  if (!trimmed || isNoiseLine(trimmed)) return null

  // 1. Extrair data no início da linha
  const dateResult = extractDate(trimmed, docYear)
  if (!dateResult) return null

  const rest = dateResult.remainingText
  if (!rest) return null

  // 2. Extrair valor no final da linha
  // Ex: "Supermercado Pão de Açúcar 123,45"
  // Ex: "UBER *TRIP 14,90-"
  // Ex: "PAGAMENTO DE FATURA -1.250,00"
  // Ex: "CONTINENTE MATOSINHOS € 45,20"
  const valRegex =
    /(?:(R\$|€|EUR|BRL)\s*)?([-+]?\s*[0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})\s*([+-]|D|C|CR)?$/i

  const valMatch = rest.match(valRegex)
  if (!valMatch) return null

  const fullValStr = valMatch[0]
  const amountParsed = extractAmount(fullValStr)
  if (!amountParsed || amountParsed.amount === 0) return null

  // A descrição é o que fica entre a data e o valor
  let description = rest.slice(0, valMatch.index).trim()

  // Se sobrou pouca descrição ou nada, pode ser que o valor não seja o último token
  if (!description) return null

  // Limpar caracteres repetidos de tabela/espaçamento como "... " ou "---"
  description = description
    .replace(/[._-]{3,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Detectar moeda na linha ou usar a do documento
  let lineCurrency = defaultCurrency
  if (fullValStr.includes('€') || /EUR/i.test(fullValStr) || /EUR/i.test(rest)) {
    lineCurrency = 'EUR'
  } else if (fullValStr.includes('R$') || /BRL/i.test(fullValStr) || /R\$/i.test(rest)) {
    lineCurrency = 'BRL'
  }

  // Detectar se é crédito (recebimento/pagamento recebido/estorno) ou débito (despesa)
  // Em faturas de cartão: "Pagamento recebido", "Crédito", "Estorno" são entradas
  const lowerDesc = description.toLowerCase()
  let isCredit = false
  if (
    lowerDesc.includes('pagamento recebido') ||
    lowerDesc.includes('pagamento de fatura') ||
    lowerDesc.includes('estorno') ||
    lowerDesc.includes('reembolso') ||
    lowerDesc.includes('transferencia recebida') ||
    lowerDesc.includes('deposito recebido') ||
    lowerDesc.includes('pix recebido') ||
    lowerDesc.includes('ordenado') ||
    lowerDesc.includes('salario') ||
    lowerDesc.includes('rendimento')
  ) {
    isCredit = true
  }

  // Se o valor tinha sufixo C ou CR ou sinal de crédito
  if (
    fullValStr.toUpperCase().includes('CR') ||
    (valMatch[3] && valMatch[3].toUpperCase() === 'C')
  ) {
    isCredit = true
  }

  const type = isCredit ? 'credit' : 'debit'
  const month = dateResult.normDate.slice(0, 7)

  return {
    id: `pdf-tx-${Math.random().toString(36).slice(2, 9)}`,
    date: dateResult.normDate,
    rawDate: dateResult.dateStr,
    description,
    amount: amountParsed.amount,
    currency: lineCurrency,
    type,
    rawLine: line,
    month,
  }
}

/**
 * Executa o parsing completo de um extrato ou fatura em PDF a partir de suas linhas de texto.
 * Agrupa descrições em múltiplas linhas e ignora cabeçalhos/rodapés.
 */
export function parsePDFStatement(
  lines: string[],
  fullText: string,
  preferredYear?: number,
): PDFParseResult {
  const detectedYear = preferredYear || inferDocumentYear(fullText)
  const detectedCurrency = inferDocumentCurrency(fullText)
  const transactions: PDFParsedTransaction[] = []
  const unrecognizedLines: string[] = []

  let pendingTx: PDFParsedTransaction | null = null

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine) continue

    // Verifica se a linha é cabeçalho/ruído
    if (isNoiseLine(rawLine)) {
      if (pendingTx) {
        transactions.push(pendingTx)
        pendingTx = null
      }
      continue
    }

    // Tenta reconhecer como nova transação
    const tx = tryParseTransactionLine(rawLine, detectedYear, detectedCurrency)

    if (tx) {
      if (pendingTx) {
        transactions.push(pendingTx)
      }
      pendingTx = tx
    } else {
      // Se não começou com data, pode ser a continuação da descrição da transação anterior
      // (ex: parcelamento "01/10", nome longo do estabelecimento em 2 linhas)
      if (pendingTx && !rawLine.match(/^[0-9]{1,3}[.,][0-9]{2}$/)) {
        // Se a linha não parece outro valor isolado ou metadado, concatena
        if (
          !rawLine.toLowerCase().includes('saldo') &&
          !rawLine.toLowerCase().includes('total') &&
          rawLine.length < 80
        ) {
          pendingTx.description += ' ' + rawLine
          pendingTx.rawLine += ' ' + rawLine
          continue
        }
      }

      if (pendingTx) {
        transactions.push(pendingTx)
        pendingTx = null
      }

      unrecognizedLines.push(rawLine)
    }
  }

  if (pendingTx) {
    transactions.push(pendingTx)
  }

  // Ordenar transações por data cronológica
  transactions.sort((a, b) => a.date.localeCompare(b.date))

  return {
    transactions,
    detectedYear,
    detectedCurrency,
    totalLinesScanned: lines.length,
    unrecognizedLines,
    reason:
      transactions.length === 0
        ? 'Não foi possível identificar transações neste PDF — pode ser protegido por senha, digitalizado sem camada de texto (imagem) ou em formato não reconhecido.'
        : undefined,
  }
}
