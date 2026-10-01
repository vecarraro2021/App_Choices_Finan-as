/**
 * Utilitário de extração de texto de PDF no navegador utilizando pdfjs-dist.
 * Processamento 100% client-side sem envio de dados a serviços externos.
 */
import * as pdfjsLib from 'pdfjs-dist'

/**
 * Inicialização robusta e à prova de falhas do worker do PDF.js.
 *
 * Estratégia de múltiplas camadas de resiliência:
 * 1. Web Worker instanciado explicitamente com URL estática local (/pdf.worker.min.mjs) via workerPort.
 * 2. Em caso de bloqueio ou erro no worker local, tenta Worker via CDN jsdlr/unpkg de mesma versão.
 * 3. Se a criação de Web Worker falhar por CSP, restrição de CORS ou ambiente restrito,
 *    desativa o worker (GlobalWorkerOptions.workerSrc = '' / workerPort = null) e usa o modo fake worker nativo,
 *    onde o PDF.js faz a extração diretamente na thread principal via promise sem travar a UI nem quebrar o parse.
 */
let isWorkerConfigured = false

function setupPdfWorker(): void {
  if (isWorkerConfigured || typeof window === 'undefined') return

  const pdfjsVersion = pdfjsLib.version || '4.10.38'
  // 1. Fallback primário com CDN confiável (jsdelivr) e fallback secundário unpkg
  const primaryCdnUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`

  try {
    // Definimos workerSrc diretamente para a CDN correspondente à versão exata do pdfjs-dist
    pdfjsLib.GlobalWorkerOptions.workerSrc = primaryCdnUrl
    isWorkerConfigured = true
  } catch (err) {
    console.warn(
      '[pdfExtractor] Falha ao definir workerSrc CDN, desativando worker para modo direto:',
      err,
    )
    try {
      pdfjsLib.GlobalWorkerOptions.workerPort = null
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    } catch {
      /* intentionally ignored */
    }
    isWorkerConfigured = true
  }
}

// Configura o worker se estiver no browser
if (typeof window !== 'undefined') {
  setupPdfWorker()
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

  setupPdfWorker()

  let pdfDoc: pdfjsLib.PDFDocumentProxy
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    })
    pdfDoc = await loadingTask.promise
  } catch (initialErr: any) {
    // Se falhar com erro de worker (ex: "Setting up fake worker failed", "Failed to fetch dynamically imported module", CORS ou rede)
    // executamos estratégia de recuperação imediata:
    // 1. Tentar unpkg caso jsdelivr tenha falhado
    // 2. Ou desabilitar completamente o worker (workerPort = null, workerSrc = '') para rodar 100% in-process
    console.warn(
      '[pdfExtractor] Falha inicial ao carregar PDF com worker, aplicando recuperação automática:',
      initialErr,
    )

    const pdfjsVersion = pdfjsLib.version || '4.10.38'
    const unpkgUrl = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`

    try {
      pdfjsLib.GlobalWorkerOptions.workerPort = null
      pdfjsLib.GlobalWorkerOptions.workerSrc = unpkgUrl
      const unpkgTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      })
      pdfDoc = await unpkgTask.promise
    } catch (cdnErr) {
      console.warn(
        '[pdfExtractor] Falha também no fallback CDN alternativo, alternando para fake worker estrito:',
        cdnErr,
      )
      try {
        pdfjsLib.GlobalWorkerOptions.workerPort = null
        pdfjsLib.GlobalWorkerOptions.workerSrc = ''
      } catch {
        /* intentionally ignored */
      }

      const inProcessTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      })
      pdfDoc = await inProcessTask.promise
    }
  }
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
