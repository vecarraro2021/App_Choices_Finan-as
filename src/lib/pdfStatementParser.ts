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
  currencyConfidence?: 'high' | 'medium' | 'fallback'
  currencyReason?: string
  totalLinesScanned: number
  unrecognizedLines: string[]
  reason?: string
  detectedCompetenceMonth?: string // YYYY-MM inferido da fatura/período vigente
  detectedPeriodLabel?: string // Ex: "31 AGO a 30 SET"
  detectedDueDate?: string // Ex: "07 OUT 2026" ou "07/10/2026"
  isCreditCardInvoice?: boolean
  isNuAccountStatement?: boolean
  totalDebits?: number
  totalCredits?: number
  extractionFailureType?: 'empty_text' | 'no_match' | 'worker_error'
}

// Meses em português para extratos que usam formato "15 JAN" ou "15 Jan 2026"
export const PT_MONTHS: Record<string, string> = {
  jan: '01',
  janeiro: '01',
  january: '01',
  fev: '02',
  feb: '02',
  fevereiro: '02',
  february: '02',
  mar: '03',
  marco: '03',
  março: '03',
  march: '03',
  abr: '04',
  apr: '04',
  abril: '04',
  april: '04',
  mai: '05',
  may: '05',
  maio: '05',
  jun: '06',
  junho: '06',
  june: '06',
  jul: '07',
  julho: '07',
  july: '07',
  agu: '08',
  ago: '08',
  aug: '08',
  agosto: '08',
  august: '08',
  set: '09',
  sep: '09',
  setembro: '09',
  september: '09',
  out: '10',
  oct: '10',
  outubro: '10',
  october: '10',
  nov: '11',
  novembro: '11',
  november: '11',
  dez: '12',
  dec: '12',
  dezembro: '12',
  december: '12',
}

/**
 * Remove cabeçalhos, rodapés e linhas irrelevantes comumente encontradas em extratos e faturas.
 */
function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase().trim()
  if (!lower) return true

  // Ignorar linhas de página, aviso ou sumário
  if (/^(?:p[aá]gina\s+)?\d+\s+de\s+\d+$/i.test(lower)) return true
  if (/^p[aá]gina\s+\d+(\s*\/\s*\d+)?$/i.test(lower)) return true
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
 * Detecta competência e metadados de fatura de cartão de crédito.
 * Exemplo Nubank: "Período vigente: 31 AGO a 30 SET", "Data de vencimento: 07 OUT 2026", "TRANSAÇÕES DE 31 AGO A 30 SET"
 * Competência principal da fatura = mês final do período de compras (ex: SET/2026 -> 2026-09)
 * ou mês anterior ao vencimento.
 */
export function inferInvoiceCompetence(
  fullText: string,
  docYear: number,
): {
  competenceMonth?: string
  periodLabel?: string
  dueDate?: string
  isInvoice: boolean
} {
  const isInvoice =
    /fatura|cart[aã]o\s+de\s+cr[eé]dito|limite\s+total|pagamento\s+m[ií]nimo|fechamento\s+da\s+pr[oó]xima\s+fatura/i.test(
      fullText,
    )

  let periodLabel: string | undefined
  let dueDate: string | undefined
  let competenceMonth: string | undefined

  // 1. Período vigente (ex: "Período vigente: 31 AGO a 30 SET" ou "TRANSAÇÕES DE 31 AGO A 30 SET" ou "31/08 a 30/09" ou "31 AGO - 30 SET")
  const periodMatch = fullText.match(
    /(?:per[ií]odo(?:\s+vigente)?|transa[çc][oõ]es\s+de|total\s+de\s+compras(?:\s+de\s+todos\s+os\s+cart[oõ]es)?)\s*[:-]?\s*(\d{1,2}\s+[A-Za-z]{3}\s*(?:a|-|at[eé])\s*\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{2,4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\s*(?:a|-|at[eé])\s*\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i,
  )

  if (periodMatch) {
    periodLabel = periodMatch[1].trim()
    // Tenta extrair o mês final do período (a competência da fatura)
    // Ex: "31 AGO a 30 SET" -> "30 SET"
    const textEndMatch = periodLabel.match(
      /(?:a|-|at[eé])\s+(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{2,4}))?/i,
    )
    if (textEndMatch) {
      const monthKey = textEndMatch[2].toLowerCase()
      const m = PT_MONTHS[monthKey]
      let y = textEndMatch[3] ? parseInt(textEndMatch[3], 10) : docYear
      if (y < 100) y = 2000 + y
      if (m && y >= 2020 && y <= 2035) {
        competenceMonth = `${y}-${m}`
      }
    } else {
      const numEndMatch = periodLabel.match(
        /(?:a|-|at[eé])\s+\d{1,2}[/-](\d{1,2})(?:[/-](\d{2,4}))?/i,
      )
      if (numEndMatch) {
        const m = numEndMatch[1].padStart(2, '0')
        let y = numEndMatch[2] ? parseInt(numEndMatch[2], 10) : docYear
        if (y < 100) y = 2000 + y
        if (parseInt(m, 10) >= 1 && parseInt(m, 10) <= 12 && y >= 2020 && y <= 2035) {
          competenceMonth = `${y}-${m}`
        }
      }
    }
  }

  // 2. Data de vencimento (ex: "Data de vencimento: 07 OUT 2026" ou "Vencimento: 07/10/2026")
  const dueMatch = fullText.match(
    /(?:data\s+de\s+vencimento|vencimento)\s*[:-]?\s*(\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{2,4})?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  )
  if (dueMatch) {
    dueDate = dueMatch[1].trim()
    // Se ainda não temos competenceMonth, inferir como o mês anterior ao vencimento (ou o próprio mês se o fechamento for no mesmo mês)
    if (!competenceMonth) {
      const textDue = dueDate.match(/^(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{2,4}))?/i)
      if (textDue) {
        const mKey = textDue[2].toLowerCase()
        const dueM = PT_MONTHS[mKey]
        let dueY = textDue[3] ? parseInt(textDue[3], 10) : docYear
        if (dueY < 100) dueY = 2000 + dueY
        if (dueM) {
          const dueDay = parseInt(textDue[1], 10)
          // Se o vencimento é no início do mês (dia <= 15), a competência das despesas quase sempre é o mês anterior
          if (dueDay <= 15) {
            const mNum = parseInt(dueM, 10)
            const compM = mNum === 1 ? 12 : mNum - 1
            const compY = mNum === 1 ? dueY - 1 : dueY
            competenceMonth = `${compY}-${String(compM).padStart(2, '0')}`
          } else {
            competenceMonth = `${dueY}-${dueM}`
          }
        }
      } else {
        const numDue = dueDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i)
        if (numDue) {
          const dueDay = parseInt(numDue[1], 10)
          const dueM = parseInt(numDue[2], 10)
          let dueY = parseInt(numDue[3], 10)
          if (dueY < 100) dueY = 2000 + dueY
          if (dueDay <= 15) {
            const compM = dueM === 1 ? 12 : dueM - 1
            const compY = dueM === 1 ? dueY - 1 : dueY
            competenceMonth = `${compY}-${String(compM).padStart(2, '0')}`
          } else {
            competenceMonth = `${dueY}-${String(dueM).padStart(2, '0')}`
          }
        }
      }
    }
  }

  return {
    competenceMonth,
    periodLabel,
    dueDate,
    isInvoice,
  }
}

export interface CurrencyDetectionResult {
  currency: 'BRL' | 'EUR'
  confidence: 'high' | 'medium' | 'fallback'
  reason?: string
}

/**
 * Detecta moeda provável (€ para bancos portugueses/europeus ou R$ para brasileiros)
 * Retorna também o nível de confiança e razão para transparência no preview.
 */
export function detectDocumentCurrency(
  fullText: string,
  userDefaultCurrency: 'BRL' | 'EUR' = 'BRL',
): CurrencyDetectionResult {
  // Símbolos monetários explícitos têm peso maior
  const euroSymbolCount = (fullText.match(/€|\beur\b|\beuros?\b/gi) || []).length
  const realSymbolCount = (fullText.match(/r\$|\bbrl\b|\breais\b/gi) || []).length

  // Emissores / bancos conhecidos
  const euroBankCount = (
    fullText.match(
      /millennium(?:\s+bcp)?|caixa\s+geral\s+de\s+dep[oó]sitos|cgd\b|activo(?:\s*bank)?|novo\s+banco|santander\s+totta|banco\s+bpi|montepio|revolut\b/gi,
    ) || []
  ).length
  const brBankCount = (
    fullText.match(
      /nubank|nu\s+pagamentos|ita[uú]|bradesco|banco\s+do\s+brasil|inter\b|c6\s*bank|xp\s+investimentos|caixa\s+econ[oô]mica|santander\s+brasil/gi,
    ) || []
  ).length

  const euroScore = euroSymbolCount * 3 + euroBankCount * 2
  const realScore = realSymbolCount * 3 + brBankCount * 2

  if (realScore > 0 && realScore > euroScore) {
    return {
      currency: 'BRL',
      confidence: realScore >= 3 ? 'high' : 'medium',
      reason:
        realSymbolCount > 0
          ? 'Identificado símbolo R$ / BRL no extrato'
          : 'Identificado emissor bancário brasileiro',
    }
  }

  if (euroScore > 0 && euroScore > realScore) {
    return {
      currency: 'EUR',
      confidence: euroScore >= 3 ? 'high' : 'medium',
      reason:
        euroSymbolCount > 0
          ? 'Identificado símbolo € / EUR no extrato'
          : 'Identificado banco / emissor europeu',
    }
  }

  // Se empatou ou nenhum foi detectado
  return {
    currency: userDefaultCurrency,
    confidence: 'fallback',
    reason: 'Moeda não identificada no arquivo, usando sua moeda padrão',
  }
}

/**
 * Mantido para retrocompatibilidade: retorna apenas 'BRL' | 'EUR'
 */
function inferDocumentCurrency(fullText: string): 'BRL' | 'EUR' {
  return detectDocumentCurrency(fullText).currency
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

  // 4. Formato "15 Jan" ou "15 Jan 2026" ou "15 de Jan" ou "15 Janeiro"
  const textMonthMatch = line.match(
    /^(\d{1,2})\s+(?:de\s+)?([A-Za-z]{3,9})\.?(?:\s+(?:de\s+)?(\d{2,4}))?\b\s*(.*)$/i,
  )
  if (textMonthMatch) {
    const d = textMonthMatch[1].padStart(2, '0')
    const monthWord = textMonthMatch[2]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    const monthKey3 = monthWord.slice(0, 3)
    const m = PT_MONTHS[monthWord] || PT_MONTHS[monthKey3]
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

  // 5. Linha de tabela markdown que começa com delimitador de coluna ou traço: ex: "| 31 AGO |"
  const pipeDateMatch = line.match(
    /^[|\s-]*(\d{1,2})[\s/-]+([A-Za-z]{3,9}|\d{1,2})(?:[\s/-]+(\d{2,4}))?\b\s*[|]?(.*)$/i,
  )
  if (pipeDateMatch) {
    const rawFirst = pipeDateMatch[1]
    const rawSecond = pipeDateMatch[2]
    const rawThird = pipeDateMatch[3]
    const d = rawFirst.padStart(2, '0')

    // Tentar como mês textual
    const monthWord = rawSecond
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    const monthKey3 = monthWord.slice(0, 3)
    const mText = PT_MONTHS[monthWord] || PT_MONTHS[monthKey3]

    if (mText) {
      let y = rawThird ? rawThird : String(docYear)
      if (y.length === 2) y = '20' + y
      return {
        dateStr: `${rawFirst} ${rawSecond}`,
        normDate: `${y}-${mText}-${d}`,
        remainingText: pipeDateMatch[4].replace(/^[|\s]+/, '').trim(),
      }
    } else if (/^\d{1,2}$/.test(rawSecond)) {
      // Mês numérico
      const mNum = rawSecond.padStart(2, '0')
      const dayVal = parseInt(d, 10)
      const monthVal = parseInt(mNum, 10)
      if (dayVal >= 1 && dayVal <= 31 && monthVal >= 1 && monthVal <= 12) {
        let y = rawThird ? rawThird : String(docYear)
        if (y.length === 2) y = '20' + y
        return {
          dateStr: `${d}/${mNum}`,
          normDate: `${y}-${mNum}-${d}`,
          remainingText: pipeDateMatch[4].replace(/^[|\s]+/, '').trim(),
        }
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

  // 0. Linhas formatadas como tabela markdown com pipe
  if (trimmed.includes('|')) {
    const isDividerCol = (val: string) => {
      const clean = val.replace(/\s+/g, '')
      return clean.length > 0 && clean.split('').every((ch) => ch === '-' || ch === ':')
    }
    const rawCols = trimmed
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !isDividerCol(s))
    if (rawCols.length >= 2) {
      const colDate = extractDate(rawCols[0], docYear)
      if (colDate) {
        const lastCol = rawCols[rawCols.length - 1]
        const amountFromLast = extractAmount(lastCol)
        if (amountFromLast && amountFromLast.amount > 0) {
          const middleCols = rawCols
            .slice(1, rawCols.length - 1)
            .join(' ')
            .replace(/^[|\s]+/, '')
            .replace(/[|\s]+$/, '')
            .trim()
          if (middleCols) {
            let lineCurrency = defaultCurrency
            if (lastCol.includes('€') || /EUR/i.test(lastCol)) lineCurrency = 'EUR'
            else if (lastCol.includes('R$') || /BRL/i.test(lastCol)) lineCurrency = 'BRL'

            const lowerDesc = middleCols.toLowerCase()
            const isCredit =
              amountFromLast.isNegative ||
              lowerDesc.includes('pagamento recebido') ||
              lowerDesc.includes('pagamento de fatura') ||
              lowerDesc.includes('estorno') ||
              lowerDesc.includes('reembolso') ||
              lowerDesc.includes('crédito') ||
              lowerDesc.includes('credito')

            return {
              id: `pdf-tx-${Math.random().toString(36).slice(2, 9)}`,
              date: colDate.normDate,
              rawDate: colDate.dateStr,
              description: middleCols,
              amount: amountFromLast.amount,
              currency: lineCurrency,
              type: isCredit ? 'credit' : 'debit',
              rawLine: line,
              month: colDate.normDate.slice(0, 7),
            }
          }
        }
      }
    }
  }

  // 1. Extrair data no início da linha
  const dateResult = extractDate(trimmed, docYear)
  if (!dateResult) return null

  const rest = dateResult.remainingText
  if (!rest) return null

  // 2. Extrair valor no final da linha ou antes de colunas secundárias (ex: parcelas, saldos)
  // Ex: "Supermercado Pão de Açúcar 123,45"
  // Ex: "•••• 2072 Htm *Aura - Parcela 5/6 R$ 73,02"
  // Ex: "UBER *TRIP 14,90-"
  // Ex: "PAGAMENTO DE FATURA -1.250,00"
  // Ex: "CONTINENTE MATOSINHOS € 45,20"
  const valRegex =
    /(?:(R\$|€|EUR|BRL)\s*)?([-+]?\s*[0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})\s*([+-]|D|C|CR)?$/i

  let valMatch = rest.match(valRegex)
  let description = ''
  let fullValStr = ''

  if (valMatch) {
    fullValStr = valMatch[0]
    description = rest.slice(0, valMatch.index).trim()
  } else {
    // Tenta encontrar padrão markdown table ou colunas: "... | R$ 123,45 |" ou "... 123,45 (com trailing noise)"
    const tableValMatch = rest.match(
      /(?:(R\$|€|EUR|BRL)\s*)?([-+]?\s*[0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})\s*([+-]|D|C|CR)?(?:\s*\|?\s*)$/i,
    )
    if (tableValMatch) {
      valMatch = tableValMatch
      fullValStr = tableValMatch[0]
      description = rest.slice(0, tableValMatch.index).trim()
    }
  }

  if (!valMatch || !fullValStr) return null

  const amountParsed = extractAmount(fullValStr)
  if (!amountParsed || amountParsed.amount === 0) return null

  // Se sobrou pouca descrição ou nada, pode ser que o valor não seja o último token
  if (!description) return null

  // Limpar pipes de tabela markdown e caracteres repetidos de tabela/espaçamento como "... " ou "---"
  description = description
    .replace(/^[|\s]+/, '')
    .replace(/[|\s]+$/, '')
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
  let isCredit = amountParsed.isNegative
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
    lowerDesc.includes('rendimento') ||
    lowerDesc.includes('crédito') ||
    lowerDesc.includes('credito')
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
/**
 * Detecta se o arquivo é um EXTRATO de conta corrente Nubank (Nu Pagamentos)
 * ao invés de uma fatura de cartão de crédito.
 */
export function isNuAccountStatementDoc(fullText: string, lines: string[]): boolean {
  const hasNuBrand =
    /nu\s+pagamentos|nu\s+financeira|nubank/i.test(fullText) ||
    lines.some((l) => /nu\s+pagamentos|nu\s+financeira/i.test(l))
  const hasStatementMarkers =
    /total\s+de\s+sa[íi]das|total\s+de\s+entradas|rendimento\s+l[íi]quido|saldo\s+inicial|saldo\s+final\s+do\s+per[íi]odo/i.test(
      fullText,
    )
  const hasMovimentacoes =
    /movimenta[çc][õo]es/i.test(fullText) ||
    lines.some((l) => /^movimenta[çc][õo]es$/i.test(l.trim()))
  return hasNuBrand && (hasStatementMarkers || hasMovimentacoes)
}

/**
 * Parser especializado para o Extrato da conta Nu (Nu Pagamentos).
 *
 * Estrutura identificada:
 * - Cabeçalho de período: "01 DE SETEMBRO DE 2026 a 30 DE SETEMBRO DE 2026 VALORES EM R$"
 * - Totais de controle: "Total de entradas +7.523,11", "Total de saídas -9.030,98"
 * - Cabeçalhos de dia: "01 SET 2026 Total de saídas - 1.763,28" ou "03 SET 2026 Total de entradas + 2.600,00"
 * - Sub-seção no mesmo dia: "Total de saídas - 515,00" (mantém a data do dia corrente)
 * - Lançamentos com valor no final da própria linha:
 *     "Pagamento de fatura 1.257,28"
 *     "Compra no débito JIM.COM* 62948758 MAYR 6,00"
 *     "Transferência enviada pelo Pix Camila Sousa da Silva - •••.625.463-•• - NU 50,00"
 * - Quebras em linhas subsequentes contendo metadados de agência/conta/banco
 * - Lançamentos onde a descrição termina e o valor está isolado na linha seguinte
 * - Lançamentos recebidos: "Transferência recebida pelo Pix ..."
 */
export function parseNuAccountStatement(
  lines: string[],
  fullText: string,
  preferredYear?: number,
): PDFParseResult {
  const detectedYear = preferredYear || inferDocumentYear(fullText)
  const transactions: PDFParsedTransaction[] = []
  const unrecognizedLines: string[] = []

  // Extrair período e competência do cabeçalho
  // Ex: "01 DE SETEMBRO DE 2026 a 30 DE SETEMBRO DE 2026 VALORES EM R$"
  let periodLabel = '01 SET a 30 SET'
  let competenceMonth: string | undefined = undefined

  const periodMatch = fullText.match(
    /(\d{1,2}\s+(?:DE\s+)?([A-Za-zçÇ]{3,9})\s+(?:DE\s+)?(\d{4}))\s+(?:a|at[eé]|-)\s+(\d{1,2}\s+(?:DE\s+)?([A-Za-zçÇ]{3,9})\s+(?:DE\s+)?(\d{4}))/i,
  )

  if (periodMatch) {
    const startStr = periodMatch[1]
    const endStr = periodMatch[4]
    const endMonthWord = periodMatch[5]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    const endYearStr = periodMatch[6]
    const m = PT_MONTHS[endMonthWord] || PT_MONTHS[endMonthWord.slice(0, 3)]
    if (m && endYearStr) {
      competenceMonth = `${endYearStr}-${m}`
    }
    periodLabel = `${startStr} a ${endStr}`
  }

  // Extrair totais de controle se disponíveis no cabeçalho
  let docTotalDebits: number | undefined = undefined
  let docTotalCredits: number | undefined = undefined

  const saídasMatch = fullText.match(
    /total\s+de\s+sa[íi]das\s*[-–—]?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
  )
  if (saídasMatch) {
    const rawNum = saídasMatch[1].replace(/\./g, '').replace(',', '.')
    const parsed = parseFloat(rawNum)
    if (!isNaN(parsed)) docTotalDebits = parsed
  }

  const entradasMatch = fullText.match(
    /total\s+de\s+entradas\s*[+–—]?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
  )
  if (entradasMatch) {
    const rawNum = entradasMatch[1].replace(/\./g, '').replace(',', '.')
    const parsed = parseFloat(rawNum)
    if (!isNaN(parsed)) docTotalCredits = parsed
  }

  // Regex para cabeçalho de dia no extrato:
  // "01 SET 2026 Total de saídas - 1.763,28"
  // "03 SET 2026 Total de entradas + 2.600,00"
  // "01 SET 2026"
  const dayHeaderRegex =
    /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+total\s+de\s+(sa[íi]das|entradas)\s*[-+]?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}))?/i

  // Regex para sub-seção do dia (ex: "Total de saídas - 515,00")
  const subSectionRegex =
    /^total\s+de\s+(sa[íi]das|entradas)\s*[-+]?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i

  // Linhas que são ruído ou metadados de rodapé / cabeçalho repetido
  const isNuNoise = (l: string) => {
    const low = l.toLowerCase().trim()
    if (!low) return true
    if (/^ver[oó]nica\s+de\s+souza\s+carraro/i.test(low)) return true
    if (/^cpf\s+•••/i.test(low)) return true
    if (/^\d{7,9}-\d$/i.test(low) && !low.includes(' ')) return true // ex: "76223058-4" no topo da página
    if (/valores\s+em\s+r\$/i.test(low)) return true
    if (/^saldo\s+(inicial|final)/i.test(low)) return true
    if (/^rendimento\s+l[íi]quido/i.test(low)) return true
    if (/^r\$\s+[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}$/i.test(low)) return true
    if (/^movimenta[çc][õo]es$/i.test(low)) return true
    if (/tem\s+alguma\s+d[uú]vida/i.test(low)) return true
    if (/caso\s+a\s+solu[çc][aã]o\s+fornecida/i.test(low)) return true
    if (/extrato\s+gerado\s+dia/i.test(low)) return true
    if (/o\s+saldo\s+l[íi]quido\s+corresponde/i.test(low)) return true
    if (/n[aã]o\s+nos\s+responsabilizamos/i.test(low)) return true
    if (/asseguramos\s+a\s+autenticidade/i.test(low)) return true
    if (/nu\s+financeira\s+s\.a\./i.test(low)) return true
    if (/cnpj:\s*\d{2}\.\d{3}\.\d{3}/i.test(low)) return true
    if (/^\d+\s+de\s+\d+$/i.test(low)) return true
    return false
  }

  // Linhas que iniciam um novo lançamento
  const isTransactionStart = (l: string) => {
    const t = l.trim()
    return /^(transfer[eê]ncia\s+enviada\s+pelo\s+pix|transfer[eê]ncia\s+recebida\s+pelo\s+pix|compra\s+no\s+d[eé]bito|pagamento\s+de\s+fatura|pagamento\s+de\s+boleto|d[eé]bito\s+em\s+conta|estorno|reembolso|dep[oó]sito)/i.test(
      t,
    )
  }

  // Valor isolado numa linha: ex: "1.250,00" ou "-50,00" ou "+2.600,00"
  const isIsolatedAmountLine = (l: string) => {
    return /^[-+]?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})$/.test(l.trim())
  }

  // Extrai valor do final da linha
  // Ex: "Transferência enviada pelo Pix ... NU 50,00" -> amount = 50.00
  const extractTrailingAmount = (l: string) => {
    const m = l.match(/^(.*?)\s+([-+]?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})$/)
    if (!m) return null
    const desc = m[1].trim()
    const rawVal = m[2].trim()
    const isNeg = rawVal.startsWith('-')
    const cleanNum = rawVal
      .replace(/^[-+]\s*/, '')
      .replace(/\./g, '')
      .replace(',', '.')
    const parsed = parseFloat(cleanNum)
    if (isNaN(parsed) || parsed === 0) return null
    return {
      description: desc,
      amount: parsed,
      isNegative: isNeg,
      rawAmount: rawVal,
    }
  }

  let currentYear = detectedYear
  let currentNormDate = `${currentYear}-09-01`
  let currentRawDate = '01 SET 2026'

  // Estrutura de montagem de transação
  interface BuildingTx {
    date: string
    rawDate: string
    descriptionParts: string[]
    amount?: number
    type?: 'debit' | 'credit'
    rawLines: string[]
  }

  let activeTx: BuildingTx | null = null

  const commitActiveTx = () => {
    if (!activeTx) return
    if (activeTx.amount !== undefined && activeTx.amount > 0) {
      const fullDesc = activeTx.descriptionParts
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
      const txType = activeTx.type || 'debit'
      transactions.push({
        id: `nu-tx-${transactions.length + 1}-${Math.random().toString(36).slice(2, 7)}`,
        date: activeTx.date,
        rawDate: activeTx.rawDate,
        description: fullDesc,
        amount: activeTx.amount,
        currency: 'BRL',
        type: txType,
        rawLine: activeTx.rawLines.join(' | '),
        month: activeTx.date.slice(0, 7),
      })
    } else {
      unrecognizedLines.push(...activeTx.rawLines)
    }
    activeTx = null
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine) continue

    // 1. Cabeçalho de dia (ex: "01 SET 2026 Total de saídas - 1.763,28")
    const dayMatch = rawLine.match(dayHeaderRegex)
    if (dayMatch) {
      commitActiveTx()
      const d = dayMatch[1].padStart(2, '0')
      const mWord = dayMatch[2].toLowerCase()
      const m = PT_MONTHS[mWord] || '09'
      const y = parseInt(dayMatch[3], 10) || currentYear
      currentYear = y
      currentNormDate = `${y}-${m}-${d}`
      currentRawDate = `${dayMatch[1]} ${dayMatch[2]} ${dayMatch[3]}`
      continue
    }

    // 2. Sub-seção no mesmo dia (ex: "Total de saídas - 515,00")
    if (subSectionRegex.test(rawLine)) {
      commitActiveTx()
      continue
    }

    // 3. Ignorar ruído Nu (cabeçalhos, rodapés, termos legais)
    if (isNuNoise(rawLine)) {
      // Se não estamos no meio de um lançamento ou se é ruído claro de rodapé, ignorar
      if (!activeTx) {
        continue
      }
      // Se estamos no meio de um lançamento e a linha é rodapé claro, fecha o lançamento
      if (/extrato\s+gerado\s+dia|tem\s+alguma\s+d[uú]vida|cnpj:/i.test(rawLine)) {
        commitActiveTx()
        continue
      }
    }

    // 4. Início de uma nova transação
    if (isTransactionStart(rawLine)) {
      commitActiveTx()

      // Determinar tipo inicial
      const isCredit = /transfer[eê]ncia\s+recebida|estorno|reembolso|dep[oó]sito/i.test(rawLine)
      const trailing = extractTrailingAmount(rawLine)

      if (trailing) {
        // O valor já estava no final da linha!
        activeTx = {
          date: currentNormDate,
          rawDate: currentRawDate,
          descriptionParts: [trailing.description],
          amount: trailing.amount,
          type: isCredit ? 'credit' : 'debit',
          rawLines: [rawLine],
        }
      } else {
        // O valor virá na linha seguinte ou após quebras
        activeTx = {
          date: currentNormDate,
          rawDate: currentRawDate,
          descriptionParts: [rawLine],
          type: isCredit ? 'credit' : 'debit',
          rawLines: [rawLine],
        }
      }
      continue
    }

    // 5. Linha subsequente: pode ser valor isolado ou continuação da descrição
    if (activeTx) {
      // Se o lançamento ainda NÃO tem valor definido e esta linha é um valor isolado
      if (activeTx.amount === undefined && isIsolatedAmountLine(rawLine)) {
        const clean = rawLine
          .replace(/^[-+]\s*/, '')
          .replace(/\./g, '')
          .replace(',', '.')
        const num = parseFloat(clean)
        if (!isNaN(num) && num > 0) {
          activeTx.amount = num
          activeTx.rawLines.push(rawLine)
          continue
        }
      }

      // Se o lançamento ainda NÃO tem valor definido e a linha termina com um valor
      if (activeTx.amount === undefined) {
        const trailing = extractTrailingAmount(rawLine)
        if (trailing) {
          activeTx.descriptionParts.push(trailing.description)
          activeTx.amount = trailing.amount
          activeTx.rawLines.push(rawLine)
          continue
        }
      }

      // Se já tem valor definido ou ainda não encontrou o valor, verificar se é metadado Nu (agência/conta/banco)
      // No extrato Nu, após o valor vêm dados como:
      // "PAGAMENTOS - IP (0260) Agência: 1 Conta:"
      // "67278091-1"
      // "COOP SICREDI CEN OEST PAULISTA Agência:"
      // "3022 Conta: 57701-4"
      // Se já tem valor definido, linhas subsequentes que são contas bancárias podem ser concatenadas ou ignoradas.
      // O mais limpo para descrição financeira pessoal é NÃO poluir o nome do recebedor com Agência e Conta bancária
      // a menos que seja relevante.
      if (activeTx.amount !== undefined) {
        // Se a próxima linha parece um novo início ou cabeçalho, fecha
        if (
          isTransactionStart(rawLine) ||
          dayHeaderRegex.test(rawLine) ||
          subSectionRegex.test(rawLine) ||
          isNuNoise(rawLine)
        ) {
          commitActiveTx()
          // Re-processar esta linha
          i--
          continue
        }

        // Se é agência/conta subsequente, apenas anexamos aos rawLines para auditoria, sem poluir a descrição principal
        activeTx.rawLines.push(rawLine)
        continue
      }

      // Se ainda não tem valor e não foi valor isolado nem trailing, concatena como continuação do texto
      activeTx.descriptionParts.push(rawLine)
      activeTx.rawLines.push(rawLine)
      continue
    }

    // Linha não associada a nenhuma transação
    unrecognizedLines.push(rawLine)
  }

  commitActiveTx()

  // Se não foi identificado competenceMonth no cabeçalho, usar o mês do primeiro lançamento
  if (!competenceMonth && transactions.length > 0) {
    competenceMonth = transactions[0].month
  }

  // Ordenar cronologicamente
  transactions.sort((a, b) => a.date.localeCompare(b.date))

  return {
    transactions,
    detectedYear,
    detectedCurrency: 'BRL',
    currencyConfidence: 'high',
    currencyReason: 'Extrato de Conta Nubank identificado (valores em R$)',
    totalLinesScanned: lines.length,
    unrecognizedLines,
    detectedCompetenceMonth: competenceMonth,
    detectedPeriodLabel: periodLabel,
    detectedDueDate: undefined, // Extrato não tem vencimento de fatura
    isCreditCardInvoice: false,
    isNuAccountStatement: true,
    totalDebits: docTotalDebits,
    totalCredits: docTotalCredits,
  }
}

export function parsePDFStatement(
  lines: string[],
  fullText: string,
  preferredYear?: number,
  userDefaultCurrency: 'BRL' | 'EUR' = 'BRL',
): PDFParseResult {
  // 1. Verificar se é extrato de conta corrente Nubank
  if (isNuAccountStatementDoc(fullText, lines)) {
    return parseNuAccountStatement(lines, fullText, preferredYear)
  }

  const detectedYear = preferredYear || inferDocumentYear(fullText)
  const currencyDetection = detectDocumentCurrency(fullText, userDefaultCurrency)
  const detectedCurrency = currencyDetection.currency
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
    let tx = tryParseTransactionLine(rawLine, detectedYear, detectedCurrency)

    // Fallback: se a linha tem colunas markdown pipe (ex: | 31 AGO | UBER TRIP | 14,90 |)
    if (!tx && rawLine.includes('|')) {
      const cleaned = rawLine.replace(/^\|/, '').replace(/\|$/, '').trim()
      tx = tryParseTransactionLine(cleaned, detectedYear, detectedCurrency)
    }

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

  // Detecção de competência da fatura (período vigente, vencimento)
  const invoiceMeta = inferInvoiceCompetence(fullText, detectedYear)

  const hasNoText = fullText.trim().length === 0
  let failureType: 'empty_text' | 'no_match' | 'worker_error' | undefined
  let failureReason: string | undefined

  if (transactions.length === 0) {
    if (hasNoText) {
      failureType = 'empty_text'
      failureReason =
        'Não foi possível ler o texto do PDF — o arquivo não possui camada de texto pesquisável (pode ser uma imagem escaneada) ou está protegido por senha.'
    } else {
      failureType = 'no_match'
      failureReason =
        'Nenhuma transação identificada no PDF — o texto do PDF foi extraído com sucesso, mas nenhum padrão de data e valor de transação foi identificado.'
    }
  }

  return {
    transactions,
    detectedYear,
    detectedCurrency,
    currencyConfidence: currencyDetection.confidence,
    currencyReason: currencyDetection.reason,
    totalLinesScanned: lines.length,
    unrecognizedLines,
    detectedCompetenceMonth: invoiceMeta.competenceMonth,
    detectedPeriodLabel: invoiceMeta.periodLabel,
    detectedDueDate: invoiceMeta.dueDate,
    isCreditCardInvoice: invoiceMeta.isInvoice,
    reason: failureReason,
    extractionFailureType: failureType,
  }
}
