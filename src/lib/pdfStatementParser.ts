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
export function parsePDFStatement(
  lines: string[],
  fullText: string,
  preferredYear?: number,
  userDefaultCurrency: 'BRL' | 'EUR' = 'BRL',
): PDFParseResult {
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
