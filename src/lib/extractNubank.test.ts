import { describe, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

describe('extract text from real pdf using pdfjs and inspect', () => {
  it('extracts all lines and inspects them', async () => {
    const pdfPath = path.resolve('src/assets/nubank2026-10-07-f4eba.pdf')
    const buffer = fs.readFileSync(pdfPath)
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise

    const lines: string[] = []
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
          lines.push(lineText.trim())
        }
      }
    }

    // Gravar em arquivo TS importável no projeto
    const fileContent = `// Auto-generated inspection of real Nubank PDF
export const NUBANK_REAL_PDF_LINES = ${JSON.stringify(lines, null, 2)} as const;
export const NUBANK_REAL_PDF_TEXT = ${JSON.stringify(lines.join('\n'))} as const;
`
    fs.writeFileSync(path.resolve('src/lib/nubankRealPdfDump.ts'), fileContent, 'utf8')
  })
})
