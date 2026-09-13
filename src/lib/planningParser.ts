import { parseAmount } from './fileParser'

export interface PlanningItem {
  id: string
  sectionName: string
  name: string
  subgroup?: string
  estimated: number
  monthlyValues: Record<string, number> // monthIndex (1..12 or 1..8) -> value in EUR
}

export interface PlanningSection {
  name: string
  items: PlanningItem[]
}

export interface PlanningParsedData {
  sheetName?: string
  detectedMonths: Array<{ index: number; name: string }> // e.g. [{ index: 1, name: 'Jan' }, ...]
  sections: PlanningSection[]
  totalItemsCount: number
  totalTransactionsCount: number
  totalEstimated: number
  totalValuesPerMonth: Record<number, number>
}

// Portuguese month abbreviation map
const MONTH_MAP: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  março: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
}

/**
 * Normalizes text removing accents and converting to lower case for comparison.
 */
export function normalizeCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Parses markdown generated from $documents.toMarkdown (Skip Cloud) or a tabular string
 * containing the "Plano Financeiro" sheet.
 */
export function parsePlanningMarkdown(markdown: string): PlanningParsedData {
  const lines = markdown.split(/\r?\n/)

  // If there are multiple sheets separated by markdown headers (e.g. ## Plano Financeiro)
  // we look for the "Plano Financeiro" section, or process the full content if only one table.
  let targetLines = lines
  const sheetHeaderIdx = lines.findIndex(
    (l) =>
      l.toLowerCase().includes('plano financeiro') && (l.startsWith('#') || l.startsWith('sheet:')),
  )
  if (sheetHeaderIdx !== -1) {
    // Find next header (## Other Sheet)
    let endIdx = lines.length
    for (let i = sheetHeaderIdx + 1; i < lines.length; i++) {
      if (
        lines[i].startsWith('## ') ||
        lines[i].startsWith('# ') ||
        lines[i].startsWith('sheet:')
      ) {
        endIdx = i
        break
      }
    }
    targetLines = lines.slice(sheetHeaderIdx, endIdx)
  }

  // Find table rows: lines with '|'
  const tableLines = targetLines.filter((l) => l.includes('|'))

  let detectedMonths: Array<{ index: number; name: string; colIdx: number }> = []
  let colNameIdx = 0
  let colSubgroupIdx = 2
  let colEstimatedIdx = 3

  const sections: PlanningSection[] = []
  let currentSection: PlanningSection | null = null
  let itemCounter = 0

  for (let lineIndex = 0; lineIndex < tableLines.length; lineIndex++) {
    const rawLine = tableLines[lineIndex].trim()

    // Ignore markdown table divider rows (| --- | --- |)
    if (/^\|?(\s*:?-+:?\s*\|?)+$/.test(rawLine)) {
      continue
    }

    // Split cells
    const rawCells = rawLine.split('|')
    // Remove leading and trailing empty cells if line starts/ends with |
    if (rawLine.startsWith('|')) rawCells.shift()
    if (rawLine.endsWith('|')) rawCells.pop()

    const cells = rawCells.map((c) => c.trim())
    if (cells.length === 0) continue

    // Detect header row containing month names (Jan, Fev, Mar...)
    const foundMonths: Array<{ index: number; name: string; colIdx: number }> = []
    cells.forEach((c, idx) => {
      const clean = c
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      if (MONTH_MAP[clean] !== undefined) {
        foundMonths.push({ index: MONTH_MAP[clean], name: c, colIdx: idx })
      }
    })

    if (foundMonths.length >= 3 && detectedMonths.length === 0) {
      detectedMonths = foundMonths
      // Also detect column positions for Subcategoria and Estimado if present in this header or adjacent
      cells.forEach((c, idx) => {
        const norm = c.toLowerCase()
        if (norm.includes('subcategoria') || norm.includes('grupo') || norm.includes('categoria')) {
          colSubgroupIdx = idx
        } else if (norm.includes('estimad') || norm.includes('planejad')) {
          colEstimatedIdx = idx
        }
      })
      continue
    }

    // Check if this row is a header row inside a section (e.g. "SUBCATEGORIA | ESTIMADO | VALOR | VALOR ...")
    const isInnerHeaderRow = cells.some(
      (c) =>
        c.toUpperCase() === 'SUBCATEGORIA' ||
        c.toUpperCase() === 'ESTIMADO' ||
        c.toUpperCase() === 'VALOR',
    )
    if (isInnerHeaderRow) {
      // If col 0 or 1 contains a section name like "MORADIA", extract it
      const potentialSection = cells[0] || cells[1] || ''
      const cleanPot = potentialSection.trim()
      if (
        cleanPot &&
        cleanPot.length > 2 &&
        cleanPot === cleanPot.toUpperCase() &&
        cleanPot !== 'SUBCATEGORIA' &&
        cleanPot !== 'ESTIMADO' &&
        cleanPot !== 'VALOR' &&
        cleanPot !== 'TOTAL'
      ) {
        let sec = sections.find((s) => s.name.toUpperCase() === cleanPot)
        if (!sec) {
          sec = { name: cleanPot, items: [] }
          sections.push(sec)
        }
        currentSection = sec
      }
      continue
    }

    // The line identifier in col 0 (or col 1 if col 0 has duplicated planeamento)
    let rowName = cells[colNameIdx] || ''
    // Sometimes markdown parser outputs duplicated column like "Aluguel | Aluguel | Moradia | 2500..."
    if (!rowName && cells.length > 1) {
      rowName = cells[1]
    }

    rowName = rowName.trim()

    // Clean any leading label artifact like "PLANEJAMENTO FINANCEIRO: "
    if (rowName.toLowerCase().startsWith('planejamento financeiro:')) {
      rowName = rowName.slice('planejamento financeiro:'.length).trim()
    }

    // Ignore empty lines or subtotal rows (empty name)
    if (!rowName) {
      continue
    }

    // Ignore TOTAL row or summary questions
    const upperName = rowName.toUpperCase()
    if (
      upperName === 'TOTAL' ||
      upperName.startsWith('TOTAL ') ||
      upperName.includes('QUANTO GASTEI') ||
      upperName.includes('DIFERENCA') ||
      upperName.includes('DIFERENÇA')
    ) {
      continue
    }

    // Check if this is a section header in ALL CAPS (e.g., "MORADIA", "CUIDADOS PESSOAIS", "EDUCAÇÃO", etc.)
    // Note: Some section names have accents like "EDUCAÇÃO", "SERVIÇOS".
    // A section header is all uppercase, has length > 2, and doesn't look like an account code.
    const isSectionHeader =
      rowName === rowName.toUpperCase() &&
      /[A-ZÀ-Ú]/.test(rowName) &&
      !/^\d+$/.test(rowName) &&
      rowName.length >= 3 &&
      // Check if cells after column 3 have "VALOR" or are empty/estimated
      (cells.some(
        (c) =>
          c.toUpperCase() === 'SUBCATEGORIA' ||
          c.toUpperCase() === 'ESTIMADO' ||
          c.toUpperCase() === 'VALOR',
      ) ||
        cells[colEstimatedIdx] === undefined ||
        cells[colEstimatedIdx] === '' ||
        isNaN(parseAmount(cells[colEstimatedIdx])))

    if (isSectionHeader) {
      const sectionClean = rowName.trim()
      let sec = sections.find((s) => s.name.toUpperCase() === sectionClean)
      if (!sec) {
        sec = { name: sectionClean, items: [] }
        sections.push(sec)
      }
      currentSection = sec
      continue
    }

    // It's a subcategory row!
    // Make sure we have a section to attach to. If none yet, create 'GERAL'
    if (!currentSection) {
      currentSection = { name: 'OUTROS', items: [] }
      sections.push(currentSection)
    }

    // Extract Subgroup/Column C
    let subgroup = ''
    if (cells[colSubgroupIdx]) {
      subgroup = cells[colSubgroupIdx].trim()
      if (subgroup.toLowerCase().startsWith('column_3:')) {
        subgroup = subgroup.slice('column_3:'.length).trim()
      }
    }

    // Extract Estimated / Column D
    let estimatedVal = 0
    if (cells[colEstimatedIdx]) {
      let estStr = cells[colEstimatedIdx].trim()
      if (estStr.toLowerCase().startsWith('column_4:')) {
        estStr = estStr.slice('column_4:'.length).trim()
      }
      estimatedVal = parseAmount(estStr)
    }

    // Extract Monthly Values
    const monthlyValues: Record<string, number> = {}

    if (detectedMonths.length > 0) {
      detectedMonths.forEach((m) => {
        if (cells[m.colIdx] !== undefined) {
          let valStr = cells[m.colIdx].trim()
          // Clean possible header prefix like "Jan: 907"
          if (valStr.includes(':')) {
            valStr = valStr.split(':')[1].trim()
          }
          if (valStr && valStr.toUpperCase() !== 'VALOR') {
            const amt = parseAmount(valStr)
            if (amt > 0) {
              monthlyValues[String(m.index)] = amt
            }
          }
        }
      })
    } else {
      // Default standard Jan-Ago in cols 4..11
      const defaultCols = [
        { idx: 4, m: 1 },
        { idx: 5, m: 2 },
        { idx: 6, m: 3 },
        { idx: 7, m: 4 },
        { idx: 8, m: 5 },
        { idx: 9, m: 6 },
        { idx: 10, m: 7 },
        { idx: 11, m: 8 },
      ]
      defaultCols.forEach((dc) => {
        if (cells[dc.idx] !== undefined) {
          let valStr = cells[dc.idx].trim()
          if (valStr.includes(':')) valStr = valStr.split(':')[1].trim()
          if (valStr && valStr.toUpperCase() !== 'VALOR') {
            const amt = parseAmount(valStr)
            if (amt > 0) {
              monthlyValues[String(dc.m)] = amt
            }
          }
        }
      })
    }

    itemCounter++
    const item: PlanningItem = {
      id: `item-${itemCounter}`,
      sectionName: currentSection.name,
      name: rowName,
      subgroup: subgroup || undefined,
      estimated: estimatedVal,
      monthlyValues,
    }

    currentSection.items.push(item)
  }

  // Calculate stats
  let totalItemsCount = 0
  let totalTransactionsCount = 0
  let totalEstimated = 0
  const totalValuesPerMonth: Record<number, number> = {}

  // Final months if none detected explicitly
  const finalMonths =
    detectedMonths.length > 0
      ? detectedMonths.map((m) => ({ index: m.index, name: m.name }))
      : [
          { index: 1, name: 'Jan' },
          { index: 2, name: 'Fev' },
          { index: 3, name: 'Mar' },
          { index: 4, name: 'Abr' },
          { index: 5, name: 'Mai' },
          { index: 6, name: 'Jun' },
          { index: 7, name: 'Jul' },
          { index: 8, name: 'Ago' },
        ]

  finalMonths.forEach((m) => {
    totalValuesPerMonth[m.index] = 0
  })

  sections.forEach((sec) => {
    sec.items.forEach((item) => {
      totalItemsCount++
      totalEstimated += item.estimated || 0
      Object.entries(item.monthlyValues).forEach(([mIdxStr, val]) => {
        const mIdx = parseInt(mIdxStr, 10)
        totalTransactionsCount++
        totalValuesPerMonth[mIdx] = (totalValuesPerMonth[mIdx] || 0) + val
      })
    })
  })

  return {
    sheetName: 'Plano Financeiro',
    detectedMonths: finalMonths,
    sections,
    totalItemsCount,
    totalTransactionsCount,
    totalEstimated,
    totalValuesPerMonth,
  }
}
