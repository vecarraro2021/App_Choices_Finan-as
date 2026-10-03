import { describe, it, expect } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parsePDFStatement } from './pdfStatementParser'

describe('inspect real pdf', () => {
  it('extracts real Nubank PDF lines and tests parser', async () => {
    console.log('--- START REAL NUBANK TEST ---')
    const filePath = path.resolve('src/assets/nu76223058401set202630set2026-b97da.pdf')
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

    // Save lines and text to inspect
    fs.writeFileSync(
      path.resolve('src/lib/nubank_dump.json'),
      JSON.stringify(
        {
          totalLines: allLines.length,
          parseCount: parseResult.transactions.length,
          allLines: allLines,
        },
        null,
        2,
      ),
    )

    expect(allLines.length).toBeGreaterThan(0)
  })

  it('fetches real backend markdown for nu statement and tests parser against it', async () => {
    const pdfPath = path.resolve('src/assets/nu76223058401set202630set2026-b97da.pdf')
    expect(fs.existsSync(pdfPath)).toBe(true)
    const fileBuf = fs.readFileSync(pdfPath)

    // Send to backend endpoint
    const baseUrl = 'https://gestao-financeira-pessoal-fbcab.shrd00.internal.goskip.dev'
    const formData = new FormData()
    const blob = new Blob([fileBuf], { type: 'application/pdf' })
    formData.append('arquivo', blob, 'NU_762230584_01SET2026_30SET2026.pdf')

    const res = await fetch(`${baseUrl}/backend/v1/documentos/dump-markdown`, {
      method: 'POST',
      body: formData,
    })

    console.log('Status from dump-markdown:', res.status)
    expect(res.ok).toBe(true)
    const data = await res.json()
    const md = data.markdown as string
    console.log('Markdown length:', md.length)

    // Save real backend markdown to disk so we can inspect and use it in tests
    fs.writeFileSync(path.resolve('src/lib/nu_backend_markdown_dump.md'), md)

    const lines = md
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    console.log('Total non-empty lines from backend:', lines.length)
    console.log('First 25 lines from backend:\n', lines.slice(0, 25))

    const parseResult = parsePDFStatement(lines, md)
    const debits = parseResult.transactions.filter((tx) => tx.type === 'debit')
    const credits = parseResult.transactions.filter((tx) => tx.type === 'credit')
    const sumDebits = debits.reduce((acc, tx) => acc + tx.amount, 0)
    const sumCredits = credits.reduce((acc, tx) => acc + tx.amount, 0)

    throw new Error(
      `BACKEND_EVAL: unrec=${JSON.stringify(parseResult.unrecognizedLines)}`,
    )
  })
})
