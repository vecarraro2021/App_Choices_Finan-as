import { describe, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

import { expect } from 'vitest'

describe('extract text from nu statement pdf using pdfjs', () => {
  it('extracts all lines and inspects them', async () => {
    const pdfPath = path.resolve('src/assets/nu76223058401set202630set2026-b97da.pdf')
    expect(fs.existsSync(pdfPath)).toBe(true)
    const buffer = fs.readFileSync(pdfPath)
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise

    const pages: Array<{ pageNumber: number; lines: string[] }> = []
    const allLines: string[] = []

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const textContent = await page.getTextContent()
      const items = textContent.items as Array<any>

      const lineBuckets = new Map<number, Array<{ x: number; text: string }>>()
      for (const item of items) {
        if (!item.str || item.str.trim() === '') continue
        const x = item.transform ? item.transform[4] : 0
        const y = item.transform ? Math.round(item.transform[5] * 2) / 2 : 0

        let matchedY: number | null = null
        for (const existingY of lineBuckets.keys()) {
          if (Math.abs(existingY - y) <= 3) {
            matchedY = existingY
            break
          }
        }
        const targetY = matchedY ?? y
        if (!lineBuckets.has(targetY)) {
          lineBuckets.set(targetY, [])
        }
        lineBuckets.get(targetY)!.push({ x, text: item.str })
      }

      const sortedYKeys = Array.from(lineBuckets.keys()).sort((a, b) => b - a)
      const pageLines: string[] = []
      for (const y of sortedYKeys) {
        const rowItems = lineBuckets.get(y)!
        rowItems.sort((a, b) => a.x - b.x)
        let lineText = ''
        for (let i = 0; i < rowItems.length; i++) {
          const item = rowItems[i]
          if (i === 0) {
            lineText = item.text
          } else {
            const prev = rowItems[i - 1].text
            if (prev.endsWith(' ') || item.text.startsWith(' ')) {
              lineText += item.text
            } else {
              lineText += ' ' + item.text
            }
          }
        }
        if (lineText.trim()) {
          pageLines.push(lineText.trim())
          allLines.push(lineText.trim())
        }
      }
      pages.push({ pageNumber: pageNum, lines: pageLines })
    }

    const dumpContent = `// Auto-generated extraction of user Nu Extrato PDF
export const NU_STATEMENT_PAGES = ${JSON.stringify(pages, null, 2)} as const;
export const NU_STATEMENT_LINES = ${JSON.stringify(allLines, null, 2)} as const;
export const NU_STATEMENT_FULL_TEXT = ${JSON.stringify(allLines.join('\n'))} as const;
`
    fs.writeFileSync(path.resolve('src/lib/nuStatementDump.ts'), dumpContent, 'utf8')
    expect(allLines.length).toBeGreaterThan(0)
  })
})
