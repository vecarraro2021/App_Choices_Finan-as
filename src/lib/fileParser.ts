/**
 * Lightweight, robust CSV and XLSX parser for statements and invoices.
 */
import { getSheetJS } from './excelLoader'

export interface ParsedRow {
  [key: string]: string
}

export interface CurrencyDetectionResult {
  currency: 'BRL' | 'EUR'
  confidence: 'high' | 'medium' | 'fallback'
  reason?: string
}

export interface ParseFileResult {
  headers: string[]
  rows: ParsedRow[]
  sourceType: 'csv' | 'xlsx'
  sheetNames?: string[]
  detectedCurrency?: 'BRL' | 'EUR'
  currencyConfidence?: 'high' | 'medium' | 'fallback'
  currencyReason?: string
}

/**
 * Detecta moeda em linhas e colunas de CSV/XLSX:
 * 1. Procura símbolos e códigos nos cabeçalhos (ex: "Valor (R$)", "Quantia (€)", "Amount BRL", "EUR")
 * 2. Procura símbolos nas células de valor (R$, €, EUR, BRL)
 * 3. Analisa formatação numérica (vírgula decimal BR/PT vs ponto decimal) e palavras-chave de banco
 * 4. Retorna fallback para moeda padrão do usuário se ambíguo
 */
export function detectTableCurrency(
  headers: string[],
  rows: ParsedRow[],
  userDefaultCurrency: 'BRL' | 'EUR' = 'BRL',
): CurrencyDetectionResult {
  let euroScore = 0
  let realScore = 0

  // 1. Cabeçalhos
  const headerText = headers.join(' ').toLowerCase()
  if (/r\$|\bbrl\b|\breais\b/.test(headerText)) realScore += 5
  if (/€|\beur\b|\beuros?\b/.test(headerText)) euroScore += 5

  // 2. Amostra de linhas (até 60 linhas)
  const sample = rows.slice(0, 60)
  let euroSymbolCount = 0
  let realSymbolCount = 0
  let commaDecimalCount = 0
  let pointDecimalCount = 0

  for (const row of sample) {
    const joined = Object.values(row).join(' ')
    if (joined.includes('€') || /\beur\b/i.test(joined)) {
      euroSymbolCount++
    }
    if (joined.includes('R$') || /\bbrl\b/i.test(joined)) {
      realSymbolCount++
    }

    // Procurar colunas com números para checar formato decimal
    for (const val of Object.values(row)) {
      const str = String(val).trim()
      if (/^[+-]?(?:R\$|€|EUR|BRL)?\s*\d{1,3}(?:\.\d{3})*,\d{2}$/i.test(str)) {
        commaDecimalCount++
      } else if (/^[+-]?(?:R\$|€|EUR|BRL)?\s*\d{1,3}(?:,\d{3})*\.\d{2}$/i.test(str)) {
        pointDecimalCount++
      }
    }
  }

  realScore += realSymbolCount * 4
  euroScore += euroSymbolCount * 4

  // Se houver indicação clara de símbolo
  if (realScore > 0 && realScore > euroScore) {
    return {
      currency: 'BRL',
      confidence: realScore >= 5 ? 'high' : 'medium',
      reason:
        realSymbolCount > 0
          ? 'Identificado símbolo R$ / BRL nos valores'
          : 'Identificado cabeçalho em R$ / BRL',
    }
  }

  if (euroScore > 0 && euroScore > realScore) {
    return {
      currency: 'EUR',
      confidence: euroScore >= 5 ? 'high' : 'medium',
      reason:
        euroSymbolCount > 0
          ? 'Identificado símbolo € / EUR nos valores'
          : 'Identificado cabeçalho em € / EUR',
    }
  }

  // Se nenhum símbolo monetário explícito apareceu nas colunas
  // mas o formato é predominantemente vírgula decimal sem símbolo ou ponto decimal,
  // ainda não temos certeza se vírgula é PT (EUR) ou BR (BRL). Portanto consideramos ambíguo:
  return {
    currency: userDefaultCurrency,
    confidence: 'fallback',
    reason: 'Moeda não identificada no arquivo, usando sua moeda padrão',
  }
}

/**
 * Checks if a byte buffer starts with the ZIP magic bytes PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
 * which indicates an Office Open XML file (XLSX, DOCX) or ZIP archive.
 */
export function isZipBuffer(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (bytes.length < 4) return false
  return (
    bytes[0] === 0x50 && // 'P'
    bytes[1] === 0x4b && // 'K'
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

/**
 * Checks if a text string begins with the PK signature.
 */
export function startsWithZipSignature(text: string): boolean {
  if (!text || text.length < 4) return false
  return (
    text.charCodeAt(0) === 0x50 &&
    text.charCodeAt(1) === 0x4b &&
    text.charCodeAt(2) === 0x03 &&
    text.charCodeAt(3) === 0x04
  )
}

/**
 * Detects whether a string is predominantly binary garbage or contains control characters.
 * Non-printable control characters: code < 9 or between 14-31, or 0xFFFD replacement characters.
 * Also checks if the text contains standard XLSX internal paths like "xl/workbook" or "xl/comments".
 */
export function isBinaryOrCorruptedText(text: string): boolean {
  if (!text || text.length === 0) return false

  // Obvious ZIP header in text form
  if (startsWithZipSignature(text)) return true

  // Check for presence of internal XLSX ZIP paths often found in raw binary dumps
  if (
    text.includes('xl/workbook') ||
    text.includes('xl/worksheets') ||
    text.includes('xl/sharedStrings') ||
    text.includes('xl/comments') ||
    text.includes('[Content_Types].xml')
  ) {
    return true
  }

  // Sample the first 4000 characters to compute ratio of non-printable / control characters
  const sampleLength = Math.min(text.length, 4000)
  let unprintableCount = 0

  for (let i = 0; i < sampleLength; i++) {
    const code = text.charCodeAt(i)
    // Printable characters are \t (9), \n (10), \r (13) and >= 32.
    // Unicode replacement char 0xFFFD (65533) is also a strong sign of binary decoding error.
    if (code < 9 || (code >= 14 && code <= 31) || code === 0xfffd) {
      unprintableCount++
    }
  }

  const ratio = unprintableCount / sampleLength
  return ratio > 0.08 // more than 8% non-printable characters is almost certainly binary
}

/**
 * Parses CSV text taking into account quoted fields, semicolons, or commas.
 */
export function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  // Normalize line breaks
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }

  // Detect delimiter: comma, semicolon or tab
  const firstLine = lines[0]
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length

  let delimiter = ','
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ';'
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t'
  }

  function splitLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''))
    return result
  }

  const rawHeaders = splitLine(lines[0])
  const headers = rawHeaders.map((h, i) => (h ? h.trim() : `Coluna_${i + 1}`))

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i])
    if (values.length <= 1 && values[0] === '') continue

    const rowObj: ParsedRow = {}
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] || ''
    })
    rows.push(rowObj)
  }

  return { headers, rows }
}

/**
 * Parses numbers that might have Brazilian formatting (1.250,50 or R$ 1.250,50 or -50,20)
 * or standard formats (1250.50).
 */
export function parseAmount(val: string | number | undefined): number {
  if (typeof val === 'number') return Math.abs(val)
  if (!val) return 0

  let cleaned = String(val)
    .replace(/[R$\s€]/g, '')
    .trim()

  // If contains comma as decimal separator
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Ex: 1.250,50
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    // Ex: 1250,50
    cleaned = cleaned.replace(',', '.')
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : Math.abs(parsed)
}

/**
 * Normalizes dates to YYYY-MM-DD (supports DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY)
 */
export function normalizeDate(val: string | undefined): string {
  if (!val) {
    return new Date().toISOString().slice(0, 10)
  }

  const str = String(val).trim()

  // Match DD/MM/YYYY or DD-MM-YYYY
  const brMatch =
    str.match(/^(\d{1,2})[/](\d{1,2})[/](\d{2,4})$/) || str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0')
    const month = brMatch[2].padStart(2, '0')
    let year = brMatch[3]
    if (year.length === 2) year = '20' + year
    return `${year}-${month}-${day}`
  }

  // Match YYYY-MM-DD
  const isoMatch =
    str.match(/^(\d{4})[/](\d{1,2})[/](\d{1,2})/) || str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const year = isoMatch[1]
    const month = isoMatch[2].padStart(2, '0')
    const day = isoMatch[3].padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Fallback
  return new Date().toISOString().slice(0, 10)
}

/**
 * Validates parsed preview rows to detect if the data is corrupted or binary garbage
 * (e.g. when an XLSX file was inadvertently parsed as CSV).
 */
export function validatePreviewSanity(rows: ParsedRow[]): {
  isSane: boolean
  reason?: string
} {
  if (!rows || rows.length === 0) {
    return { isSane: true }
  }

  const sampleSize = Math.min(rows.length, 30)
  const sample = rows.slice(0, sampleSize)

  let corruptedDescCount = 0
  let suspiciousZeroCount = 0
  let identicalSuspiciousDateCount = 0

  const firstDate = sample[0]?.data || sample[0]?.date || Object.values(sample[0])[0]

  for (const row of sample) {
    const values = Object.values(row)
    const textBlob = values.join(' ')

    // Check if the row contains unprintable/control characters or ZIP markers
    if (isBinaryOrCorruptedText(textBlob)) {
      corruptedDescCount++
    }

    // Check if amounts are 0 and descriptions are unreadable
    const amtVal = values.find((v) => /^\s*0([.,]00?)?\s*$/.test(v) || v === 'R$ 0,00' || v === '0')
    if (amtVal !== undefined) {
      suspiciousZeroCount++
    }

    // Identical fallback dates across all rows
    const dVal = values.find((v) => v === firstDate)
    if (dVal) {
      identicalSuspiciousDateCount++
    }
  }

  if (corruptedDescCount / sampleSize >= 0.25) {
    return {
      isSane: false,
      reason:
        'O arquivo parece conter dados binários ilegíveis (assinatura de planilha Excel ou arquivo compactado lido como texto).',
    }
  }

  // If all rows have corrupted text or suspicious zeros with identical dates and unreadable column headers
  return { isSane: true }
}

/**
 * Parses XLSX data from an ArrayBuffer using SheetJS (browser or node).
 */
export async function parseXLSXBuffer(
  buffer: ArrayBuffer,
): Promise<{ headers: string[]; rows: ParsedRow[]; sheetNames: string[] }> {
  const XLSX = await getSheetJS()
  if (!XLSX) {
    throw new Error('Mecanismo de leitura de planilhas Excel não disponível no navegador.')
  }

  const data = new Uint8Array(buffer)
  const workbook = XLSX.read(data, { type: 'array', cellDates: true })

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('A planilha Excel não contém nenhuma aba.')
  }

  // Use the first non-empty sheet
  let chosenSheetName = workbook.SheetNames[0]
  let chosenSheet = workbook.Sheets[chosenSheetName]

  // If first sheet is empty, check other sheets
  for (const name of workbook.SheetNames) {
    const s = workbook.Sheets[name]
    if (s && s['!ref']) {
      chosenSheetName = name
      chosenSheet = s
      break
    }
  }

  if (!chosenSheet) {
    return { headers: [], rows: [], sheetNames: workbook.SheetNames }
  }

  // Convert sheet to array of arrays
  const rawData: any[][] = XLSX.utils.sheet_to_json(chosenSheet, {
    header: 1,
    defval: '',
    raw: false, // formats dates and numbers as strings
    dateNF: 'yyyy-mm-dd',
  })

  if (rawData.length === 0) {
    return { headers: [], rows: [], sheetNames: workbook.SheetNames }
  }

  // Find header row (first row with at least 2 non-empty cells)
  let headerRowIdx = 0
  for (let r = 0; r < Math.min(rawData.length, 10); r++) {
    const row = rawData[r]
    if (!row) continue
    const filledCount = row.filter((c: any) => String(c).trim().length > 0).length
    if (filledCount >= 2) {
      headerRowIdx = r
      break
    }
  }

  const rawHeaders = rawData[headerRowIdx] || []
  const headers = rawHeaders.map((h: any, i: number) => {
    const str = String(h ?? '').trim()
    return str || `Coluna_${i + 1}`
  })

  const rows: ParsedRow[] = []
  for (let r = headerRowIdx + 1; r < rawData.length; r++) {
    const row = rawData[r]
    if (!row) continue
    const isAllEmpty = row.every((c: any) => String(c ?? '').trim().length === 0)
    if (isAllEmpty) continue

    const rowObj: ParsedRow = {}
    headers.forEach((header, idx) => {
      rowObj[header] = String(row[idx] ?? '').trim()
    })
    rows.push(rowObj)
  }

  return { headers, rows, sheetNames: workbook.SheetNames }
}

/**
 * Universal file parser for statements and spreadsheets.
 * Reads File / Blob content, inspects magic bytes and content:
 * 1. Checks magic bytes for ZIP (PK\x03\x04) -> forces XLSX parsing.
 * 2. Checks file extension or MIME type for Excel -> parses as XLSX.
 * 3. Reads as text: if text contains PK signature, corrupted binary data (>8% unprintable),
 *    immediately aborts CSV parsing and falls back to XLSX.
 * 4. Otherwise parses as standard CSV.
 */
export async function parseStatementFile(
  file: File,
  fallbackXlsxViaBackend?: (f: File) => Promise<string>,
  userDefaultCurrency: 'BRL' | 'EUR' = 'BRL',
): Promise<ParseFileResult> {
  const fileName = file.name.toLowerCase()
  const isExtensionExcel =
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.xlsm') ||
    fileName.endsWith('.xlsb') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel')

  // Read first 16 bytes to check magic bytes
  let isZipMagic = false
  try {
    const slice = file.slice(0, 16)
    const arrayBuffer = await slice.arrayBuffer()
    isZipMagic = isZipBuffer(arrayBuffer)
  } catch (err) {
    console.warn('[parseStatementFile] Falha ao inspecionar magic bytes:', err)
  }

  // If magic bytes match ZIP or file is identified as Excel, parse as XLSX directly!
  if (isZipMagic || isExtensionExcel) {
    try {
      const fullBuffer = await file.arrayBuffer()
      const result = await parseXLSXBuffer(fullBuffer)
      if (result.rows.length > 0) {
        const currDet = detectTableCurrency(result.headers, result.rows, userDefaultCurrency)
        return {
          headers: result.headers,
          rows: result.rows,
          sourceType: 'xlsx',
          sheetNames: result.sheetNames,
          detectedCurrency: currDet.currency,
          currencyConfidence: currDet.confidence,
          currencyReason: currDet.reason,
        }
      }
    } catch (xlsxErr) {
      console.warn('[parseStatementFile] Falha no SheetJS local:', xlsxErr)
      // If SheetJS failed and we have backend fallback available
      if (fallbackXlsxViaBackend) {
        try {
          const markdown = await fallbackXlsxViaBackend(file)
          const csvResult = parseCSV(markdown)
          const currDet = detectTableCurrency(
            csvResult.headers,
            csvResult.rows,
            userDefaultCurrency,
          )
          return {
            headers: csvResult.headers,
            rows: csvResult.rows,
            sourceType: 'xlsx',
            detectedCurrency: currDet.currency,
            currencyConfidence: currDet.confidence,
            currencyReason: currDet.reason,
          }
        } catch (backendErr) {
          console.error('[parseStatementFile] Falha no fallback do backend:', backendErr)
        }
      }
      throw new Error(
        'Não conseguimos ler este arquivo. Verifique se é um CSV ou planilha Excel válida (XLSX/XLS).',
      )
    }
  }

  // Not a detected ZIP magic byte yet. Let's read as text.
  let text = ''
  try {
    text = await file.text()
  } catch (textErr) {
    console.warn('[parseStatementFile] Falha ao ler como texto:', textErr)
  }

  // Check if text starts with "PK" or contains binary corruption
  if (isBinaryOrCorruptedText(text)) {
    console.info(
      '[parseStatementFile] Arquivo lido como texto contém lixo binário ou assinatura ZIP. Redirecionando para XLSX parser...',
    )
    try {
      const fullBuffer = await file.arrayBuffer()
      const result = await parseXLSXBuffer(fullBuffer)
      if (result.rows.length > 0) {
        const currDet = detectTableCurrency(result.headers, result.rows, userDefaultCurrency)
        return {
          headers: result.headers,
          rows: result.rows,
          sourceType: 'xlsx',
          sheetNames: result.sheetNames,
          detectedCurrency: currDet.currency,
          currencyConfidence: currDet.confidence,
          currencyReason: currDet.reason,
        }
      }
    } catch (retryErr) {
      console.warn('[parseStatementFile] Falha no parser XLSX após detecção de binário:', retryErr)
      if (fallbackXlsxViaBackend) {
        try {
          const markdown = await fallbackXlsxViaBackend(file)
          const csvResult = parseCSV(markdown)
          const currDet = detectTableCurrency(
            csvResult.headers,
            csvResult.rows,
            userDefaultCurrency,
          )
          return {
            headers: csvResult.headers,
            rows: csvResult.rows,
            sourceType: 'xlsx',
            detectedCurrency: currDet.currency,
            currencyConfidence: currDet.confidence,
            currencyReason: currDet.reason,
          }
        } catch (bErr) {
          console.error('[parseStatementFile] Falha no fallback do backend:', bErr)
        }
      }
      throw new Error(
        'Não conseguimos ler este arquivo. Verifique se é um CSV ou planilha Excel válida (XLSX/XLS).',
      )
    }
  }

  // Standard CSV parse
  const parsed = parseCSV(text)
  const currDet = detectTableCurrency(parsed.headers, parsed.rows, userDefaultCurrency)
  return {
    headers: parsed.headers,
    rows: parsed.rows,
    sourceType: 'csv',
    detectedCurrency: currDet.currency,
    currencyConfidence: currDet.confidence,
    currencyReason: currDet.reason,
  }
}
