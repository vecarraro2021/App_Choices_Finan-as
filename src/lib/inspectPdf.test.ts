import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parsePDFStatement } from './pdfStatementParser'

describe('inspect real pdf', () => {
  it('dump real pdf content', async () => {
    const filePath = path.resolve('src/assets/nubank2026-10-07-f4eba.pdf')
    const fileBuf = fs.readFileSync(filePath)
    const data = new Uint8Array(fileBuf)
    const doc = await pdfjsLib.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise

    expect(doc.numPages).toBeGreaterThan(0)
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
          allLines.push(lineText.trim())
        }
      }
    }

    const fullText = allLines.join('\n')
    const parseResult = parsePDFStatement(allLines, fullText)

    // Save lines and text to inspect in tests
    fs.writeFileSync(
      path.resolve('src/lib/nubank_dump.json'),
      JSON.stringify(
        {
          totalLines: allLines.length,
          lines: allLines,
          parseCount: parseResult.transactions.length,
          parseTransactions: parseResult.transactions,
        },
        null,
        2,
      ),
    )

    expect(allLines.length).toBe(0) // intentionally fail to see parseCount and sample lines
  })
})
