/**
 * Utilitário de extração de texto de PDF no navegador utilizando pdfjs-dist.
 * Processamento 100% client-side sem envio de dados a serviços externos.
 */
import * as pdfjsLib from 'pdfjs-dist'

// Configuração do worker do pdf.js
// O worker do pdfjs-dist pode ser carregado via URL do pacote ou unpkg com fallback
if (typeof window !== 'undefined') {
  try {
    // Tenta carregar o worker local empacotado via Vite
    const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  } catch {
    // Fallback para CDN oficial do unpkg correspondente à versão do pdfjs-dist
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  }
}

export interface PDFPageText {
  pageNumber: number
  text: string
  lines: string[]
}

export interface ExtractedPDF {
  totalPages: number
  fullText: string
  pages: PDFPageText[]
}

/**
 * Extrai texto e linhas estruturadas de um arquivo PDF carregado pelo usuário.
 */
export async function extractTextFromPDF(file: File | ArrayBuffer): Promise<ExtractedPDF> {
  let arrayBuffer: ArrayBuffer
  if (file instanceof File) {
    arrayBuffer = await file.arrayBuffer()
  } else {
    arrayBuffer = file
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  })

  const pdfDoc = await loadingTask.promise
  const totalPages = pdfDoc.numPages
  const pages: PDFPageText[] = []
  let fullText = ''

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const textContent = await page.getTextContent()

    // Agrupar itens de texto por coordenada Y (linhas de texto reais no documento)
    // para preservar a ordem visual das colunas e quebras de linha
    const items = textContent.items as Array<{
      str: string
      transform: number[]
      hasEOL?: boolean
      width?: number
      height?: number
    }>

    // Agrupar por coordenada Y aproximada (arredondando para tolerar variações de fonte)
    const lineBuckets = new Map<number, Array<{ x: number; text: string }>>()

    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue

      // transform[4] é X, transform[5] é Y
      const x = item.transform ? item.transform[4] : 0
      const y = item.transform ? Math.round(item.transform[5] * 2) / 2 : 0

      // Procura bucket próximo (dentro de 3pt de diferença)
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

    // Ordenar linhas de cima para baixo (no PDF, Y maior fica no topo)
    const sortedYKeys = Array.from(lineBuckets.keys()).sort((a, b) => b - a)

    const pageLines: string[] = []
    for (const y of sortedYKeys) {
      // Ordenar itens da linha da esquerda para a direita (X crescente)
      const rowItems = lineBuckets.get(y)!
      rowItems.sort((a, b) => a.x - b.x)

      // Juntar com espaço se necessário
      let lineText = ''
      for (let i = 0; i < rowItems.length; i++) {
        const item = rowItems[i]
        if (i === 0) {
          lineText = item.text
        } else {
          // Adiciona espaço se o anterior não terminar com espaço e o atual não começar com espaço
          const prev = rowItems[i - 1].text
          if (prev.endsWith(' ') || item.text.startsWith(' ')) {
            lineText += item.text
          } else {
            lineText += ' ' + item.text
          }
        }
      }

      const trimmed = lineText.trim()
      if (trimmed) {
        pageLines.push(trimmed)
      }
    }

    // Se o agrupamento por Y não capturou linhas (PDFs com estrutura exótica), fallback para ordem sequencial
    if (pageLines.length === 0 && items.length > 0) {
      const fallbackStr = items.map((it) => it.str).join(' ')
      const split = fallbackStr
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      if (split.length > 0) {
        pageLines.push(...split)
      } else if (fallbackStr.trim()) {
        pageLines.push(fallbackStr.trim())
      }
    }

    const pageFullText = pageLines.join('\n')
    pages.push({
      pageNumber: pageNum,
      text: pageFullText,
      lines: pageLines,
    })

    fullText += (fullText ? '\n' : '') + pageFullText
  }

  return {
    totalPages,
    fullText,
    pages,
  }
}
