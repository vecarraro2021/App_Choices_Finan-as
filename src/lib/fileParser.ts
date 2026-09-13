/**
 * Lightweight, zero-dependency CSV and XLSX parser for statements and invoices.
 */

export interface ParsedRow {
  [key: string]: string
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
