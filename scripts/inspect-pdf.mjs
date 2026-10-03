import fs from 'node:fs'
import path from 'node:path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

async function inspect() {
  const filePath = path.resolve('src/assets/nubank2026-10-07-f4eba.pdf')
  console.log('Exists?', fs.existsSync(filePath), 'size:', fs.statSync(filePath).size)

  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise

  console.log('Total pages:', doc.numPages)
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    console.log(`\n--- PAGE ${i} (items count: ${content.items.length}) ---`)
    const items = content.items.map((it) => {
      const transform = it.transform || []
      return {
        str: it.str,
        x: Math.round(transform[4] || 0),
        y: Math.round(transform[5] || 0),
      }
    })
    console.log('First 40 items:', JSON.stringify(items.slice(0, 40), null, 2))
  }
}

async function main() {
  const filePath = path.resolve('src/assets/nubank2026-10-07-f4eba.pdf')
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise

  const allLines = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const textContent = await page.getTextContent()
    const items = textContent.items

    const lineBuckets = new Map()
    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue
      const x = item.transform ? item.transform[4] : 0
      const y = item.transform ? Math.round(item.transform[5] * 2) / 2 : 0

      let matchedY = null
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
      lineBuckets.get(targetY).push({ x, text: item.str })
    }

    const sortedYKeys = Array.from(lineBuckets.keys()).sort((a, b) => b - a)
    for (const y of sortedYKeys) {
      const rowItems = lineBuckets.get(y)
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

  const outPath = path.resolve('src/lib/nubank_extracted_text.json')
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        totalPages: doc.numPages,
        totalLines: allLines.length,
        lines: allLines,
      },
      null,
      2,
    ),
  )
}
main().catch(console.error)
