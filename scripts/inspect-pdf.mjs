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

inspect().catch(console.error)
